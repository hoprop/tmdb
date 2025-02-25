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
        if (Lampa.Settings) {
            Lampa.Settings.add({
                title: 'Выбор домена',
                component: 'cub_domain_switcher',
                type: 'select',
                value: current_domain,
                values: custom_domains.reduce((acc, domain) => {
                    acc[domain] = domain;
                    return acc;
                }, {}),
                onChange: function (value) {
                    localStorage.setItem("selected_domain", value);
                    current_domain = value;
                    Lampa.Noty.show("Домен изменен на: " + value + "\nПерезагрузите страницу для применения изменений.");
                }
            });
        } else {
            console.warn("Lampa.Settings не найден");
        }
    }

    Lampa.Listener.follow('settings', function (e) {
        if (e.type === 'open') {
            addDomainSwitcherToMenu();
        }
    });

    console.log("🚀 Lampa Plugin Loaded: `cub.red` is now replaced with:", current_domain);
})();
