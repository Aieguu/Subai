/**
 * Code Block Interactions (Theme Redesign)
 */

(function () {
  'use strict';

  const SELECTOR = {
    copyButton: '.article-codeblock__copy',
    codeBlock: '.article-codeblock',
    codeContent: '.article-codeblock__body code'
  };

  document.addEventListener('DOMContentLoaded', initCodeBlocks);

  function initCodeBlocks() {
    document.addEventListener('click', handleCopyClick);
  }

  async function handleCopyClick(event) {
    const button = event.target.closest(SELECTOR.copyButton);
    if (!button) return;

    const block = button.closest(SELECTOR.codeBlock);
    if (!block) return;

    const code = block.querySelector(SELECTOR.codeContent);
    if (!code) return;

    const text = code.textContent || '';
    const copyFn = window.Subai && window.Subai.consume ? window.Subai.consume('copyToClipboard') : null;
    const copied = copyFn ? await copyFn(text) : false;

    if (copied) {
      setCopyState(button, 'success');
    } else {
      setCopyState(button, 'error');
    }
  }

  function setCopyState(button, state) {
    const textNode = button.querySelector('.article-codeblock__copy-text');
    const icon = button.querySelector('.article-codeblock__copy-icon');

    const defaultText = button.dataset.copyDefault || 'Copy';
    const successText = button.dataset.copySuccess || 'Copied!';
    const errorText = button.dataset.copyError || 'Error';

    clearCopyState(button, textNode, icon, defaultText);

    if (state === 'success') {
      button.classList.add('is-success');
      if (textNode) textNode.textContent = successText;
      if (icon) {
        icon.innerHTML = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"></path>';
      }
    } else {
      button.classList.add('is-error');
      if (textNode) textNode.textContent = errorText;
      if (icon) {
        icon.innerHTML = '<path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path>';
      }
    }

    window.setTimeout(() => {
      clearCopyState(button, textNode, icon, defaultText);
    }, 1800);
  }

  function clearCopyState(button, textNode, icon, defaultText) {
    button.classList.remove('is-success', 'is-error');
    if (textNode) textNode.textContent = defaultText;
    if (icon) {
      icon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
    }
  }
})();