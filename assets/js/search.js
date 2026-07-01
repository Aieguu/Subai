/**
 * 搜索功能处理
 */

(function() {
  'use strict';

  const headerSearchState = {
    initialized: false,
    searchContainer: null,
    searchToggle: null,
    searchForm: null,
    searchInput: null,
    isOpen: false
  };

  const searchPageState = {
    initialized: false,
    indexPromise: null
  };

  function getSiteRoot() {
    const root = (window.Subai && window.Subai.siteRoot) || '/';
    return root.endsWith('/') ? root : `${root}/`;
  }

  function resolveSiteUrl(path) {
    return new URL(path.replace(/^\//, ''), `${window.location.origin}${getSiteRoot()}`).toString();
  }

  function buildSearchUrl(query) {
    const target = new URL(headerSearchState.searchForm.action, window.location.origin);
    target.searchParams.set('q', query);
    return target.toString();
  }

  function syncQueryFromLocation() {
    if (!headerSearchState.searchInput) return;

    const params = new URLSearchParams(window.location.search);
    headerSearchState.searchInput.value = params.get('q') || '';
  }

  function openSearch() {
    if (!headerSearchState.searchForm || !headerSearchState.searchToggle) return;

    headerSearchState.isOpen = true;
    headerSearchState.searchForm.classList.add('active');
    headerSearchState.searchToggle.classList.add('active');
    headerSearchState.searchToggle.setAttribute('aria-expanded', 'true');
    headerSearchState.searchToggle.setAttribute('aria-label', '执行搜索');

    requestAnimationFrame(() => {
      window.setTimeout(() => {
        headerSearchState.searchInput.focus();
        headerSearchState.searchInput.select();
      }, 120);
    });
  }

  function closeSearch({ restoreFocus = false } = {}) {
    if (!headerSearchState.searchForm || !headerSearchState.searchToggle) return;

    headerSearchState.isOpen = false;
    headerSearchState.searchForm.classList.remove('active');
    headerSearchState.searchToggle.classList.remove('active');
    headerSearchState.searchToggle.setAttribute('aria-expanded', 'false');
    headerSearchState.searchToggle.setAttribute('aria-label', '打开搜索');

    if (restoreFocus) {
      headerSearchState.searchToggle.focus();
    }
  }

  function submitSearch() {
    const query = headerSearchState.searchInput.value.trim();
    if (!query) {
      headerSearchState.searchInput.focus();
      return;
    }

    const targetUrl = buildSearchUrl(query);
    const navigate = window.Subai && window.Subai.consume ? window.Subai.consume('navigate') : null;

    if (typeof navigate === 'function') {
      navigate(targetUrl);
      return;
    }

    window.location.assign(targetUrl);
  }

  function handleToggleClick(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!headerSearchState.isOpen) {
      openSearch();
      return;
    }

    submitSearch();
  }

  function handleDocumentClick(event) {
    if (!headerSearchState.searchContainer.contains(event.target)) {
      closeSearch();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape' && headerSearchState.isOpen) {
      closeSearch({ restoreFocus: true });
    }
  }

  function getSearchPageElements() {
    const container = document.getElementById('search-results-container');
    const title = document.getElementById('search-title');
    const subtitle = document.getElementById('search-subtitle');
    const pagination = document.getElementById('search-pagination');

    if (!container || !title || !subtitle || !pagination) return null;

    return { container, title, subtitle, pagination };
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getPageParameter(search = window.location.search) {
    const params = new URLSearchParams(search);
    const page = Number.parseInt(params.get('page') || '1', 10);
    return Number.isFinite(page) && page > 0 ? page : 1;
  }

  function getQueryParameter(search = window.location.search) {
    const params = new URLSearchParams(search);
    return (params.get('q') || '').trim();
  }

  function loadSearchIndex() {
    if (!searchPageState.indexPromise) {
      searchPageState.indexPromise = fetch(resolveSiteUrl('index.json'))
        .then((response) => {
          if (!response.ok) {
            throw new Error('搜索索引加载失败');
          }

          return response.json();
        });
    }

    return searchPageState.indexPromise;
  }

  function buildSearchResults(results, page, query) {
    const ITEMS_PER_PAGE = 8;
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const currentPage = Math.min(Math.max(1, page), Math.max(1, totalPages));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const pageResults = results.slice(startIndex, endIndex);

    const resultsHtml = pageResults.map((item) => {
      const title = escapeHtml(item.title);
      const date = item.date ? new Date(item.date).toLocaleDateString('zh-CN') : '';
      const categories = item.categories || [];
      const subtitle = item.subtitle || '';

      return `
        <article class="post-card post-card-unified${!item.cover_image ? ' no-image' : ''}">
          <a href="${item.url}" class="post-card-link">
            ${item.cover_image ? `
              <div class="post-card-image">
                <img src="${item.cover_image}" alt="${title}" loading="lazy" decoding="async">
              </div>
            ` : ''}
            <div class="post-card-content">
              ${categories.length > 0 ? `
                <div class="post-card-categories">
                  ${categories.slice(0, 3).map((category) => `
                    <span class="category-tag">${escapeHtml(category)}</span>
                  `).join('')}
                </div>
              ` : ''}
              <h3 class="post-card-title">${title}</h3>
              ${subtitle ? `
                <p class="post-card-subtitle desktop-only">${escapeHtml(subtitle)}</p>
              ` : ''}
              <div class="post-card-meta">
                <time datetime="${item.date}" class="post-date">${date}</time>
                ${item.author ? `
                  <span class="post-author desktop-only">by ${escapeHtml(item.author)}</span>
                ` : ''}
              </div>
            </div>
          </a>
        </article>
      `;
    }).join('');

    return {
      currentPage,
      totalPages,
      html: `
        <div class="posts-grid-two">
          ${resultsHtml}
        </div>
      `
    };
  }

  function generatePaginationHTML(currentPage, totalPages, query) {
    let paginationHTML = '<nav class="pagination" role="navigation" aria-label="Pagination Navigation">';
    paginationHTML += '<div class="pagination-wrapper">';

    if (currentPage > 1) {
      const prevPage = currentPage - 1;
      paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=${prevPage}" class="pagination-link pagination-prev" rel="prev"><span>上一页</span></a>`;
    } else {
      paginationHTML += '<span class="pagination-link pagination-prev pagination-disabled"><span>上一页</span></span>';
    }

    paginationHTML += '<div class="pagination-numbers">';

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i += 1) {
        if (i === currentPage) {
          paginationHTML += `<span class="pagination-number pagination-current" aria-current="page">${i}</span>`;
        } else {
          paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=${i}" class="pagination-number">${i}</a>`;
        }
      }
    } else if (currentPage <= 4) {
      for (let i = 1; i <= 5; i += 1) {
        if (i === currentPage) {
          paginationHTML += `<span class="pagination-number pagination-current" aria-current="page">${i}</span>`;
        } else {
          paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=${i}" class="pagination-number">${i}</a>`;
        }
      }
      paginationHTML += '<span class="pagination-ellipsis">…</span>';
      paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=${totalPages}" class="pagination-number">${totalPages}</a>`;
    } else if (currentPage >= totalPages - 3) {
      paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=1" class="pagination-number">1</a>`;
      paginationHTML += '<span class="pagination-ellipsis">…</span>';
      for (let i = totalPages - 4; i <= totalPages; i += 1) {
        if (i === currentPage) {
          paginationHTML += `<span class="pagination-number pagination-current" aria-current="page">${i}</span>`;
        } else {
          paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=${i}" class="pagination-number">${i}</a>`;
        }
      }
    } else {
      paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=1" class="pagination-number">1</a>`;
      paginationHTML += '<span class="pagination-ellipsis">…</span>';
      for (let i = currentPage - 1; i <= currentPage + 1; i += 1) {
        if (i === currentPage) {
          paginationHTML += `<span class="pagination-number pagination-current" aria-current="page">${i}</span>`;
        } else {
          paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=${i}" class="pagination-number">${i}</a>`;
        }
      }
      paginationHTML += '<span class="pagination-ellipsis">…</span>';
      paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=${totalPages}" class="pagination-number">${totalPages}</a>`;
    }

    paginationHTML += '</div>';

    if (currentPage < totalPages) {
      const nextPage = currentPage + 1;
      paginationHTML += `<a href="?q=${encodeURIComponent(query)}&page=${nextPage}" class="pagination-link pagination-next" rel="next"><span>下一页</span></a>`;
    } else {
      paginationHTML += '<span class="pagination-link pagination-next pagination-disabled"><span>下一页</span></span>';
    }

    paginationHTML += '</div>';
    paginationHTML += `<div class="pagination-info"><span class="pagination-summary">第 ${currentPage} 页，共 ${totalPages} 页</span></div>`;
    paginationHTML += '</nav>';

    return paginationHTML;
  }

  async function initSearchPage(targetUrl = window.location.href) {
    const elements = getSearchPageElements();
    if (!elements) return;

    const target = new URL(targetUrl, window.location.origin);
    const query = getQueryParameter(target.search);
    const currentPage = getPageParameter(target.search);

    if (!query) {
      elements.title.textContent = '搜索';
      elements.subtitle.style.display = 'none';
      elements.pagination.style.display = 'none';
      elements.container.innerHTML = `
        <div class="no-posts">
          <p>请输入搜索关键词</p>
        </div>
      `;
      return;
    }

    elements.title.textContent = `搜索结果 - "${query}"`;
    elements.subtitle.textContent = '搜索中...';
    elements.subtitle.style.display = 'block';
    elements.pagination.style.display = 'none';
    elements.container.innerHTML = `
      <div class="no-posts">
        <p>正在搜索 "<strong>${escapeHtml(query)}</strong>" ...</p>
      </div>
    `;

    try {
      const searchIndex = await loadSearchIndex();
      const queryLower = query.toLowerCase();

      const results = searchIndex.filter((item) => {
        const searchText = `${item.title} ${item.content} ${item.summary || ''} ${(item.tags || []).join(' ')} ${(item.categories || []).join(' ')}`.toLowerCase();

        if (item.title.toLowerCase().includes(queryLower)) return true;
        if (searchText.includes(queryLower)) return true;

        const tags = (item.tags || []).map((tag) => tag.toLowerCase());
        const categories = (item.categories || []).map((category) => category.toLowerCase());
        return tags.some((tag) => tag.includes(queryLower)) ||
               categories.some((category) => category.includes(queryLower));
      }).sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();

        if (aTitle.includes(queryLower) && !bTitle.includes(queryLower)) return -1;
        if (!aTitle.includes(queryLower) && bTitle.includes(queryLower)) return 1;
        return new Date(b.date) - new Date(a.date);
      });

      elements.subtitle.textContent = `找到 ${results.length} 个结果`;
      elements.subtitle.style.display = 'block';

      if (!results.length) {
        elements.container.innerHTML = `
          <div class="no-posts">
            <p>未找到包含 "<strong>${escapeHtml(query)}</strong>" 的结果</p>
            <p>请尝试其他关键词</p>
          </div>
        `;
        elements.pagination.style.display = 'none';
        return;
      }

      const rendered = buildSearchResults(results, currentPage, query);
      elements.container.innerHTML = rendered.html;

      if (rendered.totalPages > 1) {
        elements.pagination.innerHTML = generatePaginationHTML(rendered.currentPage, rendered.totalPages, query);
        elements.pagination.style.display = 'block';
      } else {
        elements.pagination.style.display = 'none';
      }
    } catch (error) {
      console.error('搜索失败:', error);
      elements.subtitle.style.display = 'none';
      elements.pagination.style.display = 'none';
      elements.container.innerHTML = `
        <div class="no-posts">
          <p>搜索失败，请稍后重试</p>
        </div>
      `;
    }
  }

  function initSearch() {
    if (!headerSearchState.initialized) {
      headerSearchState.searchContainer = document.querySelector('.search-container');
      headerSearchState.searchToggle = document.querySelector('.search-toggle');
      headerSearchState.searchForm = document.querySelector('.search-form');
      headerSearchState.searchInput = document.querySelector('.search-input');

      if (!headerSearchState.searchContainer || !headerSearchState.searchToggle || !headerSearchState.searchForm || !headerSearchState.searchInput) {
        initSearchPage();
        return;
      }

      headerSearchState.searchToggle.addEventListener('click', handleToggleClick);

      headerSearchState.searchForm.addEventListener('submit', function(event) {
        event.preventDefault();
        submitSearch();
      });

      headerSearchState.searchInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          submitSearch();
        }
      });

      headerSearchState.searchInput.addEventListener('blur', function() {
        window.setTimeout(() => {
          if (!headerSearchState.searchContainer.contains(document.activeElement)) {
            closeSearch();
          }
        }, 100);
      });

      headerSearchState.searchInput.addEventListener('focus', function() {
        if (!headerSearchState.isOpen) {
          openSearch();
        }
      });

      document.addEventListener('click', handleDocumentClick);
      document.addEventListener('keydown', handleKeydown);

      headerSearchState.initialized = true;
    }

    syncQueryFromLocation();
    initSearchPage(window.location.href);
  }

  window.Subai.register('initSearchPage', initSearchPage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }
})();

