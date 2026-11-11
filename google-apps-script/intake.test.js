'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SOURCE_PATH = path.join(__dirname, 'Code.gs');
const source = fs.readFileSync(SOURCE_PATH, 'utf8');
const SPREADSHEET_ID = '1lci_GiNle5KHMICP76THihdAwTpY93vmF9g5U7cu_hk';
const LIVE_ENDPOINT = 'https://script.google.com/macros/s/AKfycbym6aP7bGMbJ_X_Yt2hq1Tt6Qg6RSmr5VLzRg9k99205Xj08V6jcAj7z-JK--cEj_ud/exec';
const HEADERS = [
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
const NOW = new Date('2026-11-09T01:49:00.000Z');

function createLock(mode) {
  let held = false;
  return {
    waitLock() {
      if (mode === 'timeout') {
        const error = new Error('Exception: Lock timeout: another process was holding the lock');
        error.name = 'Exception';
        throw error;
      }
      if (held) throw new Error('lock is already held');
      held = true;
    },
    releaseLock() {
      held = false;
    },
    isHeld() {
      return held;
    }
  };
}

function createCache() {
  const store = new Map();
  return {
    store,
    get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    put(key, value) {
      store.set(key, String(value));
    }
  };
}

function createSheet(headers, dataRows) {
  const state = {
    headers: headers.slice(),
    rows: dataRows.map((row) => row.slice()),
    writes: [],
    formats: []
  };

  const sheet = {
    getLastRow() {
      if (state.rows.length) return state.rows.length + 1;
      return state.headers.length ? 1 : 0;
    },
    getLastColumn() {
      return state.headers.length;
    },
    getRange(row, column, numRows, numCols) {
      if (numRows !== 1) {
        throw new Error('unexpected multi-row range');
      }
      return {
        getDisplayValues() {
          if (row !== 1 || column !== 1) {
            throw new Error('only the header row should be read');
          }
          return [state.headers.slice(0, numCols)];
        },
        setNumberFormat(format) {
          state.formats.push({ row, column, numCols, format });
        },
        setValues(values) {
          const expectedRow = state.rows.length + 2;
          if (row !== expectedRow || column !== 1) {
            throw new Error('row collision at ' + row + '; expected ' + expectedRow);
          }
          if (!values || values.length !== 1 || values[0].length !== numCols) {
            throw new Error('setValues shape does not match the range');
          }
          state.writes.push({ row, values: values[0].slice() });
          state.rows.push(values[0].slice());
        }
      };
    }
  };

  return { sheet, state };
}

function loadScript(options) {
  const opts = options || {};
  const bundle = createSheet(
    opts.headers || HEADERS,
    opts.rows || []
  );
  const scriptLock = opts.scriptLock || createLock();
  const documentLock = opts.documentLock === undefined ? createLock() : opts.documentLock;
  const cache = opts.cache || createCache();
  const opened = [];
  const requestedSheets = [];
  let flushes = 0;

  const sandbox = {
    console,
    Logger: {
      entries: [],
      log(message) {
        this.entries.push(String(message));
      }
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        return {
          text,
          mime: null,
          setMimeType(mime) {
            this.mime = mime;
            return this;
          }
        };
      }
    },
    CacheService: {
      getScriptCache() {
        return cache;
      }
    },
    LockService: {
      getScriptLock() {
        return scriptLock;
      },
      getDocumentLock() {
        if (opts.documentLockMode === 'unsupported') {
          throw new Error('Document locks are only available for container-bound scripts');
        }
        return documentLock;
      }
    },
    SpreadsheetApp: {
      openById(id) {
        opened.push(id);
        if (opts.openError) throw new Error(opts.openError);
        if (id !== SPREADSHEET_ID) {
          throw new Error('refusing unexpected spreadsheet ' + id);
        }
        return {
          getId() {
            return opts.returnedId || id;
          },
          getSheetByName(name) {
            requestedSheets.push(name);
            if (name !== 'Leads') {
              throw new Error('unexpected sheet request ' + name);
            }
            return opts.missingSheet ? null : bundle.sheet;
          }
        };
      },
      getActiveSpreadsheet() {
        throw new Error('active spreadsheet access is disabled');
      },
      flush() {
        flushes += 1;
        if (opts.flushError) throw new Error(opts.flushError);
      }
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'Code.gs' });
  sandbox.__opened = opened;
  sandbox.__sheets = requestedSheets;
  sandbox.__state = bundle.state;
  sandbox.__cache = cache;
  sandbox.__scriptLock = scriptLock;
  sandbox.__documentLock = documentLock;
  sandbox.__flushCount = () => flushes;
  return sandbox;
}

