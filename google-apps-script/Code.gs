/**
 * Code.gs — 68th Lat & Lit intake writer.
 *
 * Paste this over the bound Apps Script project's Code.gs, then deploy a
 * web app that executes as the Sheet owner and is available to anyone.
 * Deployment steps live in google-apps-script/DEPLOYMENT.md.
 *
 * The script opens one spreadsheet by ID and appends one row to the Leads
 * tab. It does not create tabs, change headers, send mail, or call other
 * services. Run checkIntakeTarget from the editor before deploying. That
 * function only reads the header row.
 *
 * Site forms already post these fields:
 *   name, email, company, service, record_type, message,
 *   state, license_type, urgency, plus honeypot hp.
 * Timestamp is the script clock in UTC. A timestamp sent by the browser
 * is ignored.
 */
'use strict';

var SPREADSHEET_ID = '1ftivFZXkkVN346FdEGCvWMvZ2Cu_ynuFZZUz38TbOO8';
var SHEET_NAME = 'Leads';
var MAX_PER_WINDOW = 5;
var WINDOW_SECONDS = 3600;
var LOCK_WAIT_MS = 20000;

var EXPECTED_HEADERS = [
  'Timestamp',
  'Name',
  'Email',
  'Company',
  'Service',
  'Record Type',
  'Message',
  'State',
  'License Type',
  'Urgency'
];

var FIELD_LIMITS = {
  name: 120,
  email: 254,
  company: 160,
  service: 160,
  record_type: 160,
  message: 4000,
  state: 80,
  license_type: 120,
  urgency: 80
};

var FIELD_LABELS = {
  name: 'Name',
  email: 'Email',
  company: 'Company',
  service: 'Service',
  record_type: 'Record type',
  message: 'Message',
  state: 'State',
  license_type: 'License type',
  urgency: 'Urgency'
};

var REQUIRED_ERROR = 'Name and a valid email are required.';
var EMAIL_ERROR = 'Enter a valid email address.';
var RATE_LIMIT_ERROR = 'Too many submissions. Please try again later.';
var BUSY_ERROR = 'Service temporarily busy. Please try again in a moment.';
var SAVE_ERROR = 'The form could not be saved. Please try again later.';

var FORMULA_START = {
  '=': true,
  '+': true,
  '-': true,
  '@': true,
  '|': true,
  '%': true,
  '\uFF1D': true,
  '\uFF0B': true,
  '\uFF0D': true,
  '\u2212': true,
  '\uFE63': true,
  '\uFF20': true
};

function doGet() {
  return jsonResponse_({
    result: 'ready',
    service: '68th Lat & Lit intake'
  });
}

function doPost(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    if (isHoneypot(params)) {
      return jsonResponse_({ result: 'success' });
    }

    var validated = validateSubmission(params, new Date());
    if (!validated.ok) {
      return errorResponse_(validated.error);
    }

    var outcome = commitSubmission_(validated.row, validated.rateKey);
    if (!outcome.ok) {
      return errorResponse_(outcome.error);
    }

    return jsonResponse_({ result: 'success' });
  } catch (err) {
    log_('intake failed');
    return errorResponse_(SAVE_ERROR);
  }
}

/**
 * Editor-only preflight. Confirms the bound ID, Leads tab, and header row.
 * Does not append a row and is not called by the web app.
 */
function checkIntakeTarget() {
  var spreadsheet = openIntakeSpreadsheet_();
  var sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('Leads tab is missing. Create it before deploying. No tab was created and no row was written.');
  }

  var headers = readHeaders_(sheet);
  var problem = headerProblem_(headers);
  if (problem) {
    throw new Error(problem + ' No row was written.');
  }

  var report = {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    sheetName: SHEET_NAME,
    headers: headers,
    lastRow: sheet.getLastRow(),
    wroteRow: false
  };
  log_(JSON.stringify(report));
  return report;
}

function isHoneypot(params) {
  return singleLine_(field_(params, 'hp')) !== '';
}

