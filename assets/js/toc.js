/**
 * Table of Contents (TOC) functionality
 * IntersectionObserver-based implementation with smooth scrolling
 * and stable active section highlighting.
 */

class TableOfContents {
  constructor() {
    this.tocContainer = document.querySelector('.toc-container');
    this.overflow = this.tocContainer?.querySelector('.toc-body, .overflow') || null;
    this.tocLinks = Array.from(document.querySelectorAll('.toc a[href^="#"], #TableOfContents a[href^="#"]'));
    this.headings = [];
    this.activeLink = null;
    this.activeId = null;
    this.scrollOffset = 96;
    this.observer = null;
    this.programmaticScrollTimer = null;
    this.isProgrammaticScroll = false;
    this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    this.handleResize = this.handleResize.bind(this);
    this.handleLoad = this.handleLoad.bind(this);
    this.handleHashChange = this.handleHashChange.bind(this);
    this.handleIntersections = this.handleIntersections.bind(this);

    this.init();
  }

  init() {
    if (!this.tocContainer || !this.tocLinks.length) {
      return;
    }

    this.collectHeadings();

    if (!this.headings.length) {
      return;
    }

    this.updateScrollOffset();
    this.setupSmoothScrolling();
    this.setupKeyboardNavigation();
    this.setupObserver();
    this.syncActiveHeading(this.getHashId());

    window.addEventListener('resize', this.handleResize, { passive: true });
    window.addEventListener('load', this.handleLoad, { once: true });
    window.addEventListener('hashchange', this.handleHashChange);
  }

  collectHeadings() {
    const seen = new Set();

    this.headings = this.tocLinks.reduce((items, link) => {
      const href = link.getAttribute('href');

      if (!href || !href.startsWith('#')) {
        return items;
      }

      const id = this.normalizeHash(href.slice(1));

      if (!id || seen.has(id)) {
        return items;
      }

      const heading = document.getElementById(id);

      if (!heading) {
        return items;
      }

      seen.add(id);
      items.push({ id, element: heading, link });
      return items;
    }, []);
  }

  normalizeHash(hash) {
    if (!hash) {
      return '';
    }

    try {
      return decodeURIComponent(hash);
    } catch (error) {
      return hash;
    }
  }

  getHashId() {
    return this.normalizeHash(window.location.hash.replace(/^#/, ''));
  }

  updateScrollOffset() {
    const header = document.querySelector('.site-header');
    const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 72;

    this.scrollOffset = headerHeight + 24;
    document.documentElement.style.setProperty('--toc-scroll-offset', `${this.scrollOffset}px`);
  }

  setupObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    const bottomMargin = Math.max(window.innerHeight - this.scrollOffset - 160, 160);

    this.observer = new IntersectionObserver(this.handleIntersections, {
      root: null,
      rootMargin: `-${this.scrollOffset}px 0px -${bottomMargin}px 0px`,
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1]
    });

    this.headings.forEach(({ element }) => {
      this.observer.observe(element);
    });
  }

  handleIntersections() {
    if (this.isProgrammaticScroll) {
      return;
    }

    this.syncActiveHeading('', false);
  }