function responseBody(output) {
  assert.equal(output.mime, 'application/json');
  return JSON.parse(output.text);
}

function validParams(extra) {
  return Object.assign({
    name: 'Ada Lovelace',
    email: 'Ada@Example.com',
    company: 'Analytical Engines',
    service: 'Kristopher consulting inquiry',
    record_type: 'A process or SOP',
    message: 'Which record should we trust?',
    hp: ''
  }, extra || {});
}

function contactForm(file) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const form = html.match(/<form id="contact-form"[\s\S]*?<\/form>/);
  assert.ok(form, file + ' is missing the contact form');
  const action = form[0].match(/\saction="([^"]+)"/);
  const service = form[0].match(/name="service"\s+value="([^"]+)"/);
  const names = Array.from(form[0].matchAll(/\sname="([^"]+)"/g), (match) => match[1]);
  return {
    action: action && action[1],
    service: service && service[1],
    names
  };
}

test('source is bound to the new spreadsheet and has no side channels', () => {
  assert.equal(source.split(SPREADSHEET_ID).length - 1, 1);
  const banned = [
    'getActiveSpreadsheet',
    'MailApp',
    'GmailApp',
    'UrlFetchApp',
    'insertSheet',
    'appendRow',
    'ScriptApp',
    'DriveApp',
    'CalendarApp',
    'script.google.com',
    'AKfycb'
  ];
  banned.forEach((token) => {
    assert.equal(source.includes(token), false, token);
  });
});

test('site forms post to the deployed intake endpoint with a shared field map', () => {
  const handler = fs.readFileSync(path.join(ROOT, 'form-handler.js'), 'utf8');
  assert.equal(handler.includes(LIVE_ENDPOINT), true);
  assert.equal(handler.split(LIVE_ENDPOINT).length - 1, 1);

  const forms = ['index.html', 'double-blind.html', 'fire-pack.html'].map(contactForm);
  const allowed = new Set([
    'hp', 'name', 'email', 'company', 'service', 'record_type',
    'message', 'state', 'license_type', 'urgency'
  ]);

  forms.forEach((form) => {
    assert.equal(form.action, LIVE_ENDPOINT);
    assert.equal(typeof form.service, 'string');
    assert.ok(form.service.length > 0);
    form.names.forEach((name) => assert.equal(allowed.has(name), true, name));
    ['name', 'email', 'service', 'record_type', 'message', 'company', 'hp'].forEach((name) => {
      assert.equal(form.names.includes(name), true, name);
    });
  });

  assert.deepEqual(forms.map((form) => form.service), [
    'Kristopher consulting inquiry',
    'The Fresh Freeze — The Delta View',
    'The Fire Pack — One Burning Heat Seeker'
  ]);
  assert.equal(forms[0].names.includes('state'), false);
  assert.equal(forms[0].names.includes('license_type'), false);
  assert.equal(forms[0].names.includes('urgency'), false);
  ['state', 'license_type', 'urgency'].forEach((name) => {
    assert.equal(forms[1].names.includes(name), true, name);
    assert.equal(forms[2].names.includes(name), true, name);
  });
});

