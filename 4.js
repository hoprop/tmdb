(function () {
    "use strict";

    var custom_domains = ["cubs.hoprop.xyz", "cub.rip", "lampadev.ru", "cub.abmsx.tech"];
    var default_domain = "cub.red";
    var current_domain = localStorage.getItem("selected_domain") || custom_domains[0];

    function replaceDomain(url) {
        try {
            let parsedUrl = new URL(url);
            if ([default_domain, ...custom_domains].includes(parsedUrl.host)) {
                parsedUrl.host = current_domain; // Меняем домен на выбранный
            }
            return parsedUrl.toString();
        } catch (e) {
            return url;
        }
    }

    // Перехват запросов fetch()
    var originalFetch = window.fetch;
    window.fetch = function (input, options) {
        if (typeof input === "string") {
            input = replaceDomain(input);
        } else if (input instanceof Request) {
            let newUrl = replaceDomain(input.url);
            input = new Request(newUrl, input); 
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

    Lampa.Storage.listener.follow("open", function (e) {
        if (e.name === "tmdb") {
            e.body.find("[data-parent='proxy']").remove();
        }
    });

    function createDomainSwitcherButton() {
        var domainButton = $('<div>', {
            'class': 'head__action selector domain-switcher',
            'html': '<div class="source-logo" style="text-align: center; font-weight: bold;">🌐 ' + current_domain + '</div>'
        });

        // Добавляем кнопку в верхнюю панель
        $(".head__actions").prepend(domainButton);

        // Обработчик нажатия на кнопку смены домена
        domainButton.on("hover:enter", function () {
            Lampa.Select.show({
                title: "Выбор домена",
                items: custom_domains.map(domain => ({
                    title: domain,
                    domain: domain
                })),
                onSelect: function (selected) {
                    localStorage.setItem("selected_domain", selected.domain);
                    current_domain = selected.domain;
                    domainButton.find(".source-logo").text("🌐 " + selected.domain);
                    Lampa.Noty.show("Домен изменен на: " + selected.domain + "\nПерезагрузка...");
                    setTimeout(function () {
                        location.reload();
                    }, 1000);
                }
            });
        });
    }

    function initPlugin() {
        if (window.plugin_domain_switcher_ready) return;
        window.plugin_domain_switcher_ready = true;

        if (window.appready) {
            createDomainSwitcherButton();
        } else {
            Lampa.Listener.follow("app", function (e) {
                if (e.type === "ready") createDomainSwitcherButton();
            });
        }
    }

    initPlugin();

    console.log("🚀 Lampa Plugin Loaded: Кнопка смены домена добавлена в верхнюю панель. Текущий домен:", current_domain);
})();
