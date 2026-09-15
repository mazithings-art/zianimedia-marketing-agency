/* ============================================================================
   ZIANI MEDIA — Social Media Planner: wizard-UI
   ============================================================================
   Bouwt de interactieve stappen-quiz in #planner-app, aan de hand van de
   vragen/opties/scoringsregels uit social-planner-rules.js (ZianiPlannerRules).
   Puur client-side: geen opslag, geen verzending, alleen een direct resultaat.

   Houd deze twee bestanden gescheiden: pas de VRAGEN/REGELS aan in
   social-planner-rules.js, pas het GEDRAG/UITERLIJK van de wizard aan hier.
   ============================================================================ */

(function () {
  'use strict';

  var Rules = window.ZianiPlannerRules;
  if (!Rules) return; // rules-bestand ontbreekt/niet geladen: laat de sectie gewoon leeg

  var mount = document.getElementById('planner-app');
  if (!mount) return;

  var STEPS = Rules.STEPS;
  var state = {
    stepIndex: 0,
    answers: {}
  };

  /* ---------- kleine DOM-helper, geen framework nodig voor dit formaat ---------- */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      if (key === 'class') node.className = attrs[key];
      else if (key === 'text') node.textContent = attrs[key];
      else if (key === 'html') node.innerHTML = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function iconUse(iconId) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + iconId);
    svg.appendChild(use);
    return svg;
  }

  /* ---------- statische skelet (progressbalk, form, resultaat) — 1x opgebouwd ---------- */
  var progressWrap = el('div', { class: 'planner-progress' });
  var progressTrack = el('div', { class: 'planner-progress-track' });
  var progressFill = el('div', { class: 'planner-progress-fill' });
  progressTrack.appendChild(progressFill);
  var progressLabel = el('div', { class: 'planner-progress-label' });
  var progressStepText = el('span', {});
  var progressLive = el('span', { class: 'visually-hidden', 'aria-live': 'polite' });
  progressLabel.appendChild(progressStepText);
  progressWrap.appendChild(progressTrack);
  progressWrap.appendChild(progressLabel);
  progressWrap.appendChild(progressLive);

  var form = el('form', { class: 'planner-form', novalidate: 'novalidate' });
  var panelHost = el('div', { class: 'planner-panel-host' });
  var navWrap = el('div', { class: 'planner-nav' });
  var prevBtn = el('button', { type: 'button', class: 'btn btn-ghost', text: 'Vorige' });
  var nextBtn = el('button', { type: 'button', class: 'btn btn-primary', text: 'Volgende' });
  navWrap.appendChild(prevBtn);
  navWrap.appendChild(nextBtn);
  form.appendChild(panelHost);
  form.appendChild(navWrap);

  var resultHost = el('div', { class: 'planner-result', hidden: 'hidden' });

  mount.textContent = '';
  mount.appendChild(progressWrap);
  mount.appendChild(form);
  mount.appendChild(resultHost);

  /* ---------- validatie: mag Volgende aan? ---------- */
  function isStepComplete(step) {
    return step.fields.every(function (field) {
      var val = state.answers[field.key];
      if (field.type === 'multi') return Array.isArray(val) && val.length > 0;
      return !!val;
    });
  }

  /* ---------- 1 chip-veld (single of multi) bouwen ---------- */
  var chipUid = 0;
  function buildField(field, stepIndex) {
    var fieldWrap = el('div', { class: 'planner-field' });
    if (field.label) {
      fieldWrap.appendChild(el('span', { class: 'planner-field-label', text: field.label }));
    }
    var groupId = 'planner-group-' + stepIndex + '-' + field.key;
    var group = el('div', {
      class: 'planner-chip-grid',
      role: field.type === 'multi' ? 'group' : 'radiogroup',
      'aria-label': field.label || ''
    });
    var inputName = 'planner-field-' + field.key;
    var inputType = field.type === 'multi' ? 'checkbox' : 'radio';

    field.options.forEach(function (option) {
      chipUid += 1;
      var inputId = 'planner-opt-' + chipUid;
      var checked =
        field.type === 'multi'
          ? (state.answers[field.key] || []).indexOf(option.id) !== -1
          : state.answers[field.key] === option.id;

      var input = el('input', {
        type: inputType,
        name: inputName,
        id: inputId,
        value: option.id,
        class: 'planner-input-hidden'
      });
      if (checked) input.checked = true;

      var labelChildren = [el('span', { class: 'planner-chip-title', text: option.label })];
      if (option.hint) labelChildren.push(el('span', { class: 'planner-chip-hint', text: option.hint }));
      var label = el('label', { for: inputId, class: 'planner-chip' }, labelChildren);

      input.addEventListener('change', function () {
        if (field.type === 'multi') {
          var current = state.answers[field.key] ? state.answers[field.key].slice() : [];
          var pos = current.indexOf(option.id);
          if (input.checked && pos === -1) current.push(option.id);
          if (!input.checked && pos !== -1) current.splice(pos, 1);
          state.answers[field.key] = current;
        } else {
          state.answers[field.key] = option.id;
        }
        nextBtn.disabled = !isStepComplete(STEPS[state.stepIndex]);
      });

      group.appendChild(input);
      group.appendChild(label);
    });

    fieldWrap.appendChild(group);
    return fieldWrap;
  }

  /* ---------- huidige stap tekenen ---------- */
  function renderStep() {
    var step = STEPS[state.stepIndex];
    panelHost.textContent = '';

    var panel = el('fieldset', { class: 'planner-panel', id: 'planner-panel-' + step.id });
    var legend = el('legend', { class: 'planner-legend', text: step.title, tabindex: '-1' });
    panel.appendChild(legend);
    step.fields.forEach(function (field) {
      panel.appendChild(buildField(field, state.stepIndex));
    });
    panelHost.appendChild(panel);
    legend.focus({ preventScroll: true });

    prevBtn.hidden = state.stepIndex === 0;
    nextBtn.textContent = state.stepIndex === STEPS.length - 1 ? 'Bekijk mijn advies' : 'Volgende';
    nextBtn.disabled = !isStepComplete(step);

    var current = state.stepIndex + 1;
    var total = STEPS.length;
    progressFill.style.width = (current / total) * 100 + '%';
    progressStepText.textContent = 'Stap ' + current + ' van ' + total;
    progressLive.textContent = 'Stap ' + current + ' van ' + total + ': ' + step.title;
  }

  /* ---------- navigatie ---------- */
  prevBtn.addEventListener('click', function () {
    if (state.stepIndex === 0) return;
    state.stepIndex -= 1;
    renderStep();
  });

  nextBtn.addEventListener('click', function () {
    if (!isStepComplete(STEPS[state.stepIndex])) return;
    if (state.stepIndex < STEPS.length - 1) {
      state.stepIndex += 1;
      renderStep();
    } else {
      showResult();
    }
  });

  /* ---------- resultaatscherm ---------- */
  function channelCard(channel) {
    var iconBadge = el('span', { class: 'icon ' + channel.tone }, [iconUse(channel.icon)]);
    return el('div', { class: 'planner-channel-card' }, [
      iconBadge,
      el('h3', { text: channel.label }),
      el('p', { class: 'planner-channel-freq', text: channel.frequencyLabel }),
      el('p', { class: 'planner-channel-note', text: channel.note })
    ]);
  }

  function featureList(features) {
    var ul = el('ul', {});
    features.forEach(function (line) {
      ul.appendChild(el('li', {}, [iconUse('icon-check'), el('span', { text: line })]));
    });
    return ul;
  }

  function compareLists(rec) {
    var freqLabels = {};
    Rules.STEPS[3].fields[0].options.forEach(function (o) { freqLabels[o.id] = o.label; });
    var channelLabels = {};
    Rules.STEPS[3].fields[1].options.forEach(function (o) { channelLabels[o.id] = o.label; });

    var nowList = el('ul', {});
    nowList.appendChild(el('li', { text: 'Frequentie: ' + (freqLabels[state.answers.huidigeFrequentie] || '-') }));
    var nowChannels = (state.answers.huidigeKanalen || []).map(function (id) { return channelLabels[id] || id; });
    nowList.appendChild(el('li', { text: 'Kanalen: ' + (nowChannels.length ? nowChannels.join(', ') : 'geen') }));

    var adviesList = el('ul', {});
    rec.channels.forEach(function (c) {
      adviesList.appendChild(el('li', { text: c.label + ': ' + c.frequencyLabel }));
    });

    return el('div', { class: 'compare-grid planner-compare' }, [
      el('div', { class: 'compare-col old' }, [el('h3', { text: 'Nu' }), nowList]),
      el('div', { class: 'compare-col new' }, [el('h3', { text: 'Advies' }), adviesList])
    ]);
  }

  function showResult() {
    var rec = Rules.computeRecommendation(state.answers);
    resultHost.textContent = '';

    var head = el('div', { class: 'planner-result-head' }, [
      el('span', { class: 'eyebrow' }, [iconUse('icon-spark'), document.createTextNode('Jouw advies')]),
      el('h3', { text: 'Zo pak jij social media het beste aan' }),
      el('p', { class: 'lede', text: rec.explanation })
    ]);

    var channelGrid = el('div', { class: 'planner-channel-grid' }, rec.channels.map(channelCard));

    var pkg = rec.package;
    var pkgCard = el('div', { class: 'price-card ' + pkg.tone }, [
      pkg.tone === 'featured' ? el('span', { class: 'price-badge', text: 'Meest gekozen' }) : null,
      el('span', { class: 'price-kicker', text: 'Aanbevolen pakket' }),
      el('h3', { text: pkg.name }),
      el('div', { class: 'price-tag' }, [el('span', { class: 'amount', text: pkg.price })]),
      featureList(pkg.features),
      el('a', { href: '#prijzen', class: 'btn btn-primary btn-block', text: 'Bekijk pakket ' + pkg.name })
    ].filter(Boolean));
    var pkgWrap = el('div', { class: 'planner-package' }, [pkgCard]);

    var restart = el('button', { type: 'button', class: 'btn btn-ghost', text: 'Vragen opnieuw invullen' });
    restart.addEventListener('click', function () {
      state.stepIndex = 0;
      state.answers = {};
      resultHost.hidden = true;
      form.hidden = false;
      progressWrap.hidden = false;
      renderStep();
      panelHost.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });

    resultHost.appendChild(head);
    resultHost.appendChild(channelGrid);
    resultHost.appendChild(compareLists(rec));
    resultHost.appendChild(pkgWrap);
    resultHost.appendChild(
      el('p', {
        class: 'planner-disclaimer',
        text: 'Dit advies is een richtlijn op basis van jouw antwoorden, geen vaste toezegging. We stemmen de exacte invulling altijd samen met je af.'
      })
    );
    resultHost.appendChild(el('div', { class: 'planner-restart-wrap' }, [restart]));

    form.hidden = true;
    progressWrap.hidden = true;
    resultHost.hidden = false;
    resultHost.setAttribute('tabindex', '-1');
    resultHost.focus({ preventScroll: true });
  }

  /* ---------- reduced motion: geen fade-inschuif-animatie ---------- */
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    mount.setAttribute('data-reduced-motion', 'true');
  }

  renderStep();
})();
