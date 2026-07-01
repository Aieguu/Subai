/**
 * KaTeX math manager
 * - Lazy-load KaTeX only when current page contains math delimiters
 * - Support PJAX page swaps
 * - Keep backward compatibility for legacy "[ ... ]" block formulas
 */

(function () {
  'use strict';

  const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css';
  const KATEX_JS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js';
  const KATEX_AUTORENDER_JS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/contrib/auto-render.min.js';

  let assetsPromise = null;
  let renderQueue = Promise.resolve();

  function getTargets(root = document) {
    return Array.from(root.querySelectorAll('.post-content .content'));
  }

  function hasMathDelimiter(text) {
    if (!text) return false;
    return /(\\\(|\\\[|\\begin\{[a-zA-Z*]+\}|(^|[^\\])\$\$|(^|[^\\])\$[^$\n]+?\$)/m.test(text);
  }

  function isLegacyBracketBlock(text) {
    return /^\[[\s\S]+\]$/.test(text) && /\\[a-zA-Z]+/.test(text);
  }

  function looksLikeMathContainer(container) {
    const text = container.textContent || '';
    if (hasMathDelimiter(text)) {
      return true;
    }

    return Array.from(container.querySelectorAll('p')).some((paragraph) =>
      isLegacyBracketBlock((paragraph.textContent || '').trim())
    );
  }

  function normalizeLegacyMath(container) {
    container.querySelectorAll('p').forEach((paragraph) => {
      const text = (paragraph.textContent || '').trim();
      if (!isLegacyBracketBlock(text)) return;
      paragraph.textContent = `\\[${text.slice(1, -1).trim()}\\]`;
    });
  }

  function ensureStylesheet(id, href) {
    const existing = document.querySelector(`link[data-subai-id="${id}"]`);
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-subai-id', id);
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener('error', () => reject(new Error(`Failed to load stylesheet: ${href}`)), { once: true });
      document.head.appendChild(link);
    });
  }

  function ensureScript(id, src) {
    const existing = document.querySelector(`script[data-subai-id="${id}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      });
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.defer = true;
      script.setAttribute('data-subai-id', id);
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        resolve();
      }, { once: true });
      script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      document.body.appendChild(script);
    });
  }

  async function ensureMathAssets() {
    if (!assetsPromise) {
      assetsPromise = (async () => {
        await ensureStylesheet('subai-katex-css', KATEX_CSS_URL);
        await ensureScript('subai-katex-js', KATEX_JS_URL);
        await ensureScript('subai-katex-autorender-js', KATEX_AUTORENDER_JS_URL);
      })();
    }
    return assetsPromise;
  }

  async function renderMath() {
    const targets = getTargets(document).filter(looksLikeMathContainer);
    if (!targets.length) return;

    await ensureMathAssets();

    if (typeof window.renderMathInElement !== 'function') {
      return;
    }

    targets.forEach((container) => {
      normalizeLegacyMath(container);

      window.renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false,
        strict: 'ignore'
      });
    });
  }

  function queueRender() {
    renderQueue = renderQueue
      .then(() => renderMath())
      .catch((error) => {
        console.error('[Subai Math] render failed:', error);
      });
    return renderQueue;
  }

  function initMathManager() {
    queueRender();
    document.addEventListener('subai:page-ready', () => {
      queueRender();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMathManager, { once: true });
  } else {
    initMathManager();
  }
})();
