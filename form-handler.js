/**
 * form-handler.js
 *
 * Sends the site's intake forms (homepage contact, The Fresh Freeze on
 * double-blind.html, and The Fire Pack on fire-pack.html) to the 68th Lat & Lit
 * Google Apps Script web app. Each form's action uses the same endpoint as a
 * no-JavaScript fallback.
 */
(function () {
  'use strict';

  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwrKLuu1dvDwzpD72y1BSEBpMNzIXoPlrs9Q8HszOQwFwv7Www8cMSUBEzuFg2sOIiA/exec';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var submitBtn = form.querySelector('button[type="submit"]');
  var statusEl  = document.getElementById('form-status');
  var CONTACT_EMAIL = 'clearlineKris@gmail.com';
  var submitLabel = submitBtn ? submitBtn.textContent : 'Request the opening conversation';

  // Keep the native form fallback aligned with the JavaScript endpoint.
  form.setAttribute('action', SCRIPT_URL);

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (!isConfiguredAppsScriptUrl(SCRIPT_URL)) {
      showStatus('error', 'The form is not configured yet. Please email ' + CONTACT_EMAIL + ' directly.');
      return;
    }

    var params = new URLSearchParams();
    new FormData(form).forEach(function (value, key) {
      params.append(key, value);
    });
    params.append('timestamp', new Date().toISOString());

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending\u2026';
    }

    // Apps Script does not return CORS headers. The browser cannot inspect
    // its response or confirm that the lead was saved.
    fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
      .then(function () {
        // An opaque response is NOT proof of receipt. Keep the fields in place
        // so the visitor can copy the message or contact Kris directly.
        showStatus('notice', form.getAttribute('data-unconfirmed-message') ||
          'We tried to send your request, but this page cannot confirm delivery. If I don\u2019t reply, email ' + CONTACT_EMAIL + ' directly.');
      })
      .catch(function () {
        showStatus('error', 'Something went wrong. Please try again, or email ' + CONTACT_EMAIL + ' directly.');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitLabel;
        }
      });
  });

  function isConfiguredAppsScriptUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === 'https:' &&
        url.hostname === 'script.google.com' &&
        /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname);
    } catch (error) {
      return false;
    }
  }

  function showStatus(type, message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.className = 'form-status form-status--' + type;
    statusEl.removeAttribute('hidden');
  }
}());
