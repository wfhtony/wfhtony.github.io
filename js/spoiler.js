(function (document) {
  'use strict';
  function handleClick(e) {
    var node = e.target;
    while (node && node !== document) {
      if (node.classList && node.classList.contains('spoiler-title')) {
        var panel = node.parentNode;
        if (panel && panel.classList && panel.classList.contains('spoiler')) {
          panel.classList.toggle('collapsed');
          panel.classList.toggle('expanded');
        }
        return;
      }
      node = node.parentNode;
    }
  }
  document.addEventListener('click', handleClick, false);
})(document);
