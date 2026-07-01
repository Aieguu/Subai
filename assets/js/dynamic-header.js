/**
 * Dynamic header title (supports PJAX page swaps)
 * Uses IntersectionObserver instead of scroll threshold polling.
 */

(function() {
  'use strict';

  const TITLE_SELECTORS = [
    '.post-info .title-box .title',
    '#post-title',
    '#category-title',
    '#tag-title',
    '#search-title',
    '.page-title'
  ];

  const state = {
    initialized: false,
    observer: null,
    siteHeader: null,
    dynamicHeader: null,
    dynamicTitle: null,
    titleSource: null,
    targetTitle: '',
    titlePassed: false,
    lastScrollY: 0,
    lastDirection: 'down',
    ticking: false
  };

  function getTitleSource() {
    for (const selector of TITLE_SELECTORS) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element;
      }
    }

    return null;
  }

  function setDynamicState(active) {
    if (!state.dynamicHeader || !state.siteHeader || !state.targetTitle) {
      return;
    }

    state.dynamicTitle.textContent = state.targetTitle;
    state.dynamicHeader.classList.toggle('active', active);
    state.siteHeader.classList.toggle('dynamic-active', active);
  }

  function clearDynamicState() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.titleSource = null;
    state.targetTitle = '';
    state.titlePassed = false;
    state.lastScrollY = window.scrollY || 0;
    state.lastDirection = 'down';
    state.ticking = false;

    if (state.dynamicTitle) {
      state.dynamicTitle.textContent = '';
    }

    if (state.dynamicHeader) {
      state.dynamicHeader.classList.remove('active');
    }

    if (state.siteHeader) {
      state.siteHeader.classList.remove('dynamic-active');
    }
  }

  function updateHeaderMode() {
    state.ticking = false;

    if (!state.targetTitle || !state.titlePassed) {
      setDynamicState(false);
      return;
    }

    const currentScrollY = window.scrollY || 0;
    const delta = currentScrollY - state.lastScrollY;

    if (Math.abs(delta) > 2) {
      state.lastDirection = delta > 0 ? 'down' : 'up';
    }

    state.lastScrollY = currentScrollY;

    setDynamicState(state.lastDirection === 'down');
  }

  function onScroll() {
    if (state.ticking) return;
    state.ticking = true;
    requestAnimationFrame(updateHeaderMode);
  }

  function bindObserver() {
    if (!state.siteHeader || !state.dynamicHeader || !state.dynamicTitle) {
      return;
    }

    clearDynamicState();

    const source = getTitleSource();
    if (!source) {
      return;
    }

    state.titleSource = source;
    state.targetTitle = source.textContent.trim();
    state.dynamicTitle.textContent = state.targetTitle;
    state.lastScrollY = window.scrollY || 0;

    const headerHeight = state.siteHeader.offsetHeight || 0;
    const observerOptions = {
      root: null,
      threshold: [0, 1],
      rootMargin: `-${headerHeight + 8}px 0px 0px 0px`
    };

    state.observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry || !state.targetTitle) {
        state.titlePassed = false;
        setDynamicState(false);
        return;
      }

      state.titlePassed = !entry.isIntersecting && entry.boundingClientRect.bottom <= headerHeight + 8;

      if (!state.titlePassed) {
        setDynamicState(false);
        return;
      }

      updateHeaderMode();
    }, observerOptions);

    state.observer.observe(source);
  }

  function refreshDynamicHeader() {
    bindObserver();
  }

  function initDynamicHeader() {
    if (!state.initialized) {
      state.siteHeader = document.querySelector('.site-header');
      state.dynamicHeader = document.getElementById('dynamic-header');
      state.dynamicTitle = document.getElementById('dynamic-title');

      if (!state.siteHeader || !state.dynamicHeader || !state.dynamicTitle) {
        return;
      }

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', refreshDynamicHeader, { passive: true });
      state.initialized = true;
    }

    refreshDynamicHeader();
  }

  document.addEventListener('DOMContentLoaded', initDynamicHeader);
  document.addEventListener('subai:page-loading', clearDynamicState);
  document.addEventListener('subai:page-ready', initDynamicHeader);
})();
