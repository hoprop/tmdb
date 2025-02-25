(function () {
    'use strict';

    var custom_domains = ["cubs.hoprop.xyz", ]; // 🔹 Replace with your domains
    var default_domain = "cub.red";

    function replaceDomain(url) {
        for (let domain of custom_domains) {
            if (url.includes(default_domain)) {
                return url.replace(default_domain, domain);
            }
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

    console.log("🚀 Lampa Plugin Loaded: `cub.red` is now replaced with:", custom_domains);

})();
