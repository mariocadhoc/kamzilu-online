#!/usr/bin/env python3
"""
Kamzilu Link Auditor

Revisa enlaces internos y externos en un sitio estático.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen


USER_AGENT = "KamziluLinkAuditor/1.0"


@dataclass(frozen=True)
class LinkRecord:
    source_file: Path
    relative_source: str
    line: int
    tag: str
    attr: str
    link: str


class LinkExtractor(HTMLParser):
    """Extrae enlaces relevantes junto con el número de línea."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.records: List[Tuple[int, str, str, str]] = []

    def handle_starttag(self, tag: str, attrs: Sequence[Tuple[str, Optional[str]]]) -> None:
        attr_name = None
        if tag == "a":
            attr_name = "href"
        elif tag in {"img", "script"}:
            attr_name = "src"
        elif tag == "link":
            attr_name = "href"

        if not attr_name:
            return

        value = None
        for key, attr_value in attrs:
            if key.lower() == attr_name:
                value = attr_value
                break

        if value is None:
            return

        line, _ = self.getpos()
        self.records.append((line, tag, attr_name, value.strip()))


def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audita enlaces internos y externos de un sitio estático.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Ejemplos:\n"
            "  python audit_links.py --root ../sitio\n"
            "  python audit_links.py --ignore \"/sandbox;/backend\" --timeout 10\n"
            "  python audit_links.py --check-sitemap sitemap.xml --report reports/audit.csv\n"
        ),
    )

    parser.add_argument("--root", type=str, default=".", help="Ruta raíz del proyecto (default: directorio actual).")
    parser.add_argument("--concurrency", type=int, default=20, help="Número de hilos para validación (default: 20).")
    parser.add_argument("--timeout", type=int, default=8, help="Timeout por solicitud externa en segundos (default: 8).")
    parser.add_argument("--retries", type=int, default=1, help="Número de reintentos para enlaces externos (default: 1).")
    parser.add_argument("--ignore", type=str, default="", help="Patrones a ignorar (separados por ';').")
    parser.add_argument(
        "--report",
        type=str,
        default=None,
        help="Ruta del CSV de salida (default: reports/link_audit_TIMESTAMP.csv).",
    )
    parser.add_argument(
        "--check-sitemap",
        dest="check_sitemap",
        type=str,
        default=None,
        help="Ruta al sitemap.xml a validar (opcional).",
    )

    return parser.parse_args(argv)


def normalize_ignore_patterns(patterns: str) -> List[str]:
    if not patterns:
        return []
    return [p.strip() for p in patterns.split(";") if p.strip()]


def is_ignored(path: Path, ignore_patterns: Sequence[str]) -> bool:
    if not ignore_patterns:
        return False
    path_str = str(path.as_posix())
    return any(pattern in path_str for pattern in ignore_patterns)


def find_html_files(root: Path, ignore_patterns: Sequence[str]) -> List[Path]:
    html_files: List[Path] = []
    for path in root.rglob("*.html"):
        if path.is_file() and not is_ignored(path, ignore_patterns):
            html_files.append(path)
    return html_files


def extract_links_from_html(path: Path) -> List[Tuple[int, str, str, str]]:
    extractor = LinkExtractor()
    try:
        content = path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:  # pragma: no cover - lectura defensiva
        print(f"[WARN] No se pudo leer {path}: {exc}", file=sys.stderr)
        return []

    try:
        extractor.feed(content)
    except Exception as exc:  # pragma: no cover - parser robusto
        print(f"[WARN] Error parseando {path}: {exc}", file=sys.stderr)
    finally:
        extractor.close()
    return extractor.records


def _is_relative_to(path: Path, other: Path) -> bool:
    try:
        path.relative_to(other)
        return True
    except ValueError:
        return False


