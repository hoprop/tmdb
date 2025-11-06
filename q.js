(function () { 
    'use strict';

    // -----------------------------
    // НАСТРОЙКИ ПЛАГИНА
    // -----------------------------
    var ENABLE_STORAGE_KEY = 'jacred_plugin_quality_enabled'; // on/off плагина
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
    // МИНИМАЛЬНЫЙ СТИЛЬ ДЛЯ БЕЙДЖЕЙ
    // -----------------------------
    (function addJacredQualityStyle(){
        if (document.getElementById('jacred-quality-style')) return;

        var css = ''
          + '.card__quality.jacq-anim{animation:jacqPop .18s ease-out both;}'
          // CAMRIP красный фон (карточки)
          + '.card__quality.jacq-cam{'
          + '  background:#c62828!important;'
          + '  color:#fff!important;'
          + '}'
          // Бейдж качества в фулл-описании
          + '.jacred-full-quality{'
          + '  border:1px solid #fff;'
          + '  border-radius:0.2em;'
          + '  padding:0.44em;'
          + '  margin-left:0.5em;'
          + '}'
          + '@keyframes jacqPop{0%{opacity:0;transform:translateY(-4px) scale(.98);}100%{opacity:1;transform:translateY(0) scale(1);}}'
          + '@media (prefers-reduced-motion: reduce){.card__quality.jacq-anim{animation:none!important;}}';

        var el = document.createElement('style');
        el.id = 'jacred-quality-style';
        el.textContent = css;
        document.head.appendChild(el);
    })();

    // Установка бейджа качества в карточку
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

        // ---------- Фильтрация торрентов по году и типу ----------

        function filterTorrentsForCard(torrents, normalizedCard) {
            if (!Array.isArray(torrents)) return [];

            var cardType = normalizedCard.type; // 'movie' или 'tv'
            var cardYear = 0;

            if (normalizedCard.release_date && normalizedCard.release_date.length >= 4) {
                var y = parseInt(normalizedCard.release_date.substr(0, 4), 10);
                if (!isNaN(y)) cardYear = y;
            }

            // 1) Фильтр по типу (movie vs tvshow)
            var filtered = torrents.filter(function (t) {
                if (cardType === 'movie' && Array.isArray(t.types) && t.types.indexOf('tvshow') !== -1) {
                    return false;
                }
                if (cardType === 'tv' && Array.isArray(t.types) && t.types.indexOf('tvshow') === -1) {
                    return false;
                }
                return true;
            });

            // 2) Фильтр по году
            if (cardYear) {
                var byYear = filtered.filter(function (t) {
                    var ty = parseInt(t.relased || t.year, 10);
                    if (!ty || isNaN(ty)) return false;
                    return Math.abs(ty - cardYear) <= 1;
                });

                if (byYear.length) filtered = byYear;
            }

            return filtered;
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

                        // фильтруем по году и типу под конкретную карточку
                        torrents = filterTorrentsForCard(torrents, normalizedCard);
                        if (!torrents.length) {
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
        // 1) КАЧЕСТВО В КАРТОЧКЕ
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

        function updateFullQuality(quality, isCamrip, render) {
            if (!render) return;

            var element = $('.jacred-full-quality', render);
            var rateLine = $('.full-start-new__rate-line', render);
            if (!rateLine.length) return;

            if (element.length) {
                element.text(quality);
                if (isCamrip) element.addClass('jacred-full-quality_cam');
                else element.removeClass('jacred-full-quality_cam');
            } else {
                var div = document.createElement('div');
                div.className = 'jacred-full-quality' + (isCamrip ? ' jacred-full-quality_cam' : '');
                div.textContent = quality;
                rateLine.append(div);
            }
        }

        function fetchFullQuality(card, render) {
            if (!render || !card) return;

            var normalizedCard = {
                id: card.id,
                title: card.title || card.name || '',
                original_title: card.original_title || card.original_name || '',
                type: getCardType(card),
                release_date: card.release_date || card.first_air_date || ''
            };

            var qCacheKey = normalizedCard.type + '_' + (normalizedCard.id || normalizedCard.imdb_id);
            var cache = getQualityCache(qCacheKey);

            if (cache) {
                updateFullQuality(cache.quality, cache.isCamrip, render);
            } else {
                showFullPlaceholder(render);
                getBestReleaseFromJacred(normalizedCard, normalizedCard.id, function (res) {
                    var quality = res && res.quality;
                    var isCamrip = res && res.isCamrip;

                    if (quality && quality !== 'NO') {
                        saveQualityCache(qCacheKey, { quality: quality, isCamrip: isCamrip });
                        updateFullQuality(quality, isCamrip, render);
                    } else {
                        clearFullQuality(render);
                    }
                });
            }
        }

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var render = e.object && e.object.activity && e.object.activity.render && e.object.activity.render();
                fetchFullQuality(e.data && e.data.movie, render);
            }
        });

        // ==================================================
        // 2) КАЧЕСТВО НА КАРТОЧКАХ
        // ==================================================

        // Нормализация card_data Lampa → формат, понятный JacRed
        function normalizeFromCardData(data) {
            if (!data) return null;
            return {
                id: data.id,
                title: data.title || data.name || '',
                original_title: data.original_title || data.original_name || '',
                type: getCardType(data),
                release_date: data.release_date || data.first_air_date || ''
            };
        }

        // Отрисовка качества для одной мини-карточки по card_data
        function fetchMiniQualityForCardData(cardData, $view) {
            if (!cardData || !$view || !$view.length) return;
            if (!isJacredEnabled()) return;

            var norm = normalizeFromCardData(cardData);
            if (!norm || !norm.id) return;

            var qCacheKey = norm.type + '_' + (norm.id || norm.imdb_id);
            var cache = getQualityCache(qCacheKey);

            function applyQuality(quality, isCamrip) {
                if (!quality) return;
                setJacredBadge($view, quality);

                var $holder = $view.find('.card__quality').first();
                if (!$holder.length) return;

                if (isCamrip) $holder.addClass('jacq-cam');
                else          $holder.removeClass('jacq-cam');
            }

            if (cache && cache.quality) {
                applyQuality(cache.quality, cache.isCamrip);
            } else {
                // плейсхолдер "…" пока ждём ответ
                setJacredBadge($view, undefined);

                getBestReleaseFromJacred(norm, norm.id, function (res) {
                    if (!$view || !$view.length) return;

                    if (res && res.quality && res.quality !== 'undefined' && res.quality !== '' && res.quality !== 'null' && res.quality !== 'NO') {
                        applyQuality(res.quality, res.isCamrip);
                        saveQualityCache(qCacheKey, {
                            quality: res.quality,
                            isCamrip: res.isCamrip
                        });
                    } else {
                        // если ничего нет — просто убираем наш «…»
                        var $holder = $view.find('.card__quality');
                        $holder.each(function () {
                            var $h = $(this);
                            if ($h.find('.jacq-qtext').length) $h.remove();
                        });
                    }
                });
            }
        }

        // Обработка одного .card__view (как "слота" карточки)
        function handleMiniCardView(viewEl) {
            if (!viewEl) return;

            var $view = $(viewEl);
            if ($view.data('jacred_mini_done')) return;

            // Ищем ближайшую .card, на которой Lampa вешает card_data
            var cardEl = $view.closest('.card')[0] || $view[0];
            if (!cardEl) return;

            var data = cardEl.card_data;
            if (!data) return;

            $view.data('jacred_mini_done', true);
            fetchMiniQualityForCardData(data, $view);
        }

        // Просканировать уже существующие .card__view
        function scanExistingMiniCardViews() {
            $('.card__view').each(function () {
                handleMiniCardView(this);
            });
        }

        // MutationObserver: цепляемся ко всем новым card__view
        function startMiniCardsObserver() {
            scanExistingMiniCardViews();

            try {
                var root = document.body;
                var mo = new MutationObserver(function (mutations) {
                    mutations.forEach(function (m) {
                        if (!m.addedNodes || !m.addedNodes.length) return;
                        m.addedNodes.forEach(function (node) {
                            if (!(node instanceof HTMLElement)) return;

                            // если сам узел — card__view
                            if (node.classList && node.classList.contains('card__view')) {
                                handleMiniCardView(node);
                            }

                            // или внутри него есть card__view
                            var views = node.querySelectorAll && node.querySelectorAll('.card__view');
                            if (views && views.length) {
                                views.forEach(function (v) {
                                    handleMiniCardView(v);
                                });
                            }
                        });
                    });
                });

                mo.observe(root, { childList: true, subtree: true });

                // функцию refreshVisibleMiniQuality можно оставить глобально,
                // если вдруг захочешь дергать её из консоли
                window.jacredMiniQualityRefresh = function () {
                    $('.card__view').each(function () {
                        var $view = $(this);
                        var cardEl = $view.closest('.card')[0] || $view[0];
                        if (!cardEl) return;

                        var data = cardEl.card_data;
                        if (!data) return;

                        $view.removeData('jacred_mini_done');
                        fetchMiniQualityForCardData(data, $view);
                    });
                };
            } catch (e) {
                console.error('JacRedQuality: MutationObserver mini-cards error', e);
            }
        }

        // запускаем наблюдение за мини-карточками
        startMiniCardsObserver();
    }

    // -----------------------------
    // ПУНКТ НАСТРОЕК В Lampa
    // -----------------------------
    function addSettingsItem() {
        try {
            // 1) Новый API SettingsApi (современные версии Lampa)
            if (Lampa.SettingsApi && typeof Lampa.SettingsApi.addComponent === 'function') {

                Lampa.SettingsApi.addComponent({
                    component: 'jacred_quality',
                    name: 'JacRed качество',
                    icon: '<svg height="200" width="200" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/></svg>'
                });

                // Триггер включения/выключения плагина
                Lampa.SettingsApi.addParam({
                    component: 'jacred_quality',
                    param: {
                        name: ENABLE_STORAGE_KEY,
                        type: 'trigger',
                        "default": (DEFAULT_ENABLE === 'on')
                    },
                    field: {
                        name: 'Включить JacRed качество',
                        description: 'Показывать бейдж качества из JacRed в списках'
                    },
                    onChange: function () {
                        window.jacredQualityInitialized = false;
                        applyJacredQuality();
                    }
                });

                // Поле для изменения jacred_url
                Lampa.SettingsApi.addParam({
                    component: 'jacred_quality',
                    param: {
                        name: 'jacred_url',
                        type: 'input',
                        placeholder: 'jacred.xyz',
                        values: Lampa.Storage.get('jacred_url', 'jacred.xyz')
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
                        Lampa.Storage.set(CACHE_STORAGE_KEY, {});
                        window.jacredQualityInitialized = false;
                        applyJacredQuality();
                    }
                });

                // Кнопка сброса кэша качества
                Lampa.SettingsApi.addParam({
                    component: 'jacred_quality',
                    param: {
                        name: 'jacred_quality_clear_cache',
                        type: 'trigger',
                        "default": false
                    },
                    field: {
                        name: 'Сбросить кэш качества',
                        description: 'Очистить локальный кэш JacRed качества'
                    },
                    onChange: function () {
                        Lampa.Storage.set('jacred_quality_clear_cache', false);
                        Lampa.Storage.set(CACHE_STORAGE_KEY, {});
                        if (Lampa.Noty) {
                            Lampa.Noty.show('Кэш JacRed качества очищен');
                        }
                    }
                });

                return;
            }

            // 2) Старый API настроек (на всякий случай)
            if (Lampa.Settings && typeof Lampa.Settings.add === 'function') {
                Lampa.Settings.add({
                    group: 'jacred_quality',
                    title: 'JacRed качество',
                    subtitle: 'Плагин показа качества по JacRed (отдельно от Lampa)',
                    icon: 'magic',
                    onRender: function (item) {
                        item.toggleClass('on', isJacredEnabled());
                    },
                    onChange: function (item) {
                        var next = isJacredEnabled() ? 'off' : 'on';
                        Lampa.Storage.set(ENABLE_STORAGE_KEY, next);
                        item.toggleClass('on', next === 'on');
                        window.jacredQualityInitialized = false;
                        applyJacredQuality();
                    }
                });
                return;
            }

        } catch (e) {
            console.error('JacRedQuality: settings error:', e);
        }
    }

    // -----------------------------
    // ХУК ИНИЦИАЛИЗАЦИИ LAMPA
    // -----------------------------
    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                startPlugin();
            }
        });
    }
})();
