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

  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbym6aP7bGMbJ_X_Yt2hq1Tt6Qg6RSmr5VLzRg9k99205Xj08V6jcAj7z-JK--cEj_ud/exec';

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
      showStatus('error', 'The form is not configured yet. Please reach out through GitHub.');
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

    // Apps Script does not return CORS headers, so the browser cannot inspect
    // the response. A resolved fetch confirms that the request was sent.
    fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
      .then(function () {
        // The no-cors post cannot confirm receipt, so say what happens next and
        // give the email as a fallback. Pages can override via data-success-message.
        showStatus('success', form.getAttribute('data-success-message') ||
          'Request received. I\u2019ll reply by email. If you don\u2019t hear back, email ' + CONTACT_EMAIL + '.');
        form.reset();
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
