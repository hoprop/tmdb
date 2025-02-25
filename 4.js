(function () {
    'use strict';

    var custom_domains = ["cubs.hoprop.xyz", "cub.rip", "lampadev.ru"]; // 🔹 Replace with your domains
    var default_domain = "cub.red";
    var current_domain = localStorage.getItem("selected_domain") || custom_domains[0];

    function replaceDomain(url) {
        if (url.includes(default_domain)) {
            return url.replace(default_domain, current_domain);
        }
        return url;
    }

    // Override URL-related methods
    var originalFetch = window.fetch;
    window.fetch = function (url, options) {
        if (typeof url === "string") {
            url = replaceDomain(url);
        }
        return originalFetch.apply(this, arguments);
    };

    var originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (typeof url === "string") {
            arguments[1] = replaceDomain(url);
        }
        return originalXMLHttpRequestOpen.apply(this, arguments);
    };

    // Modify storage settings for domains
    Lampa.Storage.listener.follow('open', function (e) {
        if (e.name === 'tmdb') {
            e.body.find('[data-parent="proxy"]').remove();
        }
    });

    function addDomainSwitcherToMenu() {
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
                    Lampa.Noty.show("Домен изменен на: " + selected.domain + "\nПерезагрузите страницу для применения изменений.");
                }
            });
        });
        
        $(".menu .menu__list").eq(1).append(menu_items);
    }

    document.addEventListener("DOMContentLoaded", addDomainSwitcherToMenu);

    console.log("🚀 Lampa Plugin Loaded: `cub.red` is now replaced with:", current_domain);
})();
