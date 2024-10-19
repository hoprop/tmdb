(function () {
    'use strict';

    var enableProxy = true;

    var tmdb = {
        name: 'TMDB My Proxy',
        version: '1.0.1',
        description: 'ÐŸÑ€Ð¾ÐºÑÐ¸Ñ€Ð¾Ð²Ð°Ð½Ð¸Ðµ Ð¿Ð¾ÑÑ‚ÐµÑ€Ð¾Ð² Ð¸ API ÑÐ°Ð¹Ñ‚Ð° TMDB',
        path_image: Lampa.Utils.protocol() + 'tmdbimg.rootu.top/',
        path_api: Lampa.Utils.protocol() + 'tmdbapi.rootu.top/3/'
    };

    if (enableProxy) {

        Lampa.TMDB.image = function (url) {
            var base = Lampa.Utils.protocol() + 'image.tmdb.org/' + url;
            return Lampa.Storage.field('proxy_tmdb') ? tmdb.path_image + url : base;
        };

        Lampa.TMDB.api = function (url) {
            var base = Lampa.Utils.protocol() + 'api.themoviedb.org/3/' + url;
            return Lampa.Storage.field('proxy_tmdb') ? tmdb.path_api + url : base;
        };

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'tmdb') {
                e.body.find('[data-parent="proxy"]').remove();
            }
        });
    } else {
        var pluginsUpdate = false;
        var addCubProxy = true;
        var plugins = Lampa.Storage.get('plugins', '[]');

        for (var i=0; i < plugins.length; i++) {
            if (plugins[i].url.indexOf('://cub.red/plugin/tmdb-proxy') > 0) {
                addCubProxy = false;
                plugins[i].status = 1;
            }
            if (plugins[i].url.indexOf('.rootu.top/tmdb.js') > 0) {
                // Delete proxy plugins
                plugins.splice(i--, 1);
                pluginsUpdate = true;
            }
        }

        if (pluginsUpdate) {
            if (addCubProxy) {
                // Add cub tmdb proxy plugin
                plugins.unshift({
                    'url': Lampa.Utils.protocol() + 'cub.red/plugin/tmdb-proxy',
                    'status': 1,
                    'name': 'TMDB Proxy',
                    'author': '@lampa'
                });
            }
            // Save plugin
            Lampa.Storage.set('plugins', plugins);
        }
    }
})();
