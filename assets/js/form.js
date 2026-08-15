/* Leonie Coaching — Fragebogen-Logik */
(function () {
  'use strict';

  var cfg = window.LEONIE_CONFIG || {};
  var form = document.getElementById('quiz');
  if (!form) return;

  var steps = Array.prototype.slice.call(form.querySelectorAll('.fstep'));
  var dots = Array.prototype.slice.call(document.querySelectorAll('.steps-bar .dot'));
  var nextBtn = document.getElementById('nextBtn');
  var backBtn = document.getElementById('backBtn');
  var nav = document.getElementById('formNav');
  var label = document.getElementById('stepLabel');
  var pct = document.getElementById('stepPct');
  var savedNote = document.getElementById('savedNote');
  var sendError = document.getElementById('sendError');
  var LAST = steps.length - 1;          // Danke-Schritt
  var REVIEW = LAST - 1;                // Zusammenfassung
  var current = 0;

  /* ---------- Zwischenstand speichern ---------- */
  function fields() {
    return Array.prototype.slice.call(form.elements).filter(function (el) {
      return el.name && el.name !== 'website' && el.type !== 'button' && el.type !== 'submit';
    });
  }

  function save() {
    try {
      var data = {};
      fields().forEach(function (el) {
        if (el.type === 'radio') { if (el.checked) data[el.name] = el.value; }
        else if (el.type === 'checkbox') { data[el.id || el.name] = el.checked; }
        else if (el.value) { data[el.id || el.name] = el.value; }
      });
      localStorage.setItem(cfg.storageKey || 'leonie-fragebogen', JSON.stringify(data));
    } catch (e) { /* Privatmodus o. Ä. — dann eben ohne Speichern */ }
  }

  function restore() {
    try {
      var raw = localStorage.getItem(cfg.storageKey || 'leonie-fragebogen');
      if (!raw) return;
      var data = JSON.parse(raw);
      fields().forEach(function (el) {
        if (el.type === 'radio') { if (data[el.name] === el.value) el.checked = true; }
        else if (el.type === 'checkbox') { el.checked = !!data[el.id || el.name]; }
        else if (data[el.id || el.name] !== undefined) { el.value = data[el.id || el.name]; }
      });
    } catch (e) { /* egal */ }
  }
  restore();
  form.addEventListener('input', save);
  form.addEventListener('change', save);

  /* Fehlermeldungen für Screenreader ankündigen (WCAG) */
  form.querySelectorAll('.error').forEach(function (el) {
    el.setAttribute('role', 'alert');
  });

  /* ---------- Validierung ---------- */
  function markField(el, ok) {
    var wrap = el.closest('.field');
    if (!wrap) return;
    wrap.classList.toggle('invalid', !ok);
  }

  function validateStep(i) {
    var ok = true, firstBad = null;
    var required = steps[i].querySelectorAll('[required]');
    var seenRadio = {};
    Array.prototype.forEach.call(required, function (el) {
      var good = true;
      if (el.type === 'radio') {
        if (seenRadio[el.name]) return;
        seenRadio[el.name] = true;
        good = !!form.querySelector('input[name="' + el.name + '"]:checked');
      } else if (el.type === 'checkbox') {
        good = el.checked;
      } else if (el.type === 'email') {
        good = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim());
      } else {
        good = el.value.trim() !== '';
      }
      markField(el, good);
      if (!good) { ok = false; if (!firstBad) firstBad = el; }
    });
    if (firstBad) {
      var box = firstBad.closest('.field') || firstBad;
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (firstBad.focus && firstBad.type !== 'radio') firstBad.focus({ preventScroll: true });
    }
    return ok;
  }

  form.addEventListener('input', function (e) {
    var wrap = e.target.closest && e.target.closest('.field.invalid');
    if (wrap) validateLive(e.target, wrap);
  });
  form.addEventListener('change', function (e) {
    var wrap = e.target.closest && e.target.closest('.field.invalid');
    if (wrap) validateLive(e.target, wrap);
  });
  function validateLive(el, wrap) {
    var good = el.type === 'checkbox' ? el.checked
      : el.type === 'radio' ? !!form.querySelector('input[name="' + el.name + '"]:checked')
      : el.type === 'email' ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim())
      : el.value.trim() !== '';
    if (good) wrap.classList.remove('invalid');
  }

  /* ---------- Schrittwechsel ---------- */
  function show(i) {
    var from = steps[current];
    if (from && i !== current) {
      from.classList.add('leaving');
      setTimeout(function () { from.classList.remove('leaving', 'active'); }, 280);
    }
    setTimeout(function () {
      steps.forEach(function (s, n) { s.classList.toggle('active', n === i); });
    }, i !== current ? 280 : 0);

    current = i;
    dots.forEach(function (d, n) {
      d.classList.toggle('done', n < i);
      d.classList.toggle('active', n === i);
    });
    var title = steps[i].dataset.title || '';
    if (i === LAST) {
      nav.style.display = 'none';
      if (savedNote) savedNote.style.display = 'none';
      label.textContent = 'Fertig';
      pct.textContent = '100 %';
      dots.forEach(function (d) { d.classList.add('done'); });
    } else {
      label.textContent = 'Schritt ' + (i + 1) + ' von ' + (LAST) + ' · ' + title;
      pct.textContent = Math.round((i / REVIEW) * 100) + ' %';
    }
    backBtn.disabled = i === 0;
    nextBtn.querySelector('span').textContent = i === REVIEW ? 'Anfrage abschicken →' : 'Weiter →';

    var shell = document.querySelector('.form-shell');
    if (shell) {
      var top = shell.getBoundingClientRect().top + window.pageYOffset - 100;
      if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: 'smooth' });
    }
  }

  /* ---------- Zusammenfassung ---------- */
  function buildSummary() {
    var dl = document.getElementById('summaryList');
    dl.innerHTML = '';
    collect().forEach(function (row) {
      if (!row.value) return;
      var dt = document.createElement('dt'); dt.textContent = row.key;
      var dd = document.createElement('dd'); dd.textContent = row.value;
      dl.appendChild(dt); dl.appendChild(dd);
    });
  }

  function collect() {
    var out = [], seen = {};
    fields().forEach(function (el) {
      if (el.type === 'checkbox') return;
      var key = el.name;
      if (el.type === 'radio') {
        if (seen[key]) return;
        var picked = form.querySelector('input[name="' + key + '"]:checked');
        seen[key] = true;
        out.push({ key: key, value: picked ? picked.value : '' });
      } else {
        out.push({ key: key, value: el.value.trim() });
      }
    });
    return out;
  }

  /* ---------- Absenden ---------- */
  function payload() {
    var data = {};
    collect().forEach(function (r) { data[r.key] = r.value; });
    data['Einwilligung Datenschutz'] = document.getElementById('consent').checked ? 'Ja' : 'Nein';
    var nl = document.getElementById('newsletterOptIn');
    data['Newsletter gewünscht'] = nl && nl.checked ? 'Ja' : 'Nein';
    data['Gesendet am'] = new Date().toLocaleString('de-DE');
    data['Seite'] = location.href;
    return data;
  }

  function mailtoFallback(data) {
    var body = Object.keys(data).map(function (k) { return k + ': ' + data[k]; }).join('\n');
    var to = cfg.email || '';
    return 'mailto:' + to +
      '?subject=' + encodeURIComponent('Coaching-Anfrage: ' + (data['Vorname'] || '') + ' ' + (data['Nachname'] || '')) +
      '&body=' + encodeURIComponent(body);
  }

  function submit() {
    if (form.querySelector('input[name="website"]').value) return; // Bot
    var data = payload();
    sendError.style.display = 'none';
    nextBtn.classList.add('sending');
    nextBtn.querySelector('span').textContent = 'Wird gesendet …';

    function done() {
      maybeSubscribeNewsletter();
      try { localStorage.removeItem(cfg.storageKey || 'leonie-fragebogen'); } catch (e) {}
      nextBtn.classList.remove('sending');
      show(LAST);
    }

    /* Newsletter-Häkchen: Anmeldung separat anstoßen (Double-Opt-in macht der Endpoint) */
    function maybeSubscribeNewsletter() {
      var box = document.getElementById('newsletterOptIn');
      if (!box || !box.checked || !cfg.newsletterEndpoint) return;
      var email = data['E-Mail'] || '';
      if (!email) return;
      fetch(cfg.newsletterEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'subscribe', 'E-Mail': email })
      }).catch(function () { /* Anfrage ist wichtiger; Newsletter-Fehler still schlucken */ });
    }

    if (!cfg.endpoint) {
      window.location.href = mailtoFallback(data);
      setTimeout(done, 700);
      return;
    }

    fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(data)
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      done();
    }).catch(function () {
      nextBtn.classList.remove('sending');
      nextBtn.querySelector('span').textContent = 'Anfrage abschicken →';
      sendError.style.display = 'block';
      sendError.innerHTML = 'Das Absenden hat gerade nicht geklappt. ' +
        '<a href="' + mailtoFallback(data) + '" style="color:var(--pink)">Hier klicken</a>, um die Antworten stattdessen per E-Mail zu schicken.';
    });
  }

  /* ---------- Steuerung ---------- */
  nextBtn.addEventListener('click', function () {
    if (!validateStep(current)) return;
    if (current === REVIEW) { submit(); return; }
    var next = current + 1;
    if (next === REVIEW) buildSummary();
    show(next);
  });

  backBtn.addEventListener('click', function () {
    if (current > 0) show(current - 1);
  });

  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      nextBtn.click();
    }
  });

  /* Radiokacheln: Auswahl springt direkt weiter, wenn der Schritt komplett ist */
  form.querySelectorAll('.choice input[type=radio]').forEach(function (r) {
    r.addEventListener('change', function () {
      var step = steps[current];
      if (!step.querySelector('textarea[required], input[required], select[required]:not([type=radio])')) {
        setTimeout(function () { if (validateStep(current)) nextBtn.click(); }, 320);
      }
    });
  });

  show(0);
})();