function validateSubmission(params, now) {
  var name = singleLine_(field_(params, 'name'));
  var email = singleLine_(field_(params, 'email'));

  if (!name || !email) {
    return fail_(REQUIRED_ERROR);
  }
  if (!isValidEmail_(email)) {
    return fail_(EMAIL_ERROR);
  }
  if (!isUsableDate_(now)) {
    return fail_(SAVE_ERROR);
  }

  var fields = {
    name: name,
    email: email,
    company: singleLine_(field_(params, 'company')),
    service: singleLine_(field_(params, 'service')),
    record_type: singleLine_(field_(params, 'record_type')),
    message: normalizeInput_(field_(params, 'message')),
    state: singleLine_(field_(params, 'state')),
    license_type: singleLine_(field_(params, 'license_type')),
    urgency: singleLine_(field_(params, 'urgency'))
  };

  var keys = Object.keys(FIELD_LIMITS);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (fields[key].length > FIELD_LIMITS[key]) {
      return fail_(FIELD_LABELS[key] + ' is too long.');
    }
  }

  var row = EXPECTED_HEADERS.map(function (header) {
    return sanitizeCell_(columnValue_(header, fields, now));
  });

  if (row.length !== EXPECTED_HEADERS.length) {
    return fail_(SAVE_ERROR);
  }

  return {
    ok: true,
    row: row,
    rateKey: rateKeyForEmail_(email)
  };
}

function columnValue_(header, fields, now) {
  switch (header) {
    case 'Timestamp':
      return now.toISOString();
    case 'Name':
      return fields.name;
    case 'Email':
      return fields.email;
    case 'Company':
      return fields.company;
    case 'Service':
      return fields.service;
    case 'Record Type':
      return fields.record_type;
    case 'Message':
      return fields.message;
    case 'State':
      return fields.state;
    case 'License Type':
      return fields.license_type;
    case 'Urgency':
      return fields.urgency;
    default:
      return '';
  }
}

function commitSubmission_(row, rateKey) {
  var locks = null;
  try {
    locks = acquireIntakeLock_();
  } catch (lockError) {
    log_('lock unavailable');
    return fail_(BUSY_ERROR);
  }

  try {
    if (isOverRateLimit_(rateKey)) {
      return fail_(RATE_LIMIT_ERROR);
    }

    var spreadsheet = openIntakeSpreadsheet_();
    var sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) {
      log_('Leads tab missing');
      return fail_(SAVE_ERROR);
    }

    var problem = headerProblem_(readHeaders_(sheet));
    if (problem) {
      log_(problem);
      return fail_(SAVE_ERROR);
    }

    appendLeadRow_(sheet, row);
    recordSuccessfulSubmission_(rateKey);
    return { ok: true };
  } catch (err) {
    log_('save failed');
    return fail_(SAVE_ERROR);
  } finally {
    releaseIntakeLock_(locks);
  }
}

function openIntakeSpreadsheet_() {
  var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!spreadsheet || spreadsheet.getId() !== SPREADSHEET_ID) {
    throw new Error('Intake spreadsheet binding did not match.');
  }
  return spreadsheet;
}

function readHeaders_(sheet) {
  var width = EXPECTED_HEADERS.length;
  if (!sheet || sheet.getLastRow() < 1 || sheet.getLastColumn() < width) {
    return null;
  }

  var values = sheet.getRange(1, 1, 1, width).getDisplayValues();
  if (!values || !values[0] || values[0].length !== width) {
    return null;
  }

  return values[0].map(function (header) {
    return String(header == null ? '' : header).trim();
  });
}

function headersMatch_(headers) {
  if (!headers || headers.length !== EXPECTED_HEADERS.length) return false;
  for (var i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headers[i] !== EXPECTED_HEADERS[i]) return false;
  }
  return true;
}

function headerProblem_(headers) {
  if (headersMatch_(headers)) return '';
  return 'Leads header row does not match. Expected: ' +
    EXPECTED_HEADERS.join(' | ') +
    '. Found: ' + JSON.stringify(headers) + '.';
}

