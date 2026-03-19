# cannabis_compliance_scraper

> **ClearLine Engine Room — Regulatory Intelligence Tool**
> Scrapes state cannabis agency websites for compliance updates, bulletins, and rule changes.

---

## Overview

`cannabis_compliance_scraper` is a Python package that pulls regulatory updates
from official state agency websites across all twelve states in ClearLine's
Intelligence Rollout (IR) scope:

| Code | State       | Agency                                          |
|------|-------------|-------------------------------------------------|
| CA   | California  | Department of Cannabis Control (DCC)            |
| CO   | Colorado    | Marijuana Enforcement Division (MED)            |
| FL   | Florida     | Office of Medical Marijuana Use (OMMU)          |
| MI   | Michigan    | Cannabis Regulatory Agency (CRA)                |
| MN   | Minnesota   | Office of Cannabis Management (OCM)             |
| MO   | Missouri    | DHSS Cannabis Program                           |
| NE   | Nebraska    | DHHS Medical Cannabis Program                   |
| NY   | New York    | Office of Cannabis Management (OCM)             |
| OH   | Ohio        | Division of Cannabis Control (DCC)              |
| OK   | Oklahoma    | Medical Marijuana Authority (OMMA)              |
| PA   | Pennsylvania| Department of Health — Medical Cannabis         |
| TX   | Texas       | DSHS Compassionate Use Program (CUP)            |

---

## Installation

```bash
# From the tools/cannabis_compliance_scraper directory
pip install -r requirements.txt
```

Dependencies: `requests`, `beautifulsoup4`, `lxml`

---

## Usage

### Command line

```bash
# From the tools/cannabis_compliance_scraper directory:
# Scrape all states, JSON output to stdout
python -m cannabis_compliance_scraper

# Scrape CO and CA only
python -m cannabis_compliance_scraper --states CO CA

# Markdown output saved to a file
python -m cannabis_compliance_scraper --states CO MN NY --format markdown --output updates.md

# CSV with verbose logging
python -m cannabis_compliance_scraper --format csv --log debug --output results.csv

# Alternatively, from the repo root:
# PYTHONPATH=tools python -m cannabis_compliance_scraper --states CO CA
```

### Python API

```python
from cannabis_compliance_scraper.scraper import run_scrapers
from cannabis_compliance_scraper.formatters import format_results

# All states
items = run_scrapers()

# Specific states
items = run_scrapers(["CO", "CA", "NY"])

# Format output
print(format_results(items, "markdown"))
print(format_results(items, "json"))
print(format_results(items, "csv"))
```

### Custom single-state scraper

```python
from cannabis_compliance_scraper.scraper import ColoradoScraper

scraper = ColoradoScraper()
updates = scraper.fetch_updates()

for item in updates:
    print(item.title, item.url, item.published_date)
```

---

## Output formats

| Format     | Description                                   |
|------------|-----------------------------------------------|
| `json`     | JSON array of objects (default)               |
| `csv`      | RFC-4180 CSV with header row                  |
| `markdown` | Markdown table grouped by state               |

### RegulatoryItem fields

| Field           | Description                                      |
|-----------------|--------------------------------------------------|
| `state`         | Two-letter state code                            |
| `agency`        | Full agency name                                 |
| `title`         | Title / headline of the update                   |
| `url`           | Direct URL to the update                         |
| `published_date`| Date string as found on the page (if available)  |
| `category`      | e.g. bulletin, press release, regulatory notice  |
| `summary`       | Brief excerpt (if extracted)                     |
| `scraped_at`    | UTC ISO-8601 timestamp of the scrape run         |

---

## Architecture

```
cannabis_compliance_scraper/
├── __init__.py        Package metadata
├── __main__.py        python -m entry point
├── cli.py             argparse CLI (main())
├── scraper.py         BaseScraper + 12 state scrapers + run_scrapers()
├── formatters.py      to_json / to_csv / to_markdown + format_results()
├── requirements.txt   Runtime dependencies
└── README.md          This file
```

### Adding a new state

1. Add a new class in `scraper.py` that extends `BaseScraper`.
2. Set `state`, `agency`, `base_url`, and override `fetch_updates()`.
3. Register it in the `STATE_SCRAPERS` dict at the bottom of the file.

```python
class NevadaScraper(BaseScraper):
    state = "NV"
    agency = "Nevada Cannabis Compliance Board (CCB)"
    base_url = "https://ccb.nv.gov"

    def fetch_updates(self):
        soup = self._soup(self.base_url + "/news")
        ...
```

---

## Notes

- All HTTP requests include a polite 1.5-second delay between calls.
- The scraper retries once on failure before giving up for a state.
- The `User-Agent` header identifies ClearLine so agencies can identify the bot.
- State agency websites change their markup periodically — selectors may need
  updates. When a scraper returns 0 results, inspect the live page HTML.

---

## Engine Room Integration

This tool is designed to feed data into the ClearLine Engine Room workflow:

```
cannabis_compliance_scraper → RegForge knowledge base ingestion
                           → Penumbrant Papers diff alerts
                           → Reg Bible update triggers
                           → METRC compliance delta reports
```

Run on a schedule (cron, GitHub Actions, Task Scheduler) to surface regulatory
changes before they affect client operations.

---

*Part of the ClearLine compliance intelligence stack — built by Kris Gracia.*
