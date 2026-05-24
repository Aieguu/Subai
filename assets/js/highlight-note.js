(function () {
  'use strict';

  const CONFIG = {
    apiUrl: (document.querySelector('meta[name="highlight-note-api"]')?.content || '').replace(/\/+$/, ''),
    enabled: document.querySelector('meta[name="highlight-note-enabled"]')?.content === 'true'
  };

  if (!CONFIG.enabled) return;

  // ========== Toast 通知 ==========

  function getToastContainer() {
    let container = document.getElementById('note-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'note-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast(message, type) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `note-toast note-toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('note-toast-hide');
      toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
  }

  // ========== Loading 指示器 ==========

  function showLoading(noteId) {
    const badge = document.querySelector(`[data-note-id="${noteId}"]`);
    if (!badge) return;
    const loader = document.createElement('span');
    loader.className = 'note-loading';
    loader.dataset.noteId = noteId;
    badge.style.position = 'relative';
    badge.appendChild(loader);
  }

  function hideLoading(noteId) {
    const loader = document.querySelector(`.note-loading[data-note-id="${noteId}"]`);
    if (loader) loader.remove();
  }

  // ========== 工具函数 ==========

  function generateNoteId() {
    return 'note-' + Math.random().toString(36).substr(2, 9);
  }

  function getArticleSlug() {
    const path = window.location.pathname;
    const match = path.match(/\/posts\/([^\/]+)\//);
    return match ? decodeURIComponent(match[1]) : null;
  }

  // ========== API 操作 ==========

  async function saveNote(selectedText, noteContent) {
    const articleSlug = getArticleSlug();
    if (!articleSlug) throw new Error('无法获取文章标识');

    const response = await fetch(`${CONFIG.apiUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleSlug, selectedText, noteContent })
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error || '保存失败');

    const note = {
      id: result.noteId,
      articleSlug,
      selectedText,
      noteContent,
      status: 'pending'
    };
    renderNoteOnPage(note);
    return result;
  }

  async function updateNote(noteId, newContent) {
    const articleSlug = getArticleSlug();
    if (!articleSlug) throw new Error('无法获取文章标识');

    const response = await fetch(`${CONFIG.apiUrl}/api/notes/${noteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleSlug, noteContent: newContent })
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error || '更新失败');
    return result;
  }

  async function deleteNote(noteId) {
    const articleSlug = getArticleSlug();
    if (!articleSlug) throw new Error('无法获取文章标识');

    const badge = document.querySelector(`[data-note-id="${noteId}"]`);
    if (badge) {
      const parent = badge.parentNode;
      parent.replaceChild(document.createTextNode(badge.textContent), badge);
    }

    const response = await fetch(`${CONFIG.apiUrl}/api/notes/${noteId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleSlug })
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error || '删除失败');
    return result;
  }

  async function getNoteContent(noteId) {
    const hugoNote = document.querySelector(`[data-note-content="${noteId}"]`);
    if (hugoNote) return hugoNote.innerHTML;

    try {
      const response = await fetch(`${CONFIG.apiUrl}/api/notes/${noteId}`);
      const result = await response.json();
      if (result.success && result.note) return result.note.noteContent;
    } catch (e) {
      console.error('获取笔记失败:', e);
    }
    return null;
  }

  // ========== 渲染笔记标记 ==========

  function renderNoteOnPage(note) {
    const contentEl = document.querySelector('.content.main-reveal');
    if (!contentEl) return;

    if (document.querySelector(`[data-note-id="${note.id}"]`)) return;

    const walker = document.createTreeWalker(
      contentEl, NodeFilter.SHOW_TEXT, null, false
    );

    let node;
    while (node = walker.nextNode()) {
      const index = node.textContent.indexOf(note.selectedText);
      if (index !== -1) {
        const before = node.textContent.substring(0, index);
        const after = node.textContent.substring(index + note.selectedText.length);

        const mark = document.createElement('mark');
        mark.className = `highlight-note ${note.status || ''}`;
        mark.dataset.noteId = note.id;
        mark.textContent = note.selectedText;
        mark.onclick = () => showNotePopup(note.id);

        const parent = node.parentNode;
        if (before) parent.insertBefore(document.createTextNode(before), node);
        parent.insertBefore(mark, node);
        if (after) parent.insertBefore(document.createTextNode(after), node);
        parent.removeChild(node);
        break;
      }
    }
  }

  // ========== 笔记弹窗 ==========

  async function showNotePopup(noteId) {
    showLoading(noteId);
    const noteContent = await getNoteContent(noteId);
    hideLoading(noteId);

    if (!noteContent) return;

    const badge = document.querySelector(`[data-note-id="${noteId}"]`);
    const selectedText = badge ? badge.textContent : '';

    const popup = document.createElement('div');
    popup.className = 'note-popup';
    popup.innerHTML = `
      <div class="note-popup-content">
        <div class="note-popup-header">
          <h3>笔记</h3>
          <button class="note-popup-close">&times;</button>
        </div>
        <div class="note-popup-body">
          <p class="note-selected-text">"${selectedText}"</p>
          <div class="note-content">${noteContent}</div>
        </div>
        <div class="note-popup-footer">
          <div class="note-footer-left">
            <span class="note-status pending">待同步</span>
          </div>
          <div class="note-footer-right">
            <button class="btn btn-secondary note-edit-btn">编辑</button>
            <button class="btn btn-danger note-delete-btn">删除</button>
          </div>
        </div>
      </div>
    `;

    popup.querySelector('.note-popup-close').onclick = () => popup.remove();
    popup.onclick = (e) => { if (e.target === popup) popup.remove(); };

    popup.querySelector('.note-edit-btn').onclick = () => {
      popup.remove();
      showEditDialog(noteId, selectedText, noteContent);
    };

    popup.querySelector('.note-delete-btn').onclick = () => {
      popup.remove();
      deleteNote(noteId).then(
        () => showToast('笔记已删除', 'success'),
        (err) => showToast('删除失败: ' + err.message, 'error')
      );
    };

    document.body.appendChild(popup);
  }

  // ========== 编辑对话框 ==========

  function showEditDialog(noteId, selectedText, currentContent) {
    const dialog = document.createElement('div');
    dialog.className = 'note-dialog';
    dialog.innerHTML = `
      <div class="note-dialog-content">
        <div class="note-dialog-header">
          <h3>编辑笔记</h3>
          <button class="note-dialog-close">&times;</button>
        </div>
        <div class="note-dialog-body">
          <p class="note-selected-preview">"${selectedText}"</p>
          <textarea class="note-input" placeholder="输入笔记内容...">${currentContent}</textarea>
        </div>
        <div class="note-dialog-footer">
          <button class="btn btn-secondary note-cancel-btn">取消</button>
          <button class="btn btn-primary note-save-btn">保存</button>
        </div>
      </div>
    `;

    dialog.querySelector('.note-dialog-close').onclick = () => dialog.remove();
    dialog.querySelector('.note-cancel-btn').onclick = () => dialog.remove();
    dialog.querySelector('.note-save-btn').onclick = () => {
      const newContent = dialog.querySelector('.note-input').value.trim();
      if (!newContent) return;
      dialog.remove();
      updateNote(noteId, newContent).then(
        () => showToast('笔记已更新', 'success'),
        (err) => showToast('更新失败: ' + err.message, 'error')
      );
    };

    document.body.appendChild(dialog);
    dialog.querySelector('.note-input').focus();
  }

  // ========== 添加笔记对话框 ==========

  function showAddDialog(selectedText) {
    const dialog = document.createElement('div');
    dialog.className = 'note-dialog';
    dialog.innerHTML = `
      <div class="note-dialog-content">
        <div class="note-dialog-header">
          <h3>添加笔记</h3>
          <button class="note-dialog-close">&times;</button>
        </div>
        <div class="note-dialog-body">
          <p class="note-selected-preview">"${selectedText}"</p>
          <textarea class="note-input" placeholder="输入笔记内容..."></textarea>
        </div>
        <div class="note-dialog-footer">
          <button class="btn btn-secondary note-cancel-btn">取消</button>
          <button class="btn btn-primary note-save-btn">保存</button>
        </div>
      </div>
    `;

    dialog.querySelector('.note-dialog-close').onclick = () => dialog.remove();
    dialog.querySelector('.note-cancel-btn').onclick = () => dialog.remove();
    dialog.querySelector('.note-save-btn').onclick = () => {
      const noteContent = dialog.querySelector('.note-input').value.trim();
      if (!noteContent) return;
      dialog.remove();
      saveNote(selectedText, noteContent).then(
        () => showToast('笔记已添加', 'success'),
        (err) => showToast('保存失败: ' + err.message, 'error')
      );
    };

    document.body.appendChild(dialog);
    dialog.querySelector('.note-input').focus();
  }

  // ========== 选中文本监听 ==========

  function initSelectionListener() {
    let addBtn = null;

    document.addEventListener('mouseup', function () {
      setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        const contentEl = document.querySelector('.content.main-reveal');
        if (!contentEl || !contentEl.contains(selection.anchorNode)) {
          hideAddBtn();
          return;
        }

        if (selectedText.length > 0) {
          showAddBtn(selection, selectedText);
        } else {
          hideAddBtn();
        }
      }, 10);
    });

    function showAddBtn(selection, text) {
      if (!addBtn) {
        addBtn = document.createElement('button');
        addBtn.id = 'add-note-btn';
        addBtn.textContent = '添加笔记';
        document.body.appendChild(addBtn);
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      addBtn.style.display = 'block';
      addBtn.style.left = `${rect.right + window.scrollX + 4}px`;
      addBtn.style.top = `${rect.top + window.scrollY - 4}px`;
      addBtn.onclick = () => {
        hideAddBtn();
        showAddDialog(text);
      };
    }

    function hideAddBtn() {
      if (addBtn) addBtn.style.display = 'none';
    }
  }

  // ========== 初始化 ==========

  async function loadNotes() {
    const articleSlug = getArticleSlug();
    if (!articleSlug || !CONFIG.apiUrl) return;

    try {
      const response = await fetch(`${CONFIG.apiUrl}/api/notes?articleSlug=${encodeURIComponent(articleSlug)}`);
      const result = await response.json();
      if (result.success && result.notes) {
        result.notes.forEach(note => renderNoteOnPage({
          id: note.id,
          articleSlug: note.articleSlug,
          selectedText: note.selectedText,
          noteContent: note.noteContent,
          status: 'pending'
        }));
        showToast(`未同步笔记已加载，共${result.notes.length}个`, 'success');
      }
    } catch (e) {
      console.error('加载笔记失败:', e);
    }
  }

  function init() {
    initSelectionListener();

    document.querySelectorAll('.highlight-note[data-note-id]').forEach(el => {
      el.onclick = () => showNotePopup(el.dataset.noteId);
    });

    loadNotes();
  }

  window.HighlightNote = {
    showNotePopup,
    saveNote,
    updateNote,
    deleteNote
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('ji:page-ready', init);

})();
