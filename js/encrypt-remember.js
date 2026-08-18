(function (window, document) {
  "use strict";
  var TTL = 10000;
  var KEY = 'hexo-encrypt-pwd:' + location.pathname;

  function storage() {
    try { return window.localStorage; } catch (e) { return null; }
  }
  function read() {
    var s = storage();
    if (!s) return null;
    try {
      var raw = s.getItem(KEY);
      if (!raw) return null;
      var d = JSON.parse(raw);
      if (!d || typeof d.p !== "string" || !d.t) return null;
      if (Date.now() - d.t > TTL) { s.removeItem(KEY); return null; }
      return d.p;
    } catch (e) { return null; }
  }
  function write(pwd) {
    var s = storage();
    if (!s) return;
    try { s.setItem(KEY, JSON.stringify({ p: pwd, t: Date.now() })); } catch (e) {}
  }
  function clear() {
    var s = storage();
    if (!s) return;
    try { s.removeItem(KEY); } catch (e) {}
  }
  function isDecrypted() {
    var c = document.getElementById('enc_content');
    return !!(c && c.style && c.style.display === 'block');
  }

  if (TTL <= 0) return; // feature disabled via config

  var origDoDecrypt = window.doDecrypt;
  if (typeof origDoDecrypt === "function") {
    window.doDecrypt = function (pwd, onError) {
      var before = isDecrypted();
      origDoDecrypt(pwd, onError);
      if (isDecrypted()) {
        write(pwd);           // success => remember (sliding TTL)
      } else if (before) {
        clear();              // was open, now failed => drop stale memory
      }
    };
  }

  var saved = read();
  if (saved != null && !isDecrypted()) {
    var input = document.getElementById('enc_pwd_input');
    if (input) input.value = saved;
    var fn = window.doDecrypt;
    if (typeof fn === "function") fn(saved);
    if (!isDecrypted()) {
      clear();                // saved password no longer valid
      if (input) input.value = "";
    }
  }
})(window, document);
