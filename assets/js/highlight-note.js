const CONTENT_SELECTOR = '.content.main-reveal';
(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    enabled: false,
    apiBase: '',
    maxSelectionLength: 2000,
    auth: {
      storageKey: 'highlightNote.writeToken',
      scheme: 'Bearer'
    }
  };

  const STATE = {
    bound: false,
    addButton: null,
    loadedArticleKey: ''
  };

  const CONFIG = readConfig();
  if (!CONFIG.enabled) return;

  function readConfig() {
    const configNode = document.getElementById('ji-highlight-note-config');
    let parsed = {};

    if (configNode && configNode.textContent) {
      try {
        parsed = JSON.parse(configNode.textContent);
      } catch (error) {
        console.error('Highlight note config parse failed:', error);
      }
    } else {
      parsed = {
        enabled: document.querySelector('meta[name="highlight-note-enabled"]')?.content === 'true',
        apiBase: document.querySelector('meta[name="highlight-note-api"]')?.content || ''
      };
    }

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      apiBase: String(parsed.apiBase || '').replace(/\/+$/, ''),
      auth: {
        ...DEFAULT_CONFIG.auth,
        ...(parsed.auth || {})
      }
    };
  }

  function getContentEl() {
    return document.querySelector(CONTENT_SELECTOR);
  }

  function getArticleContext() {
    const contentEl = getContentEl();
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const fallbackId = decodeURIComponent(pathParts[pathParts.length - 1] || '').toLowerCase();

    return {
      articleId: contentEl?.dataset.highlightArticleId || fallbackId,
      articlePath: contentEl?.dataset.highlightArticlePath || '',
      section: contentEl?.dataset.highlightSection || pathParts[0] || '',
      pageUrl: window.location.pathname
    };
  }

  function getWriteToken() {
    try {
      return localStorage.getItem(CONFIG.auth.storageKey) || '';
    } catch (error) {
      return '';
    }
  }

  function setWriteToken(token) {
    try {
      if (token) {
        localStorage.setItem(CONFIG.auth.storageKey, token);
      } else {
        localStorage.removeItem(CONFIG.auth.storageKey);
      }
    } catch (error) {
      console.error('保存写入令牌失败:', error);
    }
  }

  function canWrite() {
    return Boolean(CONFIG.apiBase && getWriteToken());
  }

  function authHeaders() {
    const token = getWriteToken();
    if (!token) throw new Error('未配置划线笔记写入令牌');

    return {
      Authorization: `${CONFIG.auth.scheme} ${token}`
    };
  }

  async function requestApi(path, options = {}) {
    if (!CONFIG.apiBase) throw new Error('未配置划线笔记 API 地址');

    const method = options.method || 'GET';
    const query = new URLSearchParams(options.query || {});
    const url = `${CONFIG.apiBase}${path}${query.toString() ? `?${query}` : ''}`;
    const headers = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.auth ? authHeaders() : {})
    };

    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) {
      throw new Error(result.error || `请求失败: ${response.status}`);
    }

    return result;
  }

  function getToastContainer() {
    let container = document.getElementById('note-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'note-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type = 'success') {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `note-toast note-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('note-toast-hide');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3000);
  }

  function escapeSelector(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function getNoteEl(noteId) {
    return document.querySelector(`.highlight-note[data-note-id="${escapeSelector(noteId)}"]`);
  }

  function showLoading(noteId) {
    const badge = getNoteEl(noteId);
    if (!badge || badge.querySelector('.note-loading')) return;

    const loader = document.createElement('span');
    loader.className = 'note-loading';
    loader.dataset.noteId = noteId;
    badge.style.position = 'relative';
    badge.appendChild(loader);
  }

  function hideLoading(noteId) {
    const loader = document.querySelector(`.note-loading[data-note-id="${escapeSelector(noteId)}"]`);
    if (loader) loader.remove();
  }

  function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest('script, style, textarea, button, .highlight-note, .note-dialog, .note-popup')) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    let current;
    while ((current = walker.nextNode())) {
      nodes.push(current);
    }
    return nodes;
  }

  function scoreCandidate(fullText, index, exact, selector = {}) {
    let score = 0;
    if (selector.prefix) {
      const prefixStart = Math.max(0, index - selector.prefix.length);
      if (fullText.slice(prefixStart, index).endsWith(selector.prefix)) score += 2;
    }
    if (selector.suffix) {
      const suffixEnd = index + exact.length + selector.suffix.length;
      if (fullText.slice(index + exact.length, suffixEnd).startsWith(selector.suffix)) score += 2;
    }
    return score;
  }

  function findTextMatch(contentEl, note) {
    const exact = note.selectedText || note.selector?.exact;
    if (!exact) return null;

    const textNodes = collectTextNodes(contentEl);
    const fullText = textNodes.map(node => node.textContent).join('');
    const candidates = [];
    let index = fullText.indexOf(exact);

    while (index !== -1) {
      candidates.push({
        start: index,
        end: index + exact.length,
        score: scoreCandidate(fullText, index, exact, note.selector)
      });
      index = fullText.indexOf(exact, index + exact.length);
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score || a.start - b.start);
    return { textNodes, ...candidates[0] };
  }

  function rangeFromOffsets(textNodes, start, end) {
    const range = document.createRange();
    let offset = 0;
    let hasStart = false;

    for (const node of textNodes) {
      const text = node.textContent || '';
      const nextOffset = offset + text.length;

      if (!hasStart && start >= offset && start <= nextOffset) {
        range.setStart(node, start - offset);
        hasStart = true;
      }

      if (hasStart && end >= offset && end <= nextOffset) {
        range.setEnd(node, end - offset);
        return range;
      }

      offset = nextOffset;
    }

    return null;
  }

  function updateExistingNoteEl(el, note) {
    el.dataset.noteId = note.id;
    el.dataset.noteSelectedText = note.selectedText || el.textContent.trim();
    if (note.noteContent) el.dataset.noteContent = note.noteContent;
    el.classList.toggle('pending', note.status === 'pending');
    el.classList.toggle('synced', note.status === 'synced');
    el.classList.toggle('failed', note.status === 'failed');
  }

  function renderNoteOnPage(note) {
    const contentEl = getContentEl();
    if (!contentEl || !note?.id) return;

    const existing = getNoteEl(note.id);
    if (existing) {
      updateExistingNoteEl(existing, note);
      return;
    }

    const match = findTextMatch(contentEl, note);
    if (!match) return;

    const range = rangeFromOffsets(match.textNodes, match.start, match.end);
    if (!range) return;

    const mark = document.createElement('mark');
    mark.className = `highlight-note ${note.status || 'pending'}`;
    mark.dataset.noteId = note.id;
    mark.dataset.noteSelectedText = note.selectedText || note.selector?.exact || '';
    if (note.noteContent) mark.dataset.noteContent = note.noteContent;

    mark.appendChild(range.extractContents());
    range.insertNode(mark);
  }

  function unwrapNote(noteId) {
    const mark = getNoteEl(noteId);
    if (!mark || !mark.parentNode) return;

    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  }

  function buildSelector(selection, contentEl, selectedText) {
    const range = selection.getRangeAt(0);
    const prefixRange = document.createRange();
    const suffixRange = document.createRange();

    prefixRange.selectNodeContents(contentEl);
    prefixRange.setEnd(range.startContainer, range.startOffset);

    suffixRange.selectNodeContents(contentEl);
    suffixRange.setStart(range.endContainer, range.endOffset);

    return {
      exact: selectedText,
      prefix: prefixRange.toString().slice(-80),
      suffix: suffixRange.toString().slice(0, 80)
    };
  }

  async function saveNote(selectedText, noteContent, selector) {
    const article = getArticleContext();
    if (!article.articleId) throw new Error('无法获取文章标识');

    const result = await requestApi('/api/notes', {
      method: 'POST',
      auth: true,
      body: {
        ...article,
        selectedText,
        noteContent,
        selector: selector || { exact: selectedText }
      }
    });

    renderNoteOnPage(result.note || {
      id: result.noteId,
      ...article,
      selectedText,
      noteContent,
      selector,
      status: 'pending'
    });

    return result;
  }

  async function updateNote(noteId, newContent) {
    const noteEl = getNoteEl(noteId);
    const article = getArticleContext();
    const result = await requestApi(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: 'PUT',
      auth: true,
      body: {
        ...article,
        selectedText: noteEl?.dataset.noteSelectedText || noteEl?.textContent?.trim() || '',
        noteContent: newContent
      }
    });

    if (noteEl) {
      noteEl.dataset.noteContent = newContent;
      noteEl.classList.remove('synced', 'failed');
      noteEl.classList.add('pending');
    }

    return result;
  }

  async function deleteNote(noteId) {
    const noteEl = getNoteEl(noteId);
    const article = getArticleContext();

    const result = await requestApi(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
      auth: true,
      body: {
        ...article,
        selectedText: noteEl?.dataset.noteSelectedText || noteEl?.textContent?.trim() || ''
      }
    });

    unwrapNote(noteId);
    return result;
  }

  async function getNoteContent(noteId) {
    const noteEl = getNoteEl(noteId);
    if (noteEl?.dataset.noteContent) return noteEl.dataset.noteContent;
    if (!canWrite()) return null;

    const article = getArticleContext();
    const result = await requestApi(`/api/notes/${encodeURIComponent(noteId)}`, {
      auth: true,
      query: {
        articleId: article.articleId,
        articlePath: article.articlePath
      }
    });

    if (result.note?.noteContent && noteEl) {
      noteEl.dataset.noteContent = result.note.noteContent;
    }
    return result.note?.noteContent || null;
  }

  // SVG 图标
  const svgCheckmark = '<svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>';
  const svgPencil = '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
  const svgTrash = '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
  const svgClose = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

  function createIconButton(className, title, svg, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('data-tooltip', title);
    button.innerHTML = svg;
    button.addEventListener('click', onClick);
    return button;
  }

  function createButton(className, text, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', onClick);
    return button;
  }

  function createDialog(selectedText, initialContent, onSave) {
    const overlay = document.createElement('div');
    overlay.className = 'note-dialog';

    const card = document.createElement('div');
    card.className = 'note-card';

    // 头部：选中文字 + 确认/关闭按钮
    const header = document.createElement('header');
    header.className = 'note-card__header';

    const title = document.createElement('h3');
    title.className = 'note-card__title';
    title.textContent = selectedText;
    title.title = selectedText;

    const actions = document.createElement('div');
    actions.className = 'note-card__actions';

    const btnConfirm = createIconButton('note-card__btn note-card__btn--confirm', '确认', svgCheckmark, () => {
      const value = textarea.value.trim();
      if (!value) return;
      overlay.remove();
      onSave(value);
    });

    const btnClose = createIconButton('note-card__btn', '关闭', svgClose, () => overlay.remove());

    actions.append(btnConfirm, btnClose);
    header.append(title, actions);

    // 内容区：输入框
    const viewContainer = document.createElement('div');
    viewContainer.className = 'note-card__view-container';

    const textarea = document.createElement('textarea');
    textarea.className = 'note-card__textarea';
    textarea.placeholder = '输入笔记内容...';
    textarea.value = initialContent || '';

    viewContainer.appendChild(textarea);

    card.append(header, viewContainer);
    overlay.appendChild(card);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    textarea.focus();
  }

  async function showNotePopup(noteId) {
    showLoading(noteId);
    const noteContent = await getNoteContent(noteId);
    hideLoading(noteId);

    if (!noteContent) {
      showToast('未找到笔记内容', 'error');
      return;
    }

    const badge = getNoteEl(noteId);
    const selectedText = badge?.dataset.noteSelectedText || badge?.textContent?.trim() || '';
    const writable = canWrite();
    const statusName = badge?.classList.contains('pending') ? 'pending' : 'synced';

    // 遮罩层
    const overlay = document.createElement('div');
    overlay.className = 'note-popup';

    // 卡片
    const card = document.createElement('div');
    card.className = 'note-card';

    // 头部：标题 + 操作按钮
    const header = document.createElement('header');
    header.className = 'note-card__header';

    const title = document.createElement('h3');
    title.className = `note-card__title note-card__title--${statusName}`;
    title.textContent = selectedText;

    const actions = document.createElement('div');
    actions.className = 'note-card__actions';

    if (writable) {
      // 确认按钮（编辑模式下显示）
      const btnConfirm = createIconButton('note-card__btn note-card__btn--confirm', '确定', svgCheckmark, () => {
        if (!card.classList.contains('is-editing')) return;
        const newContent = textarea.value.trim();
        if (!newContent) return;
        card.classList.remove('is-editing');
        readView.textContent = newContent;
        btnConfirm.style.display = 'none';
        btnEdit.style.display = 'flex';
        updateNote(noteId, newContent).then(
          () => showToast('笔记已更新'),
          error => {
            showToast(`更新失败: ${error.message}`, 'error');
            readView.textContent = noteContent;
          }
        );
      });
      btnConfirm.style.display = 'none';

      // 编辑按钮
      const btnEdit = createIconButton('note-card__btn note-card__btn--edit', '修改', svgPencil, () => {
        textarea.value = readView.textContent.trim();
        card.classList.add('is-editing');
        textarea.focus();
        btnEdit.style.display = 'none';
        btnConfirm.style.display = 'flex';
      });

      // 删除按钮
      const btnDelete = createIconButton('note-card__btn note-card__btn--delete', '删除', svgTrash, () => {
        overlay.remove();
        deleteNote(noteId).then(
          () => showToast('笔记已删除'),
          error => showToast(`删除失败: ${error.message}`, 'error')
        );
      });

      actions.append(btnConfirm, btnEdit, btnDelete);
    }

    header.append(title, actions);

    // 内容区：阅读视图 + 编辑视图
    const viewContainer = document.createElement('div');
    viewContainer.className = 'note-card__view-container';

    const readView = document.createElement('div');
    readView.className = 'note-card__view note-card__view--read';
    readView.textContent = noteContent;

    const editView = document.createElement('div');
    editView.className = 'note-card__view note-card__view--edit';
    const textarea = document.createElement('textarea');
    textarea.className = 'note-card__textarea';
    editView.appendChild(textarea);

    viewContainer.append(readView, editView);
    card.append(header, viewContainer);

    overlay.appendChild(card);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
  }

  function showAddDialog(selectedText, selector) {
    createDialog(selectedText, '', noteContent => {
      saveNote(selectedText, noteContent, selector).then(
        () => showToast('笔记已添加'),
        error => showToast(`保存失败: ${error.message}`, 'error')
      );
    });
  }

  function hideAddButton() {
    if (STATE.addButton) STATE.addButton.style.display = 'none';
  }

  function showAddButton(range, selectedText, selector) {
    if (!STATE.addButton) {
      STATE.addButton = document.createElement('button');
      STATE.addButton.id = 'add-note-btn';
      STATE.addButton.type = 'button';
      STATE.addButton.textContent = '添加笔记';
      document.body.appendChild(STATE.addButton);
    }

    const rect = range.getBoundingClientRect();
    STATE.addButton.style.display = 'block';
    STATE.addButton.style.left = `${rect.right + window.scrollX + 4}px`;
    STATE.addButton.style.top = `${rect.top + window.scrollY - 4}px`;
    STATE.addButton.onclick = () => {
      hideAddButton();
      showAddDialog(selectedText, selector);
    };
  }

  function handleSelection() {
    if (!canWrite()) {
      hideAddButton();
      return;
    }

    const selection = window.getSelection();
    const contentEl = getContentEl();
    if (!selection || !selection.rangeCount || !contentEl) {
      hideAddButton();
      return;
    }

    const selectedText = selection.toString().trim();
    const range = selection.getRangeAt(0);
    if (
      !selectedText ||
      selectedText.length > CONFIG.maxSelectionLength ||
      !contentEl.contains(range.commonAncestorContainer)
    ) {
      hideAddButton();
      return;
    }

    showAddButton(range, selectedText, buildSelector(selection, contentEl, selectedText));
  }

  async function loadPendingNotes() {
    const article = getArticleContext();
    const articleKey = article.articlePath || article.articleId;
    if (!articleKey || !canWrite() || STATE.loadedArticleKey === articleKey) return;

    STATE.loadedArticleKey = articleKey;

    try {
      const result = await requestApi('/api/notes', {
        auth: true,
        query: {
          articleId: article.articleId,
          articlePath: article.articlePath
        }
      });

      if (Array.isArray(result.notes)) {
        result.notes.forEach(note => renderNoteOnPage({ ...note, status: note.status || 'pending' }));
        if (result.notes.length) showToast(`未同步笔记已加载，共${result.notes.length}个`);
      }
    } catch (error) {
      console.error('加载未同步笔记失败:', error);
    }
  }

  function bindGlobalEvents() {
    if (STATE.bound) return;
    STATE.bound = true;

    document.addEventListener('click', event => {
      const noteEl = event.target.closest?.('.highlight-note[data-note-id]');
      if (!noteEl) return;
      showNotePopup(noteEl.dataset.noteId);
    });

    document.addEventListener('mouseup', () => setTimeout(handleSelection, 10));
    document.addEventListener('keyup', event => {
      if (event.key === 'Shift' || event.key.startsWith('Arrow')) {
        setTimeout(handleSelection, 10);
      }
    });
  }

  function showTokenDialog() {
    const overlay = document.createElement('div');
    overlay.className = 'note-dialog';

    const card = document.createElement('div');
    card.className = 'note-card';

    // 头部
    const header = document.createElement('header');
    header.className = 'note-card__header';

    const title = document.createElement('h3');
    title.className = 'note-card__title';
    title.textContent = '划线笔记设置';

    const actions = document.createElement('div');
    actions.className = 'note-card__actions';

    const btnConfirm = createIconButton('note-card__btn note-card__btn--confirm', '确认', svgCheckmark, () => {
      const token = input.value.trim();
      if (!token) return;
      setWriteToken(token);
      overlay.remove();
      showToast('令牌已保存，刷新页面后生效');
    });

    const btnClose = createIconButton('note-card__btn', '关闭', svgClose, () => overlay.remove());

    actions.append(btnConfirm, btnClose);
    header.append(title, actions);

    // 内容区：输入框
    const viewContainer = document.createElement('div');
    viewContainer.className = 'note-card__view-container';

    const input = document.createElement('input');
    input.className = 'note-card__textarea';
    input.type = 'password';
    input.placeholder = 'WRITE_TOKEN';
    input.value = getWriteToken();

    viewContainer.appendChild(input);

    card.append(header, viewContainer);
    overlay.appendChild(card);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
    input.focus();
  }

  function bindTokenSettingsButton() {
    const btn = document.getElementById('note-token-settings');
    if (btn) btn.addEventListener('click', showTokenDialog);
  }
  function init() {
    bindGlobalEvents();
    hideAddButton();
    loadPendingNotes();
    bindTokenSettingsButton();
  }

  window.HighlightNote = {
    showNotePopup,
    saveNote,
    updateNote,
    deleteNote,
    setWriteToken,
    clearWriteToken: () => setWriteToken('')
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('ji:page-ready', () => {
    STATE.loadedArticleKey = '';
    init();
  });
})();
