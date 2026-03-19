"""
scraper.py
==========
Base scraper class and per-state implementations for cannabis regulatory sources.

Supported states
----------------
CO  — Colorado  Marijuana Enforcement Division (MED)
MN  — Minnesota Office of Cannabis Management (OCM)
PA  — Pennsylvania Department of Health / DOA
NE  — Nebraska DHHS Medical Cannabis Program
NY  — New York Office of Cannabis Management (OCM)
OH  — Ohio Division of Cannabis Control (DCC)
CA  — California Department of Cannabis Control (DCC)
FL  — Florida OMMU / Dept. of Health
OK  — Oklahoma Medical Marijuana Authority (OMMA)
TX  — Texas Dept. of State Health Services (DSHS) — compassionate use
MI  — Michigan Cannabis Regulatory Agency (CRA, fmr. MRA)
MO  — Missouri DHSS Cannabis Program
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class RegulatoryItem:
    """A single scraped regulatory update, bulletin, or rule entry."""

    state: str
    agency: str
    title: str
    url: str
    published_date: Optional[str] = None
    category: Optional[str] = None
    summary: Optional[str] = None
    scraped_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return {
            "state": self.state,
            "agency": self.agency,
            "title": self.title,
            "url": self.url,
            "published_date": self.published_date,
            "category": self.category,
            "summary": self.summary,
            "scraped_at": self.scraped_at,
        }


# ---------------------------------------------------------------------------
# Base scraper
# ---------------------------------------------------------------------------

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; ClearLine-ComplianceScraper/0.1; "
        "+https://clearlinekris.github.io)"
    )
}

REQUEST_TIMEOUT = 20  # seconds
POLITE_DELAY = 1.5    # seconds between requests


class BaseScraper:
    """Shared HTTP fetch + parse helpers."""

    state: str = ""
    agency: str = ""
    base_url: str = ""

    def __init__(self, session: Optional[requests.Session] = None):
        self.session = session or requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def fetch_updates(self) -> List[RegulatoryItem]:
        """Return a list of RegulatoryItem objects for this state."""
        raise NotImplementedError

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get(self, url: str, **kwargs) -> requests.Response:
        """GET with timeout, retry once, and polite delay."""
        for attempt in range(2):
            try:
                resp = self.session.get(url, timeout=REQUEST_TIMEOUT, **kwargs)
                resp.raise_for_status()
                time.sleep(POLITE_DELAY)
                return resp
            except requests.RequestException as exc:
                logger.warning("Attempt %d failed for %s: %s", attempt + 1, url, exc)
                if attempt == 0:
                    time.sleep(3)
                else:
                    raise
        raise RuntimeError(f"Could not fetch {url}")  # should not reach here

    def _soup(self, url: str) -> BeautifulSoup:
        resp = self._get(url)
        return BeautifulSoup(resp.text, "lxml")

    def _abs(self, href: str) -> str:
        """Turn a relative URL into an absolute one."""
        return urljoin(self.base_url, href) if href else ""

    def _text(self, tag) -> str:
        return tag.get_text(separator=" ", strip=True) if tag else ""


# ---------------------------------------------------------------------------
# State scrapers
# ---------------------------------------------------------------------------

class ColoradoScraper(BaseScraper):
    """Colorado MED — med.colorado.gov news/bulletins."""

    state = "CO"
    agency = "Colorado Marijuana Enforcement Division (MED)"
    base_url = "https://med.colorado.gov"
    _news_path = "/resources/news-bulletins"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for article in soup.select("article, .views-row, .field-content"):
            link_tag = article.find("a", href=True)
            if not link_tag:
                continue
            title = self._text(link_tag)
            if not title:
                continue
            href = self._abs(link_tag["href"])
            date_tag = article.find(class_=lambda c: c and "date" in c.lower())
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=href,
                    published_date=self._text(date_tag) if date_tag else None,
                    category="bulletin",
                )
            )
        return items


class MinnesotaScraper(BaseScraper):
    """Minnesota OCM — mn.gov/ocm news feed."""

    state = "MN"
    agency = "Minnesota Office of Cannabis Management (OCM)"
    base_url = "https://mn.gov"
    _news_path = "/ocm/news/"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for row in soup.select(".news-item, .views-row, article"):
            link_tag = row.find("a", href=True)
            if not link_tag:
                continue
            title = self._text(link_tag)
            if not title:
                continue
            href = self._abs(link_tag["href"])
            date_tag = row.find(class_=lambda c: c and "date" in c.lower())
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=href,
                    published_date=self._text(date_tag) if date_tag else None,
                )
            )
        return items


class PennsylvaniaScraper(BaseScraper):
    """Pennsylvania — Department of Health medical cannabis news."""

    state = "PA"
    agency = "Pennsylvania Department of Health — Medical Cannabis"
    base_url = "https://www.health.pa.gov"
    _news_path = "/topics/programs/Medical%20Cannabis/Pages/Medical-Cannabis.aspx"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for link_tag in soup.select("a[href]"):
            title = self._text(link_tag)
            href = link_tag.get("href", "")
            if not title or len(title) < 10:
                continue
            kw = ("bulletin", "update", "guidance", "notice", "regulation")
            if not any(k in title.lower() for k in kw):
                continue
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=self._abs(href),
                    category="regulatory notice",
                )
            )
        return items


class NebraskaScraper(BaseScraper):
    """Nebraska DHHS — Medical Cannabis Regulation Act updates."""

    state = "NE"
    agency = "Nebraska DHHS / NDHHS Medical Cannabis"
    base_url = "https://dhhs.ne.gov"
    _news_path = "/Pages/Medical-Cannabis.aspx"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for link_tag in soup.select("a[href]"):
            title = self._text(link_tag)
            href = link_tag.get("href", "")
            if not title or len(title) < 8:
                continue
            kw = ("rule", "regulation", "license", "application", "cannabis")
            if not any(k in title.lower() for k in kw):
                continue
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=self._abs(href),
                )
            )
        return items


class NewYorkScraper(BaseScraper):
    """New York OCM — cannabis.ny.gov press releases / guidance."""

    state = "NY"
    agency = "New York Office of Cannabis Management (OCM)"
    base_url = "https://cannabis.ny.gov"
    _news_path = "/press-releases"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for article in soup.select("article, .field-content, .views-row"):
            link_tag = article.find("a", href=True)
            if not link_tag:
                continue
            title = self._text(link_tag)
            if not title:
                continue
            href = self._abs(link_tag["href"])
            date_tag = article.find("time") or article.find(
                class_=lambda c: c and "date" in c.lower()
            )
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=href,
                    published_date=(
                        date_tag.get("datetime") or self._text(date_tag)
                        if date_tag
                        else None
                    ),
                    category="press release",
                )
            )
        return items


class OhioScraper(BaseScraper):
    """Ohio Division of Cannabis Control — com.ohio.gov news."""

    state = "OH"
    agency = "Ohio Division of Cannabis Control (DCC)"
    base_url = "https://com.ohio.gov"
    _news_path = "/divisions/cannabis/cannabis-news"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for row in soup.select(".news-item, article, .views-row"):
            link_tag = row.find("a", href=True)
            if not link_tag:
                continue
            title = self._text(link_tag)
            if not title:
                continue
            href = self._abs(link_tag["href"])
            date_tag = row.find("time") or row.find(
                class_=lambda c: c and "date" in c.lower()
            )
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=href,
                    published_date=(
                        date_tag.get("datetime") or self._text(date_tag)
                        if date_tag
                        else None
                    ),
                )
            )
        return items


class CaliforniaScraper(BaseScraper):
    """California DCC — cannabis.ca.gov news."""

    state = "CA"
    agency = "California Department of Cannabis Control (DCC)"
    base_url = "https://cannabis.ca.gov"
    _news_path = "/about/newsroom/"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for article in soup.select("article, .wp-block-post, .news-item"):
            link_tag = article.find("a", href=True)
            if not link_tag:
                continue
            title = self._text(link_tag)
            if not title:
                continue
            href = self._abs(link_tag["href"])
            date_tag = article.find("time")
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=href,
                    published_date=(
                        date_tag.get("datetime") or self._text(date_tag)
                        if date_tag
                        else None
                    ),
                    category="newsroom",
                )
            )
        return items


class FloridaScraper(BaseScraper):
    """Florida OMMU — flhealth.gov Office of Medical Marijuana Use."""

    state = "FL"
    agency = "Florida Department of Health — Office of Medical Marijuana Use (OMMU)"
    base_url = "https://www.flhealth.gov"
    _news_path = "/programs-and-services/office-of-medical-marijuana-use"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for link_tag in soup.select("a[href]"):
            title = self._text(link_tag)
            href = link_tag.get("href", "")
            if not title or len(title) < 8:
                continue
            kw = ("rule", "order", "update", "notice", "marijuana", "cannabis")
            if not any(k in title.lower() for k in kw):
                continue
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=self._abs(href),
                )
            )
        return items


class OklahomaScraper(BaseScraper):
    """Oklahoma OMMA — oklahoma.gov/omma news & rules."""

    state = "OK"
    agency = "Oklahoma Medical Marijuana Authority (OMMA)"
    base_url = "https://oklahoma.gov"
    _news_path = "/omma/resources/news.html"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for row in soup.select(".news-item, article, .views-row, li"):
            link_tag = row.find("a", href=True)
            if not link_tag:
                continue
            title = self._text(link_tag)
            if not title or len(title) < 8:
                continue
            href = self._abs(link_tag["href"])
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=href,
                )
            )
        return items


class TexasScraper(BaseScraper):
    """Texas DSHS — Compassionate Use Program updates."""

    state = "TX"
    agency = "Texas Department of State Health Services (DSHS) — CUP"
    base_url = "https://www.dshs.texas.gov"
    _news_path = "/texas-compassionate-use-program"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for link_tag in soup.select("a[href]"):
            title = self._text(link_tag)
            href = link_tag.get("href", "")
            if not title or len(title) < 8:
                continue
            kw = ("rule", "regulation", "license", "compassionate", "cannabis", "low-thc")
            if not any(k in title.lower() for k in kw):
                continue
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=self._abs(href),
                )
            )
        return items


class MichiganScraper(BaseScraper):
    """Michigan Cannabis Regulatory Agency — michigan.gov/cra news."""

    state = "MI"
    agency = "Michigan Cannabis Regulatory Agency (CRA)"
    base_url = "https://www.michigan.gov"
    _news_path = "/cra/news"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for article in soup.select("article, .views-row, .news-item"):
            link_tag = article.find("a", href=True)
            if not link_tag:
                continue
            title = self._text(link_tag)
            if not title:
                continue
            href = self._abs(link_tag["href"])
            date_tag = article.find("time") or article.find(
                class_=lambda c: c and "date" in c.lower()
            )
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=href,
                    published_date=(
                        date_tag.get("datetime") or self._text(date_tag)
                        if date_tag
                        else None
                    ),
                )
            )
        return items


class MissouriScraper(BaseScraper):
    """Missouri DHSS — health.mo.gov Cannabis regulation page."""

    state = "MO"
    agency = "Missouri Department of Health and Senior Services (DHSS)"
    base_url = "https://health.mo.gov"
    _news_path = "/safety/cannabis/"

    def fetch_updates(self) -> List[RegulatoryItem]:
        items: List[RegulatoryItem] = []
        soup = self._soup(self.base_url + self._news_path)

        for link_tag in soup.select("a[href]"):
            title = self._text(link_tag)
            href = link_tag.get("href", "")
            if not title or len(title) < 8:
                continue
            kw = ("rule", "regulation", "update", "notice", "cannabis", "marijuana")
            if not any(k in title.lower() for k in kw):
                continue
            items.append(
                RegulatoryItem(
                    state=self.state,
                    agency=self.agency,
                    title=title,
                    url=self._abs(href),
                )
            )
        return items


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

STATE_SCRAPERS: dict[str, type[BaseScraper]] = {
    "CO": ColoradoScraper,
    "MN": MinnesotaScraper,
    "PA": PennsylvaniaScraper,
    "NE": NebraskaScraper,
    "NY": NewYorkScraper,
    "OH": OhioScraper,
    "CA": CaliforniaScraper,
    "FL": FloridaScraper,
    "OK": OklahomaScraper,
    "TX": TexasScraper,
    "MI": MichiganScraper,
    "MO": MissouriScraper,
}


def run_scrapers(states: Optional[List[str]] = None) -> List[RegulatoryItem]:
    """
    Run scrapers for the requested states (default: all).

    Parameters
    ----------
    states : list of str, optional
        Two-letter state abbreviation(s) e.g. ["CO", "CA"]. Pass None for all.

    Returns
    -------
    list of RegulatoryItem
    """
    target = [s.upper() for s in (states or list(STATE_SCRAPERS.keys()))]
    results: List[RegulatoryItem] = []

    for code in target:
        if code not in STATE_SCRAPERS:
            logger.warning("Unknown state code: %s — skipping.", code)
            continue
        scraper = STATE_SCRAPERS[code]()
        logger.info("Scraping %s — %s …", code, scraper.agency)
        try:
            items = scraper.fetch_updates()
            logger.info("  → %d items found.", len(items))
            results.extend(items)
        except Exception:  # noqa: BLE001
            logger.exception("Error scraping %s", code)

    return results