function appendLeadRow_(sheet, row) {
  if (!row || row.length !== EXPECTED_HEADERS.length) {
    throw new Error('Refusing to write a row with the wrong width.');
  }

  var nextRow = sheet.getLastRow() + 1;
  if (nextRow < 2) {
    throw new Error('Refusing to write into the header row.');
  }

  var range = sheet.getRange(nextRow, 1, 1, row.length);
  range.setNumberFormat('@');
  range.setValues([row]);
  try {
    SpreadsheetApp.flush();
  } catch (err) {
    log_('flush failed after the row was written');
  }
}

function acquireIntakeLock_() {
  var scriptLock = LockService.getScriptLock();
  scriptLock.waitLock(LOCK_WAIT_MS);

  var documentLock = null;
  try {
    documentLock = LockService.getDocumentLock();
  } catch (err) {
    documentLock = null;
  }

  if (documentLock) {
    try {
      documentLock.waitLock(LOCK_WAIT_MS);
    } catch (err) {
      releaseLockQuietly_(scriptLock);
      throw err;
    }
  }

  return {
    scriptLock: scriptLock,
    documentLock: documentLock
  };
}

function releaseIntakeLock_(locks) {
  if (!locks) return;
  releaseLockQuietly_(locks.documentLock);
  releaseLockQuietly_(locks.scriptLock);
}

function releaseLockQuietly_(lock) {
  if (!lock) return;
  try {
    lock.releaseLock();
  } catch (ignore) {}
}

function isOverRateLimit_(rateKey) {
  return submissionCount_(rateKey) >= MAX_PER_WINDOW;
}

function recordSuccessfulSubmission_(rateKey) {
  var next = submissionCount_(rateKey) + 1;
  CacheService.getScriptCache().put(rateKey, String(next), WINDOW_SECONDS);
}

function submissionCount_(rateKey) {
  var raw = CacheService.getScriptCache().get(rateKey);
  var count = parseInt(raw || '0', 10);
  if (!isFinite(count) || count < 0) return 0;
  return count;
}

function rateKeyForEmail_(email) {
  var normalised = String(email).toLowerCase().replace(/\+[^@]*(?=@)/, '');
  return 'rl_' + normalised.replace(/[^a-z0-9@._-]/g, '');
}

function field_(params, key) {
  if (!params || !Object.prototype.hasOwnProperty.call(params, key)) return '';
  var value = params[key];
  if (Object.prototype.toString.call(value) === '[object Array]') {
    return value.length ? value[0] : '';
  }
  return value;
}

function normalizeInput_(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value)
    .replace(/\r\n|\r/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\u200B\u200C\u200D\uFEFF\u2060]/g, '')
    .trim();
}

function singleLine_(value) {
  return normalizeInput_(value).replace(/\n+/g, ' ').replace(/[ \t\f\v]+/g, ' ').trim();
}

function sanitizeCell_(value) {
  var text = normalizeInput_(value);
  if (startsLikeFormula_(text)) {
    return '\t' + text;
  }
  return text;
}

function startsLikeFormula_(text) {
  if (!text) return false;
  if (FORMULA_START[text.charAt(0)]) return true;
  var head = text.charAt(0);
  if (typeof head.normalize === 'function') {
    var normalized = head.normalize('NFKC');
    if (normalized && FORMULA_START[normalized.charAt(0)]) return true;
  }
  return false;
}

function isUsableDate_(value) {
  return Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime());
}

function isValidEmail_(email) {
  if (!email || email.length > FIELD_LIMITS.email) return false;
  if (/\s/.test(email)) return false;
  return /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(email);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse_(message) {
  return jsonResponse_({
    result: 'error',
    error: message
  });
}

function fail_(message) {
  return {
    ok: false,
    error: message
  };
}

function log_(message) {
  if (typeof Logger !== 'undefined' && Logger && Logger.log) {
    Logger.log(message);
  }
}
