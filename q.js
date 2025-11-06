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

        // ==================================================
        // НОВАЯ ЛОГИКА ПОИСКА КАЧЕСТВА (из server.js)
        // ==================================================

        function normalizeQualityFromText(s){
            var str = (s || "").toString().toLowerCase();

            // CAMRip — самый "плохой"
            if (/\bcam[-\s]?rip\b|\bcam\b/.test(str)) return "CAMRip";

            // "звук TS" / "звук с TS" (рус.) или TeleSynch / TS / Telecine / TC
            var hasZvukTS   = /звук\s*(с)?\s*ts/i.test(str);
            var isTeleSynch = /\btelesynch\b|\btele\s*synch\b|\bts\b(?![a-z])/i.test(str);
            var isTelecine  = /\btelecine\b|\btc\b(?![a-z])/i.test(str);
            if (hasZvukTS || isTeleSynch || isTelecine) return "TS";

            // 4K + HDR → просто 4K
            var is4k  = /\b(2160p|4k|uhd)\b/.test(str);
            var hasHDR= /\bhdr10\+?\b|\bhdr\b|\bdolby\s*vision\b|\bdv\b/.test(str);
            if (is4k && hasHDR) return "4K";

            if (is4k)                         return "4K";
            if (/\b1080p\b|\b1080i\b/.test(str) || /\bhdtv\s*1080i\b/.test(str)) return "1080p";
            if (/\b720p\b/.test(str))         return "720p";
            if (/\b480p\b|\bsd\b/.test(str))  return "SD";
            if (/\bhd\b/.test(str))           return "1080p";
            return null;
        }

        function chooseBetterQuality(a,b){
            if (!b) return a || null;
            if (!a) return b;
            var rank = { "4K":5, "1080p":4, "720p":3, "SD":2, "TS":1, "CAMRip":0 };
            return (rank[b] || -1) > (rank[a] || -1) ? b : a;
        }

        function normStr(s){
            return (s||"")
              .toLowerCase()
              .replace(/[._\-–—:,/\\()[\]{}'‘’"“”!?+*#№]/g, " ")
              .replace(/\s+/g, " ")
              .trim();
        }

        function removeStopWords(s){
            return (s || "")
              .replace(/\b(uhd|hdr|hdr10\+?|dolby\s*vision|dv|remux|blu[-\s]?ray|webrip|web[-\s]?dl|hdtv|rip|x26[45]|hevc|av1|avc|h\.26[45]|10[-\s]?bit|8[-\s]?bit|dts|ac3|aac|camrip|telesynch|tele[-\s]?synch|telecine|tc|ts|p(?:2160|1080|720|480))\b/g, " ")
              .replace(/\s+/g, " ")
              .trim();
        }

        function extractYear(s){
            var m = (s||"").match(/\b(19|20)\d{2}\b/);
            return m ? parseInt(m[0],10) : null;
        }

        function titleMatches(meta, releaseTitle){
            var t1 = normStr(meta.title || "");
            var t2 = normStr(meta.title_original || "");
            if (!t1 && !t2) return true;

            var r = normStr(releaseTitle || "");
            r = removeStopWords(r);

            var okByTitle =
                (t1 && r.indexOf(t1) !== -1 && t1.length >= 3) ||
                (t2 && r.indexOf(t2) !== -1 && t2.length >= 3);

            if (!okByTitle) return false;

            var my = Number(meta.year || 0) || null;
            if (!my) return true;
            var ry = extractYear(releaseTitle);
            return !ry || Math.abs(ry - my) <= 1;
        }

        function sanitize(s){ return (s || "").replace(/\s+/g, " ").trim(); }

        function isProbableReleaseTitle(s){
            return /\b(2160p|1080p|720p|480p|4k|uhd|hdr|dolby\s*vision|dv|web[-.\s]?dl|webrip|bluray|bdrip|dvdrip|hdrip|x265|x264|hevc|camrip|telesynch|tele[-\s]?synch|ts|telecine|tc)\b/i.test(s);
        }

        function dedupe(arr){
            var seen = {};
            var out = [];
            for (var i = 0; i < arr.length; i++){
                var v = arr[i];
                if (!seen[v]) {
                    seen[v] = 1;
                    out.push(v);
                }
            }
            return out;
        }

        function pickQualityFromJacredV2Json(data, meta, strictTitle) {
            if (typeof strictTitle === 'undefined') strictTitle = true;

            var list = null;
            if (Array.isArray(data && data.Results)) list = data.Results;
            else if (Array.isArray(data && data.results)) list = data.results;
            else if (Array.isArray(data)) list = data;

            if (!list || !list.length) return null;

            var best = null;

            for (var i = 0; i < list.length; i++) {
                var it = list[i];
                var cat = String(it.Category || it.CategoryDesc || "").toLowerCase();
                var t   = String(it.Title || it.Name || "").trim();

                var titleOk = !strictTitle || titleMatches(meta, t);

                if (!titleOk) {
                    if (meta.kind === "movie" && cat.indexOf("tv") !== -1)    continue;
                    if (meta.kind === "tv"    && cat.indexOf("movie") !== -1) continue;
                    if (strictTitle) continue;
                }

                var qFromTitle = normalizeQualityFromText(t);
                best = chooseBetterQuality(best, qFromTitle);

                var explicit = normalizeQualityFromText(String(it.Quality || it.Resolution || ""));
                best = chooseBetterQuality(best, explicit);

                if (best === "4K") break;
            }

            return best;
        }

        function pickQualityFromHtml(html, meta, strictTitle) {
            if (typeof strictTitle === 'undefined') strictTitle = true;
            if (!html) return null;
            var titles = [];
            var m;

            var linkRe = /<a[^>]*>([^<]+)<\/a>/gi;
            while ((m = linkRe.exec(html))) {
                var t = sanitize(m[1]);
                if (!isProbableReleaseTitle(t)) continue;
                if (strictTitle && !titleMatches(meta, t)) continue;
                titles.push(t);
            }

            var headRe = /<(h\d|strong|b)[^>]*>([^<]+)<\/\1>/gi;
            while ((m = headRe.exec(html))) {
                var t2 = sanitize(m[2]);
                if (!isProbableReleaseTitle(t2)) continue;
                if (strictTitle && !titleMatches(meta, t2)) continue;
                titles.push(t2);
            }

            var best = null;
            for (var i = 0; i < titles.length; i++) {
                var tt = titles[i];
                var q = normalizeQualityFromText(tt);
                best = chooseBetterQuality(best, q);
                if (best === "4K") break;
            }
            return best;
        }

        function buildUrls(endpoints, meta, key, opts) {
            opts = opts || {};
            var is_serial = opts.is_serial || "";
            var genres    = opts.genres || "";

            var title  = meta.title || meta.title_original || "";
            var titleOriginal = meta.title_original || "";
            var year   = meta.year || "";
            var imdb   = meta.imdb || "";

            var catsMov = ["2000"], catsTv = ["5000"], catsAll = ["2000","5000"];
            var kind = (meta.kind || "auto").toLowerCase();

            function pickCats() {
                if (kind === "movie") return catsMov;
                if (kind === "tv")    return catsTv;
                return catsAll;
            }

            var urls = [];

            function mkHealthy(base) {
                return base.replace("/indexers/all/", "/indexers/status:healthy/");
            }

            function withCats(base, q, cats, extra) {
                var usp = new URLSearchParams();
                if (key) usp.set("apikey", key);
                usp.set("Query", q);
                if (extra.title)          usp.set("title", extra.title);
                if (extra.title_original) usp.set("title_original", extra.title_original);
                if (extra.year)           usp.set("year", extra.year);
                if (extra.is_serial)      usp.set("is_serial", extra.is_serial);
                if (extra.genres)         usp.set("genres", extra.genres);
                var useCats = cats || pickCats();
                for (var i = 0; i < useCats.length; i++) {
                    usp.append("Category[]", useCats[i]);
                }
                return base + "?" + usp.toString();
            }

            function pushForCats(base, q, extra) {
                if (kind === "movie") {
                    urls.push(withCats(base, q, catsMov, extra));
                } else if (kind === "tv") {
                    urls.push(withCats(base, q, catsTv, extra));
                }
                urls.push(withCats(base, q, ["2000","5000"], extra));
            }

            // База: только тот домен, который пользователь указал в настройках
            var eps = endpoints && endpoints.length ? endpoints : [];

            // 1) IMDB healthy (если вдруг будет imdb)
            if (imdb) {
                for (var i1 = 0; i1 < eps.length; i1++){
                    pushForCats(mkHealthy(eps[i1]), imdb, {});
                }
            }

            var precise = [];
            if (title && year)         precise.push({ q: title + " " + year, t: title, to: titleOriginal, y: year });
            if (titleOriginal && year) precise.push({ q: titleOriginal + " " + year, t: title, to: titleOriginal, y: year });

            for (var i2 = 0; i2 < eps.length; i2++){
                var healthy = mkHealthy(eps[i2]);
                for (var j2 = 0; j2 < precise.length; j2++) {
                    var rec2 = precise[j2];
                    pushForCats(healthy, rec2.q, {
                        title: rec2.t,
                        title_original: rec2.to,
                        year: rec2.y,
                        is_serial: is_serial,
                        genres: genres
                    });
                }
            }

            var soft = [];
            if (title)         soft.push({ q: title, t: title, to: titleOriginal, y: year || "" });
            if (titleOriginal) soft.push({ q: titleOriginal, t: title, to: titleOriginal, y: year || "" });

            for (var i3 = 0; i3 < eps.length; i3++){
                var healthy2 = mkHealthy(eps[i3]);
                for (var j3 = 0; j3 < soft.length; j3++) {
                    var rec3 = soft[j3];
                    pushForCats(healthy2, rec3.q, {
                        title: rec3.t,
                        title_original: rec3.to,
                        year: rec3.y,
                        is_serial: is_serial,
                        genres: genres
                    });
                }
            }

            if (imdb) {
                for (var i4 = 0; i4 < eps.length; i4++){
                    pushForCats(eps[i4], imdb, {});
                }
            }

            for (var i5 = 0; i5 < eps.length; i5++){
                for (var j5 = 0; j5 < precise.length; j5++) {
                    var rec5 = precise[j5];
                    pushForCats(eps[i5], rec5.q, {
                        title: rec5.t,
                        title_original: rec5.to,
                        year: rec5.y,
                        is_serial: is_serial,
                        genres: genres
                    });
                }
                for (var j6 = 0; j6 < soft.length; j6++) {
                    var rec6 = soft[j6];
                    pushForCats(eps[i5], rec6.q, {
                        title: rec6.t,
                        title_original: rec6.to,
                        year: rec6.y,
                        is_serial: is_serial,
                        genres: genres
                    });
                }
            }

            return dedupe(urls);
        }

        function safeGetJac(url, cardId) {
            return new Promise(function (resolve) {
                fetchWithProxy(url, cardId, function (err, text) {
                    if (err || !text) {
                        resolve({ ok: false, type: "", body: "" });
                        return;
                    }
                    var body = text || "";
                    var trimmed = body.trim();
                    var first = trimmed.charAt(0);
                    var type = (first === '{' || first === '[') ? 'application/json' : 'text/html';
                    resolve({ ok: true, type: type, body: body });
                });
            });
        }

        // ---------- Поиск лучшего релиза JacRed (НОВАЯ ВЕРСИЯ) ----------

        function getBestReleaseFromJacred(normalizedCard, cardId, callback) {
            if (!jacredUrl) {
                callback(null);
                return;
            }

            var year = '';
            var dateStr = normalizedCard.release_date || '';
            if (dateStr && dateStr.length >= 4) {
                year = dateStr.substring(0, 4);
            }

            var meta = {
                kind: normalizedCard.type === 'tv' ? 'tv' : 'movie',
                title: normalizedCard.title || '',
                title_original: normalizedCard.original_title || '',
                year: year || '',
                imdb: normalizedCard.imdb_id || null
            };

            var endpoints = [
                JACRED_PROTOCOL + jacredUrl + '/api/v2.0/indexers/all/results'
            ];

            var is_serial = meta.kind === 'tv' ? '2' : '1';
            var urls = buildUrls(endpoints, meta, null, { is_serial: is_serial, genres: "" });

            if (!urls || !urls.length) {
                callback(null);
                return;
            }

            var triedBodies = [];
            var bestStrict = null;
            var idx = 0;
            var batchSize = 6;

            function processStrictBatch() {
                if (idx >= urls.length || bestStrict === '4K') {
                    processSoftPass();
                    return;
                }

                var slice = urls.slice(idx, idx + batchSize);
                idx += batchSize;

                var promises = slice.map(function (u) {
                    return safeGetJac(u, cardId);
                });

                Promise.all(promises).then(function (results) {
                    results.forEach(function (r) {
                        if (r.ok && r.body) triedBodies.push(r);
                    });

                    for (var i = 0; i < results.length; i++) {
                        var r = results[i];
                        if (!r.ok || !r.body) continue;
                        var q = null;
                        if ((r.type || "").indexOf("application/json") !== -1) {
                            try {
                                q = pickQualityFromJacredV2Json(JSON.parse(r.body), meta, true);
                            } catch (e) {}
                        }
                        if (!q) q = pickQualityFromHtml(r.body, meta, true);
                        bestStrict = chooseBetterQuality(bestStrict, q);
                        if (bestStrict === '4K') break;
                    }

                    if (bestStrict === '4K' || idx >= urls.length) {
                        processSoftPass();
                    } else {
                        processStrictBatch();
                    }
                }).catch(function () {
                    processSoftPass();
                });
            }

            function processSoftPass() {
                var best = bestStrict;
                if (!triedBodies.length) {
                    finish(best);
                    return;
                }

                for (var i = 0; i < triedBodies.length; i++) {
                    var r = triedBodies[i];
                    var q = null;
                    if ((r.type || "").indexOf("application/json") !== -1) {
                        try {
                            q = pickQualityFromJacredV2Json(JSON.parse(r.body), meta, false);
                        } catch (e) {}
                    }
                    if (!q) q = pickQualityFromHtml(r.body, meta, false);
                    best = chooseBetterQuality(best, q);
                    if (best === '4K') break;
                }

                finish(best);
            }

            function finish(quality) {
                if (!quality) {
                    callback(null);
                    return;
                }
                callback({
                    quality: quality,
                    title: meta.title || meta.title_original || '',
                    isCamrip: (quality === 'CAMRip' || quality === 'TS')
                });
            }

            processStrictBatch();
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
        // 2) КАЧЕСТВО НА МИНИ-КАРТОЧКАХ
        // ==================================================

        var cardDataStorage = new WeakMap();

        function getCardDataFromElement(cardElement) {
            try {
                if (cardDataStorage.has(cardElement)) {
                    return cardDataStorage.get(cardElement);
                }

                var tmdbId = null;
                var cardId = cardElement.getAttribute('data-id') ||
                    cardElement.getAttribute('id');

                if (!cardId) {
                    var parent = cardElement.parentElement;
                    while (parent && !cardId) {
                        cardId = parent.getAttribute('data-id') ||
                            parent.getAttribute('data-movie-id') ||
                            parent.getAttribute('data-tmdb-id') ||
                            parent.getAttribute('data-tv-id');
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
                        cardElement.getAttribute('data-name') || '';
                }

                var originalTitleElement = cardElement.querySelector('.card__original-title, .original-title, .card__original-name, .original-name');
                var originalTitle = originalTitleElement ? originalTitleElement.textContent.trim() : '';
                if (!originalTitle) {
                    originalTitle = cardElement.getAttribute('data-original-title') ||
                        cardElement.getAttribute('data-original-name') || '';
                }

                var isTv = cardElement.classList.contains('card--tv') ||
                    cardElement.classList.contains('tv') ||
                    cardElement.querySelector('.card__type') ||
                    cardElement.querySelector('[data-type="tv"]') ||
                    cardElement.getAttribute('data-type') === 'tv';

                var year = cardElement.getAttribute('data-year') ||
                    cardElement.getAttribute('data-release-year') ||
                    cardElement.getAttribute('data-first-air-date') ||
                    cardElement.getAttribute('data-release-date') || '';

                if (!year) {
                    var yearElement = cardElement.querySelector('.card__year, .year, .card__date, .date');
                    if (yearElement) {
                        var yearText = yearElement.textContent.trim();
                        var yearMatch = yearText.match(/(\d{4})/);
                        if (yearMatch) year = yearMatch[1];
                    }
                }

                var cardData = {
                    id: cardId,
                    tmdb_id: tmdbId,
                    title: title,
                    original_title: originalTitle,
                    type: isTv ? 'tv' : 'movie',
                    release_date: year
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

        // >>> НОВАЯ addQualityToMiniCard С ИСПОЛЬЗОВАНИЕМ setJacredBadge <<<
        function addQualityToMiniCard(cardElement, cardData) {
            if (!cardData || !cardData.title) return;
            if (!isJacredEnabled()) return;

            // Находим "слот" карточки, как в примере
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
                // плейсхолдер "…" пока ждём ответ
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
                        // если ничего нет — просто убираем наш «…»
                        var $holder = $slot.find('.card__quality');
                        $holder.each(function () {
                            var $h = $(this);
                            if ($h.find('.jacq-qtext').length) $h.remove();
                        });
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

            // 3) Ни одного API нет — молча выходим
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
