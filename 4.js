   (function () {
    'use strict';

    var domains = [""cubs.hoprop.xyz", "cub.rip", "lampadev.ru""]; // 🔹 Replace with your custom domains
    var default_domain = "cub.red";

    // Load saved domain or use the first one in the list
    var selectedDomain = Lampa.Storage.get('selected_cub_domain', domains[0]);

    function replaceDomain(url) {
        if (url.includes(default_domain)) {
            return url.replace(default_domain, selectedDomain);
        }
        return url;
    }

    // Override fetch() to replace `cub.red` dynamically
    var originalFetch = window.fetch;
    window.fetch = function (url, options) {
        if (typeof url === "string") {
            url = replaceDomain(url);
        }
        return originalFetch.apply(this, arguments);
    };

    // Override XMLHttpRequest to replace `cub.red`
    var originalXMLHttpRequestOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
        if (typeof url === "string") {
            arguments[1] = replaceDomain(url);
        }
        return originalXMLHttpRequestOpen.apply(this, arguments);
    };

    // Add settings menu item
    Lampa.Settings.add({
        title: '🔗 Choose Proxy Domain',
        group: 'cub_proxy',
        component: 'cub_domain_selector',
        onBack: function () {
            Lampa.Settings.main();
        }
    });

    // Create the settings component
    Lampa.Component.add('cub_domain_selector', function () {
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
                Lampa.Noty.show('✅ Selected: ' + domain);
                Lampa.Settings.update();
            });

            list.append(item);
        });

        html.append(list);
        return html;
    });

    console.log("🚀 Lampa Plugin Loaded: Domain selection enabled. Current domain:", selectedDomain);

})();
