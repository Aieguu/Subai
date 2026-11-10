/**
 * Article Page Enhancements
 * - 目录进度读数（阅读进度只在 TOC 呈现）
 * - 正文块级元素的滚动显现
 * - 回到顶部
 *
 * 兼容 PJAX：每次换页后重新绑定当前文档中的元素，
 * 所有监听器只在首次运行时挂载一次。
 */

(function () {
  'use strict';

  var state = {
    observer: null,
    content: null,
    meter: null,
    percentNodes: [],
    frame: 0,
    listening: false,
    boundTop: false
  };

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function prefersReducedMotion() {
    return Boolean(reduceMotion && reduceMotion.matches);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function resetProgress() {
    if (state.meter) {
      state.meter.style.transform = 'scaleX(0)';
    }
    state.percentNodes.forEach(function (node) {
      node.textContent = '0%';
    });
  }

  function updateProgress() {
    state.frame = 0;

    var content = state.content;
    if (!content) {
      return;
    }

    var rect = content.getBoundingClientRect();
    var contentTop = rect.top + (window.scrollY || window.pageYOffset || 0);
    var viewport = window.innerHeight || document.documentElement.clientHeight;
    var total = content.offsetHeight - viewport;
    var scrolled = (window.scrollY || 0) - contentTop;

    var progress = total > 0 ? clamp(scrolled / total, 0, 1) : scrolled > 0 ? 1 : 0;

    if (state.meter) {
      state.meter.style.transform = 'scaleX(' + progress.toFixed(4) + ')';
    }

    var label = Math.round(progress * 100) + '%';
    state.percentNodes.forEach(function (node) {
      node.textContent = label;
    });
  }

  function requestProgress() {
    if (state.frame) {
      return;
    }
    state.frame = window.requestAnimationFrame(updateProgress);
  }

  function bindGlobalListeners() {
    if (!state.listening) {
      window.addEventListener('scroll', requestProgress, { passive: true });
      window.addEventListener('resize', requestProgress, { passive: true });
      state.listening = true;
    }

    if (!state.boundTop) {
      document.addEventListener('click', function (event) {
        var target = event.target;
        if (!target || typeof target.closest !== 'function') {
          return;
        }

        var trigger = target.closest('[data-back-to-top]');
        if (!trigger) {
          return;
        }

        event.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion() ? 'auto' : 'smooth'
        });
      });
      state.boundTop = true;
    }
  }

  function collectRevealTargets(container) {
    var selector = 'h2, h3, blockquote, table, .table-wrap, .article-codeblock';
    var nodes = [];

    Array.prototype.forEach.call(container.children, function (child) {
      if (child.matches && child.matches(selector)) {
        nodes.push(child);
      }
    });

    return nodes;
  }

  function setupReveal(container) {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    if (!container || prefersReducedMotion() || !('IntersectionObserver' in window)) {
      return;
    }

    var nodes = collectRevealTargets(container);
    if (!nodes.length) {
      return;
    }

    nodes.forEach(function (node) {
      node.classList.add('reveal');
    });
    document.documentElement.classList.add('has-reveal');

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    }, {
      root: null,
      rootMargin: '0px 0px -6% 0px',
      threshold: 0.01
    });

    nodes.forEach(function (node) {
      observer.observe(node);
    });

    state.observer = observer;
  }

  function collectTargets() {
    var root = document.querySelector('.single');
    var content = document.getElementById('article-content');

    state.content = content ? content.closest('.article-body') || content : null;
    state.meter = document.querySelector('[data-toc-meter]');
    state.percentNodes = Array.prototype.slice.call(
      document.querySelectorAll('[data-toc-percent]')
    );

    if (!root || !state.content) {
      resetProgress();
      if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
      }
      return false;
    }

    return true;
  }

  function boot() {
    bindGlobalListeners();

    if (!collectTargets()) {
      return;
    }

    setupReveal(document.getElementById('article-content'));
    updateProgress();
  }

  function teardown() {
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }

    resetProgress();
    state.content = null;
    state.meter = null;
    state.percentNodes = [];
  }

  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('subai:page-ready', boot);
  document.addEventListener('subai:page-loading', teardown);
})();
