# ClearLine

The public site for ClearLine and its introductory 68th Joint Insights offer, **The Double Blind**.

**Live site:** [clearlinekris.github.io](https://clearlinekris.github.io)

ClearLine starts with an honest possibility: the operator may already be doing it right. The Double Blind compares a record the client trusts with a separate outside sample, then distinguishes among three findings:

1. The work and the proof already hold.
2. The work is sound, but the record depends on missing context.
3. A real operating or documentation gap is visible.

## Repository map

- `index.html` — homepage and intake form
- `styles.css` — responsive visual system
- `form-handler.js` — Google Apps Script form submission
- `google-apps-script/Code.gs` — Google Sheets lead-capture backend
- `assets/` — site assets
- `ir/`, `the-clear-line/`, `five-engines/` — deeper ClearLine systems

## Contact form → Google Sheets

The homepage form sends URL-encoded submissions to a Google Apps Script web app. The configured endpoint appears in both `form-handler.js` and the form's `action` attribute so the native form remains a fallback.

### Lead columns

| Column | Form field |
|---|---|
| Timestamp | Submission time |
| Name | Name |
| Email | Email |
| Company | Company or operation |
| Service | The Double Blind |
| Record Type | Selected record category |
| Message | “What makes you pause?” response |

The script creates a `Leads` tab on first submission. If a tab from the previous form already exists, it preserves the old columns and appends missing ClearLine fields.

### Deploy or update the Apps Script

1. Open the Google Sheet that should receive leads.
2. Choose **Extensions → Apps Script**.
3. Replace `Code.gs` with [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. Choose **Deploy → Manage deployments**.
5. Edit the production web-app deployment, select **New version**, and deploy.
6. Confirm **Execute as: Me** and public access for anonymous site visitors.
7. Keep the production URL ending in `/exec` in:
   - `form-handler.js`
   - the contact form `action` in `index.html`
8. Submit a clearly labeled test lead from the live site and confirm the row appears.

Editing the script without creating a new deployment version does not update the production `/exec` endpoint.

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