  setupSmoothScrolling() {
    this.tocLinks.forEach(link => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');

        if (!href || !href.startsWith('#')) {
          return;
        }

        const targetId = this.normalizeHash(href.slice(1));
        const targetElement = document.getElementById(targetId);

        if (!targetElement) {
          return;
        }

        event.preventDefault();

        this.setProgrammaticScrolling(true);
        this.setActiveLink(link);

        const targetTop = Math.max(
          window.scrollY + targetElement.getBoundingClientRect().top - this.scrollOffset,
          0
        );

        window.scrollTo({
          top: targetTop,
          behavior: this.reducedMotionQuery.matches ? 'auto' : 'smooth'
        });

        history.replaceState(null, '', href);
        this.scheduleProgrammaticScrollingReset(targetId);
      });
    });
  }

  setProgrammaticScrolling(isActive) {
    if (this.programmaticScrollTimer) {
      clearTimeout(this.programmaticScrollTimer);
      this.programmaticScrollTimer = null;
    }

    this.isProgrammaticScroll = isActive;
  }

  scheduleProgrammaticScrollingReset(preferredId) {
    if (this.programmaticScrollTimer) {
      clearTimeout(this.programmaticScrollTimer);
    }

    const delay = this.reducedMotionQuery.matches ? 0 : 450;

    this.programmaticScrollTimer = window.setTimeout(() => {
      this.isProgrammaticScroll = false;
      this.programmaticScrollTimer = null;
      this.syncActiveHeading(preferredId);
    }, delay);
  }

  syncActiveHeading(preferredId = '', fallbackToFirst = true) {
    if (!this.headings.length) {
      return;
    }

    const offsetLine = this.scrollOffset + 8;
    let activeHeading = null;

    if (preferredId) {
      activeHeading = this.headings.find((item) => item.id === preferredId) || null;
    }

    const isNearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;

    if (isNearBottom) {
      activeHeading = this.headings[this.headings.length - 1];
    }

    if (!activeHeading) {
      for (let index = this.headings.length - 1; index >= 0; index -= 1) {
        const candidate = this.headings[index];

        if (candidate.element.getBoundingClientRect().top <= offsetLine) {
          activeHeading = candidate;
          break;
        }
      }
    }

    if (!activeHeading && fallbackToFirst) {
      activeHeading = this.headings[0];
    }

    if (activeHeading) {
      this.setActiveLink(activeHeading.link);
    }
  }

  setActiveLink(activeLink) {
    if (activeLink === this.activeLink) {
      return;
    }

    this.tocLinks.forEach((link) => {
      const isActive = link === activeLink;
      link.classList.toggle('active', isActive);

      if (isActive) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });

    this.activeLink = activeLink;
    this.activeId = activeLink ? this.normalizeHash(activeLink.getAttribute('href')?.slice(1) || '') : null;

    if (activeLink) {
      this.scrollToActiveItem(activeLink);
    }
  }

  scrollToActiveItem(activeLink) {
    if (!this.overflow) {
      return;
    }

    const linkTop = activeLink.offsetTop;
    const linkBottom = linkTop + activeLink.offsetHeight;
    const viewportTop = this.overflow.scrollTop;
    const viewportBottom = viewportTop + this.overflow.clientHeight;
    const safePadding = 12;

    if (linkTop >= viewportTop + safePadding && linkBottom <= viewportBottom - safePadding) {
      return;
    }

    const nextScrollTop = Math.max(
      linkTop - (this.overflow.clientHeight / 2) + (activeLink.offsetHeight / 2),
      0
    );

    this.overflow.scrollTo({
      top: nextScrollTop,
      behavior: this.reducedMotionQuery.matches ? 'auto' : 'smooth'
    });
  }

  setupKeyboardNavigation() {
    this.tocLinks.forEach((link, index) => {
      link.addEventListener('keydown', (event) => {
        let targetIndex = index;

        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            targetIndex = Math.min(index + 1, this.tocLinks.length - 1);
            break;
          case 'ArrowUp':
            event.preventDefault();
            targetIndex = Math.max(index - 1, 0);
            break;
          case 'Home':
            event.preventDefault();
            targetIndex = 0;
            break;
          case 'End':
            event.preventDefault();
            targetIndex = this.tocLinks.length - 1;
            break;
          default:
            return;
        }

        if (targetIndex !== index) {
          this.tocLinks[targetIndex].focus();
        }
      });
    });
  }

  handleResize() {
    this.updateScrollOffset();
    this.setupObserver();
    this.syncActiveHeading(this.activeId);
  }

  handleLoad() {
    this.handleResize();
  }

  handleHashChange() {
    this.syncActiveHeading(this.getHashId());
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }

    if (this.programmaticScrollTimer) {
      clearTimeout(this.programmaticScrollTimer);
    }

    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('load', this.handleLoad);
    window.removeEventListener('hashchange', this.handleHashChange);
  }
}

let tocInstance = null;

function bootTableOfContents() {
  if (tocInstance && typeof tocInstance.destroy === 'function') {
    tocInstance.destroy();
  }

  tocInstance = new TableOfContents();
}

document.addEventListener('DOMContentLoaded', bootTableOfContents);
document.addEventListener('subai:page-ready', bootTableOfContents);
