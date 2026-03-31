/**
 * Code.gs — Google Apps Script for ClearLine Contact Form → Google Sheets
 *
 * Deployment instructions (see README for full details):
 *   1. Open your target Google Sheet in Google Drive.
 *   2. Click Extensions → Apps Script.
 *   3. Replace any existing code with this file's contents.
 *   4. Click Deploy → New deployment → Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   5. Click Deploy and copy the Web App URL.
 *   6. Paste the URL into SCRIPT_URL in form-handler.js.
 *
 * The script automatically creates a "Leads" sheet tab (if absent) with
 * the correct column headers on the first run.
 */

var SHEET_NAME = 'Leads';

/**
 * doPost — called each time the contact form submits.
 * Parameters are read from e.parameter (URL-encoded form body).
 */
function doPost(e) {
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME);

    // Create the sheet and add headers if it doesn't exist yet
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow([
        'Timestamp',
        'Name',
        'Email',
        'Company',
        'Address',
        'City',
        'State',
        'Zip',
        'Message'
      ]);
      sheet.setFrozenRows(1);
    }

    var p = e.parameter;
    sheet.appendRow([
      // timestamp is always provided by form-handler.js; the fallback here
      // guards against future clients that may not include it
      p.timestamp || new Date().toISOString(),
      p.name      || '',
      p.email     || '',
      p.company   || '',
      p.address   || '',
      p.city      || '',
      p.state     || '',
      p.zip       || '',
      p.message   || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
