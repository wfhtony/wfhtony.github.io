(function (window, document) {
  'use strict';
  if (typeof window.doDecrypt !== 'function') return; // 非加密頁

  var pwd = null;
  var FULL_DELAY = 400;

  function waToBytes(wa) {
    var words = (wa && wa.words) || [];
    var sig = (wa && wa.sigBytes) || 0;
    var out = new Uint8Array(sig);
    for (var i = 0; i < sig; i++) {
      out[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return out;
  }

  function mimeOf(url) {
    var m = /\.([a-z0-9]+)(?:$|[?#])/i.exec(url || '');
    var e = m ? m[1].toLowerCase() : 'jpg';
    if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
    if (e === 'png') return 'image/png';
    if (e === 'gif') return 'image/gif';
    if (e === 'webp') return 'image/webp';
    return 'application/octet-stream';
  }

  function blobFor(img, bytes, url) {
    var blob = new Blob([bytes], { type: mimeOf(url || img.getAttribute('data-pe-bin')) });
    return URL.createObjectURL(blob);
  }

  function decryptUrl(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).then(function (ct) {
      var bytes = waToBytes(CryptoJS.AES.decrypt(ct, pwd));
      if (!bytes.length) throw new Error('decrypt failed');
      return bytes;
    });
  }

  function anchorOf(img) {
    return img.closest ? img.closest('a.fancybox') : null;
  }

  function markBroken(img) {
    img.setAttribute('data-pe-fail', '1');
    var a = anchorOf(img);
    if (a) a.setAttribute('data-pe-fail', '1');
  }

  function run() {
    var list = [].slice.call(document.querySelectorAll('[data-pe-bin]'));
    if (!list.length) return;
    var fulls = [];

    list.forEach(function (img) {
      if (img.getAttribute('data-pe-done')) return;
      img.setAttribute('data-pe-done', '1');
      var bin = img.getAttribute('data-pe-bin');
      var full = img.getAttribute('data-pe-full');
      decryptUrl(bin).then(function (bytes) {
        var url = blobFor(img, bytes, bin);
        img.src = url;
        img.setAttribute('data-zoom-src', url);
        var a = anchorOf(img);
        if (a) a.href = url;
        if (full && full !== bin) fulls.push([img, full]);
      }).catch(function () { markBroken(img); });
    });

    if (!fulls.length) return;
    window.setTimeout(function () {
      fulls.forEach(function (pair) {
        var img = pair[0];
        decryptUrl(pair[1]).then(function (bytes) {
          var url = blobFor(img, bytes, pair[1]);
          img.setAttribute('data-zoom-src', url);
          var a = anchorOf(img);
          if (a) a.href = url;
        }).catch(function () {});
      });
    }, FULL_DELAY);
  }

  var orig = window.doDecrypt;
  window.doDecrypt = function (p, onError) {
    orig(p, onError);
    var c = document.getElementById('enc_content');
    if (!p || !c || c.style.display !== 'block') return;
    pwd = p;
    run();
  };

  // 保險：若頁面載入時內容已經解開（例如本檔被排到 encrypt-remember **之後** 載入，
  // 它會先自行解鎖），此時拿不到剛才輸入的密碼 —— 回頭讀 encrypt-remember 存在
  // localStorage 的值（同一個 key 規則）再跑一次。
  var content = document.getElementById('enc_content');
  if (content && content.style.display === 'block') {
    try {
      var raw = window.localStorage.getItem('hexo-encrypt-pwd:' + location.pathname);
      var d = raw ? JSON.parse(raw) : null;
      if (d && typeof d.p === 'string') {
        pwd = d.p;
        run();
      }
    } catch (e) { /* ignore */ }
  }
})(window, document);