test('maps each live service onto the Leads columns and ignores a forged timestamp', () => {
  const sandbox = loadScript();
  const forms = ['index.html', 'double-blind.html', 'fire-pack.html'].map(contactForm);

  forms.forEach((form) => {
    const validated = sandbox.validateSubmission({
      name: '  Kris  ',
      email: 'kris@example.com',
      company: '68th',
      service: form.service,
      record_type: 'Rule',
      message: 'Line one\r\nLine two',
      state: 'Colorado',
      license_type: 'Retail / Dispensary',
      urgency: 'This month',
      timestamp: '1999-01-01T00:00:00.000Z',
      spreadsheetId: 'attacker-controlled',
      sheet: 'Somewhere Else'
    }, NOW);

    assert.equal(validated.ok, true);
    assert.deepEqual(JSON.parse(JSON.stringify(validated.row)), [
      '2026-11-09T01:49:00.000Z',
      'Kris',
      'kris@example.com',
      '68th',
      form.service,
      'Rule',
      'Line one\nLine two',
      'Colorado',
      'Retail / Dispensary',
      'This month'
    ]);
  });

  assert.equal(sandbox.__opened.length, 0);
});

test('homepage submission leaves the diagnostic columns blank', () => {
  const sandbox = loadScript();
  const validated = sandbox.validateSubmission(validParams(), NOW);
  assert.equal(validated.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(validated.row)).slice(7), ['', '', '']);
});

test('requires a name and a plausible email address', () => {
  const sandbox = loadScript();
  ['', '   ', null].forEach((name) => {
    const missing = sandbox.validateSubmission(validParams({ name }), NOW);
    assert.equal(missing.ok, false);
    assert.equal(missing.error, 'Name and a valid email are required.');
  });

  const badEmail = sandbox.validateSubmission(validParams({ email: 'not-an-email' }), NOW);
  assert.equal(badEmail.ok, false);
  assert.equal(badEmail.error, 'Enter a valid email address.');

  const spaced = sandbox.validateSubmission(validParams({ email: 'ada @example.com' }), NOW);
  assert.equal(spaced.ok, false);
});

test('rejects oversized fields without echoing their contents', () => {
  const sandbox = loadScript();
  const result = sandbox.validateSubmission(validParams({
    message: 'x'.repeat(4001)
  }), NOW);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Message is too long.');
  assert.equal(result.error.includes('xxx'), false);
});

test('prefixes formula-like cells and keeps ordinary punctuation', () => {
  const sandbox = loadScript();
  const samples = ['=1+1', '+cmd', '-cmd', '@SUM(A1)', '|calc', '%payload', '\uFF1D1+1', '\u200B=cmd'];
  samples.forEach((message) => {
    const validated = sandbox.validateSubmission(validParams({ message }), NOW);
    assert.equal(validated.ok, true);
    assert.equal(validated.row[6].charAt(0), '\t');
    assert.equal(validated.row[6].includes(message.replace('\u200B', '')), true);
  });

  const ordinary = sandbox.validateSubmission(validParams({
    name: "O'Brien",
    company: 'Acme - North',
    message: 'See section 2 = the gap'
  }), NOW);
  assert.equal(ordinary.row[1], "O'Brien");
  assert.equal(ordinary.row[3], 'Acme - North');
  assert.equal(ordinary.row[6], 'See section 2 = the gap');
});

test('writes one plain-text row under both locks and preserves email casing', () => {
  const sandbox = loadScript();
  const body = responseBody(sandbox.doPost({ parameter: validParams() }));

  assert.deepEqual(body, { result: 'success' });
  assert.deepEqual(sandbox.__opened, [SPREADSHEET_ID]);
  assert.deepEqual(sandbox.__sheets, ['Leads']);
  assert.equal(sandbox.__flushCount(), 1);
  assert.equal(sandbox.__state.formats[0].format, '@');
  assert.equal(sandbox.__state.formats[0].row, 2);
  assert.equal(sandbox.__state.writes[0].row, 2);
  assert.equal(sandbox.__state.rows[0][1], 'Ada Lovelace');
  assert.equal(sandbox.__state.rows[0][2], 'Ada@Example.com');
  assert.equal(sandbox.__scriptLock.isHeld(), false);
  assert.equal(sandbox.__documentLock.isHeld(), false);
  assert.equal(sandbox.__cache.store.get('rl_ada@example.com'), '1');
});

