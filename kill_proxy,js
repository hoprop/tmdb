(function () {
  'use strict';

  function disableProxyCompletely() {
    // Force disable TMDB Proxy flag
    try {
      if (window.Storage) Storage.set('proxy_tmdb', false);
    } catch (e) {}

    // Hard override TMDB API + Image paths
    const forceTMDBDirect = () => {
      if (window.TMDB) {
        TMDB.api = function (url) {
          return 'https://api.themoviedb.org/3/' + url;
        };
        TMDB.image = function (url) {
          return 'https://image.tmdb.org/' + url;
        };
        console.log('[Plugin] Forced TMDB direct paths');
      }
    };

    // Prevent TMDBProxy.init from running
    if (window.TMDBProxy) {
      TMDBProxy.init = function () {
        console.log('[Plugin] TMDBProxy.init() blocked');
      };
    }

    // Kill VPN task that autoinstalls proxy
    if (window.VPN) {
      VPN.task = function (cb) {
        console.log('[Plugin] VPN.task() disabled');
        if (cb) cb();
      };
    }

    // Prevent CUB proxy rewrite
    Lampa.Listener.follow('request_before', function (e) {
      if (e.params.url.includes('api.themoviedb.org') || e.params.url.includes('image.tmdb.org')) {
        // Don’t rewrite TMDB URLs
        console.log('[Plugin] Skipping proxy for TMDB URL:', e.params.url);
      } else {
        const cubMirrors = Lampa.Manifest?.cub_mirrors || [];
        const isCub = cubMirrors.find(m => e.params.url.includes(m));
        if (isCub && !e.params.url.includes('/cub/')) {
          console.log('[Plugin] Removing proxy rewrite for:', e.params.url);
          // Do nothing to prevent proxy rewrite
        }
      }
    });

    // Patch UI settings menu to remove proxy toggle
    Lampa.Settings.listener.follow('open', function (e) {
      if (e.name === 'tmdb') {
        e.body.find('[data-parent="proxy"]').remove();
        console.log('[Plugin] Removed proxy UI option');
      }
    });

    // In case TMDB is initialized later, keep retrying
    let retry = 0;
    const interval = setInterval(() => {
      forceTMDBDirect();
      retry++;
      if (retry > 10) clearInterval(interval); // Stop after 10 tries
    }, 1000);

    console.log('[Plugin] Proxy disabling plugin initialized');
  }

  if (window.appready) disableProxyCompletely();
  else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') disableProxyCompletely();
    });
  }
})();
