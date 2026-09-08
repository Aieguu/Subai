/**
 * Subai Theme - Main JavaScript
 * Handles core functionality and interactions
 */

(function() {
  'use strict';

  // DOM Ready
  document.addEventListener('DOMContentLoaded', function() {
    initThemeOnLoad();
    initMobileMenu();
    initSmoothScrolling();
    initThemeSelector();
    initThemeToggle();
    invokeSubai('initHomeCurrentTime');
    invokeSubai('initDailyQuote');
    invokeSubai('initMusicPlayer');
    invokeSubai('initMusicTerrain');
    invokeSubai('initShareButtons');
    initPjaxNavigation();
    initAnimations();
    initSealStamp();
    initSolarTerm();
  });

  /**
   * 页脚节气 · 物候（本地计算，零请求）
   * 节气日期用 21 世纪通用公式：[Y×0.2422 + C] − [(Y−1)/4]
   */
  const SOLAR_TERMS = [
    ['小寒', 1, 6.11, ['雁北乡', '鹊始巢', '雉雊']],
    ['大寒', 1, 20.84, ['鸡乳', '征鸟厉疾', '水泽腹坚']],
    ['立春', 2, 3.87, ['东风解冻', '蛰虫始振', '鱼陟负冰']],
    ['雨水', 2, 18.73, ['獭祭鱼', '鸿雁来', '草木萌动']],
    ['惊蛰', 3, 5.63, ['桃始华', '仓庚鸣', '鹰化为鸠']],
    ['春分', 3, 20.646, ['玄鸟至', '雷乃发声', '始电']],
    ['清明', 4, 5.59, ['桐始华', '田鼠化为鴽', '虹始见']],
    ['谷雨', 4, 20.888, ['萍始生', '鸣鸠拂其羽', '戴胜降于桑']],
    ['立夏', 5, 5.52, ['蝼蝈鸣', '蚯蚓出', '王瓜生']],
    ['小满', 5, 21.04, ['苦菜秀', '靡草死', '麦秋至']],
    ['芒种', 6, 5.678, ['螳螂生', '鵙始鸣', '反舌无声']],
    ['夏至', 6, 21.37, ['鹿角解', '蜩始鸣', '半夏生']],
    ['小暑', 7, 7.108, ['温风至', '蟋蟀居宇', '鹰始鸷']],
    ['大暑', 7, 22.83, ['腐草为萤', '土润溽暑', '大雨行时']],
    ['立秋', 8, 7.5, ['凉风至', '白露降', '寒蝉鸣']],
    ['处暑', 8, 23.13, ['鹰乃祭鸟', '天地始肃', '禾乃登']],
    ['白露', 9, 7.646, ['鸿雁来', '玄鸟归', '群鸟养羞']],
    ['秋分', 9, 23.042, ['雷始收声', '蛰虫坯户', '水始涸']],
    ['寒露', 10, 8.318, ['鸿雁来宾', '雀入大水为蛤', '菊有黄华']],
    ['霜降', 10, 23.438, ['豺乃祭兽', '草木黄落', '蛰虫咸俯']],
    ['立冬', 11, 7.438, ['水始冰', '地始冻', '雉入大水为蜃']],
    ['小雪', 11, 22.36, ['虹藏不见', '天气上升地气下降', '闭塞而成冬']],
    ['大雪', 12, 7.18, ['鹖鴠不鸣', '虎始交', '荔挺出']],
    ['冬至', 12, 21.94, ['蚯蚓结', '麋角解', '水泉动']]
  ];

  function initSolarTerm() {
    const el = document.querySelector('[data-solar-term]');
    if (!el || el.dataset.computed === 'true') return;

    const now = new Date();
    const year = now.getFullYear();
    const y = year % 100;
    const termDay = (c) => Math.floor(y * 0.2422 + c) - Math.floor((y - 1) / 4);

    let current = null;
    for (const [name, month, c, hous] of SOLAR_TERMS) {
      const date = new Date(year, month - 1, termDay(c));
      if (date <= now) {
        current = { name, start: date, hous };
      }
    }

    // 元旦至小寒前：仍在上一年冬至
    if (!current) {
      const prevY = (year - 1) % 100;
      const day = Math.floor(prevY * 0.2422 + 21.94) - Math.floor((prevY - 1) / 4);
      current = { name: '冬至', start: new Date(year - 1, 11, day), hous: SOLAR_TERMS[23][3] };
    }

    const houIndex = Math.min(2, Math.floor((now - current.start) / 86400000 / 5));
    el.textContent = `${current.name} · ${current.hous[houIndex]}`;
    el.hidden = false;
    el.dataset.computed = 'true';
  }

  /**
   * 落印 —— 每会话只在印章第一次进入视口时播放一次定格动画
   */
  function initSealStamp() {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) return;

    let stamped = false;
    try { stamped = sessionStorage.getItem('subai-seal-stamped') === '1'; } catch (e) { /* ignore */ }
    if (stamped) return;

    const seals = document.querySelectorAll('.seal:not(.seal-in)');
    if (!seals.length) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      seals.forEach((seal) => seal.classList.add('seal-in'));
      try { sessionStorage.setItem('subai-seal-stamped', '1'); } catch (e) { /* ignore */ }
      observer.disconnect();
    }, { threshold: 0.5 });

    seals.forEach((seal) => observer.observe(seal));
    window.Subai.setState('sealObserver', observer);
  }

  /**
   * Initialize theme on page load
   */
  function initThemeOnLoad() {
    const savedTheme = localStorage.getItem('theme') || 'auto';
    setTheme(savedTheme);
  }

  /**
   * Mobile Menu Toggle
   */
  function initMobileMenu() {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileNavigation = document.querySelector('.mobile-navigation');
    if (!mobileMenuToggle || !mobileNavigation || mobileMenuToggle.dataset.bound === 'true') return;

    const desktopMediaQuery = window.matchMedia('(min-width: 769px)');

    const setMenuState = (expanded) => {
      const activeElement = document.activeElement;
      if (!expanded && activeElement instanceof HTMLElement && mobileNavigation.contains(activeElement)) {
        activeElement.blur();
      }

      mobileMenuToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      mobileMenuToggle.setAttribute('aria-label', expanded ? '关闭导航菜单' : '打开导航菜单');
      mobileMenuToggle.classList.toggle('active', expanded);
      mobileNavigation.classList.toggle('active', expanded);
      mobileNavigation.setAttribute('aria-hidden', expanded ? 'false' : 'true');
      if ('inert' in mobileNavigation) {
        mobileNavigation.inert = !expanded;
      }
      document.body.classList.toggle('menu-open', expanded);
    };

    const closeMenu = ({ returnFocus = false } = {}) => {
      if (!mobileNavigation.classList.contains('active')) return;
      setMenuState(false);
      if (returnFocus) {
        mobileMenuToggle.focus();
      }
    };

    const toggleMenu = () => {
      const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
      setMenuState(!isExpanded);
    };

    mobileMenuToggle.addEventListener('click', function() {
      toggleMenu();
    });

    document.addEventListener('click', function(e) {
      if (!mobileMenuToggle.contains(e.target) && !mobileNavigation.contains(e.target)) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && mobileNavigation.classList.contains('active')) {
        closeMenu({ returnFocus: true });
      }
    });

    mobileNavigation.addEventListener('click', function(e) {
      if (e.target.closest('a[href]')) {
        closeMenu();
      }
    });

    const handleDesktopChange = (event) => {
      if (event.matches) {
        closeMenu();
      }
    };

    if (typeof desktopMediaQuery.addEventListener === 'function') {
      desktopMediaQuery.addEventListener('change', handleDesktopChange);
    } else if (typeof desktopMediaQuery.addListener === 'function') {
      desktopMediaQuery.addListener(handleDesktopChange);
    }

    setMenuState(false);
    mobileMenuToggle.dataset.bound = 'true';
  }

  /**
   * Smooth Scrolling for Anchor Links
   */
  function initSmoothScrolling() {
    document.addEventListener('click', function(e) {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      if (link.closest('.toc') || link.closest('#TableOfContents')) return;

      const targetId = link.getAttribute('href').substring(1);
      if (!targetId) return;
      const target = document.getElementById(targetId);
      
      if (target) {
        e.preventDefault();
        
        const headerHeight = document.querySelector('.site-header')?.offsetHeight || 0;
        const targetPosition = target.offsetTop - headerHeight - 20;
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
        
        // Update URL without jumping
        history.pushState(null, null, link.getAttribute('href'));
        
        // Focus target for accessibility
        target.focus();
      }
    });
  }

  /**
   * Theme Selector Functionality (Footer)
   */
  function initThemeSelector() {
    const themeOptions = document.querySelectorAll('.theme-option');
    if (!themeOptions.length) return;

    // Initialize theme selector state
    updateThemeSelector();

    // Add click handlers
    themeOptions.forEach(option => {
      option.addEventListener('click', function(event) {
        const theme = this.dataset.theme;
        setThemeWithTransition(theme, event.clientX, event.clientY);
      });
    });

    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleThemePreferenceChange = function() {
        const currentTheme = localStorage.getItem('theme');
        if (!currentTheme || currentTheme === 'auto') {
          // Re-apply auto theme to trigger CSS media query changes
          setTheme('auto');
          updateThemeSelector();
        }
      };

      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleThemePreferenceChange);
      } else if (typeof mediaQuery.addListener === 'function') {
        mediaQuery.addListener(handleThemePreferenceChange);
      }
    }
  }

  function updateThemeSelector() {
    const themeOptions = document.querySelectorAll('.theme-option');
    const currentTheme = localStorage.getItem('theme') || 'auto';
    
    themeOptions.forEach(option => {
      option.classList.remove('active');
      if (option.dataset.theme === currentTheme) {
        option.classList.add('active');
      }
    });
  }

    function applyThemeClasses(theme) {
    if (theme === 'auto') {
      // Remove all theme classes to let CSS media queries handle auto detection
      document.documentElement.classList.remove('theme-dark', 'theme-light');
    } else if (theme === 'dark') {
      document.documentElement.classList.remove('theme-light');
      document.documentElement.classList.add('theme-dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('theme-dark');
      document.documentElement.classList.add('theme-light');
    }
  }

  function setTheme(theme) {
    localStorage.setItem('theme', theme);

    // Add transitioning class for smooth animations
    document.documentElement.classList.add('theme-transitioning');

    applyThemeClasses(theme);

    // Remove transitioning class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 200); // Match --theme-transition duration
  }

  function effectiveTheme() {
    const saved = localStorage.getItem('theme') || 'auto';
    if (saved !== 'auto') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  /**
   * Theme switch with View Transitions circular reveal from the click point.
   * Falls back to the classic cross-fade when unsupported / reduced motion.
   */
  function setThemeWithTransition(theme, x, y) {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof document.startViewTransition !== 'function') {
      setTheme(theme);
      updateThemeSelector();
      return;
    }

    const originX = typeof x === 'number' ? x : window.innerWidth / 2;
    const originY = typeof y === 'number' ? y : window.innerHeight / 2;

    // localStorage 与主题类都在 VT 回调中才真正应用，
    // UI 联动（页脚选择器选中态）必须在同一时刻同步，否则会慢一拍
    const transition = document.startViewTransition(() => {
      localStorage.setItem('theme', theme);
      applyThemeClasses(theme);
      updateThemeSelector();
    });

    transition.ready.then(() => {
      const radius = Math.hypot(
        Math.max(originX, window.innerWidth - originX),
        Math.max(originY, window.innerHeight - originY)
      );
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${originX}px ${originY}px)`,
            `circle(${radius}px at ${originX}px ${originY}px)`
          ]
        },
        {
          duration: 480,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          pseudoElement: '::view-transition-new(root)'
        }
      );
    }).catch(() => {});
  }

  /**
   * Header theme toggle (sun/moon) — flips between explicit light/dark.
   */
  function initThemeToggle() {
    const toggle = document.querySelector('[data-theme-toggle]');
    if (!toggle || toggle.dataset.bound === 'true') return;

    toggle.addEventListener('click', function(event) {
      const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      const x = event.clientX || window.innerWidth - 48;
      const y = event.clientY || 40;
      setThemeWithTransition(next, x, y);
    });

    toggle.dataset.bound = 'true';
  }

  function invokeSubai(name, ...args) {
    const fn = window.Subai && window.Subai.consume ? window.Subai.consume(name) : null;
    if (typeof fn === 'function') {
      return fn(...args);
    }
    return undefined;
  }

  /**
   * PJAX navigation (preserve audio playback between pages)
   */
  function initPjaxNavigation() {
    if (window.Subai.getState('pjaxReady')) return;
    if (!window.fetch || !window.history || !window.history.pushState || !window.DOMParser) return;
    window.Subai.setState('pjaxReady', true);

    let navigating = false;
    let currentPageKey = `${window.location.pathname}${window.location.search}`;
    const EXCLUDED_EXT_RE = /\.(pdf|zip|rar|7z|jpg|jpeg|png|gif|webp|svg|mp3|mp4|webm|avi|mov|wav|flac)$/i;
    const normalizePath = (path) => (path || '/').replace(/\/+$/, '') || '/';
    const reducedMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const shouldReduceMotion = () => Boolean(reducedMotionQuery && reducedMotionQuery.matches);

    const waitForTransition = (element, timeout = 260) => new Promise((resolve) => {
      if (!element || shouldReduceMotion()) {
        resolve();
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        element.removeEventListener('transitionend', onTransitionEnd);
        resolve();
      };

      const onTransitionEnd = (event) => {
        if (event.target !== element) return;
        finish();
      };

      element.addEventListener('transitionend', onTransitionEnd);
      setTimeout(finish, timeout);
    });

    const cloneScriptElement = (source) => {
      const script = document.createElement('script');

      Array.from(source.attributes).forEach((attribute) => {
        script.setAttribute(attribute.name, attribute.value);
      });

      if (source.textContent) {
        script.textContent = source.textContent;
      }

      return script;
    };

    const syncPageAssets = (nextDocument) => {
      document.head.querySelectorAll('[data-subai-page-asset]').forEach((node) => node.remove());
      document.body.querySelectorAll('[data-subai-page-script]').forEach((node) => node.remove());

      nextDocument.querySelectorAll('head [data-subai-page-asset]').forEach((node) => {
        document.head.appendChild(node.cloneNode(true));
      });

      nextDocument.querySelectorAll('body [data-subai-page-script]').forEach((node) => {
        if (node.tagName === 'SCRIPT') {
          document.body.appendChild(cloneScriptElement(node));
        } else {
          document.body.appendChild(node.cloneNode(true));
        }
      });
    };

    const updateMenuState = (pathname) => {
      const normalizedPath = normalizePath(pathname);

      document.querySelectorAll('.menu-item').forEach((item) => {
        const anchor = item.querySelector('a[href]');
        if (!anchor) return;

        const href = anchor.getAttribute('href');
        if (!href || href.startsWith('#')) return;

        const targetPath = normalizePath(new URL(href, window.location.origin).pathname);
        const isRoot = targetPath === '/';
        const isActive = isRoot
          ? normalizedPath === '/'
          : normalizedPath === targetPath || normalizedPath.startsWith(`${targetPath}/`);

        item.classList.toggle('current-menu-item', isActive);
      });
    };

    const shouldHandleLink = (link, event) => {
      if (!link || !link.getAttribute) return false;
      if (event.defaultPrevented) return false;
      if (event.button !== 0) return false;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
      if (link.target && link.target !== '_self') return false;
      if (link.hasAttribute('download')) return false;
      if (link.dataset.noPjax !== undefined) return false;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;

      let url;
      try {
        url = new URL(href, window.location.href);
      } catch (error) {
        return false;
      }

      if (url.origin !== window.location.origin) return false;
      if (EXCLUDED_EXT_RE.test(url.pathname)) return false;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
      if (url.pathname === window.location.pathname && url.search === window.location.search && !url.hash) return false;
      return true;
    };

    const navigate = async (targetUrl, options = {}) => {
      const { historyMode = 'push', scrollToHash = true } = options;
      if (navigating) return;
      navigating = true;

      document.dispatchEvent(new CustomEvent('subai:page-loading', {
        detail: {
          url: targetUrl.toString()
        }
      }));

      try {
        const response = await fetch(targetUrl, {
          credentials: 'same-origin',
          headers: {
            'X-Requested-With': 'PJAX'
          }
        });

        if (!response.ok) throw new Error(`PJAX fetch failed: ${response.status}`);

        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (!contentType.includes('text/html')) throw new Error('PJAX non-html response');

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const nextMain = doc.querySelector('#main-content');
        const currentMain = document.querySelector('#main-content');

        if (!nextMain || !currentMain) throw new Error('PJAX target not found');

        if (!shouldReduceMotion()) {
          currentMain.classList.remove('is-pjax-entering', 'is-pjax-enter-active');
          currentMain.classList.add('is-pjax-leaving');
          await waitForTransition(currentMain, 240);
        }

        // Remove script tags from parsed content to prevent XSS injection
        nextMain.querySelectorAll('script').forEach(function(s) { s.remove(); });
        currentMain.innerHTML = nextMain.innerHTML;
        if (doc.body) {
          document.body.className = doc.body.className;
        }
        if (doc.title) {
          document.title = doc.title;
        }

        syncPageAssets(doc);

        if (historyMode === 'push') {
          window.history.pushState({ pjax: true }, '', targetUrl);
        } else if (historyMode === 'replace') {
          window.history.replaceState({ pjax: true }, '', targetUrl);
        }

        currentPageKey = `${window.location.pathname}${window.location.search}`;

        updateMenuState(window.location.pathname);

        const initSearchFn = window.Subai && window.Subai.consume ? window.Subai.consume('initSearchPage') : null;
        if (typeof initSearchFn === 'function') {
          await initSearchFn(targetUrl.toString());
        }

        if (scrollToHash && targetUrl.hash) {
          const id = decodeURIComponent(targetUrl.hash.slice(1));
          const target = document.getElementById(id);
          if (target) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
          } else {
            window.scrollTo(0, 0);
          }
        } else {
          window.scrollTo(0, 0);
        }

        invokeSubai('initHomeCurrentTime');
        invokeSubai('initDailyQuote');
        invokeSubai('initMusicPlayer');
        invokeSubai('initMusicTerrain');
        initAnimations();
        initSealStamp();

        if (!shouldReduceMotion()) {
          currentMain.classList.remove('is-pjax-leaving');
          currentMain.classList.add('is-pjax-entering');
          currentMain.getBoundingClientRect();
          currentMain.classList.add('is-pjax-enter-active');
          await waitForTransition(currentMain, 300);
          currentMain.classList.remove('is-pjax-entering', 'is-pjax-enter-active');
        } else {
          currentMain.classList.remove('is-pjax-leaving', 'is-pjax-entering', 'is-pjax-enter-active');
        }

        document.dispatchEvent(new CustomEvent('subai:page-ready', {
          detail: {
            url: targetUrl.toString()
          }
        }));
      } catch (error) {
        window.location.href = targetUrl.toString();
      } finally {
        const mainContent = document.querySelector('#main-content');
        if (mainContent) {
          mainContent.classList.remove('is-pjax-leaving', 'is-pjax-entering', 'is-pjax-enter-active');
        }
        navigating = false;
      }
    };

    window.Subai.register('navigate', (target, options = {}) => {
      try {
        const nextUrl = target instanceof URL ? target : new URL(target, window.location.href);
        return navigate(nextUrl, options);
      } catch (error) {
        window.location.href = String(target);
        return null;
      }
    });

    updateMenuState(window.location.pathname);

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href]');
      if (!shouldHandleLink(link, event)) return;
      event.preventDefault();
      navigate(new URL(link.getAttribute('href'), window.location.href));
    });

    document.addEventListener('subai:navigate', (event) => {
      const target = event.detail?.url;
      if (!target) return;

      try {
        navigate(new URL(target, window.location.href));
      } catch (error) {
        window.location.href = target;
      }
    });

    window.addEventListener('popstate', () => {
      const nextPageKey = `${window.location.pathname}${window.location.search}`;
      if (nextPageKey === currentPageKey) {
        if (window.location.hash) {
          const id = decodeURIComponent(window.location.hash.slice(1));
          const target = document.getElementById(id);
          if (target) {
            target.scrollIntoView({ behavior: 'auto', block: 'start' });
            return;
          }
        }
        window.scrollTo(0, 0);
        return;
      }

      navigate(new URL(window.location.href), { historyMode: 'none', scrollToHash: true });
    });
  }

  /**
   * Scroll Animations
   */
  function initAnimations() {
    if ('IntersectionObserver' in window) {
      const prevObserver = window.Subai.getState('animObserver');
      if (prevObserver && typeof prevObserver.disconnect === 'function') {
        prevObserver.disconnect();
      }

      const animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
          }
        });
      }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
      });

      // Animate elements on scroll —— stagger 逐项入场，封顶 8 项
      document.querySelectorAll('.post-card, .taxonomy-card, .home-mosaic-tile').forEach((el, index) => {
        el.style.setProperty('--stagger-index', Math.min(index % 8, 7));
        animationObserver.observe(el);
      });

      window.Subai.setState('animObserver', animationObserver);
    }
  }

})();


