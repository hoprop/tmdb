(function () {
    'use strict';

    var tmdb_proxy = {
      name: 'TMDB Proxy',
      version: '1.0.4',
      description: 'Proxying TMDB Posters and API',
      path_image: 'https://img.hoprop.xyz/',  //  Image Proxy
      path_api: 'https://tmdb.hoprop.xyz/'  //  API Proxy
    };

    function filter(u) {
      var s = u.slice(0, 8);
      var e = u.slice(8).replace(/\/+/g, '/');
      return s + e;
    }

    function email() {
      return Lampa.Storage.get('account', '{}').email || '';
    }

    Lampa.TMDB.image = function (url) {
      var base = 'https://image.tmdb.org/' + url;
      return Lampa.Utils.addUrlComponent(filter(Lampa.Storage.field('proxy_tmdb') ? tmdb_proxy.path_image + url : base), 'email=' + encodeURIComponent(email()));
    };

    Lampa.TMDB.api = function (url) {
      var base = 'https://api.themoviedb.org/3/' + url;
      var proxyUrl = tmdb_proxy.path_api + url;

      // Fix for missing genres
      if (url.includes('/genre/movie/list')) {
        console.log(" Fetching Genre List:", proxyUrl);
      }

      // Fix for search
      if (url.includes('/search/movie') || url.includes('/search/tv')) {
        console.log(" Search Request:", proxyUrl);
      }

      return Lampa.Utils.addUrlComponent(filter(Lampa.Storage.field('proxy_tmdb') ? proxyUrl : base), 'email=' + encodeURIComponent(email()));
    };

    Lampa.Settings.listener.follow('open', function (e) {
      if (e.name == 'tmdb') {
        e.body.find('[data-parent="proxy"]').remove();
      }
    });

    console.log('TMDB-Proxy', 'started, enabled:', Lampa.Storage.field('proxy_tmdb'));

})();
