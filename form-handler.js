/**
 * form-handler.js
 *
 * Submits the contact form to a Google Apps Script Web App which appends
 * each lead to a Google Sheet.
 *
 * Setup: deploy google-apps-script/Code.gs as a Web App (see README for
 * full instructions) and paste the resulting URL into SCRIPT_URL below.
 */
(function () {
  'use strict';

  // ── Replace with your deployed Google Apps Script Web App URL ────────────
  var SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL';
  // ─────────────────────────────────────────────────────────────────────────

  var form = document.getElementById('contact-form');
  if (!form) return;

  var submitBtn = form.querySelector('button[type="submit"]');
  var statusEl  = document.getElementById('form-status');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Collect all form values
    var params = new URLSearchParams();
    new FormData(form).forEach(function (value, key) {
      params.append(key, value);
    });
    params.append('timestamp', new Date().toISOString());

    // Disable button while in flight
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending\u2026';

    // POST to Google Apps Script
    // no-cors makes this a simple CORS request so no preflight is needed.
    // The response is opaque — success is optimistic (the data still reaches
    // the sheet; we cannot distinguish server-side errors from success).
    fetch(SCRIPT_URL, {
      method:  'POST',
      mode:    'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString()
    })
      .then(function () {
        showStatus('success', "Message received \u2014 I\u2019ll be in touch soon.");
        form.reset();
      })
      .catch(function () {
        showStatus('error', 'Something went wrong. Please try again or reach out directly.');
      })
      .finally(function () {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Send Message';
      });
  });

  function showStatus(type, message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className   = 'form-status form-status--' + type;
    statusEl.removeAttribute('hidden');
  }
}());
