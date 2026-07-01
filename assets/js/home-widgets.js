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

    const timezone = timeElement.dataset.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone
    });

    const updateTime = () => {
      const now = new Date();
      timeElement.textContent = timeFormatter.format(now);
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

    const typeText = (text, callback) => {
      let index = 0;
      quoteRoot.classList.remove('is-deleting');
      quoteRoot.classList.add('is-typing');

      const step = () => {
        index += 1;
        quoteText.textContent = text.slice(0, index);

        if (index < text.length) {
          pushTimer(step, typeSpeed);
        } else {
          quoteRoot.classList.remove('is-typing');
          callback();
        }
      };

      quoteText.textContent = '';
      pushTimer(step, typeSpeed);
    };

    const deleteText = (callback) => {
      const currentText = quoteText.textContent || '';
      let index = currentText.length;

      if (!currentText) {
        callback();
        return;
      }

      quoteRoot.classList.remove('is-typing');
      quoteRoot.classList.add('is-deleting');

      const step = () => {
        index -= 1;
        quoteText.textContent = currentText.slice(0, Math.max(0, index));

        if (index > 0) {
          pushTimer(step, deleteSpeed);
        } else {
          quoteRoot.classList.remove('is-deleting');
          callback();
        }
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
  window.Subai.register('initShareButtons', initShareButtons);
})();
