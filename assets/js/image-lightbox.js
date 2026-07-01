/**
 * Image lightbox for article and featured images (supports PJAX)
 */

(function() {
  'use strict';

  if (window.Subai && window.Subai.getState('lightboxReady')) return;
  if (window.Subai) window.Subai.setState('lightboxReady', true);

  const state = {
    overlay: null,
    overlayImage: null,
    overlayCaption: null,
    currentSourceImage: null,
    sourceProxy: null,
    lastActiveElement: null,
    isClosing: false,
    reduceMotion: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  function getZoomableImages() {
    return Array.from(document.querySelectorAll('.article-image img, .content p > img:only-child'));
  }

  function isZoomableImage(image) {
    if (!image || image.tagName !== 'IMG') return false;
    if (image.closest('.article-image')) return true;

    const parent = image.parentElement;
    return Boolean(parent && parent.matches('p') && parent.children.length === 1 && parent.closest('.content'));
  }

  function markZoomableImages() {
    getZoomableImages().forEach((image) => {
      image.classList.add('is-zoomable');
      image.setAttribute('tabindex', '0');
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', `${image.alt || '图片'}，点击放大查看`);
    });
  }

  function getImageCaption(image) {
    const articleImage = image.closest('.article-image');
    if (!articleImage) return '';

    const caption = articleImage.querySelector('.article-image-caption');
    return caption ? caption.textContent.trim() : '';
  }

  function createLightbox() {
    let overlay = document.getElementById('image-lightbox-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'image-lightbox-overlay';
    overlay.className = 'image-lightbox-overlay';
    overlay.tabIndex = -1;
    overlay.innerHTML = [
      '<div class="image-lightbox-backdrop"></div>',
      '<div class="image-lightbox-dialog" role="dialog" aria-modal="true" aria-label="图片预览">',
      '  <img class="image-lightbox-image" alt="">',
      '  <div class="image-lightbox-caption" hidden></div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);
    return overlay;
  }

  function cleanupSourceProxy() {
    if (state.sourceProxy && state.sourceProxy.parentNode) {
      state.sourceProxy.parentNode.removeChild(state.sourceProxy);
    }
    state.sourceProxy = null;
  }

  function createProxyFromElement(image, rect) {
    const proxy = document.createElement('img');
    const computedStyle = window.getComputedStyle(image);

    proxy.className = 'image-lightbox-source-proxy';
    proxy.src = image.currentSrc || image.src;
    proxy.alt = image.alt || '';
    proxy.setAttribute('aria-hidden', 'true');
    proxy.style.top = `${rect.top}px`;
    proxy.style.left = `${rect.left}px`;
    proxy.style.width = `${rect.width}px`;
    proxy.style.height = `${rect.height}px`;
    proxy.style.borderRadius = computedStyle.borderRadius;
    proxy.style.boxShadow = computedStyle.boxShadow;
    proxy.style.objectFit = computedStyle.objectFit;
    proxy.style.background = computedStyle.backgroundColor;
    proxy.style.clipPath = 'inset(0 0 0 0)';
    return proxy;
  }

  function waitForImageReady(image, callback) {
    if (image.complete && image.naturalWidth > 0) {
      callback();
      return;
    }

    image.addEventListener('load', callback, { once: true });
    image.addEventListener('error', callback, { once: true });
  }

  function finishSourceAnimation() {
    const { overlay } = state;
    if (!overlay) return;

    overlay.classList.add('is-seamless-open');
    overlay.classList.remove('is-opening-from-source');

    requestAnimationFrame(function() {
      cleanupSourceProxy();
      overlay.focus();

      requestAnimationFrame(function() {
        overlay.classList.remove('is-seamless-open');
      });
    });
  }

  function animateFromSource(image) {
    const { overlay, overlayImage } = state;
    const sourceRect = image.getBoundingClientRect();

    if (!sourceRect.width || !sourceRect.height || !overlay || !overlayImage) {
      if (overlay) overlay.focus();
      return;
    }

    overlay.classList.add('is-opening-from-source');
    state.sourceProxy = createProxyFromElement(image, sourceRect);
    document.body.appendChild(state.sourceProxy);

    waitForImageReady(overlayImage, function() {
      requestAnimationFrame(function() {
        const targetRect = overlayImage.getBoundingClientRect();
        if (!targetRect.width || !targetRect.height || !state.sourceProxy) {
          finishSourceAnimation();
          return;
        }

        state.sourceProxy.style.top = `${targetRect.top}px`;
        state.sourceProxy.style.left = `${targetRect.left}px`;
        state.sourceProxy.style.width = `${targetRect.width}px`;
        state.sourceProxy.style.height = `${targetRect.height}px`;
        state.sourceProxy.style.borderRadius = window.getComputedStyle(overlayImage).borderRadius;
        state.sourceProxy.style.boxShadow = window.getComputedStyle(overlayImage).boxShadow;

        state.sourceProxy.addEventListener('transitionend', finishSourceAnimation, { once: true });
      });
    });
  }

  function finalizeClose() {
    const { overlay, overlayImage } = state;
    if (!overlay || !overlayImage) return;

    cleanupSourceProxy();
    state.isClosing = false;
    overlay.classList.remove('is-open', 'is-opening-from-source', 'is-closing-to-source', 'is-seamless-open', 'has-caption');
    document.body.classList.remove('image-lightbox-open');
    document.documentElement.style.removeProperty('--image-lightbox-scrollbar-width');
    overlayImage.removeAttribute('src');
    overlayImage.removeAttribute('alt');
    state.currentSourceImage = null;

    if (state.lastActiveElement && typeof state.lastActiveElement.focus === 'function') {
      try {
        state.lastActiveElement.focus({ preventScroll: true });
      } catch (error) {
        state.lastActiveElement.focus();
      }
    }
  }

  function closeLightbox() {
    const { overlay, overlayImage, currentSourceImage } = state;
    if (!overlay || !overlayImage) return;
    if (state.isClosing || !overlay.classList.contains('is-open')) return;

    if (overlay.classList.contains('is-opening-from-source')) {
      finalizeClose();
      return;
    }

    if (state.reduceMotion || !currentSourceImage || !document.body.contains(currentSourceImage)) {
      finalizeClose();
      return;
    }

    const targetRect = currentSourceImage.getBoundingClientRect();
    const overlayRect = overlayImage.getBoundingClientRect();
    const header = document.querySelector('.site-header');
    const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    const headerOverlap = Math.max(0, headerBottom - targetRect.top);

    if (!targetRect.width || !targetRect.height || !overlayRect.width || !overlayRect.height) {
      finalizeClose();
      return;
    }

    state.isClosing = true;
    cleanupSourceProxy();

    state.sourceProxy = createProxyFromElement(overlayImage, overlayRect);
    document.body.appendChild(state.sourceProxy);

    overlay.classList.add('is-closing-to-source');
    overlay.classList.remove('is-open');

    requestAnimationFrame(function() {
      if (!state.sourceProxy) {
        finalizeClose();
        return;
      }

      state.sourceProxy.style.top = `${targetRect.top}px`;
      state.sourceProxy.style.left = `${targetRect.left}px`;
      state.sourceProxy.style.width = `${targetRect.width}px`;
      state.sourceProxy.style.height = `${targetRect.height}px`;
      state.sourceProxy.style.borderRadius = window.getComputedStyle(currentSourceImage).borderRadius;
      state.sourceProxy.style.boxShadow = window.getComputedStyle(currentSourceImage).boxShadow;
      state.sourceProxy.style.clipPath = headerOverlap > 0
        ? `inset(${headerOverlap}px 0 0 0)`
        : 'inset(0 0 0 0)';

      state.sourceProxy.addEventListener('transitionend', finalizeClose, { once: true });
    });
  }

  function openLightbox(image) {
    const { overlay, overlayImage, overlayCaption } = state;
    if (!overlay || !overlayImage || !overlayCaption) return;
    if (state.isClosing) return;

    const caption = getImageCaption(image);
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    state.currentSourceImage = image;
    state.lastActiveElement = document.activeElement;

    overlayImage.src = image.currentSrc || image.src;
    overlayImage.alt = image.alt || '';
    overlayCaption.textContent = caption || '';
    overlayCaption.hidden = !caption;
    overlay.classList.toggle('has-caption', Boolean(caption));
    document.documentElement.style.setProperty('--image-lightbox-scrollbar-width', `${scrollbarWidth}px`);

    overlay.classList.add('is-open');
    document.body.classList.add('image-lightbox-open');

    if (state.reduceMotion) {
      overlay.focus();
      return;
    }

    animateFromSource(image);
  }

  function findZoomableImage(target) {
    const image = target.closest('img');
    if (!isZoomableImage(image)) return null;
    return image;
  }

  function initImageLightbox() {
    if (!state.overlay) {
      state.overlay = createLightbox();
      state.overlayImage = state.overlay.querySelector('.image-lightbox-image');
      state.overlayCaption = state.overlay.querySelector('.image-lightbox-caption');
    }

    markZoomableImages();
  }

  document.addEventListener('click', function(event) {
    const image = findZoomableImage(event.target);
    if (image) {
      openLightbox(image);
      return;
    }

    if (!state.overlay || !state.overlay.classList.contains('is-open')) {
      return;
    }

    const clickedImage = event.target.closest('.image-lightbox-image');
    const clickedCaption = event.target.closest('.image-lightbox-caption');
    if (!clickedImage && !clickedCaption) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && state.overlay?.classList.contains('is-open')) {
      closeLightbox();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && isZoomableImage(event.target)) {
      event.preventDefault();
      openLightbox(event.target);
    }
  });

  document.addEventListener('DOMContentLoaded', initImageLightbox);
  document.addEventListener('subai:page-ready', initImageLightbox);
})();
