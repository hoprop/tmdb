(function () {
    'use strict';

    var enableProxy = true;

    var tmdb = {
        name: 'TMDB My Proxy',
        version: '1.0.1',
        description: 'Проксирование постеров и API сайта TMDB',
        path_image: 'https://img.hoprop.xyz/',
        path_api: 'https://tmdb.hoprop.xyz/3/'
    };

    if (enableProxy) {
        Lampa.TMDB.image = function (url) {
            var base = 'https://image.tmdb.org/t/p/' + url;
            return Lampa.Storage.field('proxy_tmdb') ? tmdb.path_image + 't/p/' + url : base;
        };

        Lampa.TMDB.api = function (url) {
            var base = 'https://api.themoviedb.org/3/' + url;
            return Lampa.Storage.field('proxy_tmdb') ? tmdb.path_api.replace(/\/3\/$/, '/') + url : base;
        };

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'tmdb') {
                e.body.find('[data-parent="proxy"]').remove();
            }
        });
    } else {
        var plugins = Lampa.Storage.get('plugins', '[]');
        var pluginsUpdate = false;
        var addCubProxy = !plugins.some(p => p.url.includes('cub.red/plugin/tmdb-proxy'));

        plugins = plugins.filter(p => !p.url.includes('.hoprop.xyz/tmdb.js')); // Remove old proxy

        if (addCubProxy) {
            plugins.unshift({
                url: 'https://cub.red/plugin/tmdb-proxy',
                status: 1,
                name: 'TMDB Proxy',
                author: '@lampa'
            });
            pluginsUpdate = true;
        }

        if (pluginsUpdate) {
            Lampa.Storage.set('plugins', plugins);
        }
    }
})();
