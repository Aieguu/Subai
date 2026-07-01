/**
 * Shared clipboard utility
 * Provides a single copyToClipboard implementation used by
 * code-highlight.js and home-widgets.js.
 */
(function() {
  'use strict';

  window.Subai.register('copyToClipboard', async function(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (error) {
        // fallback below
      }
    }

    var textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (error) {
      ok = false;
    }

    document.body.removeChild(textArea);
    return ok;
  });
})();
