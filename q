// ВКЛ/ВЫКЛ показа качества
function applyMovieQuality() {
    var movieQuality = Lampa.Storage.get('movie_quality', 'on');
    var movieQualityEnabled = CONFIG.FEATURES.JACRED_INTEGRATION && movieQuality === 'on';

    if (!movieQualityEnabled) {
        Lampa.Storage.set('jacred_quality_cache', {});
        return;
    }

    var jacredUrl = Lampa.Storage.get('jacred_url', 'jacred.xyz');
    if (!jacredUrl) {
        if (Lampa.Noty) {
            Lampa.Noty.show('JacRed URL не указан');
        }
        return;
    }

    if (window.movieQualitySystemInitialized) return;
    window.movieQualitySystemInitialized = true;

    initMovieQualitySystem(jacredUrl);
}

// ОСНОВНАЯ СИСТЕМА КАЧЕСТВА
function initMovieQualitySystem(jacredUrl) {
    var Q_CACHE_TIME = 72 * 60 * 60 * 1000;
    var QUALITY_CACHE = 'jacred_quality_cache';
    var JACRED_PROTOCOL = 'https://';
    var PROXY_LIST = [
        'http://api.allorigins.win/raw?url=',
        'http://cors.bwa.workers.dev/'
    ];
    var PROXY_TIMEOUT = 5000;

    // Полифилл AbortController, если нет
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

    // Запрос с прямым доступом + прокси
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

    // Анализ качества одного торрента
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

    // Запрос к JacRed и выбор лучшего релиза
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

    // КЭШ КАЧЕСТВА
    function getQualityCache(key) {
        var cache = Lampa.Storage.get(QUALITY_CACHE) || {};
        var item = cache[key];
        return item && (Date.now() - item.timestamp < Q_CACHE_TIME) ? item : null;
    }

    function saveQualityCache(key, data) {
        var cache = Lampa.Storage.get(QUALITY_CACHE) || {};

        for (var cacheKey in cache) {
            if (cache.hasOwnProperty(cacheKey)) {
                if (Date.now() - cache[cacheKey].timestamp >= Q_CACHE_TIME) {
                    delete cache[cacheKey];
                }
            }
        }

        cache[key] = {
            quality: data.quality || null,
            isCamrip: data.isCamrip || false,
            timestamp: Date.now()
        };

        Lampa.Storage.set(QUALITY_CACHE, cache);
    }

    // ===== ФУЛЛ-КАРТОЧКА =====

    function clearQualityElements(render) {
        if (render) {
            $('.full-start__status.surs_quality', render).remove();
        }
    }

    function showQualityPlaceholder(render) {
        if (!render) return;
        var rateLine = $('.full-start-new__rate-line', render);
        if (!rateLine.length) return;

        if (!$('.full-start__status.surs_quality', render).length) {
            var placeholder = document.createElement('div');
            placeholder.className = 'full-start__status surs_quality';
            placeholder.textContent = '...';
            rateLine.append(placeholder);
        }
    }

    function updateQualityElement(quality, isCamrip, render) {
        if (!render) return;

        var element = $('.full-start__status.surs_quality', render);
        var rateLine = $('.full-start-new__rate-line', render);
        if (!rateLine.length) return;

        if (element.length) {
            element.text(quality);
            if (isCamrip) {
                element.addClass('camrip');
            } else {
                element.removeClass('camrip');
            }
        } else {
            var div = document.createElement('div');
            div.className = 'full-start__status surs_quality' + (isCamrip ? ' camrip' : '');
            div.textContent = quality;
            rateLine.append(div);
        }
    }

    function fetchQualitySequentially(normalizedCard, qCacheKey, render) {
        getBestReleaseFromJacred(normalizedCard, normalizedCard.id, function (jrResult) {
            var quality = (jrResult && jrResult.quality) || null;
            var isCamrip = (jrResult && jrResult.isCamrip) || false;

            if (quality && quality !== 'NO') {
                saveQualityCache(qCacheKey, { quality: quality, isCamrip: isCamrip });
                updateQualityElement(quality, isCamrip, render);
            } else {
                clearQualityElements(render);
            }
        });
    }

    function getCardType(card) {
        var type = card.media_type || card.type;
        if (type === 'movie' || type === 'tv') return type;
        return card.name || card.original_name ? 'tv' : 'movie';
    }

    function fetchQualityForCard(card, render) {
        if (!render || !card) return;

        var normalizedCard = {
            id: card.id,
            title: card.title || card.name || '',
            original_title: card.original_title || card.original_name || '',
            type: getCardType(card),
            release_date: card.release_date || card.first_air_date || ''
        };

        var qCacheKey = normalizedCard.type + '_' + (normalizedCard.id || normalizedCard.imdb_id);
        var cacheQualityData = getQualityCache(qCacheKey);

        if (cacheQualityData) {
            updateQualityElement(cacheQualityData.quality, cacheQualityData.isCamrip, render);
        } else {
            showQualityPlaceholder(render);
            setTimeout(function () {
                fetchQualitySequentially(normalizedCard, qCacheKey, render);
            }, 100);
        }
    }

    // Слушаем открытие фулл-карточки
    Lampa.Listener.follow('full', function (e) {
        if (e.type === 'complite') {
            var render = e.object.activity.render();
            fetchQualityForCard(e.data.movie, render);
        }
    });

    // ===== КАРТОЧКИ В СПИСКАХ =====

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
                cardId = getCardIdFromLampaData(cardElement);
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

            if (!title && !cardId) return null;

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
            console.error('Ошибка при парсинге данных карточки:', e);
            return null;
        }
    }

    function getCardIdFromLampaData(cardElement) {
        try {
            if (window.Lampa && window.Lampa.Storage) {
                var cacheKeys = Object.keys(localStorage).filter(function (key) {
                    return key.includes('lampa') || key.includes('card') || key.includes('movie') || key.includes('tv');
                });

                for (var i = 0; i < cacheKeys.length; i++) {
                    try {
                        var cacheData = JSON.parse(localStorage.getItem(cacheKeys[i]));
                        if (cacheData && typeof cacheData === 'object') {
                            if (cacheData.id || cacheData.tmdb_id) {
                                return cacheData.id || cacheData.tmdb_id;
                            }
                        }
                    } catch (e2) { }
                }
            }

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
                    for (var i3 = 0; i3 < title.length; i3++) {
                        var char = title.charCodeAt(i3);
                        hash = ((hash << 5) - hash) + char;
                        hash = hash & hash;
                    }
                    var generatedId = Math.abs(hash).toString().substr(0, 8);
                    return generatedId;
                }
            }

            return null;
        } catch (e) {
            console.error('Ошибка при парсинге данных карточки:', e);
            return null;
        }
    }

    function addQualityToMiniCard(cardElement, cardData) {
        if (!cardData) return;

        var movieQualitySetting = Lampa.Storage.get('movie_quality', 'on');
        if (!CONFIG.FEATURES.JACRED_INTEGRATION || movieQualitySetting !== 'on') return;
        if (!cardData.title) return;

        // только логика, без инлайновых стилей
        var existingBadges = cardElement.querySelectorAll('.card-quality');
        if (existingBadges.length > 1) {
            existingBadges.forEach(function (el, index) {
                if (index > 0) el.remove();
            });
        }

        var qualityElement = existingBadges[0] || cardElement.querySelector('.card-quality');

        if (movieQualitySetting !== 'on') {
            if (qualityElement) qualityElement.remove();
            return;
        }

        if (!qualityElement) {
            qualityElement = document.createElement('div');
            qualityElement.className = 'card-quality';

            var posterElement = cardElement.querySelector('.card__poster, .card-poster, .poster, .card__image, .card-image');
            if (posterElement) {
                posterElement.appendChild(qualityElement);
            } else {
                cardElement.appendChild(qualityElement);
            }
        } else {
            qualityElement.textContent = '';
        }

        var qCacheKey = cardData.type + '_' + cardData.id;
        var cacheQualityData = getQualityCache(qCacheKey);

        function applyQualityElement(quality, isCamrip) {
            if (!qualityElement.isConnected) return;
            qualityElement.textContent = quality;
            if (isCamrip) {
                qualityElement.classList.add('camrip');
            } else {
                qualityElement.classList.remove('camrip');
            }
        }

        if (cacheQualityData && cacheQualityData.quality) {
            applyQualityElement(cacheQualityData.quality, cacheQualityData.isCamrip);
        } else {
            qualityElement.textContent = '...';
            getBestReleaseFromJacred(cardData, cardData.id, function (result) {
                if (!qualityElement.isConnected) return;

                if (result && result.quality && result.quality !== 'undefined' && result.quality !== '' && result.quality !== 'null') {
                    applyQualityElement(result.quality, result.isCamrip);
                    saveQualityCache(qCacheKey, {
                        quality: result.quality,
                        isCamrip: result.isCamrip
                    });
                } else {
                    qualityElement.remove();
                }
            });
        }
    }

    function processAllCards() {
        var cards = document.querySelectorAll('.card:not([data-quality-processed])');
        var batchSize = 5;
        var currentIndex = 0;

        function processBatch() {
            var endIndex = Math.min(currentIndex + batchSize, cards.length);
            for (var i = currentIndex; i < endIndex; i++) {
                var card = cards[i];
                var cardData = getCardDataFromElement(card);
                if (cardData) {
                    addQualityToMiniCard(card, cardData);
                    card.setAttribute('data-quality-processed', 'true');
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

    // Отслеживаем появление новых карточек
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

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    setTimeout(processAllCards, 100);
}

// Если нужно автозапускать после старта приложения:
if (window.Lampa) {
    Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
            applyMovieQuality();
        }
    });
}
