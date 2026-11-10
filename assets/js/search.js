/**
 * 站内搜索
 * - 命令面板：Ctrl / ⌘ + K 唤起，即时结果、键盘导航、关键词高亮、最近搜索
 * - 搜索页：同一套匹配与渲染逻辑，支持分页
 * 索引来自 Hugo 生成的 index.json（layouts/index.json）
 */

(function () {
  'use strict';

  const CONFIG = window.__SUBAI_SEARCH_CONFIG__ || {};
  const LABELS = CONFIG.labels || {};
  const RECENT_KEY = 'subai:search:recent';
  const MAX_RECENT = 6;
  const PANEL_LIMIT = 20;
  const PAGE_SIZE = 8;

  const dialog = {
    root: null,
    panel: null,
    input: null,
    view: null,
    all: null
  };

  const state = {
    open: false,
    index: null,
    request: null,
    query: '',
    tokens: [],
    results: [],
    active: -1,
    lastFocus: null,
    hideTimer: 0,
    debounceTimer: 0
  };

  /* ------------------------------------------------------------------ *
   * 工具
   * ------------------------------------------------------------------ */

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalize(value) {
    return String(value == null ? '' : value).toLowerCase();
  }

  // plainify 输出的正文仍带 HTML 实体，展示前还原一次
  const HTML_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    '#39': "'", '#34': '"', '#amp': '&',
    ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
    hellip: '…', mdash: '—', ndash: '–', times: '×'
  };

  function decodeEntities(value) {
    return String(value == null ? '' : value).replace(/&([a-zA-Z#0-9]+);/g, function (match, name) {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(HTML_ENTITIES, key) ? HTML_ENTITIES[key] : match;
    });
  }

  function getSiteRoot() {
    const root = (window.Subai && window.Subai.siteRoot) || '/';
    return root.endsWith('/') ? root : root + '/';
  }

  function resolveSiteUrl(path) {
    return new URL(String(path).replace(/^\//, ''), window.location.origin + getSiteRoot()).toString();
  }

  function getSearchUrl() {
    return new URL(CONFIG.searchUrl || '/search/', window.location.origin).toString();
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function navigateTo(url) {
    const navigate = window.Subai && window.Subai.consume ? window.Subai.consume('navigate') : null;
    if (typeof navigate === 'function') {
      navigate(url);
      return;
    }
    window.location.assign(url);
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function itemTime(item) {
    const time = new Date(item.date).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  /* ------------------------------------------------------------------ *
   * 匹配 / 高亮 / 摘要
   * ------------------------------------------------------------------ */

  function tokenize(query) {
    return normalize(query).split(/\s+/).filter(Boolean).slice(0, 6);
  }

  function highlight(text, tokens) {
    const source = String(text == null ? '' : text);
    if (!tokens.length) return escapeHtml(source);

    const pattern = new RegExp('(' + tokens.map(escapeRegExp).join('|') + ')', 'gi');
    let html = '';
    let last = 0;
    let match = pattern.exec(source);

    while (match !== null) {
      if (match[0] === '') {
        pattern.lastIndex += 1;
      } else {
        html += escapeHtml(source.slice(last, match.index));
        html += '<mark class="search-mark">' + escapeHtml(match[0]) + '</mark>';
        last = match.index + match[0].length;
      }
      match = pattern.exec(source);
    }

    return html + escapeHtml(source.slice(last));
  }

  function searchItems(index, query) {
    const tokens = tokenize(query);
    if (!tokens.length || !index || !index.length) return [];

    const scored = [];

    index.forEach(function (item) {
      const title = normalize(item.title);
      const subtitle = normalize(item.subtitle);
      const summary = normalize(item.summary);
      const content = normalize(item.content);
      const tags = (item.tags || []).map(normalize);
      const categories = (item.categories || []).map(normalize);

      let score = 0;

      for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        let hit = 0;

        if (title.includes(token)) hit += title.startsWith(token) ? 140 : 110;
        if (tags.some(function (tag) { return tag.includes(token); })) hit += 60;
        if (categories.some(function (category) { return category.includes(token); })) hit += 50;
        if (subtitle.includes(token)) hit += 45;
        if (summary.includes(token)) hit += 28;
        else if (content.includes(token)) hit += 14;

        // 所有关键词都必须命中，避免多词搜索返回噪声
        if (!hit) return;
        score += hit;
      }

      scored.push({ item: item, score: score });
    });

    scored.sort(function (a, b) {
      return b.score - a.score || itemTime(b.item) - itemTime(a.item);
    });

    return scored.map(function (entry) { return entry.item; });
  }

  function buildSnippet(item, tokens) {
    const source = decodeEntities(item.summary || item.content || '').replace(/\s+/g, ' ').trim();
    if (!source) return '';

    const lower = source.toLowerCase();
    const limit = 120;
    let position = -1;

    tokens.forEach(function (token) {
      const index = lower.indexOf(token);
      if (index >= 0 && (position < 0 || index < position)) position = index;
    });

    if (position < 0) {
      return source.length > limit ? source.slice(0, limit) + '…' : source;
    }

    let start = Math.max(0, position - 36);
    let end = Math.min(source.length, start + limit);
    start = Math.max(0, end - limit);

    return (start > 0 ? '…' : '') +
      source.slice(start, end) +
      (end < source.length ? '…' : '');
  }

  /* ------------------------------------------------------------------ *
   * 索引
   * ------------------------------------------------------------------ */

  function ensureIndex() {
    if (state.index) return Promise.resolve(state.index);
    if (state.request) return state.request;

    state.request = fetch(resolveSiteUrl('index.json'), { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('搜索索引加载失败');
        return response.json();
      })
      .then(function (data) {
        state.index = Array.isArray(data) ? data : [];
        return state.index;
      })
      .catch(function (error) {
        state.request = null;
        throw error;
      });

    return state.request;
  }

  function getHotTags() {
    if (!state.index) return [];
    const counts = new Map();

    state.index.forEach(function (item) {
      (item.tags || []).forEach(function (tag) {
        const key = String(tag || '').trim();
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 8)
      .map(function (entry) { return entry[0]; });
  }

  /* ------------------------------------------------------------------ *
   * 最近搜索
   * ------------------------------------------------------------------ */

  function readRecent() {
    try {
      const raw = JSON.parse(window.localStorage.getItem(RECENT_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw
        .filter(function (item) { return typeof item === 'string' && item.trim(); })
        .slice(0, MAX_RECENT);
    } catch (error) {
      return [];
    }
  }

  function writeRecent(list) {
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
    } catch (error) {
      /* 隐私模式下忽略 */
    }
  }

  function pushRecent(query) {
    const value = String(query || '').trim();
    if (!value) return;
    const list = readRecent().filter(function (item) {
      return item.toLowerCase() !== value.toLowerCase();
    });
    list.unshift(value);
    writeRecent(list);
  }

  /* ------------------------------------------------------------------ *
   * 渲染片段
   * ------------------------------------------------------------------ */

  const ICON_DOC = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"></path><path d="M14 3v5h5"></path></svg>';
  const ICON_ARROW = '<svg class="search-result-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13"></path><path d="m12 5 7 7-7 7"></path></svg>';
  const ICON_SEARCH_LG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7.25"></circle><path d="m16.4 16.4 4.1 4.1"></path></svg>';
  const ICON_EMPTY = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7.25"></circle><path d="m16.4 16.4 4.1 4.1"></path><path d="m8.5 11 2 2 3.5-4"></path></svg>';

  function buildMeta(item) {
    const parts = [];
    const date = formatDate(item.date);
    if (date) parts.push('<span>' + escapeHtml(date) + '</span>');

    (item.categories || []).slice(0, 2).forEach(function (category) {
      parts.push('<span class="search-meta-dot" aria-hidden="true"></span>');
      parts.push('<span>' + escapeHtml(decodeEntities(category)) + '</span>');
    });

    if (!parts.length) return '';
    return '<span class="search-result-meta">' + parts.join('') + '</span>';
  }

  function buildResultItem(item, tokens, index, pageMode) {
    const title = highlight(decodeEntities(item.title), tokens);
    const snippet = highlight(buildSnippet(item, tokens), tokens);
    const thumb = item.cover_image
      ? '<img src="' + escapeHtml(item.cover_image) + '" alt="" loading="lazy" decoding="async">'
      : ICON_DOC;

    const attributes = pageMode
      ? ''
      : ' id="subai-search-opt-' + index + '" role="option" aria-selected="false"';
    const linkAttributes = pageMode ? '' : ' tabindex="-1" data-no-pjax';

    return '<li class="search-result"' + attributes + '>' +
      '<a class="search-result-link" href="' + escapeHtml(item.url) + '"' + linkAttributes + '>' +
        '<span class="search-result-thumb" aria-hidden="true">' + thumb + '</span>' +
        '<span class="search-result-main">' +
          '<span class="search-result-title">' + title + '</span>' +
          (snippet ? '<span class="search-result-snippet">' + snippet + '</span>' : '') +
          buildMeta(item) +
        '</span>' +
        ICON_ARROW +
      '</a>' +
    '</li>';
  }

  function chipHTML(value) {
    return '<button type="button" class="search-chip" data-search-query="' + escapeHtml(value) + '">' +
      '<span>' + escapeHtml(value) + '</span>' +
    '</button>';
  }

  function sectionHTML(title, chipsHTML, withClear) {
    return '<div class="search-section">' +
      '<div class="search-section-head">' +
        '<span class="search-section-title">' + escapeHtml(title) + '</span>' +
        (withClear
          ? '<button type="button" class="search-clear" data-search-clear>' + escapeHtml(LABELS.clear || '清除') + '</button>'
          : '') +
      '</div>' +
      '<div class="search-chips">' + chipsHTML + '</div>' +
    '</div>';
  }

  function emptyHTML(icon, title, hint) {
    return '<div class="search-empty">' +
      '<span class="search-empty-icon" aria-hidden="true">' + icon + '</span>' +
      '<p class="search-empty-title">' + escapeHtml(title || '') + '</p>' +
      (hint ? '<p class="search-empty-hint">' + escapeHtml(hint) + '</p>' : '') +
    '</div>';
  }

  function skeletonHTML() {
    let rows = '';
    for (let i = 0; i < 4; i += 1) {
      rows += '<div class="search-skeleton-row">' +
        '<span class="search-skeleton-thumb"></span>' +
        '<span class="search-skeleton-lines">' +
          '<span class="search-skeleton-line is-title"></span>' +
          '<span class="search-skeleton-line"></span>' +
          '<span class="search-skeleton-line is-short"></span>' +
        '</span>' +
      '</div>';
    }
    return '<div class="search-skeleton" aria-hidden="true">' + rows + '</div>';
  }

  function formatCount(count) {
    const template = LABELS.resultsFound || '找到 {count} 个结果';
    return escapeHtml(template).replace('{count}', '<span class="search-page-count">' + count + '</span>');
  }

  /* ------------------------------------------------------------------ *
   * 面板状态渲染
   * ------------------------------------------------------------------ */

  function setAllLink(visible, query) {
    if (!dialog.all) return;
    dialog.all.hidden = !visible;
    if (visible) {
      dialog.all.href = getSearchUrl() + '?q=' + encodeURIComponent(query || '');
    }
  }

  function renderIdle() {
    const recent = readRecent();
    const tags = getHotTags();
    let html = '';

    if (recent.length) {
      html += sectionHTML(LABELS.recent || '最近搜索', recent.map(chipHTML).join(''), true);
    }
    if (tags.length) {
      html += sectionHTML(LABELS.hotTags || '热门标签', tags.map(chipHTML).join(''), false);
    }
    if (!html) {
      html = emptyHTML(ICON_SEARCH_LG, LABELS.idleTitle || '输入关键词开始搜索', LABELS.idleHint || '');
    }

    dialog.view.innerHTML = html;
    state.results = [];
    state.active = -1;
    dialog.input.setAttribute('aria-expanded', 'false');
    dialog.input.removeAttribute('aria-activedescendant');
    setAllLink(false, '');
  }

  function renderLoading() {
    dialog.view.innerHTML = skeletonHTML();
    setAllLink(false, '');
  }

  function renderNotFound(query) {
    dialog.view.innerHTML = emptyHTML(ICON_EMPTY, LABELS.emptyTitle || '没有找到相关文章', LABELS.emptyHint || '');
    state.results = [];
    state.active = -1;
    dialog.input.setAttribute('aria-expanded', 'false');
    setAllLink(true, query);
  }

  function renderError() {
    dialog.view.innerHTML = emptyHTML(ICON_EMPTY, LABELS.errorText || '搜索失败，请稍后重试', '');
    state.results = [];
    state.active = -1;
    setAllLink(false, '');
  }

  function renderResults(query) {
    const items = state.results.map(function (item, index) {
      return buildResultItem(item, state.tokens, index, false);
    }).join('');

    dialog.view.innerHTML = '<ul class="search-result-list" id="subai-search-results" role="listbox" aria-label="' +
      escapeHtml(LABELS.listLabel || '搜索建议') + '">' + items + '</ul>';

    setAllLink(true, query);
    setActive(0);
  }

  function setActive(index) {
    const options = dialog.view.querySelectorAll('.search-result');

    if (!options.length) {
      state.active = -1;
      dialog.input.setAttribute('aria-expanded', 'false');
      dialog.input.removeAttribute('aria-activedescendant');
      return;
    }

    let next = index;
    if (next < 0) next = options.length - 1;
    if (next >= options.length) next = 0;
    state.active = next;

    options.forEach(function (option, position) {
      const selected = position === next;
      option.classList.toggle('is-active', selected);
      option.setAttribute('aria-selected', selected ? 'true' : 'false');
    });

    const current = options[next];
    if (current.id) dialog.input.setAttribute('aria-activedescendant', current.id);
    dialog.input.setAttribute('aria-expanded', 'true');
    current.scrollIntoView({ block: 'nearest' });
  }

  function runSearch() {
    if (!dialog.input) return;

    const query = dialog.input.value.trim();
    state.query = query;
    state.tokens = tokenize(query);

    if (!query) {
      renderIdle();
      return;
    }

    if (!state.index) {
      renderLoading();
      ensureIndex().then(function () {
        if (state.open && dialog.input.value.trim() === query) runSearch();
      }).catch(function () {
        if (state.open) renderError();
      });
      state.results = [];
      state.active = -1;
      return;
    }

    const results = searchItems(state.index, query);
    state.results = results.slice(0, PANEL_LIMIT);

    if (!results.length) {
      renderNotFound(query);
      return;
    }

    renderResults(query);
  }

  function scheduleSearch() {
    window.clearTimeout(state.debounceTimer);
    state.debounceTimer = window.setTimeout(runSearch, 90);
  }

  /* ------------------------------------------------------------------ *
   * 面板开关
   * ------------------------------------------------------------------ */

  function openDialog(initialQuery) {
    if (!dialog.root) return;

    if (state.open) {
      if (typeof initialQuery === 'string') {
        dialog.input.value = initialQuery;
        runSearch();
      }
      focusInput(true);
      return;
    }

    state.open = true;
    state.lastFocus = document.activeElement;
    window.clearTimeout(state.hideTimer);

    dialog.root.hidden = false;
    document.body.classList.add('search-dialog-open');

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        dialog.root.classList.add('is-open');
      });
    });

    if (typeof initialQuery === 'string') {
      dialog.input.value = initialQuery;
    } else {
      const urlQuery = new URLSearchParams(window.location.search).get('q') || '';
      dialog.input.value = urlQuery;
    }

    renderIdle();
    if (dialog.input.value.trim()) runSearch();

    ensureIndex().then(function () {
      if (state.open && !dialog.input.value.trim()) renderIdle();
    }).catch(function () {
      /* 索引不可用时保持默认视图，用户输入后可看到错误提示 */
    });

    focusInput(Boolean(dialog.input.value));
  }

  function focusInput(select) {
    window.setTimeout(function () {
      if (!dialog.input) return;
      dialog.input.focus({ preventScroll: true });
      if (select && dialog.input.value) dialog.input.select();
    }, 60);
  }

  function closeDialog(options) {
    const settings = options || {};
    const restoreFocus = settings.restoreFocus !== false;

    if (!state.open) return;

    state.open = false;
    window.clearTimeout(state.hideTimer);

    dialog.root.classList.remove('is-open');
    document.body.classList.remove('search-dialog-open');

    state.hideTimer = window.setTimeout(function () {
      if (!state.open) dialog.root.hidden = true;
    }, prefersReducedMotion() ? 0 : 220);

    if (restoreFocus && state.lastFocus && typeof state.lastFocus.focus === 'function') {
      state.lastFocus.focus({ preventScroll: true });
    }
  }

  /* ------------------------------------------------------------------ *
   * 交互
   * ------------------------------------------------------------------ */

  function activate(url) {
    if (!url) return;
    pushRecent(state.query || (dialog.input ? dialog.input.value : ''));
    closeDialog({ restoreFocus: false });
    navigateTo(url);
  }

  function goToSearchPage() {
    const query = (dialog.input.value || '').trim();
    if (!query) {
      dialog.input.focus();
      return;
    }
    pushRecent(query);
    const target = getSearchUrl() + '?q=' + encodeURIComponent(query);
    closeDialog({ restoreFocus: false });
    navigateTo(target);
  }

  function handleInputKeydown(event) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActive(state.active + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActive(state.active - 1);
        break;
      case 'Home':
        if (state.results.length) {
          event.preventDefault();
          setActive(0);
        }
        break;
      case 'End':
        if (state.results.length) {
          event.preventDefault();
          setActive(state.results.length - 1);
        }
        break;
      case 'Enter': {
        event.preventDefault();
        const current = dialog.view.querySelector('.search-result.is-active .search-result-link');
        if (current) {
          activate(current.getAttribute('href'));
        } else {
          goToSearchPage();
        }
        break;
      }
      default:
        break;
    }
  }

  function getFocusable() {
    if (!dialog.panel) return [];
    return Array.prototype.slice
      .call(dialog.panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function (element) {
        return element.getClientRects().length > 0;
      });
  }

  function handleTab(event) {
    if (event.key !== 'Tab' || !state.open) return;

    const focusable = getFocusable();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey) {
      if (active === first || !dialog.panel.contains(active)) {
        event.preventDefault();
        last.focus();
      }
    } else if (active === last || !dialog.panel.contains(active)) {
      event.preventDefault();
      first.focus();
    }
  }

  // 缩略图加载失败时回退为文档图标（error 不冒泡，需要捕获阶段监听）
  function handleImageError(event) {
    const image = event.target;
    if (!image || image.tagName !== 'IMG') return;
    const thumb = image.closest('.search-result-thumb');
    if (!thumb) return;
    thumb.innerHTML = ICON_DOC;
  }

  function handleGlobalKeydown(event) {
    const isToggle = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
      (event.key === 'k' || event.key === 'K');

    if (isToggle) {
      event.preventDefault();
      if (state.open) closeDialog();
      else openDialog();
      return;
    }

    if (event.key === 'Escape' && state.open) {
      event.preventDefault();
      closeDialog();
    }
  }

  function handleDocumentClick(event) {
    const opener = event.target.closest('[data-search-open]');
    if (opener) {
      event.preventDefault();
      openDialog();
      return;
    }

    if (!state.open) return;

    if (event.target.closest('[data-search-close]')) {
      event.preventDefault();
      closeDialog();
      return;
    }

    const chip = event.target.closest('[data-search-query]');
    if (chip) {
      event.preventDefault();
      dialog.input.value = chip.getAttribute('data-search-query') || '';
      runSearch();
      dialog.input.focus({ preventScroll: true });
      return;
    }

    if (event.target.closest('[data-search-clear]')) {
      event.preventDefault();
      writeRecent([]);
      renderIdle();
      return;
    }

    const allLink = event.target.closest('#subai-search-all');
    if (allLink) {
      event.preventDefault();
      goToSearchPage();
      return;
    }

    const resultLink = event.target.closest('.search-dialog .search-result-link');
    if (resultLink) {
      event.preventDefault();
      activate(resultLink.getAttribute('href'));
    }
  }

  function bindDialogEvents() {
    dialog.input.addEventListener('input', function () {
      state.active = -1;
      scheduleSearch();
    });
    dialog.input.addEventListener('keydown', handleInputKeydown);
    dialog.root.addEventListener('keydown', handleTab);
  }

  function detectShortcutLabel() {
    const label = document.querySelector('[data-search-kbd]');
    if (!label) return;
    const platform = navigator.platform || navigator.userAgent || '';
    label.textContent = /Mac|iPhone|iPad|iPod/.test(platform) ? '⌘ K' : 'Ctrl K';
  }

  function prefetchIndex() {
    const warm = function () {
      ensureIndex().catch(function () {});
    };

    const trigger = document.querySelector('[data-search-open]');
    if (trigger) {
      trigger.addEventListener('pointerenter', warm, { once: true });
      trigger.addEventListener('focus', warm, { once: true });
    }

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(warm, { timeout: 3000 });
    } else {
      window.setTimeout(warm, 1800);
    }
  }

  /* ------------------------------------------------------------------ *
   * 搜索页
   * ------------------------------------------------------------------ */

  function renderPageIdle() {
    const recent = readRecent();
    const tags = getHotTags();
    let html = '';

    if (recent.length) {
      html += sectionHTML(LABELS.recent || '最近搜索', recent.map(chipHTML).join(''), true);
    }
    if (tags.length) {
      html += sectionHTML(LABELS.hotTags || '热门标签', tags.map(chipHTML).join(''), false);
    }
    if (!html) {
      return emptyHTML(ICON_SEARCH_LG, LABELS.idleTitle || '输入关键词开始搜索', LABELS.idleHint || '');
    }

    return '<div class="search-page-idle">' + html + '</div>';
  }

  function buildPagination(currentPage, totalPages, query) {
    const encoded = encodeURIComponent(query);
    const href = function (page) { return '?q=' + encoded + '&page=' + page; };

    let html = '<nav class="pagination" role="navigation" aria-label="Pagination Navigation">';
    html += '<div class="pagination-wrapper">';

    html += currentPage > 1
      ? '<a href="' + href(currentPage - 1) + '" class="pagination-link pagination-prev" rel="prev"><span>上一页</span></a>'
      : '<span class="pagination-link pagination-prev pagination-disabled"><span>上一页</span></span>';

    html += '<div class="pagination-numbers">';

    const numbers = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) numbers.push(i);
    } else if (currentPage <= 4) {
      numbers.push(1, 2, 3, 4, 5, '…', totalPages);
    } else if (currentPage >= totalPages - 3) {
      numbers.push(1, '…', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      numbers.push(1, '…', currentPage - 1, currentPage, currentPage + 1, '…', totalPages);
    }

    numbers.forEach(function (value) {
      if (value === '…') {
        html += '<span class="pagination-ellipsis">…</span>';
      } else if (value === currentPage) {
        html += '<span class="pagination-number pagination-current" aria-current="page">' + value + '</span>';
      } else {
        html += '<a href="' + href(value) + '" class="pagination-number">' + value + '</a>';
      }
    });

    html += '</div>';

    html += currentPage < totalPages
      ? '<a href="' + href(currentPage + 1) + '" class="pagination-link pagination-next" rel="next"><span>下一页</span></a>'
      : '<span class="pagination-link pagination-next pagination-disabled"><span>下一页</span></span>';

    html += '</div>';
    html += '<div class="pagination-info"><span class="pagination-summary">第 ' + currentPage + ' 页，共 ' + totalPages + ' 页</span></div>';
    html += '</nav>';

    return html;
  }

  function bindSearchPage(page, form, input, container) {
    if (page.dataset.searchBound === 'true') return;
    page.dataset.searchBound = 'true';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const query = input.value.trim();
      if (!query) {
        input.focus();
        return;
      }
      pushRecent(query);
      navigateTo(getSearchUrl() + '?q=' + encodeURIComponent(query));
    });

    // 空态下的「最近搜索 / 热门标签」与清除按钮
    page.addEventListener('click', function (event) {
      if (event.target.closest('[data-search-clear]')) {
        event.preventDefault();
        writeRecent([]);
        container.innerHTML = renderPageIdle();
        return;
      }

      const chip = event.target.closest('[data-search-query]');
      if (!chip) return;

      event.preventDefault();
      input.value = chip.getAttribute('data-search-query') || '';
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
  }

  function initSearchPage(targetUrl) {
    const page = document.getElementById('search-page');
    if (!page) return Promise.resolve();

    const form = document.getElementById('search-page-form');
    const input = document.getElementById('search-page-input');
    const subtitle = document.getElementById('search-subtitle');
    const container = document.getElementById('search-results-container');
    const pagination = document.getElementById('search-pagination');

    if (!form || !input || !subtitle || !container || !pagination) return Promise.resolve();

    bindSearchPage(page, form, input, container);

    let url;
    try {
      url = new URL(targetUrl || window.location.href, window.location.origin);
    } catch (error) {
      url = new URL(window.location.href);
    }

    const query = (url.searchParams.get('q') || '').trim();
    const pageNumber = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);

    input.value = query;

    if (!query) {
      subtitle.style.display = 'none';
      pagination.style.display = 'none';
      container.innerHTML = renderPageIdle();

      ensureIndex().then(function () {
        if (!input.value.trim()) container.innerHTML = renderPageIdle();
      }).catch(function () {});

      return Promise.resolve();
    }

    subtitle.style.display = 'block';
    subtitle.textContent = LABELS.loading || '正在搜索…';
    pagination.style.display = 'none';
    container.innerHTML = skeletonHTML();

    return ensureIndex().then(function (index) {
      const tokens = tokenize(query);
      const results = searchItems(index, query);
      const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
      const currentPage = Math.min(pageNumber, totalPages);
      const start = (currentPage - 1) * PAGE_SIZE;

      subtitle.innerHTML = formatCount(results.length);

      if (!results.length) {
        container.innerHTML = emptyHTML(ICON_EMPTY, LABELS.emptyTitle || '没有找到相关文章', LABELS.emptyHint || '');
        pagination.style.display = 'none';
        return;
      }

      container.innerHTML = '<ul class="search-result-list search-result-list--page">' +
        results.slice(start, start + PAGE_SIZE).map(function (item, index) {
          return buildResultItem(item, tokens, index, true);
        }).join('') +
      '</ul>';

      if (totalPages > 1) {
        pagination.innerHTML = buildPagination(currentPage, totalPages, query);
        pagination.style.display = 'block';
      } else {
        pagination.innerHTML = '';
        pagination.style.display = 'none';
      }
    }).catch(function (error) {
      console.error('搜索失败:', error);
      subtitle.style.display = 'none';
      pagination.style.display = 'none';
      container.innerHTML = emptyHTML(ICON_EMPTY, LABELS.errorText || '搜索失败，请稍后重试', '');
    });
  }

  /* ------------------------------------------------------------------ *
   * 初始化
   * ------------------------------------------------------------------ */

  function init() {
    const root = document.getElementById('subai-search-dialog');

    if (root && !root.dataset.searchInitialized) {
      root.dataset.searchInitialized = 'true';
      dialog.root = root;
      dialog.panel = root.querySelector('.search-dialog-panel');
      dialog.input = root.querySelector('.search-dialog-input');
      dialog.view = root.querySelector('.search-dialog-view');
      dialog.all = root.querySelector('#subai-search-all');

      if (dialog.input && dialog.view) {
        bindDialogEvents();
        detectShortcutLabel();
        prefetchIndex();
      }

      document.addEventListener('keydown', handleGlobalKeydown);
      document.addEventListener('click', handleDocumentClick);
      document.addEventListener('error', handleImageError, true);
      document.addEventListener('subai:page-loading', function () {
        closeDialog({ restoreFocus: false });
      });
    }

    initSearchPage(window.location.href);
  }

  if (window.Subai && typeof window.Subai.register === 'function') {
    window.Subai.register('initSearchPage', initSearchPage);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
