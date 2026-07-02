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
    invokeSubai('initHomeCurrentTime');
    invokeSubai('initDailyQuote');
    invokeSubai('initMusicPlayer');
    invokeSubai('initShareButtons');
    initPjaxNavigation();
    initAnimations();
    initAccessibility();
  });

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
      option.addEventListener('click', function() {
        const theme = this.dataset.theme;
        setTheme(theme);
        updateThemeSelector();
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

  function setTheme(theme) {
    localStorage.setItem('theme', theme);
    
    // Add transitioning class for smooth animations
    document.documentElement.classList.add('theme-transitioning');
    
    // Apply theme immediately for better performance
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
    
    // Remove transitioning class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 200); // Match --theme-transition duration
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
        initAnimations();

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

      // Animate elements on scroll
      document.querySelectorAll('.post-card, .taxonomy-card, .home-mosaic-tile').forEach(el => {
        animationObserver.observe(el);
      });

      window.Subai.setState('animObserver', animationObserver);
    }
  }

  /**
   * Accessibility Enhancements
   */
  function initAccessibility() {
    // Skip link functionality
    const skipLink = document.querySelector('.skip-link');
    if (skipLink) {
      skipLink.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.focus();
          target.scrollIntoView();
        }
      });
    }
  }

})();


