/**
 * form-handler.js
 *
 * Submits the contact form to a Zapier Catch Hook webhook, which the
 * Zap can forward anywhere (sheet, email, CRM, Slack, etc).
 *
 * Setup: in Zapier create a Zap with the "Webhooks by Zapier" trigger
 * (event: Catch Hook), then replace YOUR_ZAPIER_HOOK_URL below with
 * the URL Zapier gives you after clicking "Test trigger".
 */
(function () {
  'use strict';

  // ── Replace with your Zapier Catch Hook URL ──────────────────────────────
  //   1. In Zapier: create a Zap with the "Webhooks by Zapier" trigger,
  //      choose "Catch Hook", copy the URL it gives you after clicking
  //      "Test trigger".
  //   2. Paste that URL below (looks like
  //      https://hooks.zapier.com/hooks/catch/12345/abcdef/ ).
  //   3. Map the form fields in the Zap action step (name, email, etc.).
  var SCRIPT_URL = 'YOUR_ZAPIER_HOOK_URL';
  // ─────────────────────────────────────────────────────────────────────────

  var form = document.getElementById('contact-form');
  if (!form) return;

  var submitBtn = form.querySelector('button[type="submit"]');
  var statusEl  = document.getElementById('form-status');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    // Guard: if SCRIPT_URL has not been configured yet, show a clear message
    // rather than silently failing or submitting to a placeholder endpoint.
    if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_ZAPIER_HOOK_URL' ||
        SCRIPT_URL.slice(0, 30) !== 'https://hooks.zapier.com/') {
      showStatus('error', 'Form is not yet configured. Please check back soon.');
      return;
    }

    // Collect all form values (includes honeypot field; see Code.gs)
    var params = new URLSearchParams();
    new FormData(form).forEach(function (value, key) {
      params.append(key, value);
    });
    params.append('timestamp', new Date().toISOString());

    // Disable button while in flight
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Sending\u2026';

    // POST to Zapier webhook
    // no-cors makes this a simple CORS request so no preflight is needed.
    // The response is opaque — success is optimistic (the request is sent,
    // but we cannot verify delivery or distinguish server-side errors from success).
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
