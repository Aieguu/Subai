/**
 * 图片预览：View Transitions 共享元素形变 + 原生 <dialog> top layer
 *
 * 设计约定：
 * - 正文图片始终留在常规文档流里，不再克隆 position:fixed 的浮动代理图，
 *   也不再用 top/left/width/height 过渡手写 FLIP。
 * - 打开 / 关闭时给「源图」与「预览大图」临时挂同一个 view-transition-name，
 *   由浏览器在视口坐标下捕捉快照并做形变，天然跟随当前滚动位置与窗口尺寸。
 * - 滚动锁定 + 滚动条宽度补偿保证页面不横跳；背景 inert、焦点归还、Escape
 *   全部交给 dialog.showModal() / close()，不再手写焦点陷阱。
 * - 状态收尾统一走 close 事件并延迟到快照捕捉之后，不依赖过渡 Promise：
 *   top layer 关闭时 startViewTransition().finished 可能迟迟不 settle。
 * - 不支持 View Transitions 或用户偏好减少动效时，降级为 WAAPI 整体淡入淡出。
 * - 预览图优先取 img 上的 data-zoom-src（当前能提供的最大位图）。正文那一档
 *   是按 1× 屏选的，直接拿来放大必然发虚；大图解码完再替换，先保证不空白。
 * - 兼容 PJAX：换页后重新标记当前文档的图片，换页时收掉未完成的过渡。
 */

