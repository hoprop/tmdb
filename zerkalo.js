(function () {
    "use strict";
       Lampa.Platform.tv();
  
    var custom_domains = ["cubs.hoprop.xyz", "cub.rip", "lampadev.ru", "cub.abmsx.tech"];
    var default_domain = "cub.red";
    var current_domain = localStorage.getItem("selected_domain") || custom_domains[0];

    function replaceDomain(url) {
        try {
            let parsedUrl = new URL(url);
            if ([default_domain, ...custom_domains].includes(parsedUrl.host)) {
                parsedUrl.host = current_domain;
            }
            return parsedUrl.toString();
        } catch (e) {
            return url;
        }
    }

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
            'html': `
                <div class="source-logo" style="display: flex; align-items: center; justify-content: center;">
                    <svg class="domain-icon" width="32" height="32" viewBox="0 0 1.2 1.2" fill="fff" xmlns="http://www.w3.org/2000/svg">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M0.6 0.144a0.456 0.456 0 1 0 0 0.912 0.456 0.456 0 0 0 0 -0.912M0.072 0.6a0.528 0.528 0 1 1 1.056 0 0.528 0.528 0 0 1 -1.056 0" fill="currentColor"/>
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M1.08 0.632h-0.96v-0.064h0.96z" fill="currentColor"/>
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M0.568 1.08v-0.96h0.064v0.96zm0.262 -0.48c0 -0.174 -0.062 -0.346 -0.185 -0.459l0.038 -0.041c0.136 0.126 0.203 0.314 0.203 0.501s-0.067 0.374 -0.203 0.501l-0.038 -0.041c0.123 -0.114 0.185 -0.286 0.185 -0.459M0.32 0.6c0 -0.186 0.065 -0.374 0.197 -0.5l0.039 0.04C0.437 0.254 0.376 0.426 0.376 0.6s0.061 0.346 0.179 0.46l-0.039 0.04C0.385 0.974 0.32 0.786 0.32 0.6" fill="currentColor"/>
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M0.6 0.317c0.174 0 0.35 0.032 0.47 0.099a0.028 0.028 0 1 1 -0.027 0.049c-0.108 -0.06 -0.274 -0.092 -0.442 -0.092s-0.334 0.032 -0.442 0.092a0.028 0.028 0 1 1 -0.027 -0.049c0.12 -0.067 0.296 -0.099 0.47 -0.099m0 0.551c0.174 0 0.35 -0.032 0.47 -0.099a0.028 0.028 0 1 0 -0.027 -0.049c-0.108 0.06 -0.274 0.092 -0.442 0.092s-0.334 -0.032 -0.442 -0.092a0.028 0.028 0 1 0 -0.027 0.049c0.12 0.067 0.296 0.099 0.47 0.099" fill="currentColor"/>
                    </svg>
                </div>`
        });

        // Add adaptive styles + color change on hover
        const style = document.createElement("style");
        style.textContent = `
            .domain-icon {
                width: 40px;
                height: 40px;

            }

            @media (max-width: 768px) {
                .domain-icon {
                    width: 24px;
                    height: 24px;
                }
            }
            @media (max-width: 480px) {
                .domain-icon {
                    width: 20px;
                    height: 20px;
                }
            }
        `;
        document.head.appendChild(style);

        $(".head__actions").prepend(domainButton);

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

    console.log("🚀 Lampa Plugin Loaded: Кнопка смены домена добавлена. Текущий домен:", current_domain);
})();
