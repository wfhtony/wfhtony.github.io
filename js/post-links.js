/*!
 * post-links.js — 正文連結行為（外部連結開新分頁 ＋ 影音連結播放浮窗）
 *
 * 由 layout/_partial/after-footer.ejs 於 theme.post_links 啟用時載入，
 * 設定由同一頁輸出的 window.POST_LINKS 提供。
 *
 * 設計要點
 * - 事件委派（document 層）：加密文章解密後才注入的連結一樣有效
 * - 只吃純左鍵；Ctrl / Cmd / Shift / Alt 或中鍵一律放行 → 保留瀏覽器原生「開新分頁」
 * - 漸進增強：外部連結的 target="_blank" 已由 Hexo 建置期（site _config.yml 的
 *   external_link）寫入；這裡只補「解密後才注入 DOM」與其他漏網的連結
 * - 影音浮窗只在 .article-entry 內、且網址命中 YouTube / Bilibili / niconico 時接管；
 *   播放器直接嵌各平台官方 embed，不另寫樣式
 * - 尊重作者自訂連結：<a class="fancybox">（圖片連結）留給 img-viewer.js
 */
(function () {
  'use strict';

  var cfg = window.POST_LINKS;
  if (!cfg) return;

  var NEW_TAB = cfg.new_tab !== false;
  var MEDIA = cfg.media_viewer !== false;
  var AUTOPLAY = cfg.autoplay === true;
  if (!NEW_TAB && !MEDIA) return;

  /* ---------------------------------------------------------------- 工具 */

  function parseUrl(href) {
    try {
      return new URL(href, window.location.href);
    } catch (e) {
      return null;
    }
  }

  function isHttp(u) {
    return !!u && (u.protocol === 'http:' || u.protocol === 'https:');
  }

  function isExternalHref(href) {
    var u = parseUrl(href);
    return isHttp(u) && u.host !== window.location.host;
  }

  function positiveInt(v) {
    var n = parseInt(v, 10);
    return (isFinite(n) && n > 0) ? n : 0;
  }

  /* ------------------------------------------------------ 外部連結新分頁 */

  function applyNewTab(entry) {
    var links = entry.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.hasAttribute('target')) continue;
      if (!isExternalHref(a.getAttribute('href'))) continue;
      a.setAttribute('target', '_blank');
      var rel = a.getAttribute('rel');
      a.setAttribute('rel', rel ? rel + ' noopener' : 'noopener');
    }
  }

  /* -------------------------------------------------------- 影音連結解析 */

  var PLATFORM = { youtube: 'YouTube', bilibili: 'Bilibili', niconico: 'niconico' };

  function youtubeEmbed(id, start) {
    var p = ['rel=0', 'playsinline=1'];
    if (AUTOPLAY) p.push('autoplay=1');
    if (start) p.push('start=' + start);
    return 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?' + p.join('&');
  }

  function bilibiliEmbed(query, page, start) {
    var p = [query, 'page=' + (page || 1), 'autoplay=' + (AUTOPLAY ? 1 : 0)];
    if (start) p.push('t=' + start);
    return 'https://player.bilibili.com/player.html?' + p.join('&');
  }

  function niconicoEmbed(id) {
    return 'https://embed.nicovideo.jp/watch/' + encodeURIComponent(id)
      + (AUTOPLAY ? '?autoplay=1' : '');
  }

  function parseMedia(href) {
    var u = parseUrl(href);
    if (!isHttp(u)) return null;

    var host = u.hostname.toLowerCase().replace(/^(?:www|m|sp)\./, '');
    var path = u.pathname;
    var m;

    /* ---- YouTube ---- */
    if (host === 'youtu.be') {
      m = path.match(/^\/([A-Za-z0-9_-]{6,})/);
      if (!m) return null;
      return { kind: 'youtube', embed: youtubeEmbed(m[1], positiveInt(u.searchParams.get('t'))) };
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
      var vid = u.searchParams.get('v');
      if (!vid) {
        m = path.match(/^\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{6,})/);
        if (m) vid = m[1];
      }
      if (!vid) return null;
      var yStart = positiveInt(u.searchParams.get('t') || u.searchParams.get('start'));
      return { kind: 'youtube', embed: youtubeEmbed(vid, yStart) };
    }

    /* ---- Bilibili ---- */
    if (host === 'bilibili.com') {
      var query = null;
      m = path.match(/^\/video\/(BV[0-9A-Za-z]+)/i);
      if (m) {
        query = 'bvid=' + encodeURIComponent(m[1]);
      } else {
        m = path.match(/^\/video\/av(\d+)/i);
        if (m) query = 'aid=' + m[1];
      }
      if (!query) return null;
      var page = positiveInt(u.searchParams.get('p')) || 1;
      return {
        kind: 'bilibili',
        embed: bilibiliEmbed(query, page, positiveInt(u.searchParams.get('t')))
      };
    }

    /* ---- niconico（dic.nicovideo.jp 這類非影片頁不接管） ---- */
    if (host === 'nicovideo.jp' || host === 'nico.ms') {
      m = path.match(/^(?:\/watch)?\/([a-z]{2}\d+)/i);
      if (!m) return null;
      return { kind: 'niconico', embed: niconicoEmbed(m[1]) };
    }

    return null;
  }

  /* ------------------------------------------------------------ 浮窗 DOM */

  var ICON = {
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3h8v8h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H13zM5 5h6v2H7v10h10v-4h2v6H5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/></svg>'
  };

  var overlay = null;
  var frame = null;
  var iframeEl = null;
  var captionEl = null;
  var openBtn = null;
  var closeBtn = null;
  var isOpen = false;
  var lastFocus = null;
  var currentUrl = '';
  var savedScrollY = 0;

  function mkButton(html, title, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'media-viewer-btn';
    b.setAttribute('title', title);
    b.setAttribute('aria-label', title);
    b.innerHTML = html;
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      fn();
    });
    return b;
  }

  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'media-viewer';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '影片播放');
    overlay.setAttribute('aria-hidden', 'true');

    var backdrop = document.createElement('div');
    backdrop.className = 'media-viewer-backdrop';
    backdrop.addEventListener('click', close);

    var stage = document.createElement('figure');
    stage.className = 'media-viewer-stage';

    frame = document.createElement('div');
    frame.className = 'media-viewer-frame';

    iframeEl = document.createElement('iframe');
    iframeEl.className = 'media-viewer-iframe';
    iframeEl.setAttribute('frameborder', '0');
    iframeEl.setAttribute('scrolling', 'no');
    iframeEl.setAttribute('allowfullscreen', 'true');
    iframeEl.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    iframeEl.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
    iframeEl.setAttribute('title', '影片播放器');

    frame.appendChild(iframeEl);

    captionEl = document.createElement('figcaption');
    captionEl.className = 'media-viewer-caption';
    captionEl.hidden = true;

    stage.appendChild(frame);
    stage.appendChild(captionEl);

    openBtn = mkButton(ICON.open, '在新分頁開啟', function () {
      if (currentUrl) window.open(currentUrl, '_blank', 'noopener');
    });
    closeBtn = mkButton(ICON.close, '關閉（Esc）', close);

    var bar = document.createElement('div');
    bar.className = 'media-viewer-toolbar';
    bar.appendChild(openBtn);
    bar.appendChild(closeBtn);

    overlay.appendChild(backdrop);
    overlay.appendChild(stage);
    overlay.appendChild(bar);

    document.body.appendChild(overlay);
  }

  /* ------------------------------------------------------------ 開 / 關 */

  // 鎖捲動時補回 scrollbar 寬度，避免背景頁面水平位移（同 img-viewer）
  function lockScroll(on) {
    if (on) {
      savedScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
      var pad = window.innerWidth - document.documentElement.clientWidth;
      if (pad > 0) document.body.style.paddingRight = pad + 'px';
    } else {
      document.body.style.paddingRight = '';
      if (savedScrollY > 0 &&
          (window.pageYOffset || document.documentElement.scrollTop || 0) === 0) {
        window.scrollTo(0, savedScrollY);
      }
    }
  }

  function open(info, trigger) {
    ensureOverlay();
    lastFocus = trigger || document.activeElement;
    currentUrl = info.original || '';
    isOpen = true;
    document.documentElement.classList.add('media-viewer-open');
    lockScroll(true);

    var text = trigger
      ? String(trigger.getAttribute('title') || trigger.textContent || '').replace(/\s+/g, ' ').trim()
      : '';
    captionEl.textContent = text || PLATFORM[info.kind] || '';
    captionEl.hidden = !captionEl.textContent;

    iframeEl.src = info.embed;

    void overlay.offsetHeight; // 觸發 reflow，讓開啟的 transition 生效
    overlay.classList.add('on');
    overlay.removeAttribute('aria-hidden');
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('on');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('media-viewer-open');
    lockScroll(false);
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); }
    }
    window.setTimeout(function () {
      // 清掉 iframe 以停止播放（保留節點，下次開啟重新指定 src）
      if (!isOpen && iframeEl) iframeEl.src = 'about:blank';
    }, 260);
  }

  /* --------------------------------------------------------------- 互動 */

  function onKeyDown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Tab') {
      var first = openBtn;
      var last = closeBtn;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function onDocumentClick(e) {
    if (!MEDIA) return;
    if (overlay && overlay.contains(e.target)) return;
    if (e.defaultPrevented) return;
    // 保留瀏覽器原生行為：Ctrl / Cmd / Shift / Alt 點擊 = 開新分頁 / 新視窗
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var target = e.target;
    if (!target || !target.closest) return;
    if (!target.closest('.article-entry')) return;

    var a = target.closest('a');
    if (!a) return;
    if (a.classList.contains('fancybox')) return; // 圖片連結交給 img-viewer

    var info = parseMedia(a.href);
    if (!info) return;

    info.original = a.href;
    e.preventDefault();
    open(info, a);
  }

  /* ---------------------------------------------------------------- 啟動 */

  var entries = document.querySelectorAll('.article-entry');

  if (NEW_TAB) {
    for (var i = 0; i < entries.length; i++) applyNewTab(entries[i]);

    if (window.MutationObserver) {
      var observer = new MutationObserver(function (mutations) {
        var seen = [];
        for (var j = 0; j < mutations.length; j++) {
          var added = mutations[j].addedNodes;
          for (var k = 0; k < added.length; k++) {
            var node = added[k];
            if (node.nodeType !== 1 || !node.closest) continue;
            var entry = node.closest('.article-entry');
            if (entry && seen.indexOf(entry) === -1) seen.push(entry);
          }
        }
        for (var l = 0; l < seen.length; l++) applyNewTab(seen[l]);
      });
      for (var m = 0; m < entries.length; m++) {
        observer.observe(entries[m], { childList: true, subtree: true });
      }
    }
  }

  if (MEDIA) {
    document.addEventListener('click', onDocumentClick, false);
    document.addEventListener('keydown', onKeyDown, false);
  }

  document.documentElement.classList.add('post-links-ready');
})();
