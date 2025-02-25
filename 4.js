(function() {
    'use strict';

    var server_protocol = location.protocol === "https:" ? 'https://' : 'http://';
    var icon_server_redirect = '<svg width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3V13M12 13L16 9M12 13L8 9M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function startPlugin() {
        $('#REDIRECT').remove();

        var domainButton = '<div id="REDIRECT" class="head__action selector redirect-screen">' + icon_server_redirect + '</div>';
        $('.head__actions').append(domainButton);
        $('#REDIRECT').insertAfter('.open--settings');

        if (!Lampa.Storage.get('proxy_domain')) {
            setTimeout(function() {
                $('#REDIRECT').remove();
            }, 10);
        }

        $('#REDIRECT').on('hover:enter', function() {
            var selectedDomain = Lampa.Storage.get('proxy_domain', '');
            if (selectedDomain) {
                window.location.href = server_protocol + selectedDomain;
            } else {
                Lampa.Noty.show('⚠️ Please set a domain in settings first.');
            }
        });

        // ✅ Add settings section for domain input
        Lampa.SettingsApi.addComponent({
            component: 'proxy_redirect',
            name: '🌐 Proxy Server Settings',
            icon: icon_server_redirect
        });

        Lampa.SettingsApi.addParam({
            component: 'proxy_redirect',
            param: {
                name: 'proxy_domain',
                type: 'input',
                values: '',
                placeholder: 'e.g., proxy.yourdomain.com',
                default: ''
            },
            field: {
                name: 'Proxy Server URL',
                description: 'cubs.hoprop.xyz'
            },
            onChange: function(value) {
                if (!value) {
                    $('#REDIRECT').remove();
                } else {
                    startPlugin();
                }
            }
        });

        // ✅ Add setting for permanent redirect toggle
        Lampa.SettingsApi.addParam({
            component: 'proxy_redirect',
            param: {
                name: 'const_redirect',
                type: 'trigger',
                default: false
            },
            field: {
                name: 'Permanent Redirect',
                description: 'Enable this to always redirect on app start. Hold DOWN key to disable.'
            }
        });

        // ✅ Listen for DOWN key (to disable permanent redirect)
        Lampa.Keypad.listener.follow("keydown", function(e) {
            if (e.code === "ArrowDown" || e.code === 40) {
                Lampa.Storage.set('const_redirect', false);
                Lampa.Noty.show('🚫 Permanent redirect disabled.');
            }
        });

        // ✅ Automatic redirect if enabled
        setTimeout(function() {
            if (Lampa.Storage.field('const_redirect')) {
                var autoRedirectDomain = Lampa.Storage.get('proxy_domain', '');
                if (autoRedirectDomain) {
                    window.location.href = server_protocol + autoRedirectDomain;
                }
            }
        }, 300);
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') {
                startPlugin();
            }
        });
    }

})();