test('a flush failure after the write still counts as saved', () => {
  const sandbox = loadScript({ flushError: 'flush failed' });
  const body = responseBody(sandbox.doPost({ parameter: validParams() }));
  assert.deepEqual(body, { result: 'success' });
  assert.equal(sandbox.__state.rows.length, 1);
  assert.equal(sandbox.__cache.store.get('rl_ada@example.com'), '1');
  assert.equal(sandbox.__scriptLock.isHeld(), false);
});

test('holds the locks while the row is written and stacks the next row after it', () => {
  const scriptLock = createLock();
  const documentLock = createLock();
  const sandbox = loadScript({ scriptLock, documentLock });
  const originalPush = sandbox.__state.writes.push.bind(sandbox.__state.writes);
  sandbox.__state.writes.push = (entry) => {
    assert.equal(scriptLock.isHeld(), true);
    assert.equal(documentLock.isHeld(), true);
    return originalPush(entry);
  };

  responseBody(sandbox.doPost({ parameter: validParams() }));
  responseBody(sandbox.doPost({
    parameter: validParams({ email: 'ada@example.com', name: 'Second' })
  }));

  assert.deepEqual(sandbox.__state.writes.map((entry) => entry.row), [2, 3]);
  assert.equal(sandbox.__state.rows[1][1], 'Second');
  assert.equal(scriptLock.isHeld(), false);
  assert.equal(documentLock.isHeld(), false);
});

test('still writes when a standalone project has no document lock', () => {
  const sandbox = loadScript({ documentLockMode: 'unsupported', documentLock: null });
  const body = responseBody(sandbox.doPost({ parameter: validParams() }));
  assert.equal(body.result, 'success');
  assert.equal(sandbox.__state.rows.length, 1);
  assert.equal(sandbox.__scriptLock.isHeld(), false);
});

test('a busy lock writes nothing and releases the script lock', () => {
  const scriptLock = createLock();
  const documentLock = createLock('timeout');
  const sandbox = loadScript({ scriptLock, documentLock });
  const body = responseBody(sandbox.doPost({ parameter: validParams() }));

  assert.deepEqual(body, {
    result: 'error',
    error: 'Service temporarily busy. Please try again in a moment.'
  });
  assert.equal(sandbox.__opened.length, 0);
  assert.equal(sandbox.__state.rows.length, 0);
  assert.equal(scriptLock.isHeld(), false);
  assert.equal(sandbox.__cache.store.size, 0);
});

test('stops the sixth successful save for the same mailbox, including plus aliases', () => {
  const sandbox = loadScript();
  for (let i = 0; i < 4; i += 1) {
    const body = responseBody(sandbox.doPost({ parameter: validParams({ email: 'ada@example.com' }) }));
    assert.equal(body.result, 'success');
  }
  const alias = responseBody(sandbox.doPost({
    parameter: validParams({ email: 'Ada+burst@Example.com', name: 'Alias' })
  }));
  assert.equal(alias.result, 'success');

  const blocked = responseBody(sandbox.doPost({
    parameter: validParams({ email: 'ada@example.com', name: 'Blocked' })
  }));
  assert.deepEqual(blocked, {
    result: 'error',
    error: 'Too many submissions. Please try again later.'
  });
  assert.equal(sandbox.__state.rows.length, 5);
  assert.equal(sandbox.__cache.store.get('rl_ada@example.com'), '5');
});

