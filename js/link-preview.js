/*!
 * link-preview.js — 音樂平臺連結懸浮卡片
 *
 * 由 layout/_partial/after-footer.ejs 於 theme.link_preview.enable 時載入，
 * 設定由同一頁輸出的 window.LINK_PREVIEW 提供。
 *
 * 設計要點
 * - 事件委派（document 層）：加密文章解密後才注入的連結一樣有效（沿用 post-links.js 慣例）
 * - 只認 .article-entry 內、且 host 命中支援平臺的連結
 * - hover-intent（預設 250ms）：滑過不停留不觸發
 * - 資料來自同源靜態檔（建置期由 tools/lp-fetch.mjs 產生），首次 hover 才 lazy 載入
 * - 取不到資料時退回「品牌卡」（favicon 概念：平臺色塊 + 網域 + 連結文字），零網路請求
 * - 官方 iframe 播放器只在按「▶ 預覽」時才載入，避免 hover 就下載大量 iframe
 * - 卡片為單例，靠近視窗邊緣會自動翻轉
 */
(function () {
  'use strict';

  var cfg = window.LINK_PREVIEW;
  if (!cfg || cfg.enable === false) return;

  var DATA_URL = cfg.data_url || '/link-preview.json';
  var TRACKS_URL = cfg.tracks_url || '/link-preview-tracks.json';
  var DELAY = typeof cfg.delay === 'number' ? cfg.delay : 250;
  var MAX_TRACKS = typeof cfg.max_tracks === 'number' && cfg.max_tracks > 0 ? cfg.max_tracks : 12;
  var ALLOW_EMBED = cfg.embed !== false;
  var FALLBACK = cfg.fallback !== false;
  var TOUCH = cfg.touch === true;
  var SCOPE = cfg.scope || '.article-entry';
  var PREFETCH = cfg.prefetch !== false;

  /* ------------------------------------------------------------ 平臺表 */

  var PLATFORMS = [
    { suffix: 'mora.jp', key: 'mora', name: 'mora', color: '#e60028' },
    { suffix: 'ototoy.jp', key: 'ototoy', name: 'OTOTOY', color: '#0a9fe0' },
    { suffix: 'recochoku.jp', key: 'recochoku', name: 'レコチョク', color: '#00a5e3' },
    { suffix: 'shop.columbia.jp', key: 'columbia', name: 'Columbia Music Shop', color: '#1c2a8a' },
    { suffix: 'shop.asobistore.jp', key: 'asobistore', name: 'ASOBI STORE', color: '#e5007f' },
    { suffix: 'itunes.apple.com', key: 'apple', name: 'iTunes Store', color: '#fa243c' },
    { suffix: 'music.apple.com', key: 'apple', name: 'Apple Music', color: '#fa243c' },
    { suffix: 'apps.apple.com', key: 'apple-app', name: 'App Store', color: '#0d84ff' },
    { suffix: 'qobuz.com', key: 'qobuz', name: 'Qobuz', color: '#1b3a6b' },
    { suffix: 'open.spotify.com', key: 'spotify', name: 'Spotify', color: '#1db954' },
    { suffix: 'music.youtube.com', key: 'ytmusic', name: 'YouTube Music', color: '#ff0000' },
    { suffix: 'music.amazon.co.jp', key: 'amazon', name: 'Amazon Music', color: '#25d1da' },
    { suffix: 'music.amazon.com', key: 'amazon', name: 'Amazon Music', color: '#25d1da' },
    { suffix: 'amazon.co.jp', key: 'amazon-jp', name: 'Amazon.co.jp', color: '#ff9900' },
    { suffix: 'animate-onlineshop.jp', key: 'animate', name: 'アニメイト', color: '#e4002b' },
    { suffix: 'cystore.com', key: 'cystore', name: 'CyStore', color: '#1f6fb2' },
    { suffix: 'hmv.co.jp', key: 'hmv', name: 'HMV&BOOKS online', color: '#e60012' },
    // 遊戲／數位軟體商店（順序要緊：先具體、後通用，否則 store-jp.nintendo.com 會被 nintendo.com 吃掉）
    { suffix: 'store-jp.nintendo.com', key: 'nintendo-jp', name: 'Nintendo Store', color: '#e60012' },
    { suffix: 'store.nintendo.com.hk', key: 'nintendo-hk', name: 'Nintendo Store HK', color: '#e60012' },
    { suffix: 'ec.nintendo.com', key: 'nintendo-hk', name: 'Nintendo eShop', color: '#e60012' },
    { suffix: 'nintendo.com', key: 'nintendo-us', name: 'Nintendo Store', color: '#e60012' },
    { suffix: 'store.playstation.com', key: 'psn', name: 'PlayStation Store', color: '#0070d1' },
    { suffix: 'store.steampowered.com', key: 'steam', name: 'Steam', color: '#66c0f4' },
    { suffix: 's.team', key: 'steam', name: 'Steam', color: '#66c0f4' },
    { suffix: 'xbox.com', key: 'xbox', name: 'Xbox', color: '#107c10' },
    { suffix: 'play.google.com', key: 'gplay', name: 'Google Play', color: '#01875f' }
  ];

  /* itunes.apple.com 上的 App Store 連結（/jp/app/…）要用 App Store 的身分顯示 */
  var APPLE_APP = { suffix: 'apps.apple.com', key: 'apple-app', name: 'App Store', color: '#0d84ff' };

  /* 正規化 key 時保留的 query 參數（YouTube Music 的 list、CyStore 的 pid、Google Play 的 id） */
  var KEY_PARAMS = ['list', 'pid', 'id'];

  /* 官方 iframe 尺寸（MVP：apple / ototoy；其餘留給第二期） */
  var EMBED_SIZE = {
    apple: { w: 660, h: 450 },
    ototoy: { w: 620, h: 360 },
    qobuz: { w: 450, h: 560 },
    amazon: { w: 500, h: 352 },
    spotify: { w: 400, h: 352 },
    ytmusic: { w: 480, h: 270 },
    steam: { w: 646, h: 190 }
  };

  /* 官方嵌入的按鈕文案：播放器類 → 試聽；商店 widget（Steam）→ 商店預覽 */
  var EMBED_LABEL = {
    steam: '\u25B6 \u5546\u5E97\u9810\u89BD'
  };
  var EMBED_LABEL_DEFAULT = '\u25B6 \u8A66\u8074';

  function platformOf(host, path) {
    for (var i = 0; i < PLATFORMS.length; i++) {
      var s = PLATFORMS[i].suffix;
      if (host === s || host.slice(-(s.length + 1)) === '.' + s) {
        var p = PLATFORMS[i];
        // itunes.apple.com 同時有音樂與 App Store，靠路徑區分
        if (p.key === 'apple' && path && /\/app\//.test(path)) return APPLE_APP;
        return p;
      }
    }
    return null;
  }

  /* 舊格式 PS Store 連結（#!/…cid=<id>）→ 現代商品網址。規則必須與 tools/lp-fetch.mjs 完全一致。 */
  function psnCanonical(u) {
    if (u.hostname.toLowerCase() !== 'store.playstation.com') return null;
    var h = '';
    try {
      h = decodeURIComponent(u.hash || '');
    } catch (e) {
      h = u.hash || '';
    }
    if (!h) return null;
    var m = h.match(/[?&/]cid=([A-Za-z0-9_-]{4,})/);
    if (!m) return null;
    var lm = h.match(/^#!?\/?([a-z]{2}(?:-[a-z0-9]+)+)\//i) || h.match(/\/([a-z]{2}(?:-[a-z0-9]+)+)\//i);
    var locale = lm ? lm[1].toLowerCase() : 'ja-jp';
    return 'https://store.playstation.com/' + locale + '/product/' + m[1];
  }

  function normalize(href) {
    var u;
    try {
      u = new URL(href, window.location.href);
    } catch (e) {
      return null;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    var canon = psnCanonical(u);
    if (canon) {
      try {
        u = new URL(canon);
      } catch (e) {
        return null;
      }
    }
    var host = u.hostname.toLowerCase();
    var p = u.pathname.replace(/\/+$/, '');
    if (!p) p = '/';
    var params = [];
    for (var i = 0; i < KEY_PARAMS.length; i++) {
      var v = u.searchParams.get(KEY_PARAMS[i]);
      if (v) params.push(KEY_PARAMS[i] + '=' + v);
    }
    return {
      key: host + p + (params.length ? '?' + params.join('&') : ''),
      host: host,
      platform: platformOf(host, p),
      url: u.href
    };
  }

  /* ------------------------------------------------------------ 資料載入 */

  var dataPromise = null;
  function loadData() {
    if (dataPromise) return dataPromise;
    dataPromise = fetch(DATA_URL, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.entries) || {}; })
      .catch(function () { return {}; });
    return dataPromise;
  }

  var tracksPromise = null;
  function loadTracks() {
    if (tracksPromise) return tracksPromise;
    tracksPromise = fetch(TRACKS_URL, { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { return (j && j.tracks) || {}; })
      .catch(function () { return {}; });
    return tracksPromise;
  }

  /* --------------------------------------------------------------- 工具 */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* 0 小數位的幣別（不要顯示 .00） */
  var ZERO_DECIMAL = { JPY: 1, TWD: 1, KRW: 1, VND: 1, CLP: 1, ISK: 1 };

  /* 金額格式化（依幣別決定小數位與符號） */
  function yen(price) {
    if (!price || !price.amount) return '';
    var n = Number(price.amount);
    if (!isFinite(n)) return '';
    var cur = price.currency || 'JPY';
    var d = ZERO_DECIMAL[cur] ? 0 : 2;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: cur,
        minimumFractionDigits: d,
        maximumFractionDigits: d
      }).format(n);
    } catch (e) {
      return cur + ' ' + n.toLocaleString('en-US');
    }
  }

  /* ------------------------------------------------------------ 卡片 DOM */

  var card, chipDot, platName, typeBadge, tagWrap, qualityEl, priceEl;
  var bodyEl, coverBox, coverImg, titleEl, artistEl, metaEl, pricesWrap, noteEl;
  var tracksWrap, tracksToggle, trackList, tracksEmpty;
  var embedWrap;
  var openLink, embedBtn;
  var shown = false;
  var currentLink = null;
  var currentKey = null;

  function ensureCard() {
    if (card) return;
    card = el('div', 'lp-card');
    card.id = 'lp-card';
    card.setAttribute('role', 'tooltip');
    card.setAttribute('aria-hidden', 'true');

    var head = el('div', 'lp-head');
    var chip = el('span', 'lp-chip');
    chipDot = el('i', 'lp-dot');
    platName = el('span', 'lp-plat');
    chip.appendChild(chipDot);
    chip.appendChild(platName);
    var badges = el('span', 'lp-badges');
    typeBadge = el('span', 'lp-type');
    tagWrap = el('span', 'lp-tags');
    tagWrap.hidden = true;
    qualityEl = el('span', 'lp-quality');
    qualityEl.hidden = true;
    priceEl = el('span', 'lp-price');
    badges.appendChild(typeBadge);
    badges.appendChild(tagWrap);
    badges.appendChild(qualityEl);
    badges.appendChild(priceEl);
    head.appendChild(chip);
    head.appendChild(badges);

    bodyEl = el('div', 'lp-body');
    coverBox = el('div', 'lp-cover');
    coverImg = el('img');
    coverImg.alt = '';
    coverImg.referrerPolicy = 'no-referrer';
    coverBox.appendChild(coverImg);
    var info = el('div', 'lp-info');
    titleEl = el('div', 'lp-title');
    artistEl = el('div', 'lp-artist');
    metaEl = el('div', 'lp-meta');
    pricesWrap = el('div', 'lp-prices');
    pricesWrap.hidden = true;
    noteEl = el('div', 'lp-note');
    noteEl.hidden = true;
    info.appendChild(titleEl);
    info.appendChild(artistEl);
    info.appendChild(metaEl);
    info.appendChild(pricesWrap);
    info.appendChild(noteEl);
    bodyEl.appendChild(coverBox);
    bodyEl.appendChild(info);

    tracksWrap = el('div', 'lp-tracks');
    tracksWrap.hidden = true;
    tracksToggle = el('button', 'lp-tracks-toggle');
    tracksToggle.type = 'button';
    tracksToggle.setAttribute('aria-expanded', 'false');
    trackList = el('ol', 'lp-track-list');
    tracksEmpty = el('div', 'lp-tracks-empty', '此平臺未提供曲目清單');
    tracksEmpty.hidden = true;
    tracksWrap.appendChild(tracksToggle);
    tracksWrap.appendChild(trackList);
    tracksWrap.appendChild(tracksEmpty);

    embedWrap = el('div', 'lp-embed');
    embedWrap.hidden = true;

    var foot = el('div', 'lp-foot');
    openLink = el('a', 'lp-open');
    openLink.target = '_blank';
    openLink.rel = 'noopener';
    embedBtn = el('button', 'lp-embed-btn', '\u25B6 \u8A66\u8074');
    embedBtn.type = 'button';
    embedBtn.hidden = true;
    foot.appendChild(openLink);
    foot.appendChild(embedBtn);

    card.appendChild(head);
    card.appendChild(bodyEl);
    card.appendChild(tracksWrap);
    card.appendChild(embedWrap);
    card.appendChild(foot);
    document.body.appendChild(card);

    embedBtn.addEventListener('click', onEmbedClick);
    tracksToggle.addEventListener('click', onTracksToggle);
    card.addEventListener('mouseenter', cancelHide);
    card.addEventListener('mouseleave', scheduleHide);
  }

  function resetCard() {
    card.classList.remove('lp-brand', 'lp-embedding');
    bodyEl.hidden = false;
    tracksWrap.hidden = true;
    tracksToggle.hidden = false;
    trackList.hidden = false;
    tracksEmpty.hidden = true;
    embedWrap.hidden = true;
    embedWrap.innerHTML = '';
    trackList.innerHTML = '';
    tracksToggle.setAttribute('aria-expanded', 'false');
    embedBtn.hidden = true;
    coverImg.removeAttribute('src');
    coverBox.hidden = false;
    priceEl.textContent = '';
    priceEl.hidden = true;
    typeBadge.hidden = true;
    tagWrap.hidden = true;
    tagWrap.innerHTML = '';
    qualityEl.hidden = true;
    qualityEl.className = 'lp-quality';
    qualityEl.removeAttribute('title');
    noteEl.hidden = true;
    noteEl.textContent = '';
    pricesWrap.hidden = true;
    pricesWrap.innerHTML = '';
  }

  /* ------------------------------------------------------------- 渲染 */

  /** 價格（有折扣時：-N% ＋ 現價 ＋ 刪除線原價）。 */
  function renderPrice(price) {
    priceEl.textContent = '';
    if (!price || !price.amount) {
      priceEl.hidden = true;
      return;
    }
    priceEl.hidden = false;
    var now = Number(price.amount);
    var was = Number(price.original);
    if (was > now && now > 0) {
      var pct = Number(price.discount);
      if (!(pct > 0)) pct = Math.round((1 - now / was) * 100);
      if (pct > 0) priceEl.appendChild(el('span', 'lp-disc', '-' + pct + '%'));
      priceEl.appendChild(el('span', 'lp-now', yen(price)));
      priceEl.appendChild(el('s', 'lp-was', yen({ amount: was, currency: price.currency })));
    } else {
      priceEl.appendChild(document.createTextNode(yen(price)));
    }
    if (price.note) priceEl.appendChild(document.createTextNode(' · ' + price.note));
  }

  /* 各地區價格（Steam 可設定多個 cc）→ 一排小 chips；只有一個地區時不顯示 */
  function renderPrices(entry) {
    pricesWrap.innerHTML = '';
    var list = entry.prices || [];
    if (list.length < 2) {
      pricesWrap.hidden = true;
      return;
    }
    pricesWrap.hidden = false;
    pricesWrap.appendChild(el('span', 'lp-prices-label', '\u5404\u5340\u50F9\u683C')); // 各區價格
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var chip = el('span', 'lp-price-item');
      if (p.region) chip.appendChild(el('span', 'lp-price-region', p.region));
      chip.appendChild(el('span', 'lp-price-amt', yen(p)));
      var was = Number(p.original);
      if (was > Number(p.amount)) {
        var pct = Number(p.discount) > 0
          ? Number(p.discount)
          : Math.round((1 - Number(p.amount) / was) * 100);
        if (pct > 0) chip.appendChild(el('span', 'lp-price-off', '-' + pct + '%'));
        chip.title = '原價 ' + yen({ amount: was, currency: p.currency });
      }
      pricesWrap.appendChild(chip);
    }
  }

  function renderRich(entry, key, link) {
    var plat = (normalize(link.href) || {}).platform;
    resetCard();
    currentKey = key;

    if (plat) {
      chipDot.style.background = plat.color;
      platName.textContent = plat.name;
    }
    var kind = entry.kind || 'music';
    var isGoods = kind === 'goods';
    var isGame = kind === 'game';
    var flat = isGoods || isGame; // 商品／遊戲：不顯示音質，也不顯示曲目區塊
    typeBadge.hidden = false;
    typeBadge.textContent = isGame ? '遊戲' : isGoods ? '商品'
      : (entry.type === 'stream' ? '串流' : '購買');
    typeBadge.className = 'lp-type ' +
      (isGame ? 'lp-type-game'
        : isGoods ? 'lp-type-goods'
        : (entry.type === 'stream' ? 'lp-type-stream' : 'lp-type-purchase'));

    // 遊戲平臺標籤（Switch 2 / PS5 / Windows…）
    var plats = (entry.platforms || []).filter(Boolean).slice(0, 4);
    if (plats.length) {
      tagWrap.hidden = false;
      for (var pi = 0; pi < plats.length; pi++) {
        tagWrap.appendChild(el('span', 'lp-tag', String(plats[pi])));
      }
    }

    // 專輯層級音質標籤（平臺有提供才顯示；商品／遊戲不顯示）
    if (!flat && entry.quality && entry.quality.label) {
      qualityEl.hidden = false;
      qualityEl.textContent = entry.quality.label;
      qualityEl.className = 'lp-quality lp-q-' + (entry.quality.kind || 'unknown');
      if (entry.quality.detail) qualityEl.setAttribute('title', entry.quality.detail);
    }

    renderPrice(entry.price);
    renderPrices(entry);

    if (entry.cover) {
      coverBox.hidden = false;
      coverImg.classList.remove('lp-img-on');
      coverImg.onload = function () { coverImg.classList.add('lp-img-on'); };
      coverImg.src = entry.cover;
      // 快取命中時 onload 可能不會再觸發
      if (coverImg.complete && coverImg.naturalWidth > 0) coverImg.classList.add('lp-img-on');
    } else {
      coverBox.hidden = true;
    }

    titleEl.textContent = entry.title || '';
    artistEl.textContent = entry.artist || '';
    artistEl.hidden = !entry.artist;
    var metaBits = [];
    if (entry.releaseDate) metaBits.push(entry.releaseDate);
    if (entry.category) metaBits.push(entry.category);
    if (entry.quality && entry.quality.detail) metaBits.push(entry.quality.detail);
    if (entry.spec) metaBits.push(entry.spec);
    metaEl.textContent = metaBits.join(' · ');
    metaEl.hidden = metaBits.length === 0;

    // 已下架／抓不到：內容保留，加一行小字提示（若來自 Wayback 快照則標明來源）
    if (entry.archive) {
      var ts = String(entry.archive.timestamp || '');
      var snapDate = ts.length >= 8
        ? ts.slice(0, 4) + '-' + ts.slice(4, 6) + '-' + ts.slice(6, 8)
        : '';
      noteEl.hidden = false;
      noteEl.textContent = '\u26A0 商店已下架／無法取得，以下資料來自 Web Archive 快照' +
        (snapDate ? '（' + snapDate + '）' : '');
      if (/^https:\/\/web\.archive\.org\//.test(entry.archive.url || '')) {
        var alink = el('a', 'lp-note-link', '查看快照');
        alink.href = entry.archive.url;
        alink.target = '_blank';
        alink.rel = 'noopener';
        noteEl.appendChild(document.createTextNode(' '));
        noteEl.appendChild(alink);
      }
    } else if (entry.unavailable) {
      var when = entry.fetchedAt ? String(entry.fetchedAt).slice(0, 10) : '';
      noteEl.hidden = false;
      noteEl.textContent = '\u26A0 此商品可能已下架／已停止販售' +
        (when ? '（以下為 ' + when + ' 取得的資料）' : '');
    }

    if (entry.trackCount > 0) {
      tracksWrap.hidden = false;
      tracksToggle.hidden = false;
      trackList.hidden = false;
      tracksEmpty.hidden = true;
      tracksToggle.textContent = '曲目清單（' + entry.trackCount + '）';
      tracksToggle.setAttribute('data-label', tracksToggle.textContent);
    } else if (!flat) {
      // 沒有曲目資料（多數 EC 平臺不提供）→ 顯示一行說明，不留空白
      tracksWrap.hidden = false;
      tracksToggle.hidden = true;
      trackList.hidden = true;
      tracksEmpty.hidden = false;
      tracksEmpty.textContent = entry.type === 'stream'
        ? '此平臺未提供曲目清單'
        : '此平臺未提供曲目清單（可點「前往連結」查看）';
    }

    openLink.href = entry.url || link.href;
    openLink.textContent = '前往連結 \u2197';

    if (ALLOW_EMBED && entry.embed) {
      embedBtn.hidden = false;
      embedBtn.textContent = EMBED_LABEL[entry.platform] || EMBED_LABEL_DEFAULT;
      embedBtn.title = '\u8F09\u5165\u5B98\u65B9\u5D4C\u5165\u5167\u5BB9'; // 載入官方嵌入內容
    }
  }

  function renderBrand(info, link, entry) {
    resetCard();
    currentKey = null;
    card.classList.add('lp-brand');
    chipDot.style.background = info.platform.color;
    platName.textContent = info.platform.name;
    coverBox.hidden = true;
    var text = (link.getAttribute('title') || link.textContent || '').replace(/\s+/g, ' ').trim();
    titleEl.textContent = text || info.host;
    artistEl.textContent = info.host;
    artistEl.hidden = false;
    metaEl.textContent = entry && entry.dead
      ? '（連結已失效，且查無存檔可補）'
      : '（未取得商品資料，可能已下架或未支援）';
    metaEl.hidden = false;
    openLink.href = link.href;
    openLink.textContent = '前往 ' + info.host + ' \u2197';
  }

  function trackRow(t) {
    var li = el('li', 'lp-track');
    li.appendChild(el('span', 'lp-track-no', String(t.no || '').padStart(2, '0')));
    var ttl = el('span', 'lp-track-title', t.title || '');
    if (t.artist) ttl.title = t.artist;
    li.appendChild(ttl);
    li.appendChild(el('span', 'lp-track-dur', t.duration || ''));
    li.appendChild(el('span', 'lp-track-price', t.price ? '\u00A5' + Number(t.price).toLocaleString('ja-JP') : ''));
    return li;
  }

  function renderTracks(list, multiDisc) {
    trackList.innerHTML = '';
    var cap = Math.min(list.length, 300); // DOM 安全上限
    var lastDisc = null;
    for (var i = 0; i < cap; i++) {
      var t = list[i];
      // 多碟專輯（Amazon 曲目リスト）→ 每張碟一個小標題，曲號各碟重新起算
      if (multiDisc && t && t.disc && t.disc !== lastDisc) {
        lastDisc = t.disc;
        trackList.appendChild(el('li', 'lp-track-disc', 'Disc ' + t.disc));
      }
      trackList.appendChild(trackRow(t));
    }
    if (list.length > cap) {
      trackList.appendChild(el('li', 'lp-track lp-track-loading', '（僅顯示前 ' + cap + ' 首）'));
    }
  }

  function onTracksToggle() {
    var expanded = tracksToggle.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      tracksToggle.setAttribute('aria-expanded', 'false');
      trackList.innerHTML = '';
      tracksToggle.textContent = tracksToggle.getAttribute('data-label') || '曲目清單';
      return;
    }
    tracksToggle.setAttribute('aria-expanded', 'true');
    tracksToggle.textContent = '收合曲目清單';
    trackList.innerHTML = '<li class="lp-track lp-track-loading">載入中…</li>';
    loadTracks().then(function (map) {
      var list = (currentKey && map[currentKey]) || [];
      if (!list.length) {
        trackList.innerHTML = '<li class="lp-track lp-track-loading">（無曲目資料）</li>';
        return;
      }
      // 多碟專輯（Amazon 曲目リスト）→ 顯示「碟-曲」編號；要用「完整清單」判斷，不能用前 N 首
      var multiDisc = list.some(function (t) { return t && t.disc > 1; });
      var shown = MAX_TRACKS > 0 ? MAX_TRACKS : list.length;
      renderTracks(list.slice(0, shown), multiDisc);
      if (list.length > shown) {
        var li = el('li', 'lp-track lp-track-more');
        var btn = el('button', 'lp-track-more-btn', '還有 ' + (list.length - shown) + ' 首，點此展開');
        btn.type = 'button';
        btn.addEventListener('click', function () {
          renderTracks(list, multiDisc);
          position(currentLink);
        });
        li.appendChild(btn);
        trackList.appendChild(li);
      }
      position(currentLink);
    });
  }

  function onEmbedClick() {
    loadData().then(function (entries) {
      var entry = currentKey ? entries[currentKey] : null;
      if (!entry || !entry.embed) return;
      var size = EMBED_SIZE[entry.platform] || { w: 500, h: 360 };
      var f = document.createElement('iframe');
      f.className = 'lp-iframe';
      f.src = entry.embed;
      f.loading = 'lazy';
      f.setAttribute('frameborder', '0');
      f.setAttribute('allow', 'autoplay *; encrypted-media *; fullscreen *; picture-in-picture');
      f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      f.setAttribute('title', entry.title || '播放器');
      f.style.height = size.h + 'px';
      embedWrap.innerHTML = '';
      embedWrap.appendChild(f);
      card.classList.add('lp-embedding');
      card.style.width = size.w + 'px';
      bodyEl.hidden = true;
      tracksWrap.hidden = true;
      embedWrap.hidden = false;
      position(currentLink);
    });
  }

  /* ------------------------------------------------------------- 定位 */

  function position(anchor) {
    if (!anchor || !card) return;
    var r = anchor.getBoundingClientRect();
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var margin = 10;
    var cw = card.offsetWidth;
    var ch = card.offsetHeight;
    var left = r.left;
    if (left + cw > vw - margin) left = vw - margin - cw;
    if (left < margin) left = margin;
    var top = r.bottom + 8;
    if (top + ch > vh - margin) {
      var above = r.top - 8 - ch;
      top = above >= margin ? above : Math.max(margin, vh - margin - ch);
    }
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
    card.setAttribute('data-placement', top < r.top ? 'top' : 'bottom');
  }

  /* ------------------------------------------------------------- 顯示 */

  var showTimer = null;
  var hideTimer = null;

  function cancelHide() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  }

  function schedule(link) {
    cancelHide();
    if (showTimer) clearTimeout(showTimer);
    showTimer = setTimeout(function () { show(link); }, DELAY);
  }

  function scheduleHide() {
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    cancelHide();
    hideTimer = setTimeout(hide, 140);
  }

  function show(link) {
    var info = normalize(link.href);
    if (!info || !info.platform) return;
    currentLink = link;
    ensureCard();
    loadData().then(function (entries) {
      if (currentLink !== link) return;
      var entry = entries[info.key];
      if (entry && !entry.error && (entry.title || entry.cover)) {
        renderRich(entry, info.key, link);
      } else if (FALLBACK) {
        renderBrand(info, link, entry);
      } else {
        return;
      }
      card.setAttribute('aria-hidden', 'false');
      card.classList.add('on');
      shown = true;
      position(link);
      link.setAttribute('aria-describedby', 'lp-card');
    });
  }

  function hide() {
    if (!shown || !card) return;
    shown = false;
    card.classList.remove('on');
    card.setAttribute('aria-hidden', 'true');
    card.style.width = '';
    if (currentLink && currentLink.removeAttribute) currentLink.removeAttribute('aria-describedby');
    currentLink = null;
  }

  /* ------------------------------------------------------------- 事件 */

  function linkFrom(node) {
    if (!node || node.nodeType !== 1 || !node.closest) return null;
    var a = node.closest('a[href]');
    if (!a) return null;
    if (a.closest('.lp-card')) return null;
    if (a.classList.contains('fancybox')) return null;
    if (!a.closest(SCOPE)) return null;
    return a;
  }

  function onMouseOver(e) {
    var t = e.target;
    if (t && t.closest && t.closest('.lp-card')) { cancelHide(); return; }
    var a = linkFrom(t);
    if (!a) return;
    if (a === currentLink && shown) { cancelHide(); return; }
    schedule(a);
  }

  function onMouseOut(e) {
    var to = e.relatedTarget;
    if (to && to.closest && to.closest('.lp-card')) return;
    if (currentLink && to && currentLink.contains(to)) return;
    scheduleHide();
  }

  function onFocusIn(e) {
    var a = linkFrom(e.target);
    if (a) show(a);
  }

  function onFocusOut(e) {
    var to = e.relatedTarget;
    if (to && to.closest && to.closest('.lp-card')) return;
    if (card && card.contains(to)) return;
    scheduleHide();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape' && shown) { hide(); }
  }

  function onDocClick(e) {
    if (!shown) return;
    if (e.target.closest && e.target.closest('.lp-card')) return;
    if (e.target.closest && e.target.closest('a')) return; // 點連結本身放行
    hide();
  }

  document.addEventListener('mouseover', onMouseOver, false);
  document.addEventListener('mouseout', onMouseOut, false);
  document.addEventListener('focusin', onFocusIn, false);
  document.addEventListener('focusout', onFocusOut, false);
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('click', onDocClick, true);
  // 只關「頁面捲動」；卡片內部（曲目清單）自己的捲動不能關掉卡片
  window.addEventListener('scroll', function (e) {
    if (!shown) return;
    var t = e.target;
    if (t && t !== document && t.closest && t.closest('.lp-card')) return;
    hide();
  }, true);
  window.addEventListener('resize', function () { if (shown) hide(); });

  /* 觸控：長按 480ms 顯示卡片，並抑制隨後的 click（預設關閉，可用 touch: true 開啟） */
  if (TOUCH) {
    var pressTimer = null;
    var suppressClick = false;
    document.addEventListener('touchstart', function (e) {
      var a = linkFrom(e.target);
      if (!a) return;
      pressTimer = setTimeout(function () {
        suppressClick = true;
        show(a);
      }, 480);
    }, { passive: true });
    ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
      document.addEventListener(ev, function () { if (pressTimer) clearTimeout(pressTimer); }, { passive: true });
    });
    document.addEventListener('click', function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; }
    }, true);
  }

  /* 閒置預抓資料（首次 hover 就能立即顯示） */
  if (PREFETCH) {
    var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 1200); };
    idle(function () { loadData(); });
  }

  document.documentElement.classList.add('link-preview-ready');
})();
