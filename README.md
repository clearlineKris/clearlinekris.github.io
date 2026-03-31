# clearlinekris.github.io

> **Official portfolio for Kris Gracia — Cannabis Compliance Strategist, AI Automation Architect, and Founder of ClearLine.**

🌐 **Live site:** [clearlinekris.github.io](https://clearlinekris.github.io)

---

## About This Repo

This is the source code for Kris Gracia's personal and professional portfolio — the digital front door to **ClearLine**, a compliance consulting platform built at the intersection of cannabis regulation, AI-enhanced automation, and operational precision.

If you're here, you're probably a potential client, collaborator, or fellow builder navigating the increasingly complex world of cannabis compliance.

---

## What You'll Find

- **`index.html`** — The main portfolio page, hand-crafted with intention
- **`styles.css`** — Clean, branded styling
- **`form-handler.js`** — Contact form submission logic (Google Sheets integration)
- **`google-apps-script/Code.gs`** — Apps Script to deploy for the Google Sheets backend
- **`favicon.png`** — The mark of ClearLine
- **`Codex_Horizon_Regolith_Mapping.md`** — Internal knowledge architecture documentation
- **`.github/`** — Workflow and automation configuration

---

## Contact Form → Google Sheets Integration

The contact form collects leads (name, email, company, and address) and sends
each submission to a Google Sheet via a Google Apps Script Web App.

### One-time setup

1. **Create a Google Sheet**
   - Open [Google Sheets](https://sheets.google.com) and create a new spreadsheet.
   - Name it something like `ClearLine Leads`.

2. **Add the Apps Script**
   - In the spreadsheet, click **Extensions → Apps Script**.
   - Delete any existing code in `Code.gs`.
   - Paste in the contents of [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
   - Click **Save** (💾).

3. **Deploy as a Web App**
   - Click **Deploy → New deployment**.
   - Under *Select type*, choose **Web app**.
   - Set **Execute as** → *Me*.
   - Set **Who has access** → *Anyone with the link* (recommended; reduces
     automated spam compared to fully public access).
   - Click **Deploy** and authorise when prompted.
   - **Copy the Web App URL** shown in the confirmation dialog.

4. **Wire up the front end**
   - Open [`form-handler.js`](form-handler.js).
   - Replace the placeholder on the `SCRIPT_URL` line with the URL you just copied:
     ```js
     var SCRIPT_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
     ```
   - Also update the `action` attribute on the `<form>` tag in `index.html` with the same URL (used as a no-JS fallback).
   - Commit and push the change.

5. **Test it**
   - Fill in the contact form on the live site and click **Send Message**.
   - Open your Google Sheet — a new row should appear in the **Leads** tab within
     a few seconds.

### What gets recorded

| Column    | Source field        |
|-----------|---------------------|
| Timestamp | Submission time     |
| Name      | Name                |
| Email     | Email               |
| Company   | Company/Organization|
| Address   | Street address      |
| City      | City                |
| State     | State               |
| Zip       | Zip code            |
| Message   | Message             |

### Anti-abuse measures built into the Apps Script

The deployed script includes several safeguards to protect your Sheet:

| Measure | How it works |
|---------|--------------|
| **Honeypot** | A hidden field (`hp`) is added to the form. Real users never see or fill it; bots that blindly populate all fields get silently discarded. |
| **Required-field guard** | Submissions missing `name` or `email` are rejected before any data is written. |
| **Rate limiting** | Each email address is limited to **5 submissions per hour** via `CacheService`. Requests over the cap receive an error response without touching the Sheet. |
| **Formula injection protection** | All cell values are sanitized before writing: strings starting with `=`, `+`, `-`, `@`, `\|`, or `%` are prefixed with a tab character so Sheets stores them as plain text instead of executing them as formulas. |
| **Concurrent write safety** | `LockService` serialises simultaneous requests so sheet creation and row appends are race-condition-free. |

---

State IR reviews require at least an outline of each CCC/GMP document. Each state in scope requires the following documents:

- Penumbrant Papers & One-Pager
- Working Class Exhaustive
- Reg & Pol Volume
- Margin Notes
- Field Problems (fmr. Field Notes)
- Letter of the Law Stack (LOTL)
- Lil LOTL (corresponding)
- Compliance Guide (for white-ops, grey-ops)

**States in scope:** Colorado, Minnesota, Pennsylvania, Nebraska, New York, Ohio, California, Florida, Oklahoma, Texas, Michigan, Missouri

---

## About ClearLine

**ClearLine** is a boutique compliance consulting firm specializing in:

- 🌿 **METRC compliance** — seed-to-sale tracking, audit prep, and data reconciliation
- 🤖 **AI-enhanced operations** — intelligent agents for regulatory workflows
- 📋 **Cannabis waste & packaging audits** — documentation-ready, inspection-proof
- 📊 **Data extraction & ETL pipelines** — turning raw compliance data into actionable intelligence

ClearLine operates on one core principle: *compliance doesn't have to be chaos.*

---

## About Kris

Kris is a METRC Specialist and Compliance Strategist with years of hands-on experience across Colorado's cannabis industry — from dispensary operations to multi-state operator (MSO) environments. A builder at heart, Kris combines deep regulatory expertise with advanced AI tooling to create systems that actually work in the real world.

Also known as **Kris in the Loop** — always at the intersection of human judgment and automated systems. Proudly a **Human with a K**: the irreplaceable, carbon-based variable in every compliance workflow.

**Stack:** Python · JavaScript · YAML · SQL · Obsidian · GitHub · Google Workspace · Claude/Copilot/Gemini

---

## Contact & Connect

- 📧 Reach out via the portfolio site
- 🐙 GitHub: [@clearlineKris](https://github.com/clearlineKris)

---

*Made in North Philly, forged by the peaks near Denver, Colorado. Navigating penumbrant ambiguity — one commit at a time.*