def resolve_internal_link(root: Path, source_file: Path, link: str) -> Tuple[Optional[Path], str]:
    """Devuelve el path destino y una nota adicional."""
    parts = urlsplit(link)
    if parts.scheme or parts.netloc:
        return None, "Enlace externo"

    # Ruta normalizada sin query/fragmento
    clean_path = parts.path or ""
    note = ""

    if clean_path.startswith("/"):
        candidate = (root / clean_path.lstrip("/")).resolve()
    else:
        candidate = (source_file.parent / clean_path).resolve()

    if not _is_relative_to(candidate, root):
        return None, "Fuera del root"

    # Si el path apunta a un archivo directo existente
    if candidate.is_file():
        return candidate, note

    # Si apunta a un directorio o termina con '/' probamos index.html
    if candidate.is_dir():
        index_candidate = candidate / "index.html"
        if index_candidate.is_file():
            return index_candidate, "Resuelto a index.html"

    # Si no existe y no tiene extensión, intentamos ".html"
    if not candidate.exists() and candidate.suffix == "":
        html_candidate = candidate.with_suffix(".html")
        if html_candidate.is_file():
            return html_candidate, "Resuelto con .html"
        # Intentamos directorio/index.html
        dir_candidate = candidate
        if dir_candidate.is_dir():
            index_candidate = dir_candidate / "index.html"
            if index_candidate.is_file():
                return index_candidate, "Resuelto a index.html"
        else:
            dir_candidate = Path(str(candidate))
            if dir_candidate.is_dir():
                index_candidate = dir_candidate / "index.html"
                if index_candidate.is_file():
                    return index_candidate, "Resuelto a index.html"

    # Si la ruta está vacía (por ejemplo "?param")
    if clean_path == "":
        return source_file.resolve(), "Misma página"

    return None, "Destino inexistente"


def check_internal(path: Optional[Path]) -> Tuple[str, str]:
    if path is None:
        return "BROKEN", "No se pudo resolver el destino interno"

    if path.is_file():
        return "OK", ""

    if path.is_dir():
        index_file = path / "index.html"
        if index_file.is_file():
            return "OK", "Directorio con index.html"
        return "BROKEN", "Directorio sin index.html"

    return "BROKEN", "Archivo interno no encontrado"


