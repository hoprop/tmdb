(function () {
    'use strict';

    /***********************
     * МАНИФЕСТ
     ***********************/
    var manifest = {
        type: 'other',
        version: '1.0.0',
        author: 'JacRed Quality',
        name: 'JacRed Quality (Lists)',
        description: 'Показывает бейдж качества по JacRed на плитках (карточках). Отдельно от нативного качества Lampa.',
        component: 'jacred_quality_jr'
    };

    try {
        // некоторые версии Lampa ожидают, что plugins — массив
        if (Array.isArray(Lampa.Manifest.plugins)) {
            Lampa.Manifest.plugins.push(manifest);
        } else {
            Lampa.Manifest.plugins = [manifest];
        }
    } catch (_) {}

    /***********************
     * КОНФИГ / КЛЮЧИ
     ***********************/
    var ENABLE_STORAGE_KEY = 'jacred_plugin_quality_enabled';   // on/off плагина
    var CACHE_STORAGE_KEY  = 'jacred_plugin_quality_cache';     // кэш качества
    var DEFAULT_ENABLE     = 'on';

    /***********************
     * STYLE (бейдж + анимация)
     ***********************/
    (function addJacredQualityStyle(){
        if (document.getElementById('jacred-quality-style')) return;

        var css = ''
          + '.card__quality.jacq-anim{animation:jacqPop .18s ease-out both;}'
          + '@keyframes jacqPop{0%{opacity:0;transform:translateY(-4px) scale(.98);}100%{opacity:1;transform:translateY(0) scale(1);}}'
          + '@media (prefers-reduced-motion: reduce){.card__quality.jacq-anim{animation:none!important;}}';

        var el = document.createElement('style');
        el.id = 'jacred-quality-style';
        el.textContent = css;
        document.head.appendChild(el);
    })();

    /***********************
     * НАСТРОЙКИ В Lampa
     ***********************/
    function addSettings() {
        // Настройки через SettingsApi, если есть
        if (Lampa.SettingsApi && Lampa.SettingsApi.addComponent) {
            try {
                Lampa.SettingsApi.addComponent({
                    component: 'jacred_quality_jr',
                    name: 'JacRed Quality',
                    icon: '<svg height="200" width="200" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/></svg>'
                });

                // Включить / выключить плагин
                Lampa.SettingsApi.addParam({
                    component: 'jacred_quality_jr',
                    param: {
                        name: ENABLE_STORAGE_KEY,
                        type: 'trigger',
                        default: true
                    },
                    field: {
                        name: 'Включить JacRed Quality',
                        description: 'Показывать бейджи качества по JacRed на карточках'
                    },
                    onChange: function () {
                        var enabled = Lampa.Storage.get(ENABLE_STORAGE_KEY) ? 'on' : 'off';
                        Lampa.Storage.set(ENABLE_STORAGE_KEY, enabled);
                        if (Lampa.Noty) Lampa.Noty.show('JacRed Quality: ' + (enabled === 'on' ? 'включен' : 'выключен'));
                    }
                });

                // URL JacRed (если хочешь переопределить)
                Lampa.SettingsApi.addParam({
                    component: 'jacred_quality_jr',
                    param: {
                        name: 'jacred_url',
                        type: 'input',
                        values: 'jacred.xyz',
                        placeholder: 'jacred.xyz'
                    },
                    field: {
                        name: 'JacRed URL',
                        description: 'Например: jacred.xyz или свой домен'
                    },
                    onChange: function () {
                        var url = (Lampa.Storage.get('jacred_url') || '').trim();
                        if (url && Lampa.Noty) {
                            Lampa.Noty.show('JacRed URL: ' + url);
                        }
                    }
                });
            } catch (e) {
                console.error('JacRedQuality: SettingsApi error:', e);
            }
        } else if (Lampa.Settings && Lampa.Settings.add) {
            // fallback для старых версий
            try {
                Lampa.Settings.add({
                    group: 'jacred_quality_jr',
                    title: 'JacRed Quality',
                    subtitle: 'Бейдж качества по JacRed в списках',
                    icon: 'magic',
                    onRender: function (item) {
                        var enabled = Lampa.Storage.get(ENABLE_STORAGE_KEY, DEFAULT_ENABLE);
                        item.toggleClass('on', enabled === 'on');
                    },
                    onChange: function (item) {
                        var enabled = Lampa.Storage.get(ENABLE_STORAGE_KEY, DEFAULT_ENABLE);
                        var next = enabled === 'on' ? 'off' : 'on';
                        Lampa.Storage.set(ENABLE_STORAGE_KEY, next);
                        item.toggleClass('on', next === 'on');
                        if (Lampa.Noty) Lampa.Noty.show('JacRed Quality: ' + (next === 'on' ? 'включен' : 'выключен'));
                    }
                });
            } catch (e) {
                console.error('JacRedQuality: Settings error:', e);
            }
        }
    }

    /***********************
     * UNIVERSAL BADGE SETTER
     * (как в примере, только свой класс)
     ***********************/
    function setJacredBadge($el, value) {
        var $holder = $el.find('.card__quality');
        var text = (typeof value === 'undefined') ? '…' : (value === null ? '' : String(value));

        // Пустой текст не рисуем
        if (text === '') return;

        if ($holder.length) {
            // 1) Наш внутренний блок
            var $inner = $holder.find('.jacq-qtext');
            if ($inner.length) {
                if ($inner.text() !== text) $inner.text(text);
                return;
            }
            // 2) Родной ребёнок Lampa
            var $child = $holder.children().first();
            if ($child.length) {
                if ($child.text() !== text) $child.text(text);
                return;
            }
            // 3) В крайнем случае — прямо в holder
            if ($holder.text() !== text) $holder.text(text);
            return;
        }

        // Блока нет — создаём свой компактный
        $holder = $('<div>', {
            "class": "card__quality jacq-anim"
        }).append(
            $('<div>', {
                "class": "jacq-qtext",
                text: text
            })
        );

        $holder.css({
            zIndex: 999,
            fontSize: '75%'
        });

        $el.append($holder);

        // один раз анимация
        $holder.one('animationend', function () {
            $(this).removeClass('jacq-anim');
        });
    }

    /***********************
     * JACRED ЛОГИКА
     ***********************/
    function applyJacredQuality() {
        var enabled = Lampa.Storage.get(ENABLE_STORAGE_KEY, DEFAULT_ENABLE);
        if (enabled !== 'on') {
            // отключено — чистим кэш, но не трогаем DOM
            Lampa.Storage.set(CACHE_STORAGE_KEY, {});
            return;
        }

        var jacredUrl = Lampa.Storage.get('jacred_url', 'jacred.xyz');
        if (!jacredUrl) {
            if (Lampa.Noty) Lampa.Noty.show('JacRed URL не указан');
            return;
        }

        if (window.jacredQualityInitialized) return;
        window.jacredQualityInitialized = true;

        initJacredQualitySystem(jacredUrl);
    }

    function initJacredQualitySystem(jacredUrl) {
        var Q_CACHE_TIME = 72 * 60 * 60 * 1000; // 72h
        var JACRED_PROTOCOL = 'https://';
        var PROXY_LIST = [
            'http://api.allorigins.win/raw?url=',
            'http://cors.bwa.workers.dev/'
        ];
        var PROXY_TIMEOUT = 5000;

        // Полифилл AbortController (на всякий случай)
        if (typeof AbortController === 'undefined') {
            window.AbortController = function () {
                this.signal = {
                    aborted: false,
                    addEventListener: function (event, callback) {
                        if (event === 'abort') this._onabort = callback;
                    }
                };
                this.abort = function () {
                    this.signal.aborted = true;
                    if (typeof this.signal._onabort === 'function') {
                        this.signal._onabort();
                    }
                };
            };
        }

        /******** КЭШ ********/
        function getQualityCache(key) {
            var cache = Lampa.Storage.get(CACHE_STORAGE_KEY) || {};
            var item = cache[key];
            return item && (Date.now() - item.timestamp < Q_CACHE_TIME) ? item : null;
        }

        function saveQualityCache(key, data) {
            var cache = Lampa.Storage.get(CACHE_STORAGE_KEY) || {};

            Object.keys(cache).forEach(function (cacheKey) {
                if (Date.now() - cache[cacheKey].timestamp >= Q_CACHE_TIME) {
                    delete cache[cacheKey];
                }
            });

            cache[key] = {
                quality: data.quality || null,
                isCamrip: data.isCamrip || false,
                timestamp: Date.now()
            };

            Lampa.Storage.set(CACHE_STORAGE_KEY, cache);
        }

        /******** FETCH + ПРОКСИ ********/
        function fetchWithProxy(url, cardId, callback) {
            var currentProxyIndex = 0;
            var callbackCalled = false;
            var controller = new AbortController();
            var signal = controller.signal;

            function tryNextProxy() {
                if (currentProxyIndex >= PROXY_LIST.length) {
                    if (!callbackCalled) {
                        callbackCalled = true;
                        callback(new Error('Все прокси не сработали для ' + url));
                    }
                    return;
                }

                var proxyUrl = PROXY_LIST[currentProxyIndex] + encodeURIComponent(url);
                var timeoutId = setTimeout(function () {
                    controller.abort();
                    if (!callbackCalled) {
                        currentProxyIndex++;
                        tryNextProxy();
                    }
                }, PROXY_TIMEOUT);

                fetch(proxyUrl, { signal: signal })
                    .then(function (response) {
                        clearTimeout(timeoutId);
                        if (!response.ok) {
                            throw new Error('Ошибка прокси: ' + response.status);
                        }
                        return response.text();
                    })
                    .then(function (data) {
                        if (!callbackCalled) {
                            callbackCalled = true;
                            clearTimeout(timeoutId);
                            callback(null, data);
                        }
                    })
                    .catch(function () {
                        clearTimeout(timeoutId);
                        if (!callbackCalled) {
                            currentProxyIndex++;
                            tryNextProxy();
                        }
                    });
            }

            var directTimeoutId = setTimeout(function () {
                controller.abort();
                if (!callbackCalled) {
                    tryNextProxy();
                }
            }, PROXY_TIMEOUT);

            fetch(url, { signal: signal })
                .then(function (response) {
                    clearTimeout(directTimeoutId);
                    if (!response.ok) {
                        throw new Error('Ошибка прямого запроса: ' + response.status);
                    }
                    return response.text();
                })
                .then(function (data) {
                    if (!callbackCalled) {
                        callbackCalled = true;
                        clearTimeout(directTimeoutId);
                        callback(null, data);
                    }
                })
                .catch(function () {
                    clearTimeout(directTimeoutId);
                    if (!callbackCalled) {
                        tryNextProxy();
                    }
                });
        }

        /******** АНАЛИЗ КАЧЕСТВА ********/
        function analyzeTorrentQuality(torrent) {
            if (!torrent) return null;

            var rawQuality = torrent.quality != null ? torrent.quality : '';
            var title = torrent.title || '';
            var extra = torrent.release || torrent.source || '';
            var combined = (title + ' ' + rawQuality + ' ' + extra).toUpperCase();
            var camText = combined.replace(/HDRIP/gi, '');

            var isCamrip = /\b(CAMRIP|CAM|TS|TELESYNC|TELECINE|TC|SCREENER|SCR|HDTS)\b/.test(camText);
            if (isCamrip) {
                return { label: 'CAM', score: 50, isCamrip: true };
            }

            var meta = { label: null, score: -1, isCamrip: false };

            function assign(label, score) {
                if (score > meta.score) {
                    meta.label = label;
                    meta.score = score;
                }
            }

            var numericQuality = parseInt(String(rawQuality).replace(/[^0-9]/g, ''), 10);
            if (!isNaN(numericQuality)) {
                if (numericQuality >= 2160) assign('4K', 800);
                else if (numericQuality >= 1440) assign('FHD', 360);
                else if (numericQuality >= 1080) assign('FHD', 340);
                else if (numericQuality >= 720) assign('HD', 220);
                else if (numericQuality >= 480) assign('SD', 120);
            }

            if (/\b(2160P|4K|UHD|ULTRA\s*HD)\b/.test(combined)) assign('4K', 800);
            if (/\b(1440P|2K)\b/.test(combined)) assign('FHD', 360);
            if (/\b(1080P|FHD|FULL\s*HD|BLU[-\s]?RAY|BDRIP|BDREMUX|REMUX|BRRIP)\b/.test(combined)) assign('FHD', 340);
            if (/\b(900P)\b/.test(combined)) assign('HD', 230);
            if (/\b(720P|HDTV|HDRIP|WEB[-\s]?DL|WEB[-\s]?RIP|WEBDL|WEBRIP)\b/.test(combined)) assign('HD', 220);
            if (/\b(540P)\b/.test(combined)) assign('SD', 140);
            if (/\b(480P|SD|DVDRIP|DVD|TVRIP|VHS)\b/.test(combined)) assign('SD', 120);

            if (typeof rawQuality === 'string') {
                var qUpper = rawQuality.toUpperCase();
                if (!meta.label && /\b(BDRIP|BLURAY|BDREMUX|REMUX)\b/.test(qUpper)) assign('FHD', 320);
                if (!meta.label && /\b(WEBDL|WEB[-\s]?DL|WEB[-\s]?RIP|HDRIP|HDTV)\b/.test(qUpper)) assign('HD', 210);
                if (!meta.label && /\b(DVDRIP|DVD|TVRIP)\b/.test(qUpper)) assign('SD', 110);
            }

            if (!meta.label) return null;
            return meta;
        }

        /******** ЗАПРОС К JacRed ********/
        function getBestReleaseFromJacred(normalizedCard, cardId, callback) {
            if (!jacredUrl) {
                callback(null);
                return;
            }

            var year = '';
            var dateStr = normalizedCard.release_date || '';
            if (dateStr.length >= 4) {
                year = dateStr.substring(0, 4);
            }

            function searchJacredApi(searchTitle, searchYear, exactMatch, strategyName, apiCallback) {
                var apiUrl = JACRED_PROTOCOL + jacredUrl + '/api/v1.0/torrents?search=' +
                    encodeURIComponent(searchTitle) +
                    (searchYear ? '&year=' + searchYear : '') +
                    (exactMatch ? '&exact=true' : '');

                fetchWithProxy(apiUrl, cardId, function (error, responseText) {
                    if (error || !responseText) {
                        apiCallback(null);
                        return;
                    }
                    try {
                        var torrents = JSON.parse(responseText);
                        if (!Array.isArray(torrents) || torrents.length === 0) {
                            apiCallback(null);
                            return;
                        }

                        var bestRelease = null;
                        var bestCamRelease = null;

                        for (var i = 0; i < torrents.length; i++) {
                            var torrent = torrents[i];
                            var qualityMeta = analyzeTorrentQuality(torrent);
                            if (!qualityMeta || !qualityMeta.label) continue;

                            if (qualityMeta.isCamrip) {
                                if (!bestCamRelease || qualityMeta.score > bestCamRelease.meta.score) {
                                    bestCamRelease = { torrent: torrent, meta: qualityMeta };
                                }
                            } else {
                                if (!bestRelease || qualityMeta.score > bestRelease.meta.score) {
                                    bestRelease = { torrent: torrent, meta: qualityMeta };
                                }
                            }
                        }

                        var chosen = bestRelease || bestCamRelease;
                        if (chosen) {
                            apiCallback({
                                quality: chosen.meta.label,
                                title: chosen.torrent.title,
                                isCamrip: chosen.meta.isCamrip
                            });
                        } else {
                            apiCallback(null);
                        }
                    } catch (e) {
                        console.error('JacRedQuality: ошибка при получении качества из JacRed:', e);
                        apiCallback(null);
                    }
                });
            }

            var searchStrategies = [];

            if (normalizedCard.original_title && /[a-zа-яё0-9]/i.test(normalizedCard.original_title)) {
                searchStrategies.push({
                    title: normalizedCard.original_title.trim(),
                    year: year,
                    exact: true,
                    name: 'OriginalTitle Exact Year'
                });
            }

            if (normalizedCard.title && /[a-zа-яё0-9]/i.test(normalizedCard.title)) {
                searchStrategies.push({
                    title: normalizedCard.title.trim(),
                    year: year,
                    exact: true,
                    name: 'Title Exact Year'
                });
            }

            if (normalizedCard.type === 'tv' && (!year || isNaN(year))) {
                if (normalizedCard.original_title && /[a-zа-яё0-9]/i.test(normalizedCard.original_title)) {
                    searchStrategies.push({
                        title: normalizedCard.original_title.trim(),
                        year: '',
                        exact: false,
                        name: 'OriginalTitle No Year'
                    });
                }
                if (normalizedCard.title && /[a-zа-яё0-9]/i.test(normalizedCard.title)) {
                    searchStrategies.push({
                        title: normalizedCard.title.trim(),
                        year: '',
                        exact: false,
                        name: 'Title No Year'
                    });
                }
            }

            function executeNextStrategy(index) {
                if (index >= searchStrategies.length) {
                    callback(null);
                    return;
                }
                var strategy = searchStrategies[index];
                searchJacredApi(strategy.title, strategy.year, strategy.exact, strategy.name, function (result) {
                    if (result !== null) {
                        callback(result);
                    } else {
                        executeNextStrategy(index + 1);
                    }
                });
            }

            if (searchStrategies.length > 0) {
                executeNextStrategy(0);
            } else {
                callback(null);
            }
        }

        /******** ВСПОМОГАТЕЛЬНОЕ ДЛЯ КАРТОЧЕК ********/
        function getCardType(card) {
            var type = card.media_type || card.type;
            if (type === 'movie' || type === 'tv') return type;
            return card.name || card.original_name ? 'tv' : 'movie';
        }

        function getCardDataFromElement(cardElement) {
            try {
                var el = cardElement;
                var cardId = el.getAttribute('data-id') ||
                    el.getAttribute('id');

                if (!cardId) {
                    var parent = el.parentElement;
                    while (parent && !cardId) {
                        cardId = parent.getAttribute('data-id') ||
                            parent.getAttribute('data-movie-id') ||
                            parent.getAttribute('data-tmdb-id') ||
                            parent.getAttribute('data-tv-id');
                        parent = parent.parentElement;
                    }
                }

                if (!cardId) {
                    var href = el.getAttribute('href') || '';
                    var idMatch = href.match(/\/(\d+)/);
                    if (idMatch) cardId = idMatch[1];
                }

                if (!cardId) return null;

                var titleElement = el.querySelector('.card__title, .card-title, .title, .card__name, .name');
                var title = titleElement ? titleElement.textContent.trim() : '';
                if (!title) {
                    title = el.getAttribute('data-title') ||
                        el.getAttribute('data-name') || '';
                }

                var originalTitleElement = el.querySelector('.card__original-title, .original-title, .card__original-name, .original-name');
                var originalTitle = originalTitleElement ? originalTitleElement.textContent.trim() : '';
                if (!originalTitle) {
                    originalTitle = el.getAttribute('data-original-title') ||
                        el.getAttribute('data-original-name') || '';
                }

                var isTv = el.classList.contains('card--tv') ||
                    el.classList.contains('tv') ||
                    el.querySelector('.card__type') ||
                    el.querySelector('[data-type="tv"]') ||
                    el.getAttribute('data-type') === 'tv';

                var year = el.getAttribute('data-year') ||
                    el.getAttribute('data-release-year') ||
                    el.getAttribute('data-first-air-date') ||
                    el.getAttribute('data-release-date') || '';

                if (!year) {
                    var yearElement = el.querySelector('.card__year, .year, .card__date, .date');
                    if (yearElement) {
                        var yearText = yearElement.textContent.trim();
                        var yearMatch = yearText.match(/(\d{4})/);
                        if (yearMatch) year = yearMatch[1];
                    }
                }

                if (!cardId || (!title && !originalTitle)) return null;

                return {
                    id: cardId,
                    title: title,
                    original_title: originalTitle,
                    type: isTv ? 'tv' : 'movie',
                    release_date: year
                };
            } catch (e) {
                console.error('JacRedQuality: ошибка парсинга карточки:', e);
                return null;
            }
        }

        /******** РИСУЕМ БЕЙДЖ НА МИНИ-КАРТОЧКЕ ********/
        function addQualityToMiniCard(cardElement, cardData) {
            if (!cardData || !cardData.title) return;

            var enabled = Lampa.Storage.get(ENABLE_STORAGE_KEY, DEFAULT_ENABLE);
            if (enabled !== 'on') return;

            var $root = $(cardElement instanceof HTMLElement ? cardElement : cardElement);
            var $slot = $root.find('.card__view, .card__image, .card__img, .card__poster, .card__content, .card').first();
            if (!$slot.length) $slot = $root;

            var qCacheKey = cardData.type + '_' + cardData.id;
            var cache = getQualityCache(qCacheKey);

            function applyQuality(quality, isCamrip) {
                if (!$slot || !$slot.length) return;
                var text = quality || '';
                if (!text) return;

                setJacredBadge($slot, text);

                var $holder = $slot.find('.card__quality').first();
                if (!$holder.length) return;

                if (isCamrip) {
                    $holder.addClass('jacq-cam');
                } else {
                    $holder.removeClass('jacq-cam');
                }
            }

            if (cache && cache.quality) {
                applyQuality(cache.quality, cache.isCamrip);
            } else {
                // плейсхолдер "…" на время запроса
                setJacredBadge($slot, undefined);

                getBestReleaseFromJacred(cardData, cardData.id, function (res) {
                    if (!$slot || !$slot.length) return;

                    if (res && res.quality && res.quality !== 'undefined' && res.quality !== '' && res.quality !== 'null') {
                        applyQuality(res.quality, res.isCamrip);
                        saveQualityCache(qCacheKey, {
                            quality: res.quality,
                            isCamrip: res.isCamrip
                        });
                    } else {
                        // удаляем только наш jacq-блок, оставляя нативный, если он есть
                        var $holders = $slot.find('.card__quality');
                        $holders.each(function () {
                            var $h = $(this);
                            if ($h.find('.jacq-qtext').length) $h.remove();
                        });
                    }
                });
            }
        }

        /******** ОБРАБОТКА ВСЕХ КАРТОЧЕК ********/
        function processAllCards() {
            var cards = document.querySelectorAll('.card:not([data-jacred-quality-processed])');
            var batchSize = 5;
            var currentIndex = 0;

            function processBatch() {
                var endIndex = Math.min(currentIndex + batchSize, cards.length);
                for (var i = currentIndex; i < endIndex; i++) {
                    var card = cards[i];
                    var data = getCardDataFromElement(card);
                    if (data) {
                        addQualityToMiniCard(card, data);
                        card.setAttribute('data-jacred-quality-processed', 'true');
                    }
                }
                currentIndex = endIndex;
                if (currentIndex < cards.length) {
                    setTimeout(processBatch, 10);
                }
            }

            if (cards.length > 0) {
                processBatch();
            }
        }

        var observer = new MutationObserver(function (mutations) {
            var hasNewCards = false;
            for (var i = 0; i < mutations.length; i++) {
                var mutation = mutations[i];
                if (mutation.type === 'childList') {
                    var addedNodes = mutation.addedNodes;
                    for (var j = 0; j < addedNodes.length; j++) {
                        var node = addedNodes[j];
                        if (node.nodeType === 1) {
                            if (node.classList && node.classList.contains('card')) {
                                hasNewCards = true;
                            } else if (node.querySelector && node.querySelector('.card')) {
                                hasNewCards = true;
                            }
                        }
                    }
                }
            }
            if (hasNewCards) {
                setTimeout(processAllCards, 100);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // первый проход
        setTimeout(processAllCards, 100);
    }

    /***********************
     * ИНИЦИАЛИЗАЦИЯ
     ***********************/
    function add() {
        addSettings();
        applyJacredQuality();
    }

    function start() {
        if (window.jacred_quality_ready) return;
        window.jacred_quality_ready = true;

        if (window.appready) add();
        else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') add();
            });
        }
    }

    start();

})();
