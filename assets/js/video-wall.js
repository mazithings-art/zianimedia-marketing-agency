/* Videowand onder de hero.
   De clips staan op preload="none" en krijgen hun bron pas als de tegel in beeld komt.
   Daarna speelt alleen wat zichtbaar is, zodat een bezoeker niet zes video's tegelijk laadt.
   Met de knop op een tegel gaat het geluid aan; er speelt er altijd maar een met geluid. */
(function () {
  'use strict';
  var strip = document.querySelector('.wall-strip');
  if (!strip) return;

  var items = Array.prototype.slice.call(strip.querySelectorAll('.wall-item'));
  var stil = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var metGeluid = null;

  function speel(video) {
    if (stil) return;
    var p = video.play();
    if (p && p.catch) p.catch(function () { /* geblokkeerd: de poster blijft staan */ });
  }

  if ('IntersectionObserver' in window) {
    var waarnemer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target.querySelector('video');
        if (!video) return;
        if (entry.isIntersecting) {
          video.preload = 'auto';
          speel(video);
        } else {
          video.pause();
          if (metGeluid === video) zetGeluid(video, false);
        }
      });
    }, { root: null, rootMargin: '200px', threshold: 0.25 });
    items.forEach(function (item) { waarnemer.observe(item); });
  } else {
    items.forEach(function (item) {
      var v = item.querySelector('video');
      if (v) { v.preload = 'auto'; speel(v); }
    });
  }

  function zetGeluid(video, aan) {
    var knop = video.parentNode.querySelector('.wall-sound');
    video.muted = !aan;
    if (knop) {
      knop.setAttribute('aria-pressed', aan ? 'true' : 'false');
      knop.querySelector('use').setAttribute('href', aan ? '#icon-sound' : '#icon-sound-off');
      knop.querySelector('.wall-sound-text').textContent = aan ? 'Geluid uit' : 'Geluid aan';
    }
    metGeluid = aan ? video : (metGeluid === video ? null : metGeluid);
  }

  items.forEach(function (item) {
    var video = item.querySelector('video');
    var knop = item.querySelector('.wall-sound');
    if (!video || !knop) return;
    knop.addEventListener('click', function () {
      var aan = video.muted;
      if (aan && metGeluid && metGeluid !== video) zetGeluid(metGeluid, false);
      zetGeluid(video, aan);
      if (aan) speel(video);
    });
  });
})();