test('validation failures and honeypots do not write or consume the rate limit', () => {
  const sandbox = loadScript();
  const invalid = responseBody(sandbox.doPost({
    parameter: validParams({ email: 'nope' })
  }));
  const bot = responseBody(sandbox.doPost({
    parameter: validParams({ hp: 'filled-by-bot' })
  }));

  assert.equal(invalid.result, 'error');
  assert.deepEqual(bot, { result: 'success' });
  assert.equal(sandbox.__opened.length, 0);
  assert.equal(sandbox.__cache.store.size, 0);

  for (let i = 0; i < 5; i += 1) {
    assert.equal(responseBody(sandbox.doPost({ parameter: validParams() })).result, 'success');
  }
  assert.equal(sandbox.__state.rows.length, 5);
});

test('a header mismatch or missing tab does not write or consume a rate slot', () => {
  const mismatched = loadScript({
    headers: ['Timestamp', 'Name', 'Email', 'Company', 'Service', 'Record Type', 'Message', 'State', 'License', 'Urgency']
  });
  const mismatchBody = responseBody(mismatched.doPost({ parameter: validParams() }));
  assert.equal(mismatchBody.result, 'error');
  assert.equal(mismatchBody.error, 'The form could not be saved. Please try again later.');
  assert.equal(mismatchBody.error.includes(SPREADSHEET_ID), false);
  assert.equal(mismatched.__state.writes.length, 0);
  assert.equal(mismatched.__cache.store.size, 0);
  assert.equal(mismatched.__scriptLock.isHeld(), false);
  assert.match(mismatched.Logger.entries.join('\n'), /header row does not match/);

  const missing = loadScript({ missingSheet: true });
  const missingBody = responseBody(missing.doPost({ parameter: validParams() }));
  assert.equal(missingBody.result, 'error');
  assert.equal(missing.__cache.store.size, 0);
});

test('spreadsheet failures stay off the public response and release the lock', () => {
  const sandbox = loadScript({
    openError: 'Cannot open ' + SPREADSHEET_ID
  });
  const body = responseBody(sandbox.doPost({ parameter: validParams() }));
  assert.equal(body.error, 'The form could not be saved. Please try again later.');
  assert.equal(JSON.stringify(body).includes(SPREADSHEET_ID), false);
  assert.equal(sandbox.__scriptLock.isHeld(), false);
  assert.equal(sandbox.__documentLock.isHeld(), false);
  assert.equal(sandbox.__cache.store.size, 0);
});

test('an id mismatch inside the opened file does not write', () => {
  const sandbox = loadScript({ returnedId: 'different-spreadsheet' });
  const body = responseBody(sandbox.doPost({ parameter: validParams() }));
  assert.equal(body.result, 'error');
  assert.equal(sandbox.__state.writes.length, 0);
  assert.equal(sandbox.__cache.store.size, 0);
});

test('editor preflight reads headers and writes nothing', () => {
  const sandbox = loadScript();
  const report = JSON.parse(JSON.stringify(sandbox.checkIntakeTarget()));
  assert.deepEqual(report, {
    ok: true,
    spreadsheetId: SPREADSHEET_ID,
    sheetName: 'Leads',
    headers: HEADERS,
    lastRow: 1,
    wroteRow: false
  });
  assert.equal(sandbox.__state.writes.length, 0);
  assert.equal(sandbox.__flushCount(), 0);

  const broken = loadScript({ headers: ['Name'] });
  assert.throws(() => broken.checkIntakeTarget(), /No row was written/);
  assert.equal(broken.__state.writes.length, 0);
});

test('doGet is a static ready response and does not open the spreadsheet', () => {
  const sandbox = loadScript();
  const body = responseBody(sandbox.doGet());
  assert.deepEqual(body, {
    result: 'ready',
    service: '68th Lat & Lit intake'
  });
  assert.equal(sandbox.__opened.length, 0);
});

test('a script-lock timeout writes nothing', () => {
  const sandbox = loadScript({ scriptLock: createLock('timeout') });
  const body = responseBody(sandbox.doPost({ parameter: validParams() }));
  assert.equal(body.error, 'Service temporarily busy. Please try again in a moment.');
  assert.equal(sandbox.__opened.length, 0);
  assert.equal(sandbox.__state.rows.length, 0);
});
