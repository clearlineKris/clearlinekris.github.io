# Google Sheets Contact Form Integration

This guide walks you through connecting the portfolio contact form to a Google Sheet so every submission is logged automatically.

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Name it something like **ClearLine Contact Form**.
3. In Row 1, add these column headers exactly:

   | A | B | C | D |
   |---|---|---|---|
   | Timestamp | Name | Email | Message |

---

## Step 2 — Add the Apps Script

1. Inside the spreadsheet, click **Extensions → Apps Script**.
2. Delete any placeholder code in the editor.
3. Paste the following:

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data  = JSON.parse(e.postData.contents);

    sheet.appendRow([
      new Date(),
      data.name    || '',
      data.email   || '',
      data.message || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

4. Click **Save** (give the project any name, e.g. *Contact Form Handler*).

---

## Step 3 — Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Click the **gear icon ⚙** next to *Select type* and choose **Web app**.
3. Fill in the settings:
   - **Description**: Contact form handler
   - **Execute as**: Me *(your Google account)*
   - **Who has access**: **Anyone**
4. Click **Deploy**.
5. Google will ask you to authorize the script — click through the OAuth prompts.
6. Copy the **Web app URL** that appears (it looks like `https://script.google.com/macros/s/XXXXXXXX/exec`).

---

## Step 4 — Add the URL to the website

Open `index.html` and find this line near the bottom (inside the `<script>` block):

```javascript
var SHEETS_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```

Replace `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with the URL you copied in Step 3:

```javascript
var SHEETS_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

Save the file and push/deploy. Every future form submission will now write a new row into your Google Sheet **and** send an email via Formspree.

---

## Notes

- **Re-deploying the script**: If you ever edit the Apps Script code, you must create a *new deployment* (not update an existing one) to get a refreshed URL — or use *Manage deployments* to update in-place.
- **Formspree still runs in parallel**: Even with Sheets logging active, Formspree continues to send you an email on every submission. If you ever want to drop Formspree, remove the first `fetch()` call in the script block and update the form's `action` attribute.
- **Privacy**: Google Sheets is only accessible to your Google account. No third party can see the submission data unless you share the spreadsheet.
