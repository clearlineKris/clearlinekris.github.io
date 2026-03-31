/**
 * Code.gs — Google Apps Script for ClearLine Contact Form → Google Sheets
 *
 * Deployment instructions (see README for full details):
 *   1. Open your target Google Sheet in Google Drive.
 *   2. Click Extensions → Apps Script.
 *   3. Replace any existing code with this file's contents.
 *   4. Click Deploy → New deployment → Web app.
 *      - Execute as: Me
 *      - Who has access: Anyone with the link (recommended)
 *   5. Click Deploy and copy the Web App URL.
 *   6. Paste the URL into SCRIPT_URL in form-handler.js.
 *
 * The script automatically creates a "Leads" sheet tab (if absent) with
 * the correct column headers on the first run.
 *
 * Anti-abuse controls:
 *   - Honeypot: silently discards submissions where the hidden `hp` field
 *     is non-empty (bots fill every field; real users never see it).
 *   - Required-field guard: rejects submissions missing name or email.
 *   - Rate limiting: each email address is capped at MAX_PER_WINDOW
 *     submissions per WINDOW_SECONDS using CacheService.
 *   - Formula injection: values starting with =, +, -, @, |, or % are
 *     prefixed with a tab so Sheets stores them as plain text, not formulas.
 *   - Concurrent write safety: LockService serialises simultaneous POSTs
 *     to prevent race conditions on first-run sheet creation and appendRow.
 */

var SHEET_NAME     = 'Leads';
var MAX_PER_WINDOW = 5;     // max submissions per email per window
var WINDOW_SECONDS = 3600;  // rate-limit window: 1 hour

/**
 * sanitizeCell — strips leading formula-trigger characters so values are
 * always stored as plain text in the spreadsheet.
 */
function sanitizeCell(value) {
  if (typeof value !== 'string') return '';
  var s = value.trim();
  return /^[=+\-@|%]/.test(s) ? '\t' + s : s;
}

/**
 * isRateLimited — returns true (and does NOT increment) when the email has
 * already hit the cap; otherwise increments the counter and returns false.
 * Normalises the email by lowercasing and stripping the + alias suffix so
 * variants like user+spam@example.com share the same rate-limit bucket.
 */
function isRateLimited(email) {
  if (!email) return false;
  // Normalise: lowercase, strip + alias (e.g. user+tag@example.com → user@example.com)
  var normalised = email.toLowerCase().replace(/\+[^@]*(?=@)/, '');
  var cacheKey   = 'rl_' + normalised.replace(/[^a-z0-9@._-]/g, '');
  var cache      = CacheService.getScriptCache();
  var count      = parseInt(cache.get(cacheKey) || '0', 10);
  if (count >= MAX_PER_WINDOW) return true;
  cache.put(cacheKey, String(count + 1), WINDOW_SECONDS);
  return false;
}

/**
 * doPost — called each time the contact form submits.
 * Parameters are read from e.parameter (URL-encoded form body).
 */
function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};

    // 1. Honeypot — bots fill every visible/hidden field; real users don't
    if (p.hp && p.hp.trim() !== '') {
      return okResponse(); // silently discard without hinting to the bot
    }

    // 2. Required-field guard
    if (!p.name || !p.email) {
      return errResponse('Missing required fields.');
    }

    // 3. Rate limiting per email address
    if (isRateLimited(p.email)) {
      return errResponse('Too many submissions. Please try again later.');
    }

    // 4. Serialise concurrent writes so sheet creation and appendRow are safe
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000); // waits up to 10 s; throws TimeoutException if busy
    } catch (lockErr) {
      return errResponse('Service temporarily busy. Please try again in a moment.');
    }

    try {
      var ss    = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(SHEET_NAME);

      // Create the Leads tab with frozen headers on first run
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

      sheet.appendRow([
        // timestamp is always provided by form-handler.js; the fallback here
        // guards against future clients that may not include it
        sanitizeCell(p.timestamp || new Date().toISOString()),
        sanitizeCell(p.name),
        sanitizeCell(p.email),
        sanitizeCell(p.company  || ''),
        sanitizeCell(p.address  || ''),
        sanitizeCell(p.city     || ''),
        sanitizeCell(p.state    || ''),
        sanitizeCell(p.zip      || ''),
        sanitizeCell(p.message  || '')
      ]);
    } finally {
      lock.releaseLock();
    }

    return okResponse();

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function okResponse() {
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function errResponse(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ result: 'error', error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}
