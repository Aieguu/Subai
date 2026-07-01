/**
 * Subai Theme - Module Registry
 * Central namespace for cross-module communication.
 * Loaded first; all other scripts use Subai.register / Subai.consume.
 */
(function() {
  'use strict';

  window.Subai = {
    // Config values (populated from HTML template globals before this script runs)
    siteRoot: window.__SUBAI_SITE_ROOT__ || '/',
    playlist: window.__SUBAI_MUSIC_PLAYLIST || [],

    // Module exports (populated as scripts load)
    _exports: {},

    register: function(name, fn) {
      this._exports[name] = fn;
    },

    consume: function(name) {
      var fn = this._exports[name];
      return typeof fn === 'function' ? fn : null;
    },

    // Internal state
    _state: {},

    setState: function(key, value) {
      this._state[key] = value;
    },

    getState: function(key) {
      return this._state[key];
    },

    clearState: function(key) {
      var old = this._state[key];
      this._state[key] = null;
      return old;
    }
  };
})();
