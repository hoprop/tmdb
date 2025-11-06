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

        // ранжирование качества
        function qualityRank(label) {
            var q = String(label || '').toUpperCase();
            if (q === '4K')      return 6;
            if (q === '2K')      return 5;
            if (q === '1080P')   return 4;
            if (q === 'HD')      return 3;
            if (q === 'SD')      return 2;
            if (q === 'CAMRIP')  return 1;
            return 0;
        }

        function saveQualityCache(key, data) {
            var cache = Lampa.Storage.get(CACHE_STORAGE_KEY) || {};
            var now   = Date.now();

            // чистим старое
            Object.keys(cache).forEach(function (cacheKey) {
                if (now - cache[cacheKey].timestamp >= Q_CACHE_TIME) {
                    delete cache[cacheKey];
                }
            });

            var newQuality = data.quality || null;
            var newIsCam   = !!data.isCamrip;

            var existing = cache[key];
            if (existing && existing.quality) {
                var oldQuality = existing.quality;
                var oldIsCam   = !!existing.isCamrip;

                var oldRank = qualityRank(oldQuality);
                var newRank = qualityRank(newQuality);

                var shouldReplace = false;
                if (newRank > oldRank) shouldReplace = true;
                else if (newRank === oldRank && oldIsCam && !newIsCam) shouldReplace = true;

                if (!shouldReplace) {
                    existing.timestamp = now;
                    Lampa.Storage.set(CACHE_STORAGE_KEY, cache);
                    return;
                }
            }

            cache[key] = {
                quality: newQuality,
                isCamrip: newIsCam,
                timestamp: now
            };

            Lampa.Storage.set(CACHE_STORAGE_KEY, cache);
        }

        // единый формат ключа кэша
        function makeCacheKey(obj) {
            if (!obj) return null;

            if (obj.tmdb_id) return 'tmdb_' + String(obj.tmdb_id);
            if (obj.imdb_id) return 'imdb_' + String(obj.imdb_id);

            if (obj.type && obj.id) return String(obj.type) + '_' + String(obj.id);
            if (obj.id)             return 'id_' + String(obj.id);

            return null;
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
                tmdb_id: card.id,
                imdb_id: card.imdb_id || (card.ids && card.ids.imdb) || null,
                title: card.title || card.name || '',
                original_title: card.original_title || card.original_name || '',
                type: getCardType(card),
                release_date: card.release_date || card.first_air_date || ''
            };

            var qCacheKey = makeCacheKey(normalizedCard);
            if (!qCacheKey) return;

            var cache = getQualityCache(qCacheKey);

            if (cache) {
                if (cache.quality) {
                    updateFullQuality(cache.quality, cache.isCamrip, render);
                } else {
                    clearFullQuality(render);
                }
            } else {
                showFullPlaceholder(render);
                getBestReleaseFromJacred(normalizedCard, normalizedCard.id, function (res) {
                    var quality  = res && res.quality;
                    var isCamrip = res && res.isCamrip;

                    if (quality && quality !== 'NO') {
                        saveQualityCache(qCacheKey, { quality: quality, isCamrip: isCamrip });
                        updateFullQuality(quality, isCamrip, render);
                    } else {
                        saveQualityCache(qCacheKey, { quality: null, isCamrip: false });
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
        // 2) КАЧЕСТВО НА МИНИ-КАРТОЧКАХ
        // ==================================================

        var cardDataStorage = new WeakMap();

        function getCardDataFromElement(cardElement) {
            try {
                if (cardDataStorage.has(cardElement)) {
                    return cardDataStorage.get(cardElement);
                }

                var ds = cardElement.dataset || {};

                var tmdbId =
                      cardElement.getAttribute('data-tmdb-id')
                   || cardElement.getAttribute('data-card-id')
                   || cardElement.getAttribute('data-movie-id')
                   || cardElement.getAttribute('data-tv-id')
                   || cardElement.getAttribute('data-id')
                   || ds.tmdbId || ds.movieId || ds.tvId || null;

                var cardId = tmdbId;

                if (!cardId) {
                    var parent = cardElement.parentElement;
                    while (parent && !cardId) {
                        cardId =
                              parent.getAttribute('data-tmdb-id')
                           || parent.getAttribute('data-card-id')
                           || parent.getAttribute('data-movie-id')
                           || parent.getAttribute('data-tv-id')
                           || parent.getAttribute('data-id')
                           || parent.getAttribute('id');
                        parent = parent.parentElement;
                    }
                }

                if (!cardId) {
                    cardId = getCardIdFromLocal(cardElement);
                }
                if (!cardId) return null;

                var titleElement = cardElement.querySelector('.card__title, .card-title, .title, .card__name, .name');
                var title = titleElement ? titleElement.textContent.trim() : '';
                if (!title) {
                    title = cardElement.getAttribute('data-title') ||
                            cardElement.getAttribute('data-name') ||
                            ds.title || ds.name || '';
                }

                var originalTitleElement = cardElement.querySelector('.card__original-title, .original-title, .card__original-name, .original-name');
                var originalTitle = originalTitleElement ? originalTitleElement.textContent.trim() : '';

                if (!originalTitle) {
                    originalTitle =
                          ds.originalTitle || ds.original_title || ds.originalname || ds.originalName
                       || cardElement.getAttribute('data-original-title')
                       || cardElement.getAttribute('data-original_title')
                       || cardElement.getAttribute('data-original-name')
                       || cardElement.getAttribute('data-originalname')
                       || cardElement.getAttribute('data-eng-title')
                       || cardElement.getAttribute('data-en-title')
                       || cardElement.getAttribute('original_title')
                       || cardElement.getAttribute('original-name')
                       || cardElement.getAttribute('originalname')
                       || '';
                }

                var isTv =
                       cardElement.classList.contains('card--tv')
                    || cardElement.classList.contains('tv')
                    || cardElement.querySelector('.card__type')
                    || cardElement.querySelector('[data-type="tv"]')
                    || cardElement.getAttribute('data-type') === 'tv'
                    || ds.type === 'tv';

                var year =
                       cardElement.getAttribute('data-year')
                    || cardElement.getAttribute('data-release-year')
                    || cardElement.getAttribute('data-first-air-date')
                    || cardElement.getAttribute('data-release-date')
                    || cardElement.getAttribute('data-release')
                    || cardElement.getAttribute('year')
                    || cardElement.getAttribute('release_date')
                    || ds.year || ds.releaseYear || ds.firstAirDate || ds.releaseDate || ds.release_date || '';

                if (!year) {
                    var yearElement = cardElement.querySelector('.card__year, .year, .card__date, .date');
                    if (yearElement) {
                        var yearText = yearElement.textContent.trim();
                        var yearMatch = yearText.match(/(19|20)\d{2}/);
                        if (yearMatch) year = yearMatch[0];
                    }
                }

                var release_date = '';
                if (year) {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(year)) release_date = year;
                    else {
                        var ym = String(year).match(/(19|20)\d{2}/);
                        release_date = ym ? ym[0] : '';
                    }
                }

                var cardData = {
                    id: cardId,
                    tmdb_id: tmdbId || cardId,
                    title: title,
                    original_title: originalTitle,
                    type: isTv ? 'tv' : 'movie',
                    release_date: release_date
                };

                cardDataStorage.set(cardElement, cardData);
                return cardData;
            } catch (e) {
                console.error('JacRedQuality: ошибка парсинга карточки:', e);
                return null;
            }
        }

        function getCardIdFromLocal(cardElement) {
            try {
                var href = cardElement.getAttribute('href') || '';
                var idMatch = href.match(/\/(\d+)/);
                if (idMatch) return idMatch[1];

                var onclick = cardElement.getAttribute('onclick') || '';
                var onclickMatch = onclick.match(/id[:\s]*(\d+)/);
                if (onclickMatch) return onclickMatch[1];

                var titleElement = cardElement.querySelector('.card__title, .card-title, .title, .card__name, .name');
                if (titleElement) {
                    var title = titleElement.textContent.trim();
                    if (title) {
                        var hash = 0;
                        for (var i = 0; i < title.length; i++) {
                            var char = title.charCodeAt(i);
                            hash = ((hash << 5) - hash) + char;
                            hash = hash & hash;
                        }
                        return Math.abs(hash).toString().substr(0, 8);
                    }
                }

                return null;
            } catch (e) {
                return null;
            }
        }

        // >>> НОВАЯ addQualityToMiniCard С ЕДИНЫМ КЭШЕМ <<<
        function addQualityToMiniCard(cardElement, cardData) {
            if (!cardData || (!cardData.title && !cardData.original_title)) return;
            if (!isJacredEnabled()) return;

            var $root = $(cardElement instanceof HTMLElement ? cardElement : cardElement);
            var $slot = $root.find('.card__view, .card__image, .card__img, .card__poster, .card__content, .card').first();
            if (!$slot.length) $slot = $root;

            var normalizedCard = {
                id: cardData.tmdb_id || cardData.id,
                tmdb_id: cardData.tmdb_id || null,
                imdb_id: null,
                title: cardData.title || '',
                original_title: cardData.original_title || '',
                type: cardData.type || 'movie',
                release_date: cardData.release_date || ''
            };

            var qCacheKey = makeCacheKey(normalizedCard);
            if (!qCacheKey) return;

            var cache = getQualityCache(qCacheKey);

            function applyQuality(quality, isCamrip) {
                if (!$slot || !$slot.length) return;
                if (!quality) return;

                setJacredBadge($slot, quality);

                var $holder = $slot.find('.card__quality').first();
                if (!$holder.length) return;

                if (isCamrip) $holder.addClass('jacq-cam');
                else          $holder.removeClass('jacq-cam');
            }

            if (cache) {
                applyQuality(cache.quality, cache.isCamrip);
            } else {
                setJacredBadge($slot, undefined);

                getBestReleaseFromJacred(normalizedCard, normalizedCard.id, function (res) {
                    if (!$slot || !$slot.length) return;

                    if (res && res.quality && res.quality !== 'undefined' && res.quality !== '' && res.quality !== 'null') {
                        applyQuality(res.quality, res.isCamrip);

                        saveQualityCache(qCacheKey, {
                            quality: res.quality,
                            isCamrip: res.isCamrip
                        });
                    } else {
                        var $holder = $slot.find('.card__quality');
                        $holder.each(function () {
                            var $h = $(this);
                            if ($h.find('.jacq-qtext').length) $h.remove();
                        });

                        saveQualityCache(qCacheKey, { quality: null, isCamrip: false });
                    }
                });
            }
        }
        // <<< КОНЕЦ НОВОЙ addQualityToMiniCard >>>

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
        setTimeout(processAllCards, 100);
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