def _attempt_request(url: str, timeout: int, method: str) -> Tuple[int, str]:
    request = Request(url, method=method, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:
        status = response.getcode()
        # Consumimos mínimamente el cuerpo para cerrar conexión
        if method == "GET":
            try:
                response.read(1)
            except Exception:
                pass
        return status, ""


def check_external(url: str, timeout: int, retries: int) -> Tuple[str, Optional[int], str, float]:
    attempts = retries + 1
    last_note = ""
    last_code: Optional[int] = None
    elapsed_total = 0.0

    for attempt in range(attempts):
        start = time.perf_counter()
        try:
            status, note = _attempt_request(url, timeout, "HEAD")
            elapsed = time.perf_counter() - start
            elapsed_total = max(elapsed_total, elapsed)

            if status and status < 400:
                return "OK", status, note, elapsed_total

            if status in {403, 405, 429}:
                # Intentamos GET liviano
                start_get = time.perf_counter()
                status, note = _attempt_request(url, timeout, "GET")
                elapsed = time.perf_counter() - start_get
                elapsed_total = max(elapsed_total, elapsed)
                if status < 400:
                    return "OK", status, "Validado con GET", elapsed_total

            last_code = status
            last_note = f"HTTP {status}"
        except HTTPError as http_err:
            elapsed = time.perf_counter() - start
            elapsed_total = max(elapsed_total, elapsed)
            last_code = http_err.code
            if http_err.code < 400:
                return "OK", http_err.code, "", elapsed_total
            last_note = f"HTTPError {http_err.code}"
        except URLError as url_err:
            elapsed = time.perf_counter() - start
            elapsed_total = max(elapsed_total, elapsed)
            last_note = f"URLError: {url_err.reason}"
        except Exception as exc:
            elapsed = time.perf_counter() - start
            elapsed_total = max(elapsed_total, elapsed)
            last_note = f"Error: {exc}"

        if attempt < attempts - 1:
            backoff = attempt + 1
            time.sleep(backoff)

    return "BROKEN", last_code, last_note or "Error desconocido", elapsed_total


def classify_link(link: str) -> str:
    parts = urlsplit(link)
    if parts.scheme in {"http", "https"}:
        return "external"
    if parts.scheme:
        return "skipped"
    if parts.netloc:
        return "external"
    return "internal"


def should_skip_link(link: str) -> Optional[str]:
    if not link or link.strip() == "":
        return "Enlace vacío"
    normalized = link.strip()
    if normalized == "#":
        return "Ancla vacía"
    if normalized.startswith("#"):
        return "Ancla interna"
    lower = normalized.lower()
    for scheme in ("mailto:", "tel:", "javascript:", "data:", "blob:"):
        if lower.startswith(scheme):
            return f"Esquema {scheme} ignorado"
    return None


def process_record(
    record: LinkRecord,
    root: Path,
    timeout: int,
    retries: int,
) -> Tuple[str, Optional[int], str, str, float]:
    link = record.link
    classification = classify_link(link)

    if classification == "external":
        status, http_code, note, elapsed = check_external(link, timeout, retries)
        return status, http_code, note, "external", elapsed

    if classification == "skipped":
        return "SKIPPED", None, "Esquema no soportado", "skipped", 0.0

    resolved, resolution_note = resolve_internal_link(root, record.source_file, link)
    status, note = check_internal(resolved)
    combined_note = resolution_note or note
    return status, None, combined_note or note, "internal", 0.0


def write_csv(rows: List[Dict[str, str]], report_path: Path) -> None:
    report_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "source_file",
        "line",
        "tag",
        "attr",
        "link",
        "link_type",
        "status",
        "http_code",
        "note",
    ]
    with report_path.open("w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def summarize(results: List[Dict[str, str]], timeout: int, slow_externals: Set[str]) -> None:
    total = len(results)
    ok = sum(1 for row in results if row["status"] == "OK")
    broken = sum(1 for row in results if row["status"] == "BROKEN")
    skipped = sum(1 for row in results if row["status"] == "SKIPPED")

    print("\nResumen de auditoría")
    print("--------------------")
    print(f"Total enlaces analizados : {total}")
    print(f"OK                      : {ok}")
    print(f"BROKEN                  : {broken}")
    print(f"SKIPPED                 : {skipped}")
    print(f"Externos lentos (> {timeout/2:.1f}s): {len(slow_externals)}")

    if slow_externals:
        for url in sorted(slow_externals):
            print(f"  - {url}")


def parse_sitemap(sitemap_path: Path) -> List[str]:
    try:
        import xml.etree.ElementTree as ET
    except ImportError:
        print("[WARN] xml.etree.ElementTree no disponible; se omite sitemap.", file=sys.stderr)
        return []

    try:
        tree = ET.parse(str(sitemap_path))
    except Exception as exc:
        print(f"[WARN] No se pudo analizar el sitemap {sitemap_path}: {exc}", file=sys.stderr)
        return []

    urls: List[str] = []
    for loc in tree.findall(".//{*}loc"):
        if loc.text:
            urls.append(loc.text.strip())
    return urls


def resolve_sitemap_url(
    root: Path, base_url: str, url: str
) -> Tuple[str, str, Optional[Path], str]:
    """Intentamos mapear una URL de sitemap a un archivo local."""
    if url.startswith(base_url):
        relative = url[len(base_url) :].lstrip("/")
    else:
        # Si la URL absoluta no comparte prefijo, devolvemos como externo
        return url, "external", None, "URL fuera del dominio base"

    if not relative:
        relative = "index.html"

    candidate = (root / relative).resolve()

    if candidate.is_file():
        return url, "internal", candidate, ""

    # Intentamos directorio/index.html
    dir_candidate = (root / relative).resolve()
    if dir_candidate.is_dir():
        index_candidate = dir_candidate / "index.html"
        if index_candidate.is_file():
            return url, "internal", index_candidate, "Resuelto a index.html"

    # Intentamos agregar index.html si termina en '/'
    if relative.endswith("/"):
        index_candidate = (root / relative.strip("/")) / "index.html"
        if index_candidate.is_file():
            return url, "internal", index_candidate, "Resuelto a index.html"

    return url, "internal", None, "No se encontró archivo local"


def main(argv: Optional[Sequence[str]] = None) -> None:
    args = parse_args(argv)
    root = Path(args.root).resolve()

    if not root.exists() or not root.is_dir():
        print(f"[ERROR] La ruta raíz {root} no existe o no es un directorio.", file=sys.stderr)
        sys.exit(2)

    ignore_patterns = normalize_ignore_patterns(args.ignore)

    report_path = (
        Path(args.report)
        if args.report
        else Path("reports") / f"link_audit_{dt.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    )

    html_files = find_html_files(root, ignore_patterns)
    print(f"Analizando {len(html_files)} archivos HTML en {root}")

    all_records: List[LinkRecord] = []
    seen: Set[Tuple[str, int, str]] = set()

    for html_file in html_files:
        relative_source = str(html_file.relative_to(root))
        extracted = extract_links_from_html(html_file)
        for line, tag, attr, link in extracted:
            key = (relative_source, line, link)
            if key in seen:
                continue
            seen.add(key)
            all_records.append(
                LinkRecord(
                    source_file=html_file,
                    relative_source=relative_source,
                    line=line,
                    tag=tag,
                    attr=attr,
                    link=link,
                )
            )

    print(f"Total de enlaces encontrados (sin duplicados exactos): {len(all_records)}")

    results: List[Dict[str, str]] = []
    tasks: List[LinkRecord] = []

    for record in all_records:
        skip_reason = should_skip_link(record.link)
        if skip_reason:
            results.append(
                {
                    "source_file": record.relative_source,
                    "line": str(record.line),
                    "tag": record.tag,
                    "attr": record.attr,
                    "link": record.link,
                    "link_type": "skipped",
                    "status": "SKIPPED",
                    "http_code": "",
                    "note": skip_reason,
                }
            )
            continue
        tasks.append(record)

    slow_external_links: Set[str] = set()

    # Procesamos internos y externos con concurrencia
    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as executor:
        future_map = {
            executor.submit(process_record, record, root, args.timeout, args.retries): record
            for record in tasks
        }
        for future in as_completed(future_map):
            record = future_map[future]
            try:
                status, http_code, note, classification, elapsed = future.result()
            except Exception as exc:
                status, http_code, note, classification, elapsed = (
                    "BROKEN",
                    None,
                    f"Error inesperado: {exc}",
                    "internal",
                    0.0,
                )

            if (
                classification == "external"
                and status != "SKIPPED"
                and elapsed > max(0.0, args.timeout / 2)
            ):
                slow_external_links.add(record.link)

            results.append(
                {
                    "source_file": record.relative_source,
                    "line": str(record.line),
                    "tag": record.tag,
                    "attr": record.attr,
                    "link": record.link,
                    "link_type": classification,
                    "status": status,
                    "http_code": str(http_code) if http_code is not None else "",
                    "note": note,
                }
            )

    # Sitemap opcional
    if args.check_sitemap:
        sitemap_path = Path(args.check_sitemap)
        if not sitemap_path.is_absolute():
            sitemap_path = (root / sitemap_path).resolve()
        if sitemap_path.exists():
            print(f"Validando sitemap: {sitemap_path}")
            sitemap_urls = parse_sitemap(sitemap_path)
            print(f" - URLs en sitemap: {len(sitemap_urls)}")

            base_url = ""
            # Intentamos inferir el dominio base de la primera URL http(s)
            for url in sitemap_urls:
                parts = urlsplit(url)
                if parts.scheme in {"http", "https"} and parts.netloc:
                    base_url = urlunsplit((parts.scheme, parts.netloc, "", "", ""))
                    break

            for url in sitemap_urls:
                resolved_url, classification, candidate, note = resolve_sitemap_url(root, base_url, url)
                if classification == "external":
                    status = "SKIPPED"
                    http_code = ""
                    final_note = note
                else:
                    status, note_internal = check_internal(candidate)
                    http_code = ""
                    final_note = note or note_internal

                results.append(
                    {
                        "source_file": str(sitemap_path.relative_to(root) if _is_relative_to(sitemap_path, root) else sitemap_path),
                        "line": "0",
                        "tag": "sitemap",
                        "attr": "loc",
                        "link": resolved_url,
                        "link_type": classification,
                        "status": status,
                        "http_code": http_code,
                        "note": final_note,
                    }
                )
        else:
            print(f"[WARN] El sitemap {sitemap_path} no existe.")

    # Ordenamos resultados por archivo y línea para una lectura más cómoda
    results.sort(key=lambda row: (row["source_file"], int(row["line"]), row["link"]))

    write_csv(results, report_path)
    print(f"Reporte generado en {report_path}")

    broken_present = any(row["status"] == "BROKEN" for row in results)

    summarize(results, args.timeout, slow_external_links)

    sys.exit(1 if broken_present else 0)


if __name__ == "__main__":
    main()
