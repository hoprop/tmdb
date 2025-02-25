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

    function createDomainSwitcher() {
        var menu = document.createElement("div");
        menu.style.position = "fixed";
        menu.style.top = "10px";
        menu.style.right = "10px";
        menu.style.background = "rgba(0, 0, 0, 0.8)";
        menu.style.color = "white";
        menu.style.padding = "10px";
        menu.style.borderRadius = "5px";
        menu.style.zIndex = "9999";

        var select = document.createElement("select");
        select.style.padding = "5px";
        select.style.fontSize = "14px";

        custom_domains.forEach(domain => {
            var option = document.createElement("option");
            option.value = domain;
            option.textContent = domain;
            if (domain === current_domain) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener("change", function () {
            localStorage.setItem("selected_domain", this.value);
            current_domain = this.value;
            alert("Домен изменен на: " + this.value + "\nПерезагрузите страницу для применения изменений.");
        });

        menu.appendChild(select);
        document.body.appendChild(menu);
    }

    document.addEventListener("DOMContentLoaded", createDomainSwitcher);

    console.log("🚀 Lampa Plugin Loaded: `cub.red` is now replaced with:", current_domain);
})();
