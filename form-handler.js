/**
 * form-handler.js
 *
 * Sends The Double Blind intake form to the ClearLine Google Apps Script
 * web app. The form action in index.html uses the same endpoint as a
 * no-JavaScript fallback.
 */
(function () {
  'use strict';

  var SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwrKLuu1dvDwzpD72y1BSEBpMNzIXoPlrs9Q8HszOQwFwv7Www8cMSUBEzuFg2sOIiA/exec';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var submitBtn = form.querySelector('button[type="submit"]');
  var statusEl  = document.getElementById('form-status');
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
        showStatus('success', 'Request received \u2014 I\u2019ll be in touch soon.');
        form.reset();
      })
      .catch(function () {
        showStatus('error', 'Something went wrong. Please try again or reach out through GitHub.');
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
