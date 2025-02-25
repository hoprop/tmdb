(function () {
    'use strict';

    var domains = ["cubs.hoprop.xyz", "cub.rip", "lampadev.ru"]; //
    var default_domain = "cub.red";

    // Load saved domain or use the first one
    var selectedDomain = Lampa.Storage.get('selected_cub_domain', domains[0]);

    function replaceDomain(url) {
        if (url.includes(default_domain)) {
            return url.replace(default_domain, selectedDomain);
        }
        return url;
    }

    // Override fetch and XMLHttpRequest to replace domains dynamically
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

    // Add settings menu
    Lampa.Settings.add({
        title: '🔗 Choose Proxy Domain',
        component: 'cub_domain_selector',
        onBack: function () {
            Lampa.Settings.main();
        }
    });

    Lampa.Component.add('cub_domain_selector', {
        render: function () {
            var html = $('<div class="settings-folder"></div>');
            var list = $('<div class="settings-folder__list"></div>');

            domains.forEach(function (domain) {
                var item = $('<div class="settings-item selector"></div>').text(domain);

                if (domain === selectedDomain) {
                    item.addClass('active');
                }

                item.on('hover:enter', function () {
                    selectedDomain = domain;
                    Lampa.Storage.set('selected_cub_domain', domain);
                    Lampa.Settings.update();
                    Lampa.Noty.show(' Selected: ' + domain);
                });

                list.append(item);
            });

            html.append(list);
            return html;
        }
    });

    console.log(" Lampa Plugin Loaded: Domain selection enabled. Current: ", selectedDomain);

})();
