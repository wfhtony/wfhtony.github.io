/*!
 * img-viewer.js — 圖片檢視彈窗（主題色 / 可拖拽 / 可縮放 / 相簿切換）
 *
 * 由 layout/_partial/after-footer.ejs 於 theme.img_viewer.enable 時載入，
 * 設定由同一頁輸出的 window.IMG_VIEWER 提供。
 *
 * 設計要點
 * - 事件委派（document 層）：加密文章解密後才注入的圖片一樣可以點開
 * - 不攔截 Ctrl / Cmd / Shift / Alt 或中鍵點擊：保留瀏覽器原生「開新分頁」
 * - 尊重作者原本的圖片連結：不是 .fancybox 的 <a> 不接管
 * - 漸進增強：沒有 JS 時，文章圖片仍是一般的 <a href="原圖">
 */
(function () {
  'use strict';

  var cfg = window.IMG_VIEWER;
  if (!cfg || !cfg.enable) return;

  /* ---------------------------------------------------------------- 設定 */

  function num(v, d) {
    return (typeof v === 'number' && isFinite(v)) ? v : d;
  }

  var MIN_ZOOM = num(cfg.min_zoom, 0.5);
  var MAX_ZOOM = num(cfg.max_zoom, 8);
  var STEP = 0.25;      // 工具列 / 鍵盤縮放級距
  var DBL_ZOOM = 2;     // 雙擊放大倍率
  var EDGE = 48;        // 拖拽時至少留在視窗內的像素
  var GALLERY = cfg.gallery !== false;
  var DRAGGABLE = cfg.draggable !== false;
  var WHEEL_ZOOM = cfg.wheel_zoom !== false;
  var SHOW_CAPTION = cfg.show_caption !== false;

  var ICON = {
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v2H5z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3h8v8h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H13zM5 5h6v2H7v10h10v-4h2v6H5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 16.6 10 18l6-6-6-6-1.4 1.4L13.2 12z"/></svg>'
  };

  /* ---------------------------------------------------------------- 狀態 */

  var overlay = null;
  var stage = null;
  var imgEl = null;
  var captionEl = null;
  var counterEl = null;
  var zoomLabel = null;
  var prevBtn = null;
  var nextBtn = null;
  var closeBtn = null;

  var items = [];
  var index = 0;
  var scale = 1;
  var tx = 0;
  var ty = 0;
  var isOpen = false;
  var lastFocus = null;
  var rafId = 0;
  var scrollbarPad = 0;

  var activePointers = [];
  var dragState = null;
  var pinchState = null;

  /* ---------------------------------------------------------------- 工具 */

  function vw() { return window.innerWidth; }
  function vh() { return window.innerHeight; }

  function clampScale(s) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));
  }

  function setTransform() {
    if (!imgEl) return;
    imgEl.style.transform = 'translate3d(' + tx + 'px,' + ty + 'px,0) scale(' + scale + ')';
  }

  function scheduleTransform() {
    if (rafId) return;
    rafId = window.requestAnimationFrame(function () {
      rafId = 0;
      setTransform();
    });
  }

  // 拖拽時至少保留 EDGE 像素在視窗內，避免圖片被拖到完全看不見
  function clampPan() {
    if (!imgEl) return;
    var w = imgEl.offsetWidth * scale;
    var h = imgEl.offsetHeight * scale;
    var maxX = Math.max(0, (vw() + w) / 2 - EDGE);
    var maxY = Math.max(0, (vh() + h) / 2 - EDGE);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  }

  function resetView() {
    scale = 1;
    tx = 0;
    ty = 0;
    setTransform();
    updateToolbar();
  }

  // 以 (cx, cy) 為錨點縮放：游標底下的那一點保持不動
  function zoomAt(cx, cy, next) {
    next = clampScale(next);
    if (Math.abs(next - scale) < 0.0001) return;
    var k = next / scale;
    tx += (cx - vw() / 2 - tx) * (1 - k);
    ty += (cy - vh() / 2 - ty) * (1 - k);
    scale = next;
    clampPan();
    scheduleTransform();
    updateToolbar();
  }

  function updateToolbar() {
    if (!overlay) return;
    zoomLabel.textContent = Math.round(scale * 100) + '%';
    var multi = items.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
    counterEl.hidden = !multi;
    counterEl.textContent = (index + 1) + ' / ' + items.length;
  }

  /* ------------------------------------------------------------ DOM 建構 */

  function mkButton(act, html, title, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'img-viewer-btn' + (act === 'zoom-value' ? ' img-viewer-zoom-value' : '');
    b.setAttribute('data-act', act);
    if (title) {
      b.setAttribute('title', title);
      b.setAttribute('aria-label', title);
    }
    b.innerHTML = html;
    if (fn) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
    }
    return b;
  }

  function ensureOverlay() {
    if (overlay) return;

    overlay = document.createElement('div');
    overlay.className = 'img-viewer';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', '圖片檢視');
    overlay.setAttribute('aria-hidden', 'true');
    if (cfg.backdrop_opacity != null) {
      overlay.style.setProperty('--iv-backdrop-opacity', String(cfg.backdrop_opacity));
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'img-viewer-backdrop';
    backdrop.addEventListener('click', close);

    stage = document.createElement('figure');
    stage.className = 'img-viewer-stage';

    imgEl = document.createElement('img');
    imgEl.className = 'img-viewer-img';
    imgEl.alt = '';
    imgEl.draggable = false;
    imgEl.addEventListener('load', function () {
      imgEl.classList.remove('loading');
      resetView();
    });
    imgEl.addEventListener('error', function () {
      imgEl.classList.remove('loading');
    });

    captionEl = document.createElement('figcaption');
    captionEl.className = 'img-viewer-caption';

    stage.appendChild(imgEl);

    prevBtn = mkButton('prev', ICON.prev, '上一張（←）', function () { go(-1); });
    prevBtn.classList.add('img-viewer-nav', 'prev');
    nextBtn = mkButton('next', ICON.next, '下一張（→）', function () { go(1); });
    nextBtn.classList.add('img-viewer-nav', 'next');

    var zoomOut = mkButton('zoom-out', ICON.minus, '縮小（-）', function () {
      zoomAt(vw() / 2, vh() / 2, scale * (1 - STEP));
    });
    zoomLabel = mkButton('zoom-value', '100%', '重設縮放（0）', resetView);
    var zoomIn = mkButton('zoom-in', ICON.plus, '放大（+）', function () {
      zoomAt(vw() / 2, vh() / 2, scale * (1 + STEP));
    });
    var openBtn = mkButton('open', ICON.open, '在新分頁開啟原圖', function () {
      var it = items[index];
      if (it) window.open(it.src, '_blank', 'noopener');
    });
    closeBtn = mkButton('close', ICON.close, '關閉（Esc）', close);

    var bar = document.createElement('div');
    bar.className = 'img-viewer-toolbar';
    bar.appendChild(zoomOut);
    bar.appendChild(zoomLabel);
    bar.appendChild(zoomIn);
    bar.appendChild(openBtn);
    bar.appendChild(closeBtn);

    counterEl = document.createElement('div');
    counterEl.className = 'img-viewer-counter';

    overlay.appendChild(backdrop);
    overlay.appendChild(stage);
    overlay.appendChild(captionEl);
    overlay.appendChild(prevBtn);
    overlay.appendChild(nextBtn);
    overlay.appendChild(bar);
    overlay.appendChild(counterEl);

    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('dblclick', onDblClick);

    document.body.appendChild(overlay);
  }

  /* ----------------------------------------------------------- 開關 / 相簿 */

  // <img> 本身不可聚焦，關閉後焦點要還給可聚焦的祖先（通常是包住它的 <a>）
  function focusTargetFor(el) {
    if (!el) return null;
    if (el.tagName === 'IMG' && el.closest) {
      var a = el.closest('a');
      if (a) return a;
    }
    return el;
  }

  function open(list, i, trigger) {
    ensureOverlay();
    items = list;
    lastFocus = focusTargetFor(trigger) || document.activeElement;
    isOpen = true;
    document.documentElement.classList.add('img-viewer-open');
    lockScroll(true);
    void overlay.offsetHeight; // 觸發 reflow，讓開啟的 transition 生效
    overlay.classList.add('on');
    overlay.removeAttribute('aria-hidden');
    load(i);
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    overlay.classList.remove('on');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('img-viewer-open');
    lockScroll(false);
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); }
    }
    window.setTimeout(function () {
      if (!isOpen && imgEl) {
        imgEl.removeAttribute('src');
        imgEl.style.transform = '';
        scale = 1;
        tx = 0;
        ty = 0;
      }
    }, 260);
  }

  // 鎖捲動時補回 scrollbar 寬度，避免背景頁面水平位移
  function lockScroll(on) {
    if (on) {
      scrollbarPad = vw() - document.documentElement.clientWidth;
      if (scrollbarPad > 0) document.body.style.paddingRight = scrollbarPad + 'px';
    } else {
      document.body.style.paddingRight = '';
      scrollbarPad = 0;
    }
  }

  function go(delta) {
    if (items.length < 2) return;
    load((index + delta + items.length) % items.length);
  }

  function load(i) {
    var it = items[i];
    if (!it) return;
    index = i;
    imgEl.classList.add('loading');
    imgEl.src = it.src;
    imgEl.alt = it.alt || '';
    if (SHOW_CAPTION && it.alt) {
      captionEl.textContent = it.alt;
      captionEl.hidden = false;
    } else {
      captionEl.textContent = '';
      captionEl.hidden = true;
    }
    resetView();
    updateToolbar();
    preload(i + 1);
    preload(i - 1);
  }

  function preload(i) {
    if (items.length < 2) return;
    var it = items[(i + items.length) % items.length];
    if (!it || !it.src) return;
    var im = new Image();
    im.src = it.src;
  }

  /* ----------------------------------------------------------- 拖拽 / 縮放 */

  function findPointer(id) {
    for (var i = 0; i < activePointers.length; i++) {
      if (activePointers[i].id === id) return activePointers[i];
    }
    return null;
  }

  function indexOfPointer(id) {
    for (var i = 0; i < activePointers.length; i++) {
      if (activePointers[i].id === id) return i;
    }
    return -1;
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (stage.setPointerCapture) {
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
    activePointers.push({ id: e.pointerId, x: e.clientX, y: e.clientY });

    if (activePointers.length >= 2) {
      startPinch();
    } else if (DRAGGABLE) {
      dragState = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
      stage.classList.add('dragging');
    }
    e.preventDefault();
  }

  function onPointerMove(e) {
    var p = findPointer(e.pointerId);
    if (!p) return;
    p.x = e.clientX;
    p.y = e.clientY;

    if (pinchState && activePointers.length >= 2) {
      var a = activePointers[0];
      var b = activePointers[1];
      var dist = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      var midX = (a.x + b.x) / 2;
      var midY = (a.y + b.y) / 2;
      scale = clampScale(pinchState.scale * (dist / pinchState.dist));
      tx = pinchState.tx + (midX - pinchState.midX);
      ty = pinchState.ty + (midY - pinchState.midY);
      clampPan();
      scheduleTransform();
      updateToolbar();
      e.preventDefault();
      return;
    }

    if (dragState) {
      tx = dragState.tx + (e.clientX - dragState.x);
      ty = dragState.ty + (e.clientY - dragState.y);
      clampPan();
      scheduleTransform();
      e.preventDefault();
    }
  }

  function onPointerUp(e) {
    var i = indexOfPointer(e.pointerId);
    if (i >= 0) activePointers.splice(i, 1);
    if (activePointers.length < 2) pinchState = null;

    if (activePointers.length === 0) {
      dragState = null;
      stage.classList.remove('dragging');
    } else if (DRAGGABLE) {
      var p = activePointers[0];
      dragState = { x: p.x, y: p.y, tx: tx, ty: ty };
    }
  }

  function startPinch() {
    var a = activePointers[0];
    var b = activePointers[1];
    pinchState = {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      scale: scale,
      tx: tx,
      ty: ty,
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2
    };
    dragState = null;
    stage.classList.remove('dragging');
  }

  function onWheel(e) {
    if (!WHEEL_ZOOM) return;
    e.preventDefault();
    var unit = e.deltaMode === 1 ? 0.05 : 0.0018;
    zoomAt(e.clientX, e.clientY, scale * Math.exp(-e.deltaY * unit));
  }

  function onDblClick(e) {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, scale > 1.01 ? 1 : DBL_ZOOM);
  }

  function onResize() {
    if (!isOpen) return;
    clampPan();
    setTransform();
  }

  /* ------------------------------------------------------------- 鍵盤操作 */

  function onKeyDown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomAt(vw() / 2, vh() / 2, scale * (1 + STEP));
      return;
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomAt(vw() / 2, vh() / 2, scale * (1 - STEP));
      return;
    }
    if (e.key === '0') { e.preventDefault(); resetView(); return; }
    if (e.key === 'Tab') trapTab(e);
  }

  function trapTab(e) {
    var f = overlay.querySelectorAll('button:not([hidden])');
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  /* ------------------------------------------------------------- 點擊接管 */

  function zoomSrc(el) {
    return el.getAttribute('data-zoom-src') || el.currentSrc || el.src;
  }

  function isVisible(el) {
    return el.getClientRects().length > 0 || el.offsetWidth > 0 || el.offsetHeight > 0;
  }

  function openFor(img) {
    var scope = img.closest('.article-entry') ||
      img.closest('.article-gallery-photos') ||
      document.body;
    var list = [];
    var at = 0;

    if (GALLERY) {
      var nodes = scope.querySelectorAll('img');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n === img) {
          at = list.length;
          list.push({ src: zoomSrc(n), alt: n.alt || '' });
        } else if (isVisible(n) &&
          !n.classList.contains('img-viewer-img') &&
          !n.closest('.img-viewer')) {
          list.push({ src: zoomSrc(n), alt: n.alt || '' });
        }
      }
    }

    if (!list.length) {
      list = [{ src: zoomSrc(img), alt: img.alt || '' }];
      at = 0;
    }
    open(list, at, img);
  }

  function onDocumentClick(e) {
    if (overlay && overlay.contains(e.target)) return;
    if (e.defaultPrevented) return;
    // 保留瀏覽器原生行為：Ctrl / Cmd / Shift / Alt 點擊 = 開新分頁 / 新視窗
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var target = e.target;
    if (!target || !target.closest) return;
    if (!target.closest('.article-entry') && !target.closest('.article-gallery-photos')) return;

    // 點到的可能是 <img> 本身，也可能是包住它的 <a class="fancybox">
    var img = target.closest('img');
    if (!img) {
      var anchor = target.closest('a.fancybox');
      if (anchor) img = anchor.querySelector('img');
    }
    if (!img) return;
    if (img.classList.contains('img-viewer-img')) return;

    // 作者自己加的圖片連結（非 .fancybox）不接管
    var link = target.closest('a');
    if (link && !link.classList.contains('fancybox')) return;

    e.preventDefault();
    openFor(img);
  }

  /* ---------------------------------------------------------------- 啟動 */

  document.addEventListener('click', onDocumentClick, false);
  document.addEventListener('keydown', onKeyDown, false);
  window.addEventListener('resize', onResize, false);
  document.documentElement.classList.add('img-viewer-ready');
})();
