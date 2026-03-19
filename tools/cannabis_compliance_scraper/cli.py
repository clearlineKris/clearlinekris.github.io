"""
cli.py
======
Command-line interface for cannabis_compliance_scraper.

Usage
-----
python -m cannabis_compliance_scraper [OPTIONS]

Options
-------
  --states   CO MN CA ...   States to scrape (default: all)
  --format   json|csv|markdown|md  Output format (default: json)
  --output   PATH           Write to file instead of stdout
  --log      debug|info|warning   Log verbosity (default: info)

Examples
--------
# Scrape all states, print JSON to stdout
python -m cannabis_compliance_scraper

# Scrape CO and CA only, write Markdown to a file
python -m cannabis_compliance_scraper --states CO CA --format markdown --output updates.md

# Scrape NY, verbose logging, CSV output
python -m cannabis_compliance_scraper --states NY --format csv --log debug
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from .formatters import format_results
from .scraper import STATE_SCRAPERS, run_scrapers


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cannabis_compliance_scraper",
        description=(
            "Scrape state cannabis regulatory agency websites for compliance "
            "updates, bulletins, and rule changes. Part of the ClearLine "
            "Engine Room toolchain."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--states",
        nargs="+",
        metavar="STATE",
        default=None,
        help=(
            "Two-letter state code(s) to scrape. "
            f"Available: {', '.join(sorted(STATE_SCRAPERS))}. "
            "Default: all states."
        ),
    )
    parser.add_argument(
        "--format",
        dest="fmt",
        choices=["json", "csv", "markdown", "md"],
        default="json",
        help="Output format. Default: json.",
    )
    parser.add_argument(
        "--output",
        metavar="PATH",
        default=None,
        help="Write output to this file path. Default: stdout.",
    )
    parser.add_argument(
        "--log",
        choices=["debug", "info", "warning", "error"],
        default="info",
        help="Logging verbosity. Default: info.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=getattr(logging, args.log.upper()),
        format="%(levelname)s  %(name)s  %(message)s",
        stream=sys.stderr,
    )

    # Validate state codes
    if args.states:
        unknown = [s for s in args.states if s.upper() not in STATE_SCRAPERS]
        if unknown:
            parser.error(
                f"Unknown state code(s): {', '.join(unknown)}. "
                f"Available: {', '.join(sorted(STATE_SCRAPERS))}."
            )

    items = run_scrapers(args.states)
    output = format_results(items, args.fmt)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        logging.getLogger(__name__).info("Results written to %s", out_path)
    else:
        print(output)

    return 0


if __name__ == "__main__":
    sys.exit(main())
