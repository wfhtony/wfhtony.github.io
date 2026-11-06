/*!
 * link-preview-keys.js — 百科連結的正規化（前端與 tools/encyclopedia-lib.cjs 同邏輯）
 *
 * 為什麼要單獨一支：
 *   link-preview.js 在瀏覽器端判斷「這個連結屬不屬於某個百科、快取 key 是什麼」；
 *   建置期採集器用 CJS 做同一件事。兩邊若漂移，hover 會永遠查不到資料。
 *   這裡刻意只放純函式（不碰 DOM、不發請求），讓 tests/encyclopedia-lib.test.mjs
 *   可以用 vm 載入、和 CJS 版本跑同一張 URL 表比對。
 *
 * 只認：
 *   *.wikipedia.org（含 m.、/zh-tw/、index.php?title=、?variant=）
 *   dic.pixiv.net（/a/、/en/a/）
 *   dic.nicovideo.jp（/a/、/t/a/、/id/<數字>）
 */
(function (global) {
  'use strict';

  var PIXIV_HOST = 'dic.pixiv.net';
  var NICO_HOST = 'dic.nicovideo.jp';

  var ZH_VARIANTS = {
    'zh-hans': '簡體',
    'zh-hant': '繁體',
    'zh-cn': '中國大陸',
    'zh-tw': '臺灣',
    'zh-hk': '香港',
    'zh-mo': '澳門',
    'zh-sg': '新加坡',
    'zh-my': '馬來西亞'
  };
  var LANG_LABEL = {
    zh: '中文',
    en: '英文',
    ja: '日文',
    ko: '韓文',
    fr: '法文',
    de: '德文',
    es: '西班牙文',
    it: '義大利文',
    pt: '葡萄牙文',
    ru: '俄文'
  };

  function normalizeSpace(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function decodePart(s) {
    try {
      return decodeURIComponent(String(s == null ? '' : s));
    } catch (e) {
      return String(s == null ? '' : s);
    }
  }

  function normalizeTitle(raw) {
    return normalizeSpace(decodePart(raw)).slice(0, 300);
  }

  function normalizeWikiTitle(raw) {
    return normalizeSpace(decodePart(raw).replace(/_/g, ' ')).slice(0, 300);
  }

  function parseWikiHost(hostname) {
    var labels = String(hostname || '').toLowerCase().split('.');
    if (labels.length < 3 || labels.length > 4) return '';
    if (labels[labels.length - 1] !== 'org' || labels[labels.length - 2] !== 'wikipedia') return '';
    var sub = labels.slice(0, labels.length - 2);
    if (sub.length === 2) {
      if (sub[1] !== 'm') return '';
      sub = [sub[0]];
    }
    var lang = sub[0];
    if (!lang || lang === 'www' || lang === 'm') return '';
    if (!/^[a-z][a-z0-9-]{0,14}$/.test(lang)) return '';
    return lang;
  }

  function normalizeVariant(v, lang) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    if (!s || lang !== 'zh') return '';
    if (ZH_VARIANTS[s]) return s;
    if (/^zh(?:-[a-z0-9]{2,8}){0,3}$/.test(s)) return s;
    return '';
  }

  function encodeTitlePath(title) {
    return encodeURIComponent(String(title == null ? '' : title));
  }

  function buildWikipediaUrl(ref) {
    var lang = String((ref && ref.lang) || 'zh').toLowerCase();
    var title = String((ref && ref.title) || '').replace(/ /g, '_');
    var variant = normalizeVariant(ref && ref.variant, lang);
    return 'https://' + lang + '.wikipedia.org/' + (variant ? variant + '/' : 'wiki/') + encodeTitlePath(title);
  }

  function buildPixivUrl(ref) {
    var lang = ref && ref.lang === 'en' ? 'en' : 'ja';
    var title = normalizeSpace(ref && ref.title);
    return 'https://' + PIXIV_HOST + '/' + (lang === 'en' ? 'en/' : '') + 'a/' + encodeTitlePath(title);
  }

  function buildNicoUrl(ref) {
    if (ref && ref.id) return 'https://' + NICO_HOST + '/id/' + String(ref.id).replace(/\D/g, '');
    return 'https://' + NICO_HOST + '/a/' + encodeTitlePath(normalizeSpace(ref && ref.title));
  }

  function keyOf(ref) {
    if (!ref) return '';
    if (ref.provider === 'wikipedia') {
      var lang = String(ref.lang || 'zh').toLowerCase();
      var variant = normalizeVariant(ref.variant, lang) || '-';
      return 'wikipedia:' + lang + ':' + variant + ':' + normalizeSpace(ref.title);
    }
    if (ref.provider === 'pixiv') {
      var plang = ref.lang === 'en' ? 'en' : 'ja';
      return 'pixiv:' + plang + ':' + normalizeSpace(ref.title);
    }
    if (ref.provider === 'niconico') {
      if (ref.id) return 'niconico:id:' + String(ref.id).replace(/\D/g, '');
      return 'niconico:' + normalizeSpace(ref.title);
    }
    return '';
  }

  function langLabelOf(ref) {
    if (!ref) return '';
    if (ref.provider === 'wikipedia') {
      var lang = String(ref.lang || '').toLowerCase();
      var base = LANG_LABEL[lang] || lang.toUpperCase();
      var v = normalizeVariant(ref.variant, lang);
      var vl = v && ZH_VARIANTS[v];
      return vl ? base + '（' + vl + '）' : base;
    }
    if (ref.provider === 'pixiv') return ref.lang === 'en' ? '英文' : '日文';
    if (ref.provider === 'niconico') return '日文';
    return '';
  }

  function decorate(ref) {
    var label = ref.provider === 'wikipedia'
      ? '維基百科'
      : ref.provider === 'pixiv'
        ? 'pixiv百科事典'
        : 'ニコニコ大百科';
    var accent = ref.provider === 'wikipedia'
      ? '#6f9bd6'
      : ref.provider === 'pixiv'
        ? '#0096fa'
        : '#e6b422';
    ref.siteLabel = label;
    ref.accent = accent;
    ref.langLabel = langLabelOf(ref);
    return ref;
  }

  function parseUrl(input) {
    var u;
    if (input && typeof input === 'object' && input.hostname) {
      u = input;
    } else {
      try {
        u = new URL(String(input == null ? '' : input), global.location ? global.location.href : undefined);
      } catch (e) {
        return null;
      }
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    var host = u.hostname.toLowerCase();

    /* ---- Wikipedia ---- */
    var wl = parseWikiHost(host);
    if (wl) {
      var path = u.pathname || '/';
      var qTitle = u.searchParams.get('title');
      var qVariant = normalizeVariant(u.searchParams.get('variant'), wl);
      var title = '';
      var variant = '';
      var m;
      if ((m = /^\/wiki\/(.+)$/.exec(path))) {
        title = m[1];
      } else if (qTitle) {
        title = qTitle;
      } else if ((m = /^\/(zh(?:-[a-z0-9]{2,8})?)\/(?:wiki\/)?(.+)$/i.exec(path))) {
        variant = normalizeVariant(m[1], wl);
        if (!variant) return null;
        title = m[2];
      } else {
        return null;
      }
      var clean = normalizeWikiTitle(title);
      if (!clean) return null;
      if (!variant) variant = qVariant;
      var wref = { provider: 'wikipedia', lang: wl, variant: variant, title: clean };
      wref.url = buildWikipediaUrl(wref);
      wref.key = keyOf(wref);
      return decorate(wref);
    }

    /* ---- pixiv 百科 ---- */
    if (host === PIXIV_HOST) {
      var ppath = u.pathname || '/';
      var plang = 'ja';
      var pm = /^\/a\/(.+?)\/?$/.exec(ppath);
      if (!pm) {
        pm = /^\/en\/a\/(.+?)\/?$/.exec(ppath);
        if (pm) plang = 'en';
      }
      if (!pm) return null;
      var ptitle = normalizeTitle(pm[1]);
      if (!ptitle) return null;
      var pref = { provider: 'pixiv', lang: plang, title: ptitle };
      pref.url = buildPixivUrl(pref);
      pref.key = keyOf(pref);
      return decorate(pref);
    }

    /* ---- ニコニコ大百科 ---- */
    if (host === NICO_HOST) {
      var npath = u.pathname || '/';
      var nm = /^\/id\/(\d+)\/?$/.exec(npath);
      if (nm) {
        var iref = { provider: 'niconico', id: nm[1], title: '' };
        iref.url = buildNicoUrl(iref);
        iref.key = keyOf(iref);
        return decorate(iref);
      }
      nm = /^\/(?:t\/)?a\/(.+?)\/?$/.exec(npath);
      if (!nm) return null;
      var ntitle = normalizeTitle(nm[1]);
      if (!ntitle) return null;
      var nref = { provider: 'niconico', title: ntitle };
      nref.url = buildNicoUrl(nref);
      nref.key = keyOf(nref);
      return decorate(nref);
    }

    return null;
  }

  global.LinkPreviewKeys = {
    parseUrl: parseUrl,
    keyOf: keyOf,
    normalizeTitle: normalizeTitle,
    normalizeWikiTitle: normalizeWikiTitle,
    parseWikiHost: parseWikiHost,
    normalizeVariant: normalizeVariant,
    buildWikipediaUrl: buildWikipediaUrl,
    buildPixivUrl: buildPixivUrl,
    buildNicoUrl: buildNicoUrl
  };
})(typeof window !== 'undefined' ? window : this);
