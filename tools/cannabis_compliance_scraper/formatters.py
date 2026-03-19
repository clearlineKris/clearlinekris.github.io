"""
formatters.py
=============
Output formatters for RegulatoryItem results.

Supported formats
-----------------
json        — Pretty-printed JSON array
csv         — RFC-4180 CSV with header row
markdown    — Markdown table grouped by state
"""

from __future__ import annotations

import csv
import io
import json
from typing import List

from .scraper import RegulatoryItem

# ---------------------------------------------------------------------------
# JSON
# ---------------------------------------------------------------------------

def to_json(items: List[RegulatoryItem], indent: int = 2) -> str:
    """Serialize items to a JSON string."""
    return json.dumps([item.to_dict() for item in items], indent=indent, ensure_ascii=False)


# ---------------------------------------------------------------------------
# CSV
# ---------------------------------------------------------------------------

FIELDNAMES = [
    "state",
    "agency",
    "title",
    "url",
    "published_date",
    "category",
    "summary",
    "scraped_at",
]


def _sanitize_csv_value(value):
    """
    Neutralize potentially dangerous leading characters in string values to
    mitigate CSV formula injection when opened in spreadsheet software.
    """
    if isinstance(value, str) and value and value[0] in ("=", "+", "-", "@"):
        return "'" + value
    return value


def _sanitize_csv_row(row: dict) -> dict:
    """Return a copy of *row* with all values sanitized for CSV output."""
    return {key: _sanitize_csv_value(value) for key, value in row.items()}


def to_csv(items: List[RegulatoryItem]) -> str:
    """Serialize items to a CSV string."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=FIELDNAMES, extrasaction="ignore")
    writer.writeheader()
    for item in items:
        row = item.to_dict()
        writer.writerow(_sanitize_csv_row(row))
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

_MD_HEADER = "| State | Agency | Title | Date | Category | URL |\n|---|---|---|---|---|---|\n"


def _md_row(item: RegulatoryItem) -> str:
    def esc(s: str | None) -> str:
        """
        Escape Markdown-significant characters for safe use in table cells.

        - Normalizes newlines to spaces to keep each cell on one line.
        - Escapes characters that can interfere with tables/links.
        """
        if not s:
            return ""

        # Normalize newlines so table rows remain single-line.
        s = s.replace("\r\n", " ").replace("\r", " ").replace("\n", " ")

        # Escape Markdown-significant characters that can break tables/links.
        for ch in ("|", "[", "]", "(", ")", "*", "_", "`"):
            s = s.replace(ch, "\\" + ch)

        return s

    title_cell = (
        f"[{esc(item.title)}]({item.url})" if item.url else esc(item.title)
    )
    return (
        f"| {esc(item.state)} "
        f"| {esc(item.agency)} "
        f"| {title_cell} "
        f"| {esc(item.published_date)} "
        f"| {esc(item.category)} "
        f"| {esc(item.url)} |\n"
    )


def to_markdown(items: List[RegulatoryItem]) -> str:
    """Serialize items to a Markdown document grouped by state."""
    if not items:
        return "_No regulatory updates found._\n"

    # Group by state
    grouped: dict[str, List[RegulatoryItem]] = {}
    for item in items:
        grouped.setdefault(item.state, []).append(item)

    lines: List[str] = ["# Cannabis Regulatory Updates\n\n"]
    for state in sorted(grouped.keys()):
        state_items = grouped[state]
        agency = state_items[0].agency
        lines.append(f"## {state} — {agency}\n\n")
        lines.append(_MD_HEADER)
        for item in state_items:
            lines.append(_md_row(item))
        lines.append("\n")

    return "".join(lines)


# ---------------------------------------------------------------------------
# Dispatch helper
# ---------------------------------------------------------------------------

def format_results(items: List[RegulatoryItem], fmt: str) -> str:
    """
    Format *items* in the requested format.

    Parameters
    ----------
    items : list of RegulatoryItem
    fmt   : "json" | "csv" | "markdown"

    Returns
    -------
    str
    """
    fmt = fmt.lower().strip()
    if fmt == "json":
        return to_json(items)
    if fmt == "csv":
        return to_csv(items)
    if fmt in ("markdown", "md"):
        return to_markdown(items)
    raise ValueError(f"Unsupported format: {fmt!r}. Choose json, csv, or markdown.")
