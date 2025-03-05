(function () {
    "use strict";

    var custom_domains = ["cubs.hoprop.xyz", "cub.rip", "lampadev.ru", "cub.abmsx.tech"];
    var default_domain = "cub.red"; // Оригинальный (изначальный) домен
    var current_domain = localStorage.getItem("selected_domain") || custom_domains[0];

    function replaceDomain(url) {
        try {
            let parsedUrl = new URL(url);
            // Проверяем, есть ли текущий домен в списке известных доменов
            if ([default_domain, ...custom_domains].includes(parsedUrl.host)) {
                parsedUrl.host = current_domain; // Меняем домен на выбранный
            }
            return parsedUrl.toString();
        } catch (e) {
            return url; // Если URL некорректен, возвращаем как есть
        }
    }

    // Перехват запросов fetch()
    var originalFetch = window.fetch;
    window.fetch = function (input, options) {
        if (typeof input === "string") {
            input = replaceDomain(input);
        } else if (input instanceof Request) {
            let newUrl = replaceDomain(input.url);
            input = new Request(newUrl, input); // Создаем новый Request
        }
        return originalFetch.apply(this, arguments);
    };

    // Перехват XMLHttpRequest
    var originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (typeof url === "string") {
            arguments[1] = replaceDomain(url);
        }
        return originalXMLHttpRequestOpen.apply(this, arguments);
    };

    // Удаление прокси-опций в интерфейсе TMDb
    Lampa.Storage.listener.follow("open", function (e) {
        if (e.name === "tmdb") {
            e.body.find("[data-parent='proxy']").remove();
        }
    });

    // Создание меню выбора домена
    function domainSwitcherMenu() {
        var menu_items = $(
            '<li class="menu__item selector" data-action="switch_domain">' +
            '<div class="menu__ico">🌐</div>' +
            '<div class="menu__text">Выбор домена</div>' +
            '</li>'
        );

        menu_items.on("hover:enter", function () {
            Lampa.Select.show({
                title: "Выбор домена",
                items: custom_domains.map(domain => ({
                    title: domain,
                    domain: domain
                })),
                onSelect: function (selected) {
                    localStorage.setItem("selected_domain", selected.domain);
                    current_domain = selected.domain;
                    Lampa.Noty.show("Домен изменен на: " + selected.domain + "\nПерезагрузка...");
                    setTimeout(function () {
                        location.reload();
                    }, 1000);
                }
            });
        });

        $(".menu .menu__list").eq(1).append(menu_items);
    }

    function createDomainMenu() {
        if (window.plugin_domain_switcher_ready) return; // Предотвращаем дублирование
        window.plugin_domain_switcher_ready = true;

        if (window.appready) {
            domainSwitcherMenu();
        } else {
            Lampa.Listener.follow("app", function (e) {
                if (e.type == "ready") domainSwitcherMenu();
            });
        }
    }

    createDomainMenu();

    console.log("🚀 Lampa Plugin Loaded: `cub.red` теперь заменяется на:", current_domain);
})();
