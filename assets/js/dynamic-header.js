/**
 * 阅读态标题（支持 PJAX 页面切换）
 *
 * 设计约定：
 * - 只在带 #post-title 的页面启用（正文页与主题说明页）。列表 / 分类 / 标签 /
 *   搜索页的「标题」等于栏目名，信息量为零，不值得为它挤掉导航。
 * - 标题只占用左侧「品牌」那一格，导航与搜索原地保留，随时可用。
 * - 方向切换带累计阈值（迟滞），避免触控板惯性、回弹造成的闪烁。
 */

(function() {
  'use strict';

  const TITLE_SELECTORS = [
    '#post-title',
    '.post-hero .post-title'
  ];

  const SCROLLED_AT = 24;      // 离开顶部多少像素后收成悬浮岛屿
  const UP_TRAVEL = 56;        // 向上累计滚动多少像素才把导航换回来
  const DOWN_TRAVEL = 32;      // 向下累计滚动多少像素才再次进入阅读态
  const JUMP_GUARD = 120;      // 单帧位移超过此值视为锚点跳转 / 拖拽滚动条，不计入方向

  const state = {
    initialized: false,
    observer: null,
    siteHeader: null,
    dynamicHeader: null,
    dynamicTitle: null,
    titleSource: null,
    targetTitle: '',
    titlePassed: false,
    headerHeight: 0,
    mode: 'nav',
    travel: 0,
    lastScrollY: 0,
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

  /**
   * 唯一的状态出口：Header 的类名统一在这里落地，
   * 避免多个开关各自 toggle 造成状态打架。
   */
  function syncHeaderChrome() {
    if (!state.siteHeader) return;

    state.siteHeader.classList.toggle('is-scrolled', (window.scrollY || 0) > SCROLLED_AT);

    const reading = state.titlePassed && state.mode === 'title';
    state.siteHeader.classList.toggle('dynamic-active', reading);

    if (state.dynamicHeader) {
      state.dynamicHeader.classList.toggle('active', reading);
    }
  }

  /**
   * 直接量测标题位置，不依赖 IntersectionObserver 的回调时机：
   * 锚点跳转时滚动事件可能先于 observer 触发，否则会卡在导航态。
   */
  function isTitlePassed() {
    if (!state.titleSource) return false;
    return state.titleSource.getBoundingClientRect().bottom <= state.headerHeight + 8;
  }

  function setMode(mode) {
    if (state.mode === mode) return;
    state.mode = mode;
    state.travel = 0;
  }

  function clearDynamicState() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    state.titleSource = null;
    state.targetTitle = '';
    state.titlePassed = false;
    state.headerHeight = 0;
    state.mode = 'nav';
    state.travel = 0;
    state.lastScrollY = window.scrollY || 0;
    state.ticking = false;

    if (state.dynamicTitle) {
      state.dynamicTitle.textContent = '';
      state.dynamicTitle.removeAttribute('title');
    }

    syncHeaderChrome();
  }

  function onScroll() {
    if (state.ticking) return;
    state.ticking = true;

    requestAnimationFrame(function() {
      state.ticking = false;

      const current = window.scrollY || 0;
      const delta = current - state.lastScrollY;
      state.lastScrollY = current;

      state.titlePassed = isTitlePassed();

      if (!state.titlePassed) {
        // 回到标题之上：立刻恢复导航
        state.mode = 'nav';
        state.travel = 0;
      } else if (Math.abs(delta) >= JUMP_GUARD) {
        // 锚点跳转 / 拖动滚动条：方向本身就是明确意图，不累计、直接切换
        setMode(delta > 0 ? 'title' : 'nav');
      } else if (state.mode === 'title') {
        // 阅读态下只累计「向上」的行程，回读一小段不会立刻把导航弹回来
        state.travel += Math.min(delta, 0);
        if (state.travel <= -UP_TRAVEL) {
          setMode('nav');
        }
      } else {
        state.travel += Math.max(delta, 0);
        if (state.travel >= DOWN_TRAVEL) {
          setMode('title');
        }
      }

      syncHeaderChrome();
    });
  }

  function scrollToTop() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  }

  /**
   * 100vw 含经典滚动条宽度，布局视口不含。
   * 把两者差值写成 --sbw，岛屿内边距的补偿量才能对上真实可用宽度，
   * 否则 1200–1232px 区间会多补半个滚动条的宽度。
   */
  function syncScrollbarWidth() {
    const viewport = window.innerWidth;
    const available = document.documentElement.clientWidth;
    const scrollbar = viewport > available ? viewport - available : 0;

    document.documentElement.style.setProperty('--sbw', scrollbar + 'px');
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
    state.dynamicTitle.setAttribute('title', state.targetTitle);
    state.lastScrollY = window.scrollY || 0;

    state.headerHeight = state.siteHeader.offsetHeight || 0;
    const headerHeight = state.headerHeight;
    const observerOptions = {
      root: null,
      threshold: [0, 1],
      rootMargin: `-${headerHeight + 8}px 0px 0px 0px`
    };

    state.observer = new IntersectionObserver(function(entries) {
      const entry = entries[0];
      if (!entry || !state.targetTitle) {
        state.titlePassed = false;
        state.mode = 'nav';
        state.travel = 0;
        syncHeaderChrome();
        return;
      }

      state.titlePassed = !entry.isIntersecting && entry.boundingClientRect.bottom <= headerHeight + 8;

      if (!state.titlePassed) {
        // 回到标题之上：立刻恢复导航，不需要等方向判断
        state.mode = 'nav';
        state.travel = 0;
      }

      syncHeaderChrome();
    }, observerOptions);

    state.observer.observe(source);
  }

  function refreshDynamicHeader() {
    syncScrollbarWidth();
    bindObserver();
    syncHeaderChrome();
  }

  function initDynamicHeader() {
    syncScrollbarWidth();

    if (!state.initialized) {
      state.siteHeader = document.querySelector('.site-header');
      state.dynamicHeader = document.getElementById('dynamic-header');
      state.dynamicTitle = document.getElementById('dynamic-title');

      if (!state.siteHeader || !state.dynamicHeader || !state.dynamicTitle) {
        return;
      }

      state.lastScrollY = window.scrollY || 0;
      state.dynamicHeader.addEventListener('click', scrollToTop);

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
