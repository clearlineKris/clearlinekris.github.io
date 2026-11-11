# Deploy the intake script

This writer is bound to the private spreadsheet `1lci_GiNle5KHMICP76THihdAwTpY93vmF9g5U7cu_hk`, tab `Leads`. The homepage, Fresh Freeze, and Fire Pack forms post to the deployed web app `https://script.google.com/macros/s/AKfycbym6aP7bGMbJ_X_Yt2hq1Tt6Qg6RSmr5VLzRg9k99205Xj08V6jcAj7z-JK--cEj_ud/exec`.

The spreadsheet ID is an address, not a password. Leave the Sheet shared only with the owning account. Do not put Google credentials, an API key, or a service-account file in this repository.

## Before you deploy

1. Open the private spreadsheet `1lci_GiNle5KHMICP76THihdAwTpY93vmF9g5U7cu_hk`.
2. Confirm the tab name is exactly `Leads`.
3. Confirm row 1 is exactly these ten headers, in this order:

   `Timestamp`, `Name`, `Email`, `Company`, `Service`, `Record Type`, `Message`, `State`, `License Type`, `Urgency`

4. Open **Extensions → Apps Script** from that spreadsheet so the project is the container-bound project. The copy to paste is `google-apps-script/Code.gs` (also saved as `artifacts/Code.gs`).
5. Replace the entire contents of `Code.gs` with that file. Save. Do not add libraries, triggers, mail code, or other files.

## Editor check

1. In the function menu, choose `checkIntakeTarget` and click **Run**.
2. Approve access if Google asks. The prompt should cover viewing and editing spreadsheets, because the script opens this Sheet by ID. Stop if Google asks to send email on your behalf.
3. The execution log should include `"ok": true` and `"wroteRow": false`.
4. If the run reports a missing tab or a header mismatch, fix the Sheet and run the check again. The script will not create a tab or rewrite headers.
5. Confirm the Leads tab did not gain a data row from this check.

## Web app deployment

1. **Deploy → New deployment**. Choose the gear icon, then **Web app**.
2. Execute as: **Me** (the account that can edit this private Sheet).
3. Who has access: **Anyone**. If the dialog still says "Anyone, even anonymous", choose that. Stop if the only public option is limited to a company domain; the site's visitors would not be able to submit.
4. Deploy and authorize. The site already uses `https://script.google.com/macros/s/AKfycbym6aP7bGMbJ_X_Yt2hq1Tt6Qg6RSmr5VLzRg9k99205Xj08V6jcAj7z-JK--cEj_ud/exec`.
5. Publish later edits as a new version of that same deployment so this `/exec` URL stays in place. The `/dev` URL is only for the Apps Script tester.

To publish a later edit of `Code.gs`, open **Deploy → Manage deployments**, edit this web app, set **Version** to **New version**, and deploy. That keeps the same `/exec` URL.

## What a saved row contains

| Leads column | Form field | Notes |
| --- | --- | --- |
| Timestamp | — | UTC time from the script clock. Browser timestamps are ignored. |
| Name | `name` | Required. |
| Email | `email` | Required. Stored as entered, aside from surrounding whitespace. |
| Company | `company` | Blank when the form omits it. |
| Service | `service` | Homepage, Fresh Freeze, and Fire Pack each send their own value. |
| Record Type | `record_type` | |
| Message | `message` | Line breaks are kept. |
| State | `state` | Blank on the homepage form. |
| License Type | `license_type` | Blank on the homepage form. |
| Urgency | `urgency` | Blank on the homepage form. |

The honeypot field `hp` is dropped. A filled honeypot gets a success response and no row. Any other posted name is ignored, including a spreadsheet ID or sheet name.

Cells that start with `=`, `+`, `-`, `@`, `|`, `%`, or a lookalike character are stored as text with a leading tab. Each written row is also set to plain-text format. Name and email are required, other fields are limited in length, and a successful save counts toward five saves per email per rolling hour. `user+tag@example.com` shares that hour with `user@example.com`.

Concurrent submissions take the script lock, then the document lock when the project is container-bound, and only then read the next free row and write it.

## Offline check

From the repository root:

```sh
node --test google-apps-script/intake.test.js
```

That check does not contact Google and does not submit a form.
