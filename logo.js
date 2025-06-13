(function() {
    'use strict';
    
    // Add the setting to show/hide logos instead of movie titles
    Lampa.SettingsApi.addParam({
        component: "interface",
        param: {
            name: "logo_glav",
            type: "select",
            values: { 1: "Скрыть", 0: "Отображать" },
            default: "0"
        },
        field: {
            name: "Логотипы вместо названий",
            description: "Отображает логотипы фильмов вместо текста"
        }
    });

    // Initialize plugin if not already done
    if (!window.logoplugin) {
        window.logoplugin = true;

        Lampa.Listener.follow("full", function(a) {
            if (a.type === 'complite' && Lampa.Storage.get("logo_glav") !== "1") {
                var movie = a.data.movie;
                var mediaType, url;

                // Check if it's a TV show or a movie
                if (movie.name) {
                    // It's a TV show
                    mediaType = "tv";
                    url = Lampa.TMDB.api("tv/" + movie.id + "/images?api_key=" + Lampa.TMDB.key() + "&language=" + Lampa.Storage.get("language"));
                } else {
                    // It's a movie
                    mediaType = "movie";
                    url = Lampa.TMDB.api("movie/" + movie.id + "/images?api_key=" + Lampa.TMDB.key() + "&language=" + Lampa.Storage.get("language"));
                }

                // Log API URL for debugging
                console.log("Fetching logos from URL:", url);

                // Fetch images from TMDB API
                $.get(url, function(response) {
                    if (response.logos && response.logos[0]) {
                        var logoPath = response.logos[0].file_path;

                        if (logoPath !== "") {
                            var logoHtml = '<img style="margin-top: 10px; margin-bottom: 10px; max-height: 45px;" src="' + Lampa.TMDB.image("/t/p/w500" + logoPath.replace(".svg", ".png")) + '" />';

                            // Safely check if activity and render() exist
                            if (a.object && a.object.activity && typeof a.object.activity.render === 'function') {
                                a.object.activity.render().find(".full-start-new__title").html(logoHtml);
                            } else {
                                console.warn("Cannot find activity.render(), skipping logo insertion", a.object);
                            }
                        }
                    }
                });
            }
        });
    }
})();
