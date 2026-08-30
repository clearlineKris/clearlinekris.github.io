/**
 * Code.gs — ClearLine Double Blind intake → Google Sheets
 *
 * Deploy this as a web app from the Google Sheet that should receive leads:
 *   1. Open the Sheet, then Extensions → Apps Script.
 *   2. Replace Code.gs with this file.
 *   3. Deploy → New deployment → Web app.
 *   4. Execute as: Me. Who has access: Anyone.
 *   5. Copy the production /exec URL into form-handler.js and index.html.
 *
 * The first submission creates a "Leads" tab with these columns:
 * Timestamp, Name, Email, Company, Service, Record Type, Message.
 *
 * If a Leads tab already uses the previous schema, this script preserves its
 * existing columns and appends any missing ClearLine fields to the right.
 */

var SHEET_NAME = 'Leads';
var MAX_PER_WINDOW = 5;
var WINDOW_SECONDS = 3600;
var EXPECTED_HEADERS = [
  'Timestamp',
  'Name',
  'Email',
  'Company',
  'Service',
  'Record Type',
  'Message'
];

function sanitizeCell(value) {
  if (value === null || typeof value === 'undefined') return '';
  var text = String(value).trim();
  return /^[=+\-@|%]/.test(text) ? '\t' + text : text;
}

function isRateLimited(email) {
  if (!email) return false;

  var normalised = String(email)
    .toLowerCase()
    .replace(/\+[^@]*(?=@)/, '');
  var cacheKey = 'rl_' + normalised.replace(/[^a-z0-9@._-]/g, '');
  var cache = CacheService.getScriptCache();
  var count = parseInt(cache.get(cacheKey) || '0', 10);

  if (count >= MAX_PER_WINDOW) return true;

  cache.put(cacheKey, String(count + 1), WINDOW_SECONDS);
  return false;
}

function doGet() {
  return jsonResponse({
    result: 'ready',
    service: 'ClearLine Double Blind intake'
  });
}

function doPost(e) {
  try {
    var p = e && e.parameter ? e.parameter : {};

    // Bots often fill every field; real visitors never see this one.
    if (p.hp && String(p.hp).trim() !== '') {
      return jsonResponse({ result: 'success' });
    }

    if (!p.name || !p.email) {
      return errorResponse('Missing required fields.');
    }

    if (isRateLimited(p.email)) {
      return errorResponse('Too many submissions. Please try again later.');
    }

    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
    } catch (lockError) {
      return errorResponse('Service temporarily busy. Please try again in a moment.');
    }

    try {
      var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = spreadsheet.getSheetByName(SHEET_NAME);

      if (!sheet) {
        sheet = spreadsheet.insertSheet(SHEET_NAME);
      }

      var headers = ensureHeaders(sheet);
      appendSubmission(sheet, headers, p);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ result: 'success' });
  } catch (error) {
    return errorResponse(error.toString());
  }
}

function ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    sheet.getRange(1, 1, 1, EXPECTED_HEADERS.length)
      .setValues([EXPECTED_HEADERS]);
    sheet.setFrozenRows(1);
    return EXPECTED_HEADERS.slice();
  }

  var columnCount = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, columnCount)
    .getDisplayValues()[0]
    .map(function (header) {
      return String(header).trim();
    });

  var missing = EXPECTED_HEADERS.filter(function (header) {
    return headers.indexOf(header) === -1;
  });

  if (missing.length) {
    sheet.getRange(1, columnCount + 1, 1, missing.length)
      .setValues([missing]);
    headers = headers.concat(missing);
  }

  sheet.setFrozenRows(1);
  return headers;
}

function appendSubmission(sheet, headers, p) {
  var valuesByHeader = {
    'Timestamp': p.timestamp || new Date().toISOString(),
    'Name': p.name,
    'Email': p.email,
    'Company': p.company || '',
    'Service': p.service || 'The Double Blind',
    'Record Type': p.record_type || '',
    'Message': p.message || ''
  };

  var row = headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(valuesByHeader, header)
      ? sanitizeCell(valuesByHeader[header])
      : '';
  });

  sheet.appendRow(row);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  return jsonResponse({
    result: 'error',
    error: message
  });
}
