(function () {
    "use strict";
           
            Lampa.Platform.tv();

    var sources = ["cub", "tmdb", "SURS", "SURS KIDS", "SURS RUS", "KP"]; // Доступные источники
    var sourceNames = { 
        "cub": "CUB", 
        "tmdb": "TMDB", 
        "KP": "KП",
        "SURS": "SURS",
        "SURS KIDS": "KIDS",
        "SURS RUS": "RU"
    };

    var currentSource = Lampa.Storage.get("source") || "cub"; // Получаем текущий источник

    function createSourceSwitcher() {
        var sourceDiv = $('<div>', {
            'class': 'head__action selector sources',
            'html': `<div class="source-logo" style="text-align: center; font-weight: bold;">${sourceNames[currentSource]}</div>`
        });

        // Добавляем кнопку переключения источников в верхнюю панель Lampa
        $(".head__actions").prepend(sourceDiv);

        // Обработчик нажатия на кнопку выбора источника
        sourceDiv.on("hover:enter", function () {
            Lampa.Select.show({
                title: "Выбор источника",
                items: sources.map(source => ({
                    title: sourceNames[source],
                    source: source
                })),
                onSelect: function (selected) {
                    currentSource = selected.source;
                    Lampa.Storage.set("source", currentSource);
                    sourceDiv.find(".source-logo").text(sourceNames[currentSource]);
                    Lampa.Noty.show("Источник изменен на: " + sourceNames[currentSource]);

                    Lampa.Activity.replace({
                        source: currentSource,
                        title: Lampa.Lang.translate("title_main") + " - " + sourceNames[currentSource]
                    });
                }
            });
        });
    }

    function initPlugin() {
        if (window.plugin_source_switcher_ready) return; // Предотвращаем дублирование
        window.plugin_source_switcher_ready = true;

        if (window.appready) {
            createSourceSwitcher();
        } else {
            Lampa.Listener.follow("app", function (e) {
                if (e.type === "ready") createSourceSwitcher();
            });
        }
    }

    initPlugin();
})();
