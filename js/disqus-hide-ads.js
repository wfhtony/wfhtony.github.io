/**
 * disqus-hide-ads.js
 * 移除 Disqus 免費版插在評論區的廣告/推薦區塊：
 *  1. Taboola 廣告 iframe（#disqus_thread 內）
 *     tempest.services.disqus.com/ads-iframe/taboola/?position=top|bottom
 *  2. #disqus_recommendations 推薦區塊（#disqus_thread 的兄弟節點，
 *     內含 disqus.com/recommendations/ iframe）
 *
 * 原理：
 *  1. sweep()  — 掃描 src 匹配廣告特徵的 iframe + #disqus_recommendations，
 *                直接移除節點（移除節點比 display:none 穩，避免觸發偵測）
 *  2. MutationObserver — Disqus 會在 embed 載入後 ~0.5-1s 才插入廣告/推薦，
 *                觀察 #comments（#disqus_thread 的父層）才能看到兄弟節點插入
 *  3. load 後 1s / 3s 再補掃兩次作雙保險
 *
 * 僅在存在 #disqus_thread 的頁面（文章頁 embed）啟動；count.js 頁面自動跳過。
 * 選擇器以 src 特徵匹配，若 Disqus 日後改版換域名/路徑，需更新 AD_SRC_RE。
 * 2026-09-01 起 Disqus Admin 已官方關閉 Recommendations，本檔為保險網（no-op 化）。
 */
(function () {
  'use strict';

  // 廣告/推薦 iframe src 特徵（2026-09 實測）
  var AD_SRC_RE = /ads-iframe|disqusads|tempest\.services\.disqus\.com|disqus\.com\/recommendations\//i;
  var THREAD_ID = 'disqus_thread';
  var RECS_ID = 'disqus_recommendations';
  var WRAP_ID = 'comments'; // #disqus_thread 的父層（主題 article.ejs 渲染）
  var observer = null;

  function sweep() {
    var thread = document.getElementById(THREAD_ID);
    if (!thread) return false;
    var removed = 0;

    // 1) 掃描 #disqus_thread 內匹配特徵的 iframe
    var iframes = thread.querySelectorAll('iframe[src]');
    for (var i = 0; i < iframes.length; i++) {
      var f = iframes[i];
      if (AD_SRC_RE.test(f.src)) {
        f.parentNode && f.parentNode.removeChild(f);
        removed++;
      }
    }

    // 2) 移除推薦區塊（document 範圍找，id 穩定）
    var recs = document.getElementById(RECS_ID);
    if (recs) {
      recs.parentNode && recs.parentNode.removeChild(recs);
      removed++;
    }

    return removed > 0;
  }

  function startObserver() {
    if (observer) return;
    // 觀察 #comments（父層）而非 #disqus_thread：embed 會把 #disqus_recommendations
    // 插入為 #disqus_thread 的兄弟節點，只監聽 thread 本身看不到。
    // #comments 不存在時（結構變動）退回 #disqus_thread。
    var wrap = document.getElementById(WRAP_ID) || document.getElementById(THREAD_ID);
    if (!wrap) return;

    observer = new MutationObserver(function () {
      sweep();
    });
    observer.observe(wrap, { childList: true, subtree: true });
  }

  function init() {
    var thread = document.getElementById(THREAD_ID);
    if (!thread) return; // 非 embed 頁面（首頁 count.js 等），不啟動

    sweep();          // 先清一次（若 embed 已插入）
    startObserver();  // 持續監聽延遲插入的廣告/推薦

    // 雙保險：load 後補掃（若 observer 因任何原因失效）
    var tidy = function () { sweep(); };
    window.addEventListener('load', function () {
      setTimeout(tidy, 1000);
      setTimeout(tidy, 3000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
