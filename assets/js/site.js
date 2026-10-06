/* Gedeeld over alle pagina's: het mobiele menu en het jaartal in de voettekst. */
(function () {
  'use strict';

  var toggle = document.getElementById('nav-toggle');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    var close = function () {
      nav.setAttribute('data-open', 'false');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Menu openen');
    };
    toggle.addEventListener('click', function () {
      var open = nav.getAttribute('data-open') === 'true';
      if (open) { close(); return; }
      nav.setAttribute('data-open', 'true');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Menu sluiten');
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', close);
    });
  }

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
