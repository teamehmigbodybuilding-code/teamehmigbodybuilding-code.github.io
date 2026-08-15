/* Leonie Coaching — Interaktion & Motion */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Mobile-Navigation ---------- */
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Sticky-CTA (mobil): erscheint nach dem Hero ---------- */
  var stickyCta = document.getElementById('stickyCta');
  var heroEl = document.querySelector('.hero');
  if (stickyCta && heroEl) document.body.classList.add('has-sticky-cta');
  function updateStickyCta() {
    if (!stickyCta || !heroEl) return;
    var pastHero = heroEl.getBoundingClientRect().bottom < 0;
    stickyCta.classList.toggle('show', pastHero);
    stickyCta.setAttribute('aria-hidden', String(!pastHero));
  }

  /* ---------- Überschriften in Zeilen zerlegen ---------- */
  document.querySelectorAll('[data-split]').forEach(function (el) {
    var html = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = html.map(function (line) {
      return '<span class="split-line"><span>' + line.trim() + '</span></span>';
    }).join('');
  });

  /* ---------- Fließtext in Wörter zerlegen ---------- */
  document.querySelectorAll('[data-words]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w, i) {
      return '<span class="word" style="animation-delay:' + (i * 0.028).toFixed(3) + 's">' + w + '</span>';
    }).join(' ');
  });

  /* ---------- Reveal beim Scrollen ---------- */
  var revealSel = '.reveal, [data-split], [data-words], [data-stagger], .img-reveal, .step, .trust-inner';
  var targets = document.querySelectorAll(revealSel);
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add('in'); });
  }

  /* ---------- Zahlen hochzählen ---------- */
  function countUp(el) {
    var target = parseFloat(el.dataset.count);
    var suffix = el.dataset.suffix || '';
    var dur = 1200, start = performance.now();
    function frame(now) {
      var p = Math.min((now - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window && !reduced) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { countUp(e.target); cio.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach(function (c) { cio.observe(c); });
  } else {
    counters.forEach(function (c) { c.textContent = c.dataset.count + (c.dataset.suffix || ''); });
  }

  /* ---------- Scroll-Fortschritt + Parallax ---------- */
  var bar = document.querySelector('.progress-bar');
  var parallax = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
  var ticking = false;

  function onScroll() {
    updateStickyCta();
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement;
      if (bar) {
        var p = h.scrollTop / Math.max(h.scrollHeight - h.clientHeight, 1);
        bar.style.transform = 'scaleX(' + p + ')';
      }
      if (!reduced) {
        var vh = window.innerHeight;
        parallax.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.bottom < -200 || r.top > vh + 200) return;
          var speed = parseFloat(el.dataset.parallax) || 0.12;
          var offset = (r.top + r.height / 2 - vh / 2) * -speed;
          el.style.transform = 'translate3d(0,' + offset.toFixed(1) + 'px,0)';
        });
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Karten-Licht + Cursor-Glow ---------- */
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  var glow = document.querySelector('.cursor-glow');
  if (glow && !reduced && window.matchMedia('(pointer: fine)').matches) {
    var gx = 0, gy = 0, tx = 0, ty = 0, running = false;
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      document.body.classList.add('has-cursor');
      if (!running) { running = true; requestAnimationFrame(loop); }
    });
    function loop() {
      gx += (tx - gx) * 0.12;
      gy += (ty - gy) * 0.12;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      if (Math.abs(tx - gx) > 0.5 || Math.abs(ty - gy) > 0.5) requestAnimationFrame(loop);
      else running = false;
    }
  }

  /* ---------- Laufband verdoppeln (nahtlose Schleife) ---------- */
  document.querySelectorAll('.marquee-track').forEach(function (track) {
    track.innerHTML += track.innerHTML;
  });

  /* ---------- Magnetische Buttons ---------- */
  if (!reduced && window.matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('.btn-lg').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) * 0.18;
        var dy = (e.clientY - (r.top + r.height / 2)) * 0.28;
        btn.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
    });
  }
})();
