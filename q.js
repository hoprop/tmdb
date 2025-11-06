(function () { 
    'use strict';

    // -----------------------------
    // НАСТРОЙКИ ПЛАГИНА
    // -----------------------------
    var ENABLE_STORAGE_KEY = 'jacred_plugin_quality_enabled'; // on/off плагина (через триггер)
    var CACHE_STORAGE_KEY  = 'jacred_plugin_quality_cache';   // кэш качества
    var DEFAULT_ENABLE     = 'on';

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
    // СТИЛЬ ДЛЯ БЕЙДЖЕЙ + setJacredBadge
    // -----------------------------
    (function addJacredQualityStyle(){
        if (document.getElementById('jacred-quality-style')) return;

        var css = ''
          + '.card__quality.jacq-anim{animation:jacqPop .18s ease-out both;}'
          + '@keyframes jacqPop{0%{opacity:0;transform:translateY(-4px) scale(.98);}100%{opacity:1;transform:translateY(0) scale(1);}}'
          + '@media (prefers-reduced-motion: reduce){.card__quality.jacq-anim{animation:none!important;}}'
          + '.jacred-full-quality{margin-left:.5em;font-size:.9em;opacity:.9;}'
          + '.jacred-full-quality_cam{color:#f55;}'
          + '.jacq-cam{color:#f55;}';

        var el = document.createElement('style');
        el.id = 'jacred-quality-style';
        el.textContent = css;
        document.head.appendChild(el);
    })();

    // установка бейджа качества (универсальная)
    function setJacredBadge($el, value){
        var $holder = $el.find('.card__quality');
        var text = (typeof value === 'undefined') ? '…' : (value === null ? '' : String(value));

        if (text === '') return;

        if ($holder.length){
            var $inner = $holder.find('.jacq-qtext');
            if ($inner.length){
                if ($inner.text() !== text) $inner.text(text);
                return;
            }
            var $child = $holder.children().first();
            if ($child.length){
                if ($child.text() !== text) $child.text(text);
                return;
            }
            if ($holder.text() !== text) $holder.text(text);
            return;
        }

        $holder = $('<div>', {
            "class": "card__quality jacq-anim"
        }).append(
            $('<div>', {
                "class": "jacq-qtext",
                text: text
            })
        );

        $el.append($holder);
        $holder.one('animationend', function () {
            $(this).removeClass('jacq-anim');
        });
    }

    // -----------------------------
    // СТАРТ ПЛАГИНА
    // -----------------------------
    function startPlugin() {
        try {
            addSettingsItem();
            applyJacredQuality();
        } catch (e) {
            console.error('JacRedQuality plugin start error:', e);
        }
    }

    function applyJacredQuality() {
        if (!isJacredEnabled()) {
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
        var Q_CACHE_TIME    = 72 * 60 * 60 * 1000;
        var Q_TS_CACHE_TIME = 24 * 60 * 60 * 1000;

        var JACRED_PROTOCOL = 'https://';
        var PROXY_LIST = [
            'http://api.allorigins.win/raw?url=',
            'http://cors.bwa.workers.dev/'
        ];
        var PROXY_TIMEOUT = 5000;

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

        // ---------- КЭШ ----------
        function getQualityCache(key) {
            var cache = Lampa.Storage.get(CACHE_STORAGE_KEY) || {};
            var item  = cache[key];
            if (!item) return null;

            var age = Date.now() - item.timestamp;
            var ttl = Q_CACHE_TIME;

            var q = String(item.quality || '').toUpperCase();
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

        // ---------- HTTP + ПРОКСИ ----------
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

        // ---------- JacRed API ----------
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

        function getCardType(card) {
            var type = card.media_type || card.type;
            if (type === 'movie' || type === 'tv') return type;
            return card.name || card.original_name ? 'tv' : 'movie';
        }

        // ===== ОБЩАЯ НОРМАЛИЗАЦИЯ (full + lists) =====
        function normalizeCard(card){
            if (!card) return null;

            var tmdbId = card.tmdb_id || card.id;

            return {
                id: tmdbId,
                tmdb_id: tmdbId,
                title: card.title || card.name || '',
                original_title: card.original_title || card.original_name || '',
                type: getCardType(card),
                release_date: card.release_date || card.first_air_date || ''
            };
        }

        // ==================================================
        // 1) КАЧЕСТВО В ФУЛЛ-ОПИСАНИИ (ИСХОДНАЯ ЛОГИКА)
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

            var normalizedCard = normalizeCard(card);
            if (!normalizedCard || !normalizedCard.id) return;

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
                var movie = e.data && (e.data.movie || e.data.tv || e.data.season || e.data.episode || e.data);
                fetchFullQuality(movie, render);
            }
        });

        // ==================================================
        // 2) КАЧЕСТВО В СПИСКАХ (ЛОГИКА КАК У FULL)
        // ==================================================

        // слот карточки из корня (как в antq)
        function pickCardSlot($cardRoot, onReady){
            if(!$cardRoot || !$cardRoot.length) return;

            function pick(){ 
                return $cardRoot.find('.card__view, .card__image, .card__img, .card__poster, .card, .card__content').first(); 
            }

            var $slot = pick(); 
            if($slot && $slot.length){ 
                onReady($slot); 
                return; 
            }

            var attempts=0, maxAttempts=20;
            var timer=setInterval(function(){
                attempts++; 
                var $try = pick();
                if($try && $try.length){ 
                    clearInterval(timer); 
                    onReady($try); 
                }
                else if(attempts>=maxAttempts){ 
                    clearInterval(timer); 
                }
            },100);

            try{
                var mo = new MutationObserver(function(){ 
                    var $t = pick(); 
                    if($t && $t.length){ 
                        mo.disconnect(); 
                        clearInterval(timer); 
                        onReady($t); 
                    } 
                });
                mo.observe($cardRoot.get(0),{childList:true,subtree:true});
            }catch(_){}
        }

        function applyListQuality(obj, $slot){
            if (!obj || !$slot || !$slot.length) return;
            if (!isJacredEnabled()) return;

            var normalizedCard = normalizeCard(obj);
            if (!normalizedCard || !normalizedCard.id) return;

            var qCacheKey = normalizedCard.type + '_' + (normalizedCard.id || normalizedCard.imdb_id);
            var cache = getQualityCache(qCacheKey);

            function applyQuality(quality, isCamrip) {
                if (!$slot || !$slot.length) return;
                var text = quality || '';
                if (!text) return;

                setJacredBadge($slot, text);

                var $holder = $slot.find('.card__quality').first();
                if (!$holder.length) return;

                if (isCamrip) $holder.addClass('jacq-cam');
                else $holder.removeClass('jacq-cam');
            }

            if (cache && cache.quality) {
                applyQuality(cache.quality, cache.isCamrip);
            } else {
                setJacredBadge($slot, undefined); // тот же плейсхолдер "…"

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
                    }
                });
            }
        }

        // слушаем Lampa списки, как antq, и юзаем ту же логику, что full
        Lampa.Listener.follow('line', function(e){
            if (['create','append','visible'].indexOf(e.type) === -1) return;

            var items = e.items || [];
            if (!items.length) return;

            setTimeout(function(){
                for (var i=0;i<items.length;i++){
                    var mc = items[i]; 
                    if(!mc || !mc.data) continue;

                    var rootEl = mc.card || mc.html || mc.node || mc;
                    var $root = rootEl instanceof $ ? rootEl : $(rootEl);
                    if(!$root || !$root.length) continue;

                    (function(data,$rootRef){
                        pickCardSlot($rootRef,function($slot){
                            applyListQuality(data, $slot);
                        });
                    })(mc.data,$root);
                }
            },0);
        });
    }

    // -----------------------------
    // НАСТРОЙКИ Lampa
    // -----------------------------
    function addSettingsItem() {
        try {
            if (Lampa.SettingsApi && typeof Lampa.SettingsApi.addComponent === 'function') {

                Lampa.SettingsApi.addComponent({
                    component: 'jacred_quality',
                    name: 'JacRed качество',
                    icon: '<svg height="200" width="200" viewBox="0 0 24 24" fill="#fff" xmlns="http://www.w3.org/2000/svg"><path d="M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z"/></svg>'
                });

                Lampa.SettingsApi.addParam({
                    component: 'jacred_quality',
                    param: {
                        name: ENABLE_STORAGE_KEY,
                        type: 'trigger',
                        "default": (DEFAULT_ENABLE === 'on')
                    },
                    field: {
                        name: 'Включить JacRed качество',
                        description: 'Показывать бейдж качества из JacRed (описание + списки)'
                    },
                    onChange: function () {
                        window.jacredQualityInitialized = false;
                        applyJacredQuality();
                    }
                });

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

            if (Lampa.Settings && typeof Lampa.Settings.add === 'function') {
                Lampa.Settings.add({
                    group: 'jacred_quality',
                    title: 'JacRed качество',
                    subtitle: 'Плагин показа качества по JacRed',
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
