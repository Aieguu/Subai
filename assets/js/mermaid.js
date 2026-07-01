/**
 * Mermaid manager
 * - Lazy-load Mermaid only when diagrams exist
 * - Support PJAX page swaps
 * - Re-render when theme changes
 */

(function () {
  'use strict';

  const MERMAID_SELECTOR = '.mermaid';
  const MERMAID_MODULE_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

  const lightConfig = {
    theme: 'default',
    themeVariables: {
      background: 'transparent',
      primaryColor: '#0a3069',
      primaryTextColor: '#24292f',
      primaryBorderColor: '#0a3069',
      lineColor: '#0a3069',
      textColor: '#24292f',
      tertiaryColor: '#f6f8fa'
    }
  };

  const darkConfig = {
    theme: 'dark',
    themeVariables: {
      background: 'transparent',
      primaryColor: '#58a6ff',
      primaryTextColor: '#e6edf3',
      primaryBorderColor: '#58a6ff',
      lineColor: '#58a6ff',
      textColor: '#e6edf3',
      tertiaryColor: '#161b22'
    }
  };

  let mermaidPromise = null;
  let renderQueue = Promise.resolve();
  let activeTheme = null;
  const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function isDarkTheme() {
    if (document.documentElement.classList.contains('theme-dark')) return true;
    if (document.documentElement.classList.contains('theme-light')) return false;
    return colorSchemeQuery.matches;
  }

  function getThemeConfig() {
    return isDarkTheme() ? darkConfig : lightConfig;
  }

  function getThemeKey() {
    return isDarkTheme() ? 'dark' : 'light';
  }

  function getMermaidNodes(root = document) {
    return Array.from(root.querySelectorAll(MERMAID_SELECTOR));
  }

  function hasMermaid(root = document) {
    return getMermaidNodes(root).length > 0;
  }

  async function loadMermaid() {
    if (!mermaidPromise) {
      mermaidPromise = import(MERMAID_MODULE_URL).then((module) => module.default || module);
    }

    return mermaidPromise;
  }

  function snapshotSource(root = document) {
    getMermaidNodes(root).forEach((node) => {
      if (!node.dataset.mermaidSource) {
        node.dataset.mermaidSource = node.textContent || '';
      }
    });
  }

  function restoreSource(root = document) {
    getMermaidNodes(root).forEach((node) => {
      if (!node.dataset.mermaidSource) return;

      node.removeAttribute('data-processed');
      node.removeAttribute('aria-busy');
      node.innerHTML = '';
      node.textContent = node.dataset.mermaidSource;
    });
  }

  async function renderMermaid({ force = false } = {}) {
    if (!hasMermaid(document)) {
      activeTheme = getThemeKey();
      return;
    }

    const mermaid = await loadMermaid();

    snapshotSource(document);

    if (force) {
      restoreSource(document);
    }

    mermaid.initialize({
      startOnLoad: false,
      ...getThemeConfig()
    });

    const nodes = getMermaidNodes(document);
    if (!nodes.length) return;

    await mermaid.run({
      nodes,
      suppressErrors: false
    });

    activeTheme = getThemeKey();
  }

  function queueRender(options = {}) {
    renderQueue = renderQueue
      .then(() => renderMermaid(options))
      .catch((error) => {
        console.error('[Subai Mermaid] render failed:', error);
      });

    return renderQueue;
  }

  function handleThemeMutation() {
    if (!hasMermaid(document)) {
      activeTheme = getThemeKey();
      return;
    }

    const nextTheme = getThemeKey();
    if (nextTheme === activeTheme) return;

    queueRender({ force: true });
  }

  function initMermaidManager() {
    queueRender();

    document.addEventListener('subai:page-ready', () => {
      queueRender();
    });

    const themeObserver = new MutationObserver(handleThemeMutation);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    if (typeof colorSchemeQuery.addEventListener === 'function') {
      colorSchemeQuery.addEventListener('change', handleThemeMutation);
    } else if (typeof colorSchemeQuery.addListener === 'function') {
      colorSchemeQuery.addListener(handleThemeMutation);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMermaidManager, { once: true });
  } else {
    initMermaidManager();
  }
})();
