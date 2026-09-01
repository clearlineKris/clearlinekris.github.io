# ClearLine

The public site for ClearLine and its 68th Joint Insights work.

**Live site:** [clearlinekris.github.io](https://clearlinekris.github.io)

ClearLine helps cannabis teams make sense of rules, records, and the gray area between them. The homepage is intentionally simple; deeper detail lives inside the individual project pages.

## Repository map

- `index.html` — portfolio homepage and intake form
- `styles.css` — responsive visual system
- `form-handler.js` — Google Apps Script form submission
- `google-apps-script/Code.gs` — Google Sheets lead-capture backend
- `assets/` — site assets
- `ir/` — RegMatrix
- `the-clear-lines/` — The Clear Lines public cannabis knowledge floor
- `five-engines/` — operational compliance concepts

## Contact form → Google Sheets

The homepage form sends URL-encoded submissions to a Google Apps Script web app. The configured endpoint appears in both `form-handler.js` and the form's `action` attribute so the native form remains a fallback.

### Safeguards

- Hidden honeypot field for basic bot filtering
- Required name and email checks
- Five submissions per email per hour
- Spreadsheet-formula injection protection
- Script locking for concurrent writes
- Non-destructive migration of an existing `Leads` header row

Do not collect METRC exports, invoices, or other sensitive operating records through this public lead form. Arrange a secure exchange after the opening conversation.

## Positioning

ClearLine provides operational and regulatory-intelligence support, not legal advice. Outcomes depend on jurisdiction, facts, and regulator discretion.

[Connect with @clearlineKris](https://github.com/clearlineKris)
