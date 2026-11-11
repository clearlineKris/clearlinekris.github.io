# 68th Lat & Lit

The public site for 68th Lat & Lit and its 68th Joint Insights work. (Formerly ClearLine; The Clear Lines keeps the origin in its name.)

**Live site:** [clearlinekris.github.io](https://clearlinekris.github.io)

68th Lat & Lit helps cannabis teams make sense of rules, records, and the gray area between them. The homepage is intentionally simple; deeper detail lives inside the individual project pages.

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

The homepage, Fresh Freeze (`double-blind.html`), and Fire Pack (`fire-pack.html`) forms send URL-encoded submissions to a Google Apps Script web app. `form-handler.js` and each form `action` use the same endpoint, so the form still submits when JavaScript is unavailable.

`google-apps-script/Code.gs` writes leads to the private spreadsheet `1lci_GiNle5KHMICP76THihdAwTpY93vmF9g5U7cu_hk`. The forms post to `https://script.google.com/macros/s/AKfycbym6aP7bGMbJ_X_Yt2hq1Tt6Qg6RSmr5VLzRg9k99205Xj08V6jcAj7z-JK--cEj_ud/exec`. Deploy script edits from that spreadsheet's bound Apps Script editor using `google-apps-script/DEPLOYMENT.md`.

### Field mapping

| Form field | Leads column |
| --- | --- |
| Script clock (UTC) | Timestamp |
| `name` | Name |
| `email` | Email |
| `company` | Company |
| `service` | Service |
| `record_type` | Record Type |
| `message` | Message |
| `state` | State |
| `license_type` | License Type |
| `urgency` | Urgency |

### Safeguards

- Opens that spreadsheet by ID and writes only to the `Leads` tab
- Refuses the write when the tab or its header row does not match
- Hidden honeypot field for basic bot filtering
- Required name and email checks, plus length limits
- Five successful saves per email per rolling hour
- Formula-injection protection on every written cell
- Script lock, plus the document lock when the project is container-bound, around each row write
- No mail, auto-reply, notification, or third-party service

The spreadsheet stays private. The web app runs as its owner. The spreadsheet ID is not a credential; do not add Google account credentials to this repository.

Offline check, with no form submission:

```sh
node --test google-apps-script/intake.test.js
```

Do not collect METRC exports, invoices, or other sensitive operating records through this public lead form. Arrange a secure exchange after the opening conversation.

## Positioning

68th Lat & Lit provides operational and regulatory-intelligence support, not legal advice. Outcomes depend on jurisdiction, facts, and regulator discretion.

[Connect with @clearlineKris](https://github.com/clearlineKris)