(function () {
  'use strict';

  var VT_NAME = 'article-image-zoom';

  var state = {
    dialog: null,
    image: null,
    caption: null,
    source: null,
    closing: false,
    pending: false
  };

  var reduceMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  function prefersReducedMotion() {
    return Boolean(reduceMotion && reduceMotion.matches);
  }

  function supportsViewTransitions() {
    return typeof document.startViewTransition === 'function'
      && Boolean(window.CSS && CSS.supports && CSS.supports('view-transition-name', VT_NAME))
      && !prefersReducedMotion();
  }

  /* 时长与缓动的唯一真源在 lightbox.css，JS 只读取它用于降级与收尾延迟 */
  function motionOptions() {
    var root = getComputedStyle(document.documentElement);
    var duration = parseFloat(root.getPropertyValue('--image-zoom-duration'));
    var easing = root.getPropertyValue('--image-zoom-ease').trim() || 'ease';

    return {
      duration: isNaN(duration) ? 380 : duration,
      easing: easing
    };
  }

  function getZoomableImages() {
    return Array.prototype.slice.call(
      document.querySelectorAll('.article-image img, .content p > img:only-child')
    );
  }

  function isZoomableImage(image) {
    if (!image || image.tagName !== 'IMG') return false;
    if (image.closest('.article-image')) return true;

    var parent = image.parentElement;
    return Boolean(parent && parent.matches('p') && parent.children.length === 1 && parent.closest('.content'));
  }

  function markZoomableImages() {
    getZoomableImages().forEach(function (image) {
      image.classList.add('is-zoomable');
      image.setAttribute('tabindex', '0');
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', (image.alt || '图片') + '，点击放大查看');
    });
  }

  function getCaption(image) {
    var wrapper = image.closest('.article-image');
    if (!wrapper) return '';

    var node = wrapper.querySelector('.article-image-caption');
    return node ? node.textContent.trim() : '';
  }

  function createDialog() {
    var dialog = document.getElementById('image-lightbox');
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = 'image-lightbox';
    dialog.className = 'image-lightbox';
    dialog.setAttribute('aria-label', '图片预览');
    dialog.innerHTML = [
      '<button class="image-lightbox-close" type="button" aria-label="关闭预览">',
      '  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">',
      '    <path d="M6 6l12 12M18 6L6 18"></path>',
      '  </svg>',
      '</button>',
      '<img class="image-lightbox-image" alt="">',
      '<p class="image-lightbox-caption" hidden></p>'
    ].join('');

    document.body.appendChild(dialog);
    return dialog;
  }

  function lockScroll() {
    var width = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    document.documentElement.style.setProperty('--image-lightbox-scrollbar-width', width + 'px');
    document.body.classList.add('image-lightbox-open');
  }

  function unlockScroll() {
    document.body.classList.remove('image-lightbox-open');
    document.documentElement.style.removeProperty('--image-lightbox-scrollbar-width');
  }

  function setName(element, name) {
    if (!element) return;
    if (name) element.style.viewTransitionName = name;
    else element.style.removeProperty('view-transition-name');
  }

  /* 图片元素上的 data-zoom-src 是当前能提供的最大位图。正文那一档是按
     1× 屏选的，直接拿来放大必然发虚。统一解析成绝对地址，才能和
     currentSrc 直接比较。 */
  function zoomSourceOf(image) {
    var zoom = image.getAttribute('data-zoom-src');
    return zoom ? new URL(zoom, document.baseURI).href : image.src;
  }

  /* 悬停预取：真正点开时大图多半已在 HTTP 缓存里，切换几乎无感 */
  function prefetchZoom(image) {
    var url = zoomSourceOf(image);
    if (!url || url === (image.currentSrc || image.src)) return;
    if (image.dataset.zoomPrefetched === url) return;
    image.dataset.zoomPrefetched = url;
    var probe = new Image();
    probe.src = url;
  }

  /* 打开时就把画框定死：宽高取自最大候选的像素尺寸（img 上的 width/height
     属性），换成大图时不会再撑大一次。大图到位前用正文那张垫一层背景，
     打开瞬间不会留白。 */
  function applyContent(image) {
    var caption = getCaption(image);
    var base = image.currentSrc || image.src;
    var full = zoomSourceOf(image);
    var width = parseInt(image.getAttribute('width'), 10);
    var height = parseInt(image.getAttribute('height'), 10);

    if (width > 0 && height > 0) {
      state.image.setAttribute('width', width);
      state.image.setAttribute('height', height);
    }

    state.image.style.backgroundImage = full === base ? '' : 'url("' + base + '")';
    state.image.src = full;
    state.image.alt = image.alt || '';
    state.caption.textContent = caption;
    state.caption.hidden = !caption;
  }

  function clearContent() {
    if (!state.image) return;
    state.image.removeAttribute('src');
    state.image.removeAttribute('alt');
    state.image.removeAttribute('width');
    state.image.removeAttribute('height');
    state.image.style.backgroundImage = '';
    state.caption.textContent = '';
    state.caption.hidden = true;
  }

  function resetState() {
    setName(state.source, null);
    setName(state.image, null);
    clearContent();
    state.source = null;
    state.closing = false;
  }

  function show() {
    lockScroll();
    state.dialog.showModal();
  }

  function hide() {
    var wasOpen = state.dialog.open;
    if (wasOpen) state.dialog.close();
    unlockScroll();
    if (!wasOpen) resetState();
  }

  function fadeIn() {
    var options = motionOptions();
    if (options.duration <= 0) return;

    state.dialog.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: options.duration, easing: options.easing }
    );
  }

  function fadeOut(done) {
    var options = motionOptions();
    if (options.duration <= 0) {
      done();
      return;
    }

    var animation = state.dialog.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: Math.round(options.duration * 0.7), easing: 'ease-in' }
    );
    animation.finished.then(done, done);
  }

  function runOpen(image) {
    state.source = image;
    applyContent(image);

    if (!supportsViewTransitions()) {
      show();
      fadeIn();
      return;
    }

    setName(image, VT_NAME);

    var transition;
    try {
      transition = document.startViewTransition(function () {
        setName(image, null);
        show();
        setName(state.image, VT_NAME);
      });
    } catch (error) {
      // 浏览器临时拒绝过渡（例如已有过渡在跑）时，仍要保证预览能打开
      setName(image, null);
      show();
      return;
    }

    // 过渡完成后释放共享名；兜底计时器避免 Promise 不 settle 时残留
    var settled = false;
    var finishOpen = function () {
      if (settled) return;
      settled = true;
      setName(state.image, null);
    };
    transition.finished.then(finishOpen, finishOpen);
    window.setTimeout(finishOpen, Math.max(0, motionOptions().duration) + 200);
  }

  function openLightbox(image) {
    if (!state.dialog || state.dialog.open || state.closing || state.pending) return;

    // 先确保位图已解码，过渡快照里不会出现空白图片
    if (typeof image.decode === 'function') {
      state.pending = true;
      var settle = function () {
        if (!state.pending) return;  // PJAX 换页期间已取消
        state.pending = false;
        if (!state.dialog.open) runOpen(image);
      };
      image.decode().then(settle, settle);
    } else {
      runOpen(image);
    }
  }

  function closeLightbox() {
    if (!state.dialog || !state.dialog.open || state.closing) return;

    var source = state.source;

    // 源图已随换页消失，或减少动效 / 不支持 VT：走整体淡出
    if (!supportsViewTransitions() || !source || !document.body.contains(source)) {
      state.closing = true;
      fadeOut(hide);
      return;
    }

    state.closing = true;
    setName(state.image, VT_NAME);

    // 过渡一结束就释放共享名与状态，用户能立刻再次放大；
    // close 事件里的定时器仍作为兜底，防止 finished 不 settle。
    var settled = false;
    var finish = function () {
      if (settled) return;
      settled = true;
      resetState();
    };

    try {
      var transition = document.startViewTransition(function () {
        setName(state.image, null);
        state.dialog.close();
        unlockScroll();
        setName(source, VT_NAME);
      });
      transition.finished.then(finish, finish);
    } catch (error) {
      setName(state.image, null);
      hide();
      finish();
    }
  }

  function findZoomableImage(target) {
    if (!target || typeof target.closest !== 'function') return null;
    var image = target.closest('img');
    return isZoomableImage(image) ? image : null;
  }

  function bindDialogEvents() {
    state.dialog.addEventListener('click', function (event) {
      if (event.target === state.dialog || event.target.closest('.image-lightbox-close')) {
        closeLightbox();
      }
    });

    // Escape 由 dialog 原生触发 cancel；拦下默认关闭，改走带过渡的路径
    state.dialog.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeLightbox();
    });

    // 统一收尾：等浏览器捕捉完 new 快照再释放共享名与内容。
    // 不依赖 transition.finished —— top layer 关闭时它可能不 settle。
    state.dialog.addEventListener('close', function () {
      unlockScroll();
      var delay = Math.max(0, motionOptions().duration) + 60;
      window.setTimeout(function () {
        if (state.dialog.open) return;  // 期间又打开了，跳过本轮清理
        resetState();
      }, delay);
    });
  }

  function initImageLightbox() {
    if (!state.dialog) {
      state.dialog = createDialog();
      state.image = state.dialog.querySelector('.image-lightbox-image');
      state.caption = state.dialog.querySelector('.image-lightbox-caption');
      bindDialogEvents();
    }

    markZoomableImages();
  }

  function teardown() {
    // 换页时源图即将被替换，直接收尾，不启动过渡
    state.pending = false;
    if (state.dialog && state.dialog.open) {
      state.dialog.close();
      unlockScroll();
      resetState();
    }
  }

  // 指针进入时预取最大位图：点开的瞬间只等解码，不等网络
  document.addEventListener('pointerover', function (event) {
    var image = findZoomableImage(event.target);
    if (image) prefetchZoom(image);
  });

  document.addEventListener('click', function (event) {
    var image = findZoomableImage(event.target);
    if (!image) return;

    event.preventDefault();
    openLightbox(image);
  });

  document.addEventListener('keydown', function (event) {
    if ((event.key === 'Enter' || event.key === ' ') && isZoomableImage(event.target)) {
      event.preventDefault();
      openLightbox(event.target);
    }
  });

  document.addEventListener('DOMContentLoaded', initImageLightbox);
  document.addEventListener('subai:page-ready', initImageLightbox);
  document.addEventListener('subai:page-loading', teardown);
})();
