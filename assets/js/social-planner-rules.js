/* ============================================================================
   ZIANI MEDIA — Social Media Planner: regels & data
   ============================================================================
   Dit bestand bevat ALLE inhoud en scoringslogica van de planner-tool
   ("Ontdek jouw social-ritme", sectie #planner op de homepage):
     - de vragen/stappen en hun antwoordopties (wat de bezoeker te zien krijgt)
     - de kanalen die geadviseerd kunnen worden
     - de 3 Groei-pakketten en hun harde grenzen
     - de scoringsregels die antwoorden vertalen naar een kanalenadvies + pakket

   Bewust losgekoppeld van de UI (social-planner.js). Wil je een vraag,
   antwoordoptie, kanaal-weging of pakketgrens aanpassen? Dat kan allemaal
   hier, zonder de wizard-component zelf aan te raken.

   Niets in dit bestand is een "black box": elke score is een simpel getal
   dat je kan optellen en narekenen (zie computeRecommendation onderaan).
   ============================================================================ */

(function (global) {
  'use strict';

  /* ---------------------------------------------------------------------
     1. DE 3 GROEI-PAKKETTEN
     Bron: de "Prijzen"-sectie op de site zelf (#prijzen) — dit bestand
     herhaalt bewust dezelfde cijfers, zodat het advies nooit iets kan
     beloven wat de pakketten niet waarmaken.
     --------------------------------------------------------------------- */
  var PACKAGES = {
    basis: {
      id: 'basis',
      name: 'Groei Basis',
      price: '€1.500 / maand · ex btw',
      videosPerWeek: 2, // 8 video's/maand
      socialBeheerIncluded: false, // bij Basis is dit een betaalde optie (+€100/mnd)
      tone: 'tone-lime',
      features: [
        "8 video's per maand (2 per week)",
        'Contentplanning op maat',
        "Social media beheer optioneel bij te boeken (+€100/maand)"
      ]
    },
    plus: {
      id: 'plus',
      name: 'Groei Plus',
      price: '€2.000 / maand · ex btw',
      videosPerWeek: 3, // 12 video's/maand
      socialBeheerIncluded: true,
      tone: 'featured',
      features: [
        "12 video's per maand (3 per week)",
        'Social media beheer inbegrepen (plaatsen, interactie, optimalisatie)',
        'Maandelijks overleg en bijsturing'
      ]
    },
    ultra: {
      id: 'ultra',
      name: 'Groei Ultra',
      price: '€2.600 / maand · ex btw',
      videosPerWeek: 4, // 16 video's/maand
      socialBeheerIncluded: true,
      tone: 'tone-coral',
      features: [
        "16 video's per maand (4 per week)",
        'Social media beheer inbegrepen (plaatsen, interactie, optimalisatie)',
        'Maandelijkse rapportage'
      ]
    }
  };
  // Volgorde waarin pakketten oplopen — gebruikt om de tier-score te clampen
  // zodat de tool NOOIT iets adviseert wat boven Ultra uitkomt.
  var PACKAGE_ORDER = ['basis', 'plus', 'ultra'];

  /* ---------------------------------------------------------------------
     2. KANALEN
     "type: video"  = wordt gevuld door dezelfde video's die het pakket al
                       levert (1 video wordt hergebruikt over meerdere
                       kanalen — bevestigd door de klant), dus de frequentie
                       = het aantal video's/week van het aanbevolen pakket.
     "type: text"   = geen video-kanaal; wordt als aanvullend advies getoond
                       met een eigen vaste, lage frequentie, los van de
                       videopakketten.
     --------------------------------------------------------------------- */
  var CHANNELS = {
    instagram: { id: 'instagram', label: 'Instagram', icon: 'icon-ch-camera', type: 'video', tone: 'tone-coral' },
    tiktok: { id: 'tiktok', label: 'TikTok', icon: 'icon-ch-note', type: 'video', tone: 'tone-primary' },
    facebook: { id: 'facebook', label: 'Facebook', icon: 'icon-ch-chat', type: 'video', tone: 'tone-lime' },
    youtube: { id: 'youtube', label: 'YouTube Shorts', icon: 'icon-play', type: 'video', tone: 'tone-coral' },
    linkedin: { id: 'linkedin', label: 'LinkedIn', icon: 'icon-ch-network', type: 'text', fixedPerWeek: 1, tone: 'tone-primary' },
    pinterest: { id: 'pinterest', label: 'Pinterest', icon: 'icon-ch-pin', type: 'text', fixedPerWeek: 2, tone: 'tone-lime' }
  };

  /* ---------------------------------------------------------------------
     3. VRAGEN / STAPPEN
     Elke stap = 1 "groepje" (brief: max 1 vraag/groepje per stap). Stap 4
     heeft 2 velden (frequentie + kanalen) omdat die onlosmakelijk bij
     elkaar horen ("huidige situatie").
     --------------------------------------------------------------------- */
  var BRANCHES = [
    { id: 'horeca', label: 'Horeca', hint: 'Restaurant, cafe, lunchroom' },
    { id: 'detailhandel', label: 'Lokale winkel', hint: 'Fysieke detailhandel' },
    { id: 'ecommerce', label: 'E-commerce / product', hint: 'Webshop, productmerk' },
    { id: 'beauty_auto', label: 'Beauty, wellness & detailing', hint: 'Salon, studio, auto detailing' },
    { id: 'overig', label: 'Anders / dienstverlening', hint: 'Past hierboven niet? Kies dit' }
  ];

  var SIZES = [
    { id: 'zzp', label: 'ZZP', hint: 'Ik werk alleen' },
    { id: 'klein_team', label: 'Klein team', hint: '2-10 medewerkers' },
    { id: 'groter_bedrijf', label: 'Groter bedrijf', hint: '10+ medewerkers' }
  ];

  var GOALS = [
    { id: 'naamsbekendheid', label: 'Naamsbekendheid', hint: 'Meer mensen kennen ons merk' },
    { id: 'leads_verkoop', label: 'Leads & verkoop', hint: 'Meer aanvragen of directe verkoop' },
    { id: 'community', label: 'Community & loyaliteit', hint: 'Bestaande klanten binden' },
    { id: 'recruitment', label: 'Personeel werven', hint: 'Nieuwe collega\'s aantrekken' }
  ];

  var CURRENT_FREQ = [
    { id: 'niet', label: 'Nauwelijks / nooit' },
    { id: 'een_keer', label: 'Ongeveer 1x per week' },
    { id: 'twee_drie', label: '2-3x per week' },
    { id: 'vier_plus', label: '4x per week of meer' }
  ];

  // Kanalen die je nu al kan gebruiken (multi-select) — dezelfde CHANNELS
  // lijst plus een "geen"-optie, zodat starters ook een geldig antwoord hebben.
  var CURRENT_CHANNEL_OPTIONS = [
    { id: 'instagram', label: 'Instagram' },
    { id: 'tiktok', label: 'TikTok' },
    { id: 'facebook', label: 'Facebook' },
    { id: 'youtube', label: 'YouTube' },
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'pinterest', label: 'Pinterest' },
    { id: 'geen', label: 'Nog geen enkel kanaal' }
  ];

  var TIME_BUDGET = [
    { id: 'zelf_weinig_tijd', label: 'Zelf posten, weinig tijd', hint: 'Minder dan 2 uur per week beschikbaar' },
    { id: 'zelf_tijd_vrij', label: 'Zelf posten, kan tijd vrijmaken', hint: 'Meerdere uren per week beschikbaar' },
    { id: 'uitbesteden', label: 'Het liefst volledig uitbesteden', hint: 'Wij regelen plaatsing en beheer' }
  ];

  var AUDIENCES = [
    { id: 'b2c_jong', label: 'Consument, vooral jong', hint: 'Grofweg onder de 35 jaar' },
    { id: 'b2c_breed', label: 'Consument, brede doelgroep', hint: 'Alle leeftijden' },
    { id: 'b2b', label: 'Andere bedrijven (B2B)', hint: 'Zakelijke klanten/opdrachtgevers' }
  ];

  var STEPS = [
    {
      id: 'branche',
      title: 'In welke branche zit je?',
      fields: [{ key: 'branche', type: 'single', options: BRANCHES }]
    },
    {
      id: 'grootte',
      title: 'Hoe groot is je bedrijf?',
      fields: [{ key: 'grootte', type: 'single', options: SIZES }]
    },
    {
      id: 'doel',
      title: 'Wat is je belangrijkste doel met social media?',
      fields: [{ key: 'doel', type: 'single', options: GOALS }]
    },
    {
      id: 'huidig',
      title: 'Hoe posten jullie op dit moment?',
      fields: [
        { key: 'huidigeFrequentie', label: 'Huidige postfrequentie', type: 'single', options: CURRENT_FREQ },
        { key: 'huidigeKanalen', label: 'Huidige kanalen (kies er meerdere)', type: 'multi', options: CURRENT_CHANNEL_OPTIONS }
      ]
    },
    {
      id: 'tijd',
      title: 'Hoe pak je content het liefst aan?',
      fields: [{ key: 'tijdBudget', type: 'single', options: TIME_BUDGET }]
    },
    {
      id: 'doelgroep',
      title: 'Wie is je belangrijkste doelgroep?',
      fields: [{ key: 'doelgroep', type: 'single', options: AUDIENCES }]
    }
  ];

  /* ---------------------------------------------------------------------
     4. SCORINGSREGELS — kanaaladvies
     Elk kanaal krijgt een score opgebouwd uit 3 optelbare onderdelen:
     branche-basisscore + doel-bonus + doelgroep-bonus. Hoe hoger, hoe
     relevanter. De top 3 kanalen met een positieve score worden getoond.
     Wijzig je iets? De optelsom blijft altijd naspeurbaar per stap.
     --------------------------------------------------------------------- */
  var BRANCH_CHANNEL_WEIGHTS = {
    horeca: { instagram: 3, facebook: 2, tiktok: 2, youtube: 1, linkedin: 0, pinterest: 0 },
    detailhandel: { instagram: 3, facebook: 2, tiktok: 2, youtube: 1, linkedin: 0, pinterest: 1 },
    ecommerce: { tiktok: 3, instagram: 3, youtube: 2, facebook: 1, pinterest: 1, linkedin: 0 },
    beauty_auto: { instagram: 3, tiktok: 3, youtube: 1, pinterest: 1, facebook: 1, linkedin: 0 },
    overig: { instagram: 2, facebook: 2, linkedin: 2, tiktok: 1, youtube: 1, pinterest: 1 }
  };

  var GOAL_CHANNEL_WEIGHTS = {
    naamsbekendheid: { tiktok: 2, instagram: 1, youtube: 2, facebook: 0, linkedin: 0, pinterest: 0 },
    leads_verkoop: { instagram: 2, facebook: 1, tiktok: 1, pinterest: 1, youtube: 0, linkedin: 0 },
    community: { facebook: 2, instagram: 1, tiktok: 0, youtube: 0, linkedin: 0, pinterest: 0 },
    recruitment: { linkedin: 3, instagram: 1, facebook: 0, tiktok: 0, youtube: 0, pinterest: 0 }
  };

  var AUDIENCE_CHANNEL_WEIGHTS = {
    b2c_jong: { tiktok: 2, instagram: 1, youtube: 1, facebook: -1, linkedin: -2, pinterest: 0 },
    b2c_breed: { instagram: 1, facebook: 1, tiktok: 0, youtube: 0, linkedin: -1, pinterest: 0 },
    b2b: { linkedin: 3, facebook: -1, tiktok: -2, instagram: 0, youtube: 0, pinterest: 0 }
  };

  // Korte "waarom"-zin per branche, gebruikt in de uitleg op het resultaatscherm.
  var BRANCH_REASON = {
    horeca: 'zaken als horeca leven van visuele sfeerbeelden die mensen direct langs laten komen',
    detailhandel: 'een lokale winkel wordt vooral gevonden door mensen in de buurt die producten en sfeer willen zien',
    ecommerce: 'productmerken groeien het snelst met kort, deelbaar videocontent dat direct naar een aankoop leidt',
    beauty_auto: 'resultaatgerichte branches zoals deze verkopen zichzelf het best met voor/na-beelden en proces-video\'s',
    overig: 'een brede mix aan kanalen geeft de beste kans om je doelgroep te bereiken'
  };

  /* ---------------------------------------------------------------------
     5. SCORINGSREGELS — pakketadvies
     Simpele optelsom (0-9) van 4 ambitie-indicatoren, met daarna één
     harde correctie op basis van een feit uit de pakketten zelf.
     --------------------------------------------------------------------- */
  var GOAL_FREQ_POINTS = { naamsbekendheid: 2, leads_verkoop: 2, community: 1, recruitment: 1 };
  var SIZE_FREQ_POINTS = { zzp: 0, klein_team: 1, groter_bedrijf: 2 };
  var CURRENT_FREQ_POINTS = { niet: 0, een_keer: 1, twee_drie: 2, vier_plus: 3 };
  var TIME_BUDGET_POINTS = { zelf_weinig_tijd: 0, zelf_tijd_vrij: 1, uitbesteden: 2 };
  // total loopt van 0 t/m 9 -> drempels verdelen dat grofweg in drieën.
  var TIER_THRESHOLDS = { basis: 3, plus: 6 }; // <=3 Basis, <=6 Plus, >6 Ultra

  function scoreToTier(total) {
    if (total <= TIER_THRESHOLDS.basis) return 'basis';
    if (total <= TIER_THRESHOLDS.plus) return 'plus';
    return 'ultra';
  }

  function clampTier(tierId) {
    var idx = PACKAGE_ORDER.indexOf(tierId);
    if (idx < 0) return 'basis';
    if (idx >= PACKAGE_ORDER.length) return PACKAGE_ORDER[PACKAGE_ORDER.length - 1];
    return PACKAGE_ORDER[idx];
  }

  function bumpTier(tierId, steps) {
    var idx = PACKAGE_ORDER.indexOf(tierId) + steps;
    idx = Math.max(0, Math.min(PACKAGE_ORDER.length - 1, idx));
    return PACKAGE_ORDER[idx];
  }

  /* ---------------------------------------------------------------------
     6. HOOFDFUNCTIE — combineert alles tot 1 concreet advies
     --------------------------------------------------------------------- */
  function computeRecommendation(answers) {
    var branchWeights = BRANCH_CHANNEL_WEIGHTS[answers.branche] || BRANCH_CHANNEL_WEIGHTS.overig;
    var goalWeights = GOAL_CHANNEL_WEIGHTS[answers.doel] || {};
    var audienceWeights = AUDIENCE_CHANNEL_WEIGHTS[answers.doelgroep] || {};

    // --- kanaalscore per kanaal, optelbaar en traceerbaar ---
    var channelScores = [];
    Object.keys(CHANNELS).forEach(function (channelId) {
      var score =
        (branchWeights[channelId] || 0) +
        (goalWeights[channelId] || 0) +
        (audienceWeights[channelId] || 0);
      channelScores.push({ id: channelId, score: score });
    });
    channelScores.sort(function (a, b) { return b.score - a.score; });
    var topChannelIds = channelScores
      .filter(function (c) { return c.score > 0; })
      .slice(0, 3)
      .map(function (c) { return c.id; });
    // Val terug op de eerste 3 sowieso als (bijna) niets een positieve score haalt.
    if (topChannelIds.length < 2) {
      topChannelIds = channelScores.slice(0, 3).map(function (c) { return c.id; });
    }

    // --- pakket-score: 4 optelbare punten, dan clampen + 1 harde correctie ---
    var tierPoints =
      (GOAL_FREQ_POINTS[answers.doel] || 0) +
      (SIZE_FREQ_POINTS[answers.grootte] || 0) +
      (CURRENT_FREQ_POINTS[answers.huidigeFrequentie] || 0) +
      (TIME_BUDGET_POINTS[answers.tijdBudget] || 0);
    var tierId = scoreToTier(tierPoints);

    // Harde regel (bron: PACKAGES.basis.socialBeheerIncluded === false):
    // wie expliciet volledige uitbesteding van plaatsing/beheer wil, past niet
    // bij Basis (daar is dat een betaalde optie) -> til minimaal naar Plus.
    if (answers.tijdBudget === 'uitbesteden' && tierId === 'basis') {
      tierId = bumpTier(tierId, 1);
    }
    tierId = clampTier(tierId); // nooit boven Ultra

    var pkg = PACKAGES[tierId];

    var channels = topChannelIds.map(function (channelId) {
      var channel = CHANNELS[channelId];
      var perWeek = channel.type === 'video' ? pkg.videosPerWeek : channel.fixedPerWeek;
      var freqLabel = perWeek === 1 ? '1x per week' : perWeek + 'x per week';
      return {
        id: channel.id,
        label: channel.label,
        icon: channel.icon,
        tone: channel.tone,
        perWeek: perWeek,
        frequencyLabel: freqLabel,
        note: channel.type === 'video'
          ? "Onderdeel van je maandelijkse video's (" + pkg.name + ')'
          : 'Aanvullend, los van je videopakket'
      };
    });

    var branchLabel = (BRANCHES.filter(function (b) { return b.id === answers.branche; })[0] || {}).label || 'jouw branche';
    var goalLabel = (GOALS.filter(function (g) { return g.id === answers.doel; })[0] || {}).label || 'jouw doel';
    var reason = BRANCH_REASON[answers.branche] || BRANCH_REASON.overig;
    var explanation = 'Voor ' + branchLabel.toLowerCase() + ' met als doel "' + goalLabel.toLowerCase() +
      '" werkt dit meestal het best, omdat ' + reason + '.';

    return {
      channels: channels,
      package: pkg,
      explanation: explanation,
      tierPoints: tierPoints // handig om te debuggen; niet getoond in de UI
    };
  }

  /* ---------------------------------------------------------------------
     Publiek object
     --------------------------------------------------------------------- */
  global.ZianiPlannerRules = {
    STEPS: STEPS,
    CHANNELS: CHANNELS,
    PACKAGES: PACKAGES,
    computeRecommendation: computeRecommendation
  };
})(window);
