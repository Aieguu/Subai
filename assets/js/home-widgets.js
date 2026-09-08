/**
 * Home widgets and shared interactive utilities
 * - Home current time
 * - Daily quote typing effect
 * - Home music player
 * - Share button copy action
 */

(function() {
  'use strict';

  function initHomeCurrentTime() {
    const existingTimer = window.Subai.getState('clockTimer');
    if (existingTimer) {
      clearInterval(existingTimer);
      window.Subai.setState('clockTimer', null);
    }

    const timeElement = document.querySelector('[data-current-time]');
    if (!timeElement) return;

    const shichenElement = document.querySelector('[data-current-shichen]');
    const SHICHEN = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];

    const timezone = timeElement.dataset.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone
    });
    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone
    });

    const updateTime = () => {
      const now = new Date();
      timeElement.textContent = timeFormatter.format(now);

      if (shichenElement) {
        // 时辰：子时为 23:00–01:00，每两小时一时辰
        const hour = Number.parseInt(hourFormatter.format(now), 10) % 24;
        shichenElement.textContent = SHICHEN[Math.floor(((hour + 1) % 24) / 2)];
      }
    };

    updateTime();
    window.Subai.setState('clockTimer', setInterval(updateTime, 15000));
  }

  function initHomeDailyQuote() {
    const existingState = window.Subai.getState('quoteState');
    if (existingState) {
      if (Array.isArray(existingState.timers)) {
        existingState.timers.forEach((timer) => clearTimeout(timer));
      }
      window.Subai.setState('quoteState', null);
    }

    const quoteRoot = document.querySelector('[data-home-daily-quote]');
    if (!quoteRoot) return;

    const quoteText = quoteRoot.querySelector('[data-daily-quote-text]');
    if (!quoteText) return;

    const resolveQuotes = (source) => {
      if (Array.isArray(source)) return source;
      if (typeof source !== 'string') return [];

      try {
        const parsed = JSON.parse(source);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        return [];
      }
    };

    const normalizeQuote = (item) => {
      if (typeof item === 'string') {
        const text = item.trim();
        return text || null;
      }

      if (item && typeof item === 'object') {
        const text = typeof item.text === 'string' ? item.text.trim() : '';
        if (!text) return null;
        return text;
      }

      return null;
    };

    const quotes = resolveQuotes(quoteRoot.dataset.quotes)
      .map(normalizeQuote)
      .filter(Boolean);

    if (!quotes.length) {
      quoteText.textContent = '';
      return;
    }

    const quoteState = {
      timers: [],
      lastIndex: -1
    };

    window.Subai.setState('quoteState', quoteState);

    const pushTimer = (callback, delay) => {
      const timer = window.setTimeout(() => {
        quoteState.timers = quoteState.timers.filter(item => item !== timer);
        callback();
      }, delay);
      quoteState.timers.push(timer);
      return timer;
    };

    const typeSpeed = Math.max(40, Number.parseInt(quoteRoot.dataset.typeSpeed || '90', 10) || 90);
    const deleteSpeed = Math.max(24, Number.parseInt(quoteRoot.dataset.deleteSpeed || '45', 10) || 45);
    const switchTime = Math.max(1200, Number.parseInt(quoteRoot.dataset.switchTime || quoteRoot.dataset.interval || '2600', 10) || 2600);

    const getRandomIndex = () => {
      if (quotes.length <= 1) return 0;

      let nextIndex = Math.floor(Math.random() * quotes.length);
      while (nextIndex === quoteState.lastIndex) {
        nextIndex = Math.floor(Math.random() * quotes.length);
      }
      return nextIndex;
    };

    // 洇墨模式：逐字 <span>，出现时从模糊洇开到定形；reduced-motion 退化为纯文本
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 内层文本容器：quoteText 是 flex 容器，字符需包一层以保持自然折行
    let quoteFlow = quoteText.querySelector('[data-quote-flow]');
    if (!quoteFlow) {
      quoteFlow = document.createElement('span');
      quoteFlow.className = 'home-quote-flow';
      quoteFlow.setAttribute('data-quote-flow', '');
      quoteText.textContent = '';
      quoteText.appendChild(quoteFlow);
    }

    const typeText = (text, callback) => {
      const chars = Array.from(text);
      let index = 0;
      quoteRoot.classList.remove('is-deleting');
      quoteRoot.classList.add('is-typing');

      const step = () => {
        const ch = chars[index];
        index += 1;

        if (reducedMotion) {
          quoteFlow.append(ch);
        } else {
          const span = document.createElement('span');
          span.className = 'ink-char';
          span.textContent = ch;
          quoteFlow.appendChild(span);
        }

        if (index < chars.length) {
          pushTimer(step, typeSpeed);
        } else {
          quoteRoot.classList.remove('is-typing');
          callback();
        }
      };

      quoteFlow.textContent = '';
      pushTimer(step, typeSpeed);
    };

    const deleteText = (callback) => {
      if (!quoteFlow.textContent) {
        callback();
        return;
      }

      quoteRoot.classList.remove('is-typing');
      quoteRoot.classList.add('is-deleting');

      const step = () => {
        const last = quoteFlow.lastChild;
        if (!last) {
          quoteRoot.classList.remove('is-deleting');
          callback();
          return;
        }

        if (!reducedMotion && last.nodeType === Node.ELEMENT_NODE) {
          // 淡出后于下一拍移除
          last.classList.add('ink-out');
          pushTimer(() => last.remove(), deleteSpeed);
        } else {
          last.remove();
        }

        pushTimer(step, deleteSpeed);
      };

      pushTimer(step, deleteSpeed);
    };

    const cycleQuote = (isFirstRender = false) => {
      const nextIndex = getRandomIndex();
      const nextQuote = quotes[nextIndex];
      quoteState.lastIndex = nextIndex;

      const startTyping = () => {
        typeText(nextQuote, () => {
          pushTimer(() => cycleQuote(false), switchTime);
        });
      };

      if (isFirstRender || !quoteText.textContent) {
        startTyping();
      } else {
        deleteText(startTyping);
      }
    };

    cycleQuote(true);
  }

  function initHomeMusicPlayer() {
    const player = document.querySelector('[data-home-music-player]');
    const STATE_KEY = 'ji_home_music_state_v1';
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const normalizeSrc = (value) => {
      try {
        return new URL(value || '', window.location.origin).href;
      } catch (error) {
        return value || '';
      }
    };
    const resolvePlaylist = (source) => {
      if (Array.isArray(source)) return source;
      if (typeof source === 'string') {
        try {
          const parsed = JSON.parse(source);
          return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
          return [];
        }
      }
      return [];
    };

    const getTrackName = (src) => {
      const normalized = (src || '').split('?')[0].split('#')[0];
      const fileName = decodeURIComponent(normalized.split('/').pop() || '曲目');
      return fileName.replace(/\.[^/.]+$/, '');
    };

    const playlist = resolvePlaylist(
      player?.dataset.playlist ?? window.Subai.playlist ?? []
    ).filter(item => typeof item === 'string' && item.trim().length > 0);

    if (!window.Subai.getState('musicManager')) {
      let audio = document.querySelector('audio[data-global-music-audio="true"]');
      if (!audio) {
        audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.dataset.globalMusicAudio = 'true';
        audio.style.display = 'none';
        document.body.appendChild(audio);
      }

      const manager = {
        audio,
        playlist: [],
        currentIndex: 0,
        playlistSignature: '',
        ui: {},
        lastPersistAt: 0,
        restoreState() {
          try {
            const raw = localStorage.getItem(STATE_KEY);
            return raw ? JSON.parse(raw) : {};
          } catch (error) {
            return {};
          }
        },
        persistState() {
          try {
            localStorage.setItem(STATE_KEY, JSON.stringify({
              index: this.currentIndex,
              time: Number.isFinite(this.audio.currentTime) ? this.audio.currentTime : 0,
              volume: this.audio.volume,
              muted: this.audio.muted,
              isPlaying: !this.audio.paused,
              updatedAt: Date.now()
            }));
          } catch (error) {
            // ignore
          }
        },
        updateTrackInfo() {
          if (this.ui.trackElement) {
            this.ui.trackElement.textContent = this.playlist.length
              ? getTrackName(this.playlist[this.currentIndex])
              : '暂无曲目';
          }
        },
        updatePlayState() {
          if (this.ui.toggleButton) {
            this.ui.toggleButton.classList.toggle('is-playing', !this.audio.paused);
          }
        },
        updateProgress() {
          if (!this.ui.progressBar) return;
          if (!this.audio.duration || Number.isNaN(this.audio.duration)) {
            this.ui.progressBar.style.width = '0%';
            return;
          }
          const percentage = (this.audio.currentTime / this.audio.duration) * 100;
          this.ui.progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        },
        updateVolumeState() {
          if (this.ui.volumeRange) {
            this.ui.volumeRange.value = `${Math.round(this.audio.volume * 100)}`;
          }
          if (this.ui.muteButton) {
            this.ui.muteButton.classList.toggle('is-muted', this.audio.muted || this.audio.volume === 0);
          }
        },
        applySavedPreferences(savedState = {}) {
          const restoreVolume = Number.isFinite(savedState.volume) ? clamp(savedState.volume, 0, 1) : 0.7;
          this.audio.volume = restoreVolume;
          this.audio.muted = Boolean(savedState.muted);
        },
        setTrack(nextIndex, options = {}) {
          const { autoPlay = false, restoreTime = 0, forceReload = false } = options;
          if (!this.playlist.length) return;

          this.currentIndex = (nextIndex + this.playlist.length) % this.playlist.length;
          const nextSrc = this.playlist[this.currentIndex];
          const currentSrc = this.audio.getAttribute('src') || this.audio.currentSrc || '';
          const shouldReload = forceReload || normalizeSrc(currentSrc) !== normalizeSrc(nextSrc);

          if (shouldReload) {
            this.audio.src = nextSrc;
            this.audio.load();
          }

          if (restoreTime > 0) {
            const seek = () => {
              try {
                const maxDuration = Number.isFinite(this.audio.duration) ? this.audio.duration : restoreTime;
                this.audio.currentTime = Math.min(Math.max(0, restoreTime), maxDuration);
              } catch (error) {
                // ignore
              }
            };

            if (this.audio.readyState >= 1) {
              seek();
            } else {
              this.audio.addEventListener('loadedmetadata', seek, { once: true });
            }
          } else if (shouldReload) {
            this.audio.currentTime = 0;
          }

          this.updateTrackInfo();
          this.updateProgress();
          this.persistState();

          if (autoPlay) {
            this.audio.play().catch(() => {});
          } else {
            this.updatePlayState();
          }
        },
        bindUI(nextPlayer) {
          this.ui = {
            player: nextPlayer || null,
            prevButton: nextPlayer?.querySelector('[data-music-prev]') || null,
            nextButton: nextPlayer?.querySelector('[data-music-next]') || null,
            toggleButton: nextPlayer?.querySelector('[data-music-toggle]') || null,
            trackElement: nextPlayer?.querySelector('[data-music-track]') || null,
            muteButton: nextPlayer?.querySelector('[data-music-mute]') || null,
            volumeRange: nextPlayer?.querySelector('[data-music-volume]') || null,
            progress: nextPlayer?.querySelector('[data-music-progress]') || null,
            progressBar: nextPlayer?.querySelector('[data-music-progress-bar]') || null
          };

          if (!nextPlayer) return;

          const { prevButton, nextButton, toggleButton, muteButton, volumeRange, progress } = this.ui;

          if (prevButton) {
            prevButton.disabled = this.playlist.length <= 1;
            prevButton.onclick = () => this.setTrack(this.currentIndex - 1, { autoPlay: true });
          }

          if (nextButton) {
            nextButton.disabled = this.playlist.length <= 1;
            nextButton.onclick = () => this.setTrack(this.currentIndex + 1, { autoPlay: true });
          }

          if (toggleButton) {
            toggleButton.onclick = () => {
              if (this.audio.paused) {
                this.audio.play().catch(() => {});
              } else {
                this.audio.pause();
              }
            };
          }

          if (muteButton) {
            muteButton.onclick = () => {
              this.audio.muted = !this.audio.muted;
              if (!this.audio.muted && this.audio.volume === 0) {
                this.audio.volume = 0.7;
              }
              this.updateVolumeState();
              this.persistState();
            };
          }

          if (volumeRange) {
            volumeRange.oninput = () => {
              const value = Number.parseInt(volumeRange.value, 10);
              if (!Number.isFinite(value)) return;
              const normalized = clamp(value / 100, 0, 1);
              this.audio.volume = normalized;
              this.audio.muted = normalized === 0;
              this.updateVolumeState();
              this.persistState();
            };
          }

          if (progress) {
            progress.onclick = (event) => {
              if (!this.audio.duration || Number.isNaN(this.audio.duration)) return;
              const rect = progress.getBoundingClientRect();
              if (!rect.width) return;
              const ratio = (event.clientX - rect.left) / rect.width;
              this.audio.currentTime = Math.min(this.audio.duration, Math.max(0, ratio * this.audio.duration));
              this.updateProgress();
              this.persistState();
            };
          }

          this.updateTrackInfo();
          this.updatePlayState();
          this.updateProgress();
          this.updateVolumeState();
        },
        updatePlaylist(nextPlaylist) {
          const cleaned = Array.isArray(nextPlaylist)
            ? nextPlaylist.filter(item => typeof item === 'string' && item.trim())
            : [];
          const nextSignature = cleaned.join('\n');
          const isChanged = this.playlistSignature !== nextSignature;

          this.playlist = cleaned;
          this.playlistSignature = nextSignature;

          if (!this.playlist.length) {
            this.updateTrackInfo();
            this.updateProgress();
            return;
          }

          if (isChanged || !this.audio.getAttribute('src')) {
            const savedState = this.restoreState();
            this.currentIndex = clamp(
              Number.parseInt(savedState.index, 10) || 0,
              0,
              Math.max(0, this.playlist.length - 1)
            );
            this.applySavedPreferences(savedState);
            this.setTrack(this.currentIndex, {
              autoPlay: false,
              restoreTime: Number.isFinite(savedState.time) ? savedState.time : 0,
              forceReload: true
            });

            if (Boolean(savedState.isPlaying)) {
              this.audio.play().catch(() => {});
            }
          } else {
            this.updateTrackInfo();
            this.updatePlayState();
            this.updateProgress();
            this.updateVolumeState();
          }
        },
        setupEvents() {
          this.audio.addEventListener('play', () => {
            this.updatePlayState();
            this.persistState();
          });

          this.audio.addEventListener('pause', () => {
            this.updatePlayState();
            this.persistState();
          });

          this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
            const now = Date.now();
            if (now - this.lastPersistAt > 1000) {
              this.persistState();
              this.lastPersistAt = now;
            }
          });

          this.audio.addEventListener('loadedmetadata', () => this.updateProgress());
          this.audio.addEventListener('volumechange', () => {
            this.updateVolumeState();
            this.persistState();
          });

          this.audio.addEventListener('ended', () => {
            this.setTrack(this.currentIndex + 1, { autoPlay: true });
          });

          window.addEventListener('pagehide', () => this.persistState());
          window.addEventListener('beforeunload', () => this.persistState());
          document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.persistState();
          });
        }
      };

      manager.setupEvents();
      window.Subai.setState('musicManager', manager);
    }

    const manager = window.Subai.getState('musicManager');
    manager.updatePlaylist(playlist);

    if (!playlist.length) {
      manager.bindUI(player || null);
      if (player) {
        const trackElement = player.querySelector('[data-music-track]');
        if (trackElement) trackElement.textContent = '暂无曲目';
      }
      return;
    }

    manager.bindUI(player || null);
  }

  /**
   * 山水频谱 —— 把音乐频谱画成水墨山峦
   * 远山淡、近山浓；AnalyserNode 单例跨 PJAX 复用，canvas 随页面重绑
   */
  function initMusicTerrain() {
    // PJAX 重入：上一页的 rAF 停掉，共享音频分析器保留
    const prev = window.Subai.getState('terrainView');
    if (prev && prev.raf) cancelAnimationFrame(prev.raf);
    window.Subai.setState('terrainView', null);

    const canvas = document.querySelector('[data-music-terrain]');
    if (!canvas) return;

    const audio = document.querySelector('audio[data-global-music-audio="true"]');
    if (!audio) return;

    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const view = { raf: 0, w: 0, h: 0 };
    window.Subai.setState('terrainView', view);

    // 墨色跟随主题（解析一次，主题切换时重解析）
    let ink = { r: 28, g: 27, b: 25 };
    const resolveInk = () => {
      const m = getComputedStyle(document.body).color.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      if (m) ink = { r: +m[1], g: +m[2], b: +m[3] };
    };
    resolveInk();

    // 三层山脊：远山高频/小幅/偏高/最淡，近山低频/大幅/偏低/最浓
    const LAYERS = [
      { from: 30, to: 90, base: 0.34, amp: 0.18, alpha: 0.07 },
      { from: 12, to: 48, base: 0.56, amp: 0.26, alpha: 0.11 },
      { from: 2,  to: 20, base: 0.78, amp: 0.36, alpha: 0.17 }
    ];
    const SAMPLES = 56;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      view.w = Math.max(1, Math.round(rect.width * dpr));
      view.h = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = view.w;
      canvas.height = view.h;
      if (audio.paused) drawStatic();
    };

    const drawRidge = (layer, values) => {
      const { w, h } = view;
      const step = w / (values.length - 1);
      ctx.beginPath();
      ctx.moveTo(-step, h);
      for (let i = 0; i < values.length; i++) {
        const x = i * step;
        const y = (layer.base - values[i] * layer.amp) * h;
        if (i === 0) {
          ctx.lineTo(x, y);
        } else {
          // 中点二次曲线平滑，山脊不尖锐
          const prevX = (i - 1) * step;
          const prevY = (layer.base - values[i - 1] * layer.amp) * h;
          ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2);
        }
      }
      ctx.lineTo(w + step, h);
      ctx.closePath();
      ctx.fillStyle = `rgba(${ink.r}, ${ink.g}, ${ink.b}, ${layer.alpha})`;
      ctx.fill();
    };

    // 静止时的剪影：固定相位正弦叠加，像远山轮廓
    const staticValues = (layer, seed) => {
      const values = [];
      for (let i = 0; i < SAMPLES; i++) {
        const t = i / SAMPLES;
        const v = 0.3 + 0.24 * Math.sin(i * 0.55 + seed) + 0.16 * Math.sin(i * 1.35 + seed * 2.1) + 0.08 * Math.sin(t * 6.28 * 3 + seed);
        values.push(Math.max(0.06, Math.min(0.9, v)));
      }
      return values;
    };

    function drawStatic() {
      ctx.clearRect(0, 0, view.w, view.h);
      LAYERS.forEach((layer, i) => drawRidge(layer, staticValues(layer, i * 1.7 + 0.9)));
    }

    function ensureAnalyser() {
      let shared = window.Subai.getState('terrainAudio');
      if (shared) return shared;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        const audioCtx = new AudioCtx();
        const sourceNode = audioCtx.createMediaElementSource(audio);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        sourceNode.connect(analyser);
        analyser.connect(audioCtx.destination); // 必须接回输出，否则无声
        shared = { audioCtx, analyser, data: new Uint8Array(analyser.frequencyBinCount) };
        window.Subai.setState('terrainAudio', shared);
        return shared;
      } catch (error) {
        return null; // createMediaElementSource 重复调用等异常：放弃动画，音频照常
      }
    }

    const drawFrame = () => {
      const shared = window.Subai.getState('terrainAudio');
      if (!shared) return;
      view.raf = requestAnimationFrame(drawFrame);
      shared.analyser.getByteFrequencyData(shared.data);
      ctx.clearRect(0, 0, view.w, view.h);
      for (const layer of LAYERS) {
        const values = [];
        const span = layer.to - layer.from;
        for (let i = 0; i < SAMPLES; i++) {
          const bin = layer.from + Math.floor((i / (SAMPLES - 1)) * (span - 1));
          values.push(Math.pow((shared.data[bin] || 0) / 255, 1.4)); // 压弱信号，山形更稳
        }
        drawRidge(layer, values);
      }
    };

    const startDrawing = () => {
      if (reduced) return;
      const shared = ensureAnalyser();
      if (!shared) return;
      if (shared.audioCtx.state === 'suspended') shared.audioCtx.resume().catch(() => {});
      if (view.raf) cancelAnimationFrame(view.raf);
      view.raf = requestAnimationFrame(drawFrame);
    };

    const stopDrawing = () => {
      if (view.raf) cancelAnimationFrame(view.raf);
      view.raf = 0;
    };

    // 一切定义就绪后才注册观察器与首次调用，避免 TDZ
    new MutationObserver(() => {
      resolveInk();
      if (audio.paused) drawStatic();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    new ResizeObserver(resize).observe(canvas);
    resize();

    audio.addEventListener('play', startDrawing);
    audio.addEventListener('pause', stopDrawing);
    audio.addEventListener('ended', stopDrawing);

    // PJAX 回来若音乐仍在播，直接恢复绘制
    if (!audio.paused) startDrawing();
    else drawStatic();
  }

  function initShareButtons() {
    if (window.Subai.getState('shareBound')) return;
    window.Subai.setState('shareBound', true);

    document.addEventListener('click', async function(event) {
      const button = event.target.closest('[data-copy-link]');
      if (!button) return;

      event.preventDefault();

      const text = button.getAttribute('data-copy-link') || '';
      if (!text) return;

      const copyFn = window.Subai.consume('copyToClipboard');
      const copied = copyFn ? await copyFn(text) : false;
      showCopyNotification(copied ? 'Link copied to clipboard!' : 'Failed to copy link');
    });
  }

  function showCopyNotification(message) {
    const existing = document.querySelector('.copy-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    window.setTimeout(() => {
      notification.classList.remove('show');
      window.setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 250);
    }, 1800);
  }

  window.Subai.register('initHomeCurrentTime', initHomeCurrentTime);
  window.Subai.register('initDailyQuote', initHomeDailyQuote);
  window.Subai.register('initMusicPlayer', initHomeMusicPlayer);
  window.Subai.register('initMusicTerrain', initMusicTerrain);
  window.Subai.register('initShareButtons', initShareButtons);
})();
