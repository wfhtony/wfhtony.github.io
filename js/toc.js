/* 目錄（TOC）：層級摺疊 + 長清單收合（主題層實作）
 *
 * 為什麼需要 JS：
 *   目錄 HTML 由 hexo-toc（markdown-toc）在建置期產生，靜態的巢狀 <ul>/<ol> 本身沒有
 *   「這裡可以展開」的資訊，CSS 也做不到「預設收合、點擊展開」。
 * 漸進增強：
 *   沒有 JS 時清單維持全部展開，只吃 _partial/toc.styl 的符號與縮排（不會壞）。
 * 加密文章：
 *   hexo-encrypt 的內容是解密後才注入 DOM（#enc_content），所以除了 DOM ready 之外，
 *   另以 MutationObserver 監看 .article-entry，補初始化後續才出現的目錄
 *   （與 js/script.js 處理解密後圖片 caption 同一套做法）。
 * 設定：
 *   themes/landscape-plus/_config.yml 的 toc_ui，經 after-footer.ejs 注入 window.TOC_UI。
 * 標記（CSS 依賴這些）：
 *   li.toc-has-child + button.toc-toggle（caret 兼符號）、子清單 hidden（收合）、
 *   li.toc-more > button.toc-more-btn（長清單收合列）。
 */
(function ($) {
  'use strict';

  var cfg = window.TOC_UI || {};
  if (cfg.enable === false) return;

  var COLLAPSE = cfg.collapse !== false; // 有子清單的節點預設收合
  var FLAT_AFTER = typeof cfg.collapse_flat_after === 'number' ? cfg.collapse_flat_after : 12;
  var REMEMBER = cfg.remember === true; // 用 localStorage 記住「這一頁」展開過什麼
  var STORE_KEY = 'toc-ui:' + location.pathname;

  // 記住的狀態：expanded＝已展開節點的識別清單、flat＝長清單是否已展開
  var state = { expanded: [], flat: false };

  function loadState() {
    if (!REMEMBER || !window.localStorage) return;
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && Object.prototype.toString.call(saved.expanded) === '[object Array]') {
        state.expanded = saved.expanded;
      }
      state.flat = !!(saved && saved.flat === true);
    } catch (err) {
      /* 私密模式或壞資料：忽略，退回預設 */
    }
  }

  function saveState() {
    if (!REMEMBER || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ expanded: state.expanded, flat: state.flat })
      );
    } catch (err) {
      /* 額度用盡或私密模式：忽略 */
    }
  }

  function remember(key, open) {
    var i = $.inArray(key, state.expanded);
    if (open && i === -1) state.expanded.push(key);
    if (!open && i !== -1) state.expanded.splice(i, 1);
    saveState();
  }

  // 節點識別：優先取項目自身的錨點（改標題就會變 → 屆時視為未記住，回到預設收合）；
  // hexo 內建 toc() 產生的 <a class="toc-link"> 常沒有 href，改用序號。
  function keyOf($li, index) {
    var href = $li.children('a').first().attr('href');
    return href ? href : 'idx:' + index;
  }

  function setOpen($li, $sub, open, isUserAction, key) {
    if ($sub && $sub.length) $sub.prop('hidden', !open);
    $li.toggleClass('toc-open', open);
    $li
      .children('button.toc-toggle')
      .attr('aria-expanded', open ? 'true' : 'false')
      .attr('aria-label', open ? '收合子目錄' : '展開子目錄');
    if (isUserAction) remember(key, open);
  }

  function initToc($toc) {
    // 1) 有子清單的節點：加 caret（兼符號）＋可摺疊
    var index = 0;

    $toc.find('li').each(function () {
      var $li = $(this);
      var $sub = $li.children('ul, ol');
      index += 1;
      if (!$sub.length || $li.hasClass('toc-has-child')) return;

      var key = keyOf($li, index);
      var $btn = $('<button type="button" class="toc-toggle"></button>');

      $li.addClass('toc-has-child').prepend($btn);

      var open = !COLLAPSE || (REMEMBER && $.inArray(key, state.expanded) !== -1);
      setOpen($li, $sub, open, false, key);

      $btn.on('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setOpen($li, $sub, !$li.hasClass('toc-open'), true, key);
      });
    });

    // 2) 頂層過長（多半是沒有子層的扁平目錄）：只留前 N 項，其餘收起來
    if (FLAT_AFTER > 0 && !$toc.data('tocFlat')) {
      var $root = $toc.is('ul, ol') ? $toc : $toc.children('ul, ol').first();
      var $items = $root.children('li');

      if ($items.length > FLAT_AFTER) {
        $toc.data('tocFlat', true);

        var $tail = $items.slice(FLAT_AFTER);
        var $more = $('<li class="toc-more"><button type="button" class="toc-more-btn"></button></li>');
        var $btn = $more.children('button');
        var total = $items.length;

        $root.append($more);

        var applyFlat = function (open, isUserAction) {
          $tail.prop('hidden', !open);
          $btn
            .attr('aria-expanded', open ? 'true' : 'false')
            .text(open ? '收合' : '顯示全部 ' + total + ' 項');
          if (isUserAction) {
            state.flat = open;
            saveState();
          }
        };

        applyFlat(!!state.flat, false);

        $btn.on('click', function (e) {
          e.preventDefault();
          applyFlat($btn.attr('aria-expanded') !== 'true', true);
        });
      }
    }
  }

  function scan() {
    $('.article-entry .toc').each(function () {
      var $toc = $(this);
      if ($toc.data('tocInit')) return;
      $toc.data('tocInit', true);
      initToc($toc);
    });
  }

  loadState();
  $(scan);

  // 解密後才注入的目錄（hexo-encrypt）靠這裡補上
  if (window.MutationObserver) {
    var queued = false;
    var observer = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () {
        queued = false;
        scan();
      }, 0);
    });

    $(function () {
      $('.article-entry').each(function () {
        observer.observe(this, { childList: true, subtree: true });
      });
    });
  }
})(jQuery);
