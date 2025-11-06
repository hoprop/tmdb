(function () { 
    'use strict';

    // -----------------------------
    // НАСТРОЙКИ ПЛАГИНА
    // -----------------------------
    var ENABLE_STORAGE_KEY = 'jacred_plugin_quality_enabled'; // on/off плагина (через триггер)
    var CACHE_STORAGE_KEY  = 'jacred_plugin_quality_cache';   // кэш качества
    var DEFAULT_ENABLE     = 'on';

    // Универсальный чекер "включен ли плагин"
    function isJacredEnabled() {
        try {
            var v = Lampa.Storage.get(ENABLE_STORAGE_KEY, DEFAULT_ENABLE);

            if (v === 'on')  return true;
            if (v === 'off') return false;

            if (typeof v === 'boolean') return v;

            if (v === 'true'  || v === '1')  return true;
            if (v === 'false' || v === '0')  return false;
        } catch (e) {}

        return DEFAULT_ENABLE === 'on';
    }

    // -----------------------------
    // МИНИМАЛЬНЫЙ СТИЛЬ ДЛЯ БЕЙДЖЕЙ + setJacredBadge
    // -----------------------------
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

    // Установка бейджа качества в карточку (аналог setBadge из примера)
    function setJacredBadge($el, value){
        var $holder = $el.find('.card__quality');
        var text = (typeof value === 'undefined') ? '…' : (value === null ? '' : String(value));

        // пустую строку не рисуем
        if (text === '') return;

        if ($holder.length){
            // 1) Наш внутренний текстовый блок
            var $inner = $holder.find('.jacq-qtext');
            if ($inner.length){
                if ($inner.text() !== text) $inner.text(text);
                return;
            }
            // 2) Если есть родной ребёнок — пишем туда
            var $child = $holder.children().first();
            if ($child.length){
                if ($child.text() !== text) $child.text(text);
                return;
            }
            // 3) В крайнем случае — прямо в holder
            if ($holder.text() !== text) $holder.text(text);
            return;
        }

        // Блока качества нет — создаём свой компактный
        $holder = $('<div>', {
            "class": "card__quality jacq-anim"
        }).append(
            $('<div>', {
                "class": "jacq-qtext",
                text: text
            })
        );

        $el.append($holder);

        // один раз анимация появления
        $holder.one('animationend', function () {
            $(this).removeClass('jacq-anim');
        });
    }

    // -----------------------------
    // НАЧАЛО ИНИЦИАЛИЗАЦИИ
    // -----------------------------
    function startPlugin() {
        try {
            addSettingsItem();
            applyJacredQuality();
        } catch (e) {
            console.error('JacRedQuality plugin start error:', e);
        }
    }

    // Основная точка входа
    function applyJacredQuality() {
        if (!isJacredEnabled()) {
            // если отключено – просто чистим кэш
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

    // -----------------------------
    // СИСТЕМА КАЧЕСТВА
    // -----------------------------
    function initJacredQualitySystem(jacredUrl) {
        // общий TTL – 72 часа
        var Q_CACHE_TIME    = 72 * 60 * 60 * 1000;
        // для TS / CAM / CAMRip – 24 часа (раз в сутки)
        var Q_TS_CACHE_TIME = 24 * 60 * 60 * 1000;

        var JACRED_PROTOCOL = 'https://';
        var PROXY_LIST = [
            'http://api.allorigins.win/raw?url=',
            'http://cors.bwa.workers.dev/'
        ];
        var PROXY_TIMEOUT = 5000;

        // нормализация id -> "123456" и общий ключ кэша
        function makeCacheKey(type, id, imdbId) {
            var raw = id || imdbId || '';
            var m = String(raw).match(/(\d+)/);
            var clean = m ? m[1] : String(raw);
            return String(type || 'movie') + '_' + clean;
        }

        // Полифилл AbortController (если нет)
        if (typeof AbortController === 'undefined') {
            window.AbortController = function () {
                this.signal = {
                    aborted: false,
                    addEventListener: function (event, callback) {
                        if (event === 'abort') {
                            this._onabort = callback;
                        }
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

        // >>> ранги качества, чтобы не понижать значение в кэше
        function getQualityRank(q) {
            if (!q) return -1;
            var u = String(q).toUpperCase().trim();

            if (u === 'FHD' || u === 'FULL HD') u = '1080P';
            if (u === 'ULTRAHD' || u === 'ULTRA HD') u = '4K';

            var map = {
                'CAMRIP': 0,
                'CAM': 0,
                'TS': 1,
                'SD': 2,
                '480P': 2,
                'HD': 3,
                '720P': 3,
                '900P': 3,
                '1080P': 4,
                '2K': 5,
                '1440P': 5,
                '4K': 6,
                '2160P': 6
            };

            return (map[u] !== undefined) ? map[u] : -1;
        }

        // Обновить все мини-карточки с данным ключом кэша
        function refreshCardsForKey(key, quality, isCamrip) {
            try {
                if (!key || !quality) return;

                var nodes = document.querySelectorAll('[data-jacred-q-key="' + key + '"]');
                if (!nodes.length) return;

                nodes.forEach(function (node) {
                    var $root = $(node);
                    var $slot = $root.find('.card__view, .card__image, .card__img, .card__poster, .card__content, .card').first();
                    if (!$slot.length) $slot = $root;

                    setJacredBadge($slot, quality);

                    var $holder = $slot.find('.card__quality').first();
                    if ($holder.length) {
                        if (isCamrip) $holder.addClass('jacq-cam');
                        else $holder.removeClass('jacq-cam');
                    }
                });
            } catch (e) {
                console.error('JacRedQuality: refreshCardsForKey error:', e);
            }
        }

        // ---------- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ КЭША ----------

        function getQualityCache(key) {
            var cache = Lampa.Storage.get(CACHE_STORAGE_KEY) || {};
            var item  = cache[key];
            if (!item) return null;

            var age = Date.now() - item.timestamp;

            // по умолчанию TTL = 72 часа
            var ttl = Q_CACHE_TIME;

            var q = String(item.quality || '').toUpperCase();

            // для TS / CAM / CAMRIP — обновление раз в сутки
            if (/\bTS\b/.test(q) || /\bCAM\b/.test(q) || /\bCAMRIP\b/.test(q)) {
                ttl = Q_TS_CACHE_TIME;
            }

            return age < ttl ? item : null;
        }

        function saveQualityCache(key, data) {
            var cache = Lampa.Storage.get(CACHE_STORAGE_KEY) || {};

            // удаляем протухшие
            Object.keys(cache).forEach(function (cacheKey) {
                if (Date.now() - cache[cacheKey].timestamp >= Q_CACHE_TIME) {
                    delete cache[cacheKey];
                }
            });

            var newQuality  = data.quality || null;
            var newIsCamrip = data.isCamrip || false;

            var existing = cache[key];
            if (existing && existing.quality) {
                var oldRank = getQualityRank(existing.quality);
                var newRank = getQualityRank(newQuality);

                // если новое качество не лучше — просто обновляем timestamp и выходим
                if (newRank <= oldRank) {
                    existing.timestamp = Date.now();
                    cache[key] = existing;
                    Lampa.Storage.set(CACHE_STORAGE_KEY, cache);
                    return;
                }
            }

            cache[key] = {
                quality: newQuality,
                isCamrip: newIsCamrip,
                timestamp: Date.now()
            };

            Lampa.Storage.set(CACHE_STORAGE_KEY, cache);

            // сразу обновляем все карточки с этим ключом
            refreshCardsForKey(key, newQuality, newIsCamrip);
        }

        // ---------- HTTP: прямой запрос + прокси ----------

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

        // ---------- Анализ качества одного торрента ----------

        function analyzeTorrentQuality(torrent) {
            if (!torrent) return null;

            var rawQuality = torrent.quality != null ? torrent.quality : '';
            var title = torrent.title || '';
            var extra = torrent.release || torrent.source || '';
            var combined = (title + ' ' + rawQuality + ' ' + extra).toUpperCase();
            var camText = combined.replace(/HDRIP/gi, '');

            var isCamrip = /\b(CAMRIP|CAM|TS|TELESYNC|TELECINE|TC|SCREENER|SCR|HDTS)\b/.test(camText);
            if (isCamrip) {
                return { label: 'CAMRIP', score: 50, isCamrip: true };
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
                else if (numericQuality >= 1440) assign('2K', 360);
                else if (numericQuality >= 1080) assign('1080P', 340);
                else if (numericQuality >= 720) assign('HD', 220);
                else if (numericQuality >= 480) assign('SD', 120);
            }

            if (/\b(2160P|4K|UHD|ULTRA\s*HD)\b/.test(combined)) assign('4K', 800);
            if (/\b(1440P|2K)\b/.test(combined)) assign('2K', 360);
            if (/\b(1080P|FHD|FULL\s*HD|BLU[-\s]?RAY|BDRIP|BDREMUX|REMUX|BRRIP)\b/.test(combined)) assign('1080P', 340);
            if (/\b(900P)\b/.test(combined)) assign('HD', 230);
            if (/\b(720P|HDTV|HDRIP|WEB[-\s]?DL|WEB[-\s]?RIP|WEBDL|WEBRIP)\b/.test(combined)) assign('HD', 220);
            if (/\b(540P)\b/.test(combined)) assign('SD', 140);
            if (/\b(480P|SD|DVDRIP|DVD|TVRIP|VHS)\b/.test(combined)) assign('SD', 120);

            if (typeof rawQuality === 'string') {
                var qUpper = rawQuality.toUpperCase();
                if (!meta.label && /\b(BDRIP|BLURAY|BDREMUX|REMUX)\b/.test(qUpper)) assign('1080P', 320);
                if (!meta.label && /\b(WEBDL|WEB[-\s]?DL|WEB[-\s]?RIP|HDRIP|HDTV)\b/.test(qUpper)) assign('HD', 210);
                if (!meta.label && /\b(DVDRIP|DVD|TVRIP)\b/.test(qUpper)) assign('SD', 110);
            }

            if (!meta.label) return null;
            return meta;
        }

        // ---------- Поиск лучшего релиза JacRed ----------

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
                        console.error('Ошибка при получении качества из JacRed:', e);
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

        // ---------- Тип карточки ----------

        function getCardType(card) {
            var type = card.media_type || card.type;
            if (type === 'movie' || type === 'tv') return type;
            return card.name || card.original_name ? 'tv' : 'movie';
        }

        // ==================================================
        // 1) КАЧЕСТВО В ФУЛЛ-ОПИСАНИИ
        // ==================================================

        function clearFullQuality(render) {
            if (!render) return;
            $('.jacred-full-quality', render).remove();
        }

        function showFullPlaceholder(render) {
            if (!render) return;
            var rateLine = $('.full-start-new__rate-line', render);
            if (!rateLine.length) return;

            if (!$('.jacred-full-quality', render).length) {
                var placeholder = document.createElement('div');
                placeholder.className = 'jacred-full-quality';
                placeholder.textContent = '...';
                rateLine.append(placeholder);
            }
        }

        functio
