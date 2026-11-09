// Digital Identity Atlas: interactive world map of national digital identity and
// verifiable credential implementations. Data lives in public/atlas/*.json.
// All elements live inside #atlas; styles are in the global block on src/pages/atlas.astro.

const root = document.getElementById('atlas');
if (root) init(root);

async function init(root) {
  const base = root.dataset.base || '';
  const load = (f) => fetch(`${base}/atlas/${f}.json`).then((r) => r.json());
  let COUNTRIES, SEED, SEED_IMGS;
  try {
    [COUNTRIES, SEED, SEED_IMGS] = await Promise.all([load('countries'), load('profiles'), load('seed-images')]);
  } catch (e) {
    root.querySelector('#atlasLoading').textContent = 'The map could not be loaded. Please refresh the page.';
    return;
  }
  root.querySelector('#atlasLoading').remove();
  const $ = (id) => root.querySelector('#' + id);
  const byId = {}; COUNTRIES.forEach((c) => (byId[c.id] = c));

  const TYPES = {
    SSO: { label: 'Single Sign-On (SSO)', color: '#3B8FD9', def: 'Federated login / authentication gateway (OIDC, SAML). Proves who is logging in at the time of the transaction; does not issue a portable credential the holder keeps.' },
    MATCH: { label: 'Identity Matching', color: '#E8803A', def: 'Foundational registry with live matching of biometrics, OTP or a signed QR/card against a central database (eKYC, registry checks). Every verification calls back to the issuer.' },
    'VC-PKI': { label: 'VC: X.509 / ISO mDoc / SD-JWT VC', color: '#1D995B', def: 'Holder-held credentials signed with traditional PKI: X.509 end-entity certificates and document types such as ISO/IEC 18013-5 mDoc and IETF SD-JWT VC, including the EUDI Wallet (PID / attestations). Verifiable offline.' },
    'VC-DLT': { label: 'VC: Blockchain / DLT', color: '#9466E0', def: 'W3C Verifiable Credentials with DIDs and trust anchors on a blockchain or distributed ledger (e.g. Hyperledger Indy, Ethereum, Polygon, ZKsync).' },
    HYBRID: { label: 'Hybrid', color: '#E2B42B', def: 'Two or more of the models above are live or in pilot in the same country (for example an SSO login layer plus registry identity matching plus state-issued VCs). On the map a hybrid country is striped in the colours of its component models.' },
  };
  const REGIONS = [
    { k: 'world', label: 'World', box: null },
    { k: 'europe', label: 'Europe', box: [440, 38, 625, 188], hint: [528, 92] },
    { k: 'asia', label: 'Asia', box: [600, 105, 885, 300], hint: [740, 185] },
    { k: 'pacific', label: 'Pacific', box: [770, 268, 1000, 462], hint: [905, 330] },
    { k: 'americas', label: 'Americas', box: [60, 40, 410, 480], hint: null },
    { k: 'africa', label: 'Africa & Middle East', box: [440, 160, 670, 420], hint: null },
  ];
  const HINT_REGIONS = ['europe', 'asia', 'pacific'];
  const DEFAULT_HINT = 'Click a highlighted region to zoom in &middot; double-click any country to focus';

  // ---------- storage (edits are kept in this visitor's browser only) ----------
  const PREFIX = 'idatlas3:'; const mem = {};
  const store = {
    async list() { try { return Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)); } catch (e) { return Object.keys(mem); } },
    async get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    async set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    async del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } },
  };

  const SEEDBY = {}; SEED.forEach((p) => (SEEDBY[p.i] = p));
  function normalise(p, id) {
    p = p && typeof p === 'object' ? p : {}; p.i = p.i || id; const s = SEEDBY[p.i] || {};
    ['img', 'leg', 'ag', 'links', 'comps'].forEach((k) => { if (!Array.isArray(p[k])) p[k] = Array.isArray(s[k]) ? s[k].slice() : []; });
    if (!p.comps.length && s.comps) p.comps = s.comps.slice();
    p.comps = p.comps.filter((c) => c && TYPES[c.t] && c.t !== 'HYBRID');
    p.links = p.links.filter((l) => Array.isArray(l) && l.length);
    if (!TYPES[p.type]) p.type = s.type || 'SSO';
    const act = []; p.comps.forEach((c) => { if (c.st !== 'F' && !act.includes(c.t)) act.push(c.t); });
    if (p.type === 'HYBRID') { p.mix = act.length > 1 ? act : (Array.isArray(p.mix) && p.mix.length > 1 ? p.mix.filter((t) => TYPES[t] && t !== 'HYBRID') : ['SSO', 'MATCH']); }
    else p.mix = [p.type];
    ['n', 'pop', 'app', 'takeup', 'sum', 'status', 'cc', 'region'].forEach((k) => { if (p[k] == null) p[k] = s[k] != null ? s[k] : ''; });
    if (!p.n) p.n = byId[p.i] ? byId[p.i].name : p.i; if (!p.status) p.status = 'Proposed'; if (!p.region) p.region = 'other';
    return p;
  }
  const P = {};
  SEED.forEach((p) => (P[p.i] = normalise(p, p.i)));
  let mode = 'view', selected = null, typeFilter = new Set(Object.keys(TYPES));

  const svg = $('map'), countryLayer = $('countryLayer'), markerLayer = $('markerLayer'), labelLayer = $('labelLayer'), zoomGroup = $('zoomGroup'), mapWrap = $('mapWrap'), tooltip = $('atlasTip'), drawer = $('drawer'), drawerHead = $('drawerHead'), drawerBody = $('drawerBody'), hintLayer = $('hintLayer'), zoomHint = $('zoomHint');
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
  const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const flagUrl = (p, w) => (p && p.cc ? 'https://flagcdn.com/' + (w || 'w160') + '/' + p.cc.toLowerCase() + '.png' : '');
  const flagEmoji = (cc) => (cc ? String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0))) : '');
  const proj = (lon, lat) => [504.8 + 2.632 * lon, 298.07 - 3.2376 * lat];

  // Hatch patterns for pilot / proposed
  const defs = $('defs');
  Object.entries(TYPES).forEach(([k, t]) => {
    defs.insertAdjacentHTML('beforeend', `<pattern id="h-${k}" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)"><rect width="3" height="3" style="fill:var(--a-land)"/><rect width="1.6" height="3" fill="${t.color}"/></pattern>`);
  });

  // ---------- build map ----------
  COUNTRIES.forEach((c) => {
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', c.d); p.setAttribute('class', 'country'); p.dataset.id = c.id; countryLayer.appendChild(p);
  });
  function geomOf(id) { const p = P[id]; if (p && p.marker) { const [x, y] = proj(p.marker[0], p.marker[1]); return { cx: x, cy: y, bbox: [x - 4, y - 4, x + 4, y + 4] }; } return byId[id]; }
  function isTiny(id) { const c = byId[id]; if (!c) return true; const b = c.bbox; return b[2] - b[0] < 5 && b[3] - b[1] < 5; }

  const mixKey = (p) => (p.mix || [p.type]).join('_');
  const liveTypes = (p) => p.mix || [p.type];
  const propTypes = (p) => (p.comps || []).filter((c) => c.st === 'F').map((c) => c.t).filter((t) => !liveTypes(p).includes(t));
  function countP(p, counts) {
    liveTypes(p).forEach((t) => (counts[t] = (counts[t] || 0) + 1));
    if (p.type === 'HYBRID') counts.HYBRID = (counts.HYBRID || 0) + 1;
    counts._h = counts._h || {}; counts._f = counts._f || {};
    liveTypes(p).forEach((t) => { if (p.type === 'HYBRID') counts._h[t] = (counts._h[t] || 0) + 1; });
    [...new Set(propTypes(p))].forEach((t) => (counts._f[t] = (counts._f[t] || 0) + 1));
  }
  const filterOn = () => typeFilter.size < Object.keys(TYPES).length;
  function filterMatch(p) {
    if (!filterOn()) return { m: 'live' };
    if (typeFilter.has('HYBRID') && p.type === 'HYBRID') return { m: 'live', t: null };
    const lt = liveTypes(p).find((t) => typeFilter.has(t)); if (lt) return { m: 'live', t: lt };
    const ft = propTypes(p).find((t) => typeFilter.has(t)); if (ft) return { m: 'prop', t: ft };
    return { m: null };
  }
  const matchesFilter = (p) => !!filterMatch(p).m;
  function ensureMixPatterns() {
    const seen = new Set();
    Object.values(P).forEach((p) => {
      if (p.type !== 'HYBRID') return; const k = mixKey(p);
      if (seen.has(k) || root.querySelector('#mix-' + k)) return; seen.add(k);
      const cols = (p.mix || []).filter((t) => TYPES[t]).map((t) => TYPES[t].color); if (!cols.length) return;
      const w = 1.4 * cols.length;
      defs.insertAdjacentHTML('beforeend', `<pattern id="mix-${k}" class="mixpat" data-n="${cols.length}" patternUnits="userSpaceOnUse" width="${w}" height="${w}" patternTransform="rotate(45)">${cols.map((c, i) => `<rect x="${i * 1.4}" y="0" width="1.4" height="${w}" fill="${c}"/>`).join('')}</pattern>`);
    });
  }
  function render() {
    ensureMixPatterns();
    let count = 0; const counts = {}; Object.keys(TYPES).forEach((k) => (counts[k] = 0));
    countryLayer.querySelectorAll('path').forEach((el) => {
      const p = P[el.dataset.id]; el.className.baseVal = 'country';
      if (p) {
        count++; countP(p, counts); el.classList.add('has-data', 't-' + p.type);
        if (p.type === 'HYBRID') el.style.fill = `url(#mix-${mixKey(p)})`;
        else { el.style.fill = ''; if (p.status !== 'Production') el.classList.add('pending'); }
        const fm = filterMatch(p);
        if (fm.m) {
          el.classList.add('match-filter');
          if (filterOn() && fm.t) {
            if (fm.m === 'live') el.style.fill = TYPES[fm.t].color;
            else { el.style.fill = `url(#h-${fm.t})`; el.classList.add('prop-match'); }
          }
        }
      } else el.style.fill = '';
      if (selected === el.dataset.id) el.classList.add('sel');
    });
    markerLayer.innerHTML = ''; labelLayer.innerHTML = '';
    Object.values(P).forEach((p) => {
      if (!byId[p.i] && !p.marker) return;
      if (p.marker) { count++; countP(p, counts); }
      const g = geomOf(p.i); if (!g) return;
      if (p.marker || isTiny(p.i)) {
        const col = p.type === 'HYBRID' ? `url(#mix-${mixKey(p)})` : (TYPES[p.type] || TYPES.HYBRID).color;
        const m = document.createElementNS(NS, 'g'); m.setAttribute('class', 'mk' + (matchesFilter(p) ? ' match-filter' : '') + (selected === p.i ? ' sel' : '')); m.dataset.id = p.i;
        m.innerHTML = `<circle class="ring" cx="${g.cx}" cy="${g.cy}" r="4.2" stroke="${p.type === 'HYBRID' ? TYPES.HYBRID.color : col}"/><circle class="dot" cx="${g.cx}" cy="${g.cy}" r="2.3" fill="${col}"/>`;
        markerLayer.appendChild(m);
      }
      const t = document.createElementNS(NS, 'text'); t.setAttribute('x', g.cx); t.setAttribute('y', g.cy + (p.marker || isTiny(p.i) ? -6 : 1.5)); t.setAttribute('class', 'country-label on'); t.textContent = p.n; labelLayer.appendChild(t);
    });
    $('statCount').textContent = count;
    svg.classList.toggle('focus', !!selected);
    svg.classList.toggle('filtered', filterOn());
    buildLegend(counts); buildRegions(); scaleLabels();
  }
  const regionOf = (p) => p.region || 'other';
  function buildRegions() {
    const el = $('regions'); const cur = el.dataset.cur || 'world'; el.innerHTML = '';
    REGIONS.forEach((r) => {
      const n = r.k === 'world' ? Object.keys(P).length : Object.values(P).filter((p) => regionOf(p) === r.k).length;
      const b = document.createElement('button'); b.type = 'button'; if (r.k === cur) b.classList.add('active');
      b.innerHTML = `${r.label}<span class="cnt">${n}</span>`; b.onclick = () => goRegion(r.k); el.appendChild(b);
    });
    hintLayer.innerHTML = '';
    REGIONS.filter((r) => HINT_REGIONS.includes(r.k)).forEach((r) => {
      const n = Object.values(P).filter((p) => regionOf(p) === r.k).length;
      const d = document.createElement('button'); d.type = 'button'; d.className = 'region-hint'; d.dataset.k = r.k;
      d.innerHTML = `<span class="z">+</span><span><b>${r.label}</b> &middot; ${n} countries</span>`; d.onclick = () => goRegion(r.k); hintLayer.appendChild(d);
    });
    positionHints();
  }
  function updateFilterHint() {
    if (!filterOn()) { if (zoomHint.dataset.f) { zoomHint.innerHTML = zoomHint.dataset.prev || zoomHint.innerHTML; delete zoomHint.dataset.f; } return; }
    if (!zoomHint.dataset.f) { zoomHint.dataset.prev = zoomHint.innerHTML; zoomHint.dataset.f = '1'; }
    const ks = [...typeFilter];
    const live = Object.values(P).filter((p) => filterMatch(p).m === 'live');
    const prop = Object.values(P).filter((p) => filterMatch(p).m === 'prop');
    const hy = live.filter((p) => p.type === 'HYBRID').length;
    zoomHint.innerHTML = `<b>${ks.map((k) => TYPES[k].label).join(' + ')}</b> &middot; ${live.length} countries (${hy} within hybrids)${prop.length ? ` &middot; +${prop.length} proposed (dashed)` : ''} &middot; click the legend row again to clear`;
  }
  function buildLegend(counts) {
    const L = $('legend');
    L.innerHTML = '<h4>Identity model <span>click to filter</span></h4>' + Object.entries(TYPES).map(([k, t]) => `<button type="button" class="row${typeFilter.has(k) ? '' : ' off'}" data-k="${k}"><span class="sw" style="background:${k === 'HYBRID' ? `repeating-linear-gradient(45deg,${TYPES.SSO.color} 0 3px,${TYPES.MATCH.color} 3px 6px,${TYPES['VC-PKI'].color} 6px 9px)` : t.color}"></span>${t.label}<span class="n" title="Countries where this model is live or in pilot, including hybrids">${counts[k] || 0}${k !== 'HYBRID' && counts._h && counts._h[k] ? ` <i>(${counts._h[k]} hybrid)</i>` : ''}${k !== 'HYBRID' && counts._f && counts._f[k] ? ` <i class="pr">+${counts._f[k]} proposed</i>` : ''}</span></button>`).join('') + '<div class="foot"><span><i class="sw solid"></i>Production</span><span><i class="sw hatch"></i>Pilot / Proposed</span></div>';
    updateFilterHint();
    L.querySelectorAll('.row').forEach((r) => (r.onclick = () => {
      const k = r.dataset.k;
      if (typeFilter.size === Object.keys(TYPES).length) typeFilter = new Set([k]);
      else if (typeFilter.has(k)) { typeFilter.delete(k); if (!typeFilter.size) typeFilter = new Set(Object.keys(TYPES)); }
      else typeFilter.add(k);
      render();
    }));
  }

  // ---------- zoom / pan ----------
  const view = { x: 0, y: 0, k: 1 }; const VB = { w: 1000, h: 520 };
  function apply() { zoomGroup.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`); svg.classList.toggle('zoomed', view.k >= 1.9); scaleLabels(); positionHints(); }
  function scaleLabels() {
    const k = view.k;
    markerLayer.querySelectorAll('.mk').forEach((m) => { const d = m.querySelector('.dot'), r = m.querySelector('.ring'); const s = Math.max(0.15, 1 / Math.pow(k, 0.75)); d.setAttribute('r', 2.3 * s); r.setAttribute('r', 4.2 * s); });
    defs.querySelectorAll('pattern:not(.mixpat)').forEach((p) => { const w = Math.max(0.5, 3 / Math.sqrt(k)); p.setAttribute('width', w); p.setAttribute('height', w); p.children[0].setAttribute('width', w); p.children[0].setAttribute('height', w); p.children[1].setAttribute('width', w * 0.53); p.children[1].setAttribute('height', w); });
    defs.querySelectorAll('pattern.mixpat').forEach((p) => { const n = +p.dataset.n; const sw = Math.max(0.4, 2.4 / Math.sqrt(k)); p.setAttribute('width', sw * n); p.setAttribute('height', sw * n); [...p.children].forEach((r, i) => { r.setAttribute('x', i * sw); r.setAttribute('width', sw); r.setAttribute('height', sw * n); }); });
    const fs = Math.max(1.1, 5.6 / k);
    labelLayer.querySelectorAll('text').forEach((t) => { t.style.fontSize = fs + 'px'; t.style.strokeWidth = fs * 0.28 + 'px'; });
  }
  const clampK = (k) => Math.max(1, Math.min(24, k));
  function geom() { const r = svg.getBoundingClientRect(); const s = Math.max(VB.w / r.width, VB.h / r.height) || 1; return { r, s, ox: (r.width * s - VB.w) / 2, oy: (r.height * s - VB.h) / 2 }; }
  function constrain() {
    const { ox, oy } = geom(); const w = VB.w * view.k, h = VB.h * view.k; const M = view.k > 1.2 ? 260 : 0;
    view.x = view.k === 1 ? 0 : Math.max(Math.min(-ox, VB.w + ox - w) - M, Math.min(Math.max(-ox, VB.w + ox - w) + M * 0.4, view.x));
    view.y = view.k === 1 ? 0 : Math.max(Math.min(-oy, VB.h + oy - h), Math.min(Math.max(-oy, VB.h + oy - h), view.y));
  }
  function svgPt(cx, cy) { const { r, s, ox, oy } = geom(); return [(cx - r.left) * s - ox, (cy - r.top) * s - oy]; }
  function scrPt(x, y) { const { s, ox, oy } = geom(); return [(x + ox) / s, (y + oy) / s]; }
  function zoomAt(cx, cy, f) { const [sx, sy] = svgPt(cx, cy); const px = (sx - view.x) / view.k, py = (sy - view.y) / view.k; const k = clampK(view.k * f); view.x = sx - px * k; view.y = sy - py * k; view.k = k; constrain(); apply(); }
  let anim = null;
  function zoomToBox(b, pad, cap) {
    const [x0, y0, x1, y1] = b; const bw = Math.max(x1 - x0, 10), bh = Math.max(y1 - y0, 10);
    const k = Math.min(cap || 24, clampK(Math.min(VB.w / (bw * (pad || 1.15)), VB.h / (bh * (pad || 1.15)))));
    const tgt = { k, x: VB.w / 2 - ((x0 + x1) / 2) * k, y: VB.h / 2 - ((y0 + y1) / 2) * k };
    const from = { ...view }; const t0 = performance.now(); cancelAnimationFrame(anim);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const step = (t) => { const u = reduce ? 1 : Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - u, 3); view.k = from.k + (tgt.k - from.k) * e; view.x = from.x + (tgt.x - from.x) * e; view.y = from.y + (tgt.y - from.y) * e; constrain(); apply(); if (u < 1) anim = requestAnimationFrame(step); };
    anim = requestAnimationFrame(step);
  }
  function goRegion(k) {
    const r = REGIONS.find((x) => x.k === k); $('regions').dataset.cur = k; buildRegions();
    if (!r.box) { zoomToBox([0, 0, 1000, 520], 1); zoomHint.innerHTML = DEFAULT_HINT; return; }
    zoomToBox(r.box, 1.12); const n = Object.values(P).filter((p) => regionOf(p) === k).length;
    zoomHint.innerHTML = `<b>${r.label}</b> &middot; ${n} profiled countries &middot; hover for a summary, click for the full profile`;
  }
  function positionHints() {
    hintLayer.querySelectorAll('.region-hint').forEach((d) => {
      const r = REGIONS.find((x) => x.k === d.dataset.k); const [x, y] = scrPt(r.hint[0] * view.k + view.x, r.hint[1] * view.k + view.y);
      const mr = mapWrap.getBoundingClientRect(), sr = svg.getBoundingClientRect();
      d.style.left = x + sr.left - mr.left + 'px'; d.style.top = y + sr.top - mr.top + 'px'; d.classList.toggle('hide', view.k > 1.6);
    });
  }
  function zoomToCountry(id) {
    const g = geomOf(id); if (!g) return; let b = g.bbox; if (id === '242') b = [985, 345, 1000, 362];
    const w = b[2] - b[0], h = b[3] - b[1]; const pad = Math.max(w, h) < 20 ? 2.4 : 1.5;
    zoomToBox([b[0] - (w < 8 ? 8 : 0), b[1] - (h < 8 ? 6 : 0), b[2] + (w < 8 ? 8 : 0), b[3] + (h < 8 ? 6 : 0)], pad, 9);
  }
  const centre = () => { const r = svg.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  $('zoomIn').onclick = () => zoomAt(...centre(), 1.5);
  $('zoomOut').onclick = () => zoomAt(...centre(), 1 / 1.5);
  $('zoomReset').onclick = () => { select(null); goRegion('world'); };
  // Only capture the wheel once the map is zoomed or with a modifier, so the page still scrolls past it.
  mapWrap.addEventListener('wheel', (e) => {
    if (view.k === 1 && !(e.ctrlKey || e.metaKey) && e.deltaY > 0) return;
    e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });
  let dragging = false, ds = null, dragged = false;
  mapWrap.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.region-hint,.legend,.zoom-controls')) return;
    dragging = true; dragged = false; ds = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; mapWrap.classList.add('grabbing');
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return; const { s } = geom(); const dx = (e.clientX - ds.x) * s, dy = (e.clientY - ds.y) * s;
    if (Math.abs(dx) + Math.abs(dy) > 2) dragged = true; view.x = ds.vx + dx; view.y = ds.vy + dy; constrain(); apply();
  });
  window.addEventListener('pointerup', () => { dragging = false; mapWrap.classList.remove('grabbing'); });
  window.addEventListener('resize', positionHints);

  // ---------- tooltip ----------
  const STL = { L: 'Live', P: 'Pilot', F: 'Proposed' };
  function compsHTML(p, compact) {
    const cs = p.comps || []; if (!cs.length) return '';
    return `<div class="comps">${cs.filter((c) => TYPES[c.t]).map((c) => `<div class="comp${c.st === 'F' ? ' fut' : ''}"><span class="cdot" style="background:${TYPES[c.t].color}"></span><div><b>${esc(TYPES[c.t].label)}</b>${compact ? '' : `<span class="cst">${STL[c.st]}</span>`}<div class="csys">${esc(c.s)}${compact && c.st !== 'L' ? ` (${STL[c.st].toLowerCase()})` : ''}</div></div></div>`).join('')}</div>`;
  }
  function typeChip(t) { const T = TYPES[t] || TYPES.HYBRID; return `<span class="chip" style="--c:${T.color}">${esc(T.label)}</span>`; }
  const flagImg = (p, w, cls) => (p.cc ? `<img${cls ? ` class="${cls}"` : ''} src="${flagUrl(p, w)}" alt="Flag of ${esc(p.n)}" onerror="this.replaceWith(document.createTextNode('${flagEmoji(p.cc)}'))">` : '');
  function showTip(id, x, y) {
    const p = P[id]; if (!p) return;
    tooltip.innerHTML = `<div class="tt-head">${flagImg(p, 'w80')}<div class="nm">${esc(p.n)}</div></div><div class="tt-body"><div class="chips">${typeChip(p.type)}<span class="chip status ${esc(p.status)}">${esc(p.status)}</span></div><div class="k">Identity models</div>${compsHTML(p, true)}<div class="k">Take-up</div><div>${esc(p.takeup)}</div></div>`;
    tooltip.classList.add('show'); const w = 290, h = tooltip.offsetHeight;
    let l = x + 16, t = y + 16; if (l + w > innerWidth - 8) l = x - w - 16; if (t + h > innerHeight - 8) t = innerHeight - h - 8;
    tooltip.style.left = l + 'px'; tooltip.style.top = t + 'px';
  }
  const hideTip = () => tooltip.classList.remove('show');
  function idFromEvent(e) { const t = e.target; const m = t.closest && t.closest('.mk'); if (m) return m.dataset.id; if (t.tagName === 'path' && t.dataset.id) return t.dataset.id; return null; }
  svg.addEventListener('mousemove', (e) => { if (dragging) return; const id = idFromEvent(e); if (id && P[id] && mode === 'view') showTip(id, e.clientX, e.clientY); else hideTip(); });
  svg.addEventListener('mouseleave', hideTip);
  svg.addEventListener('click', (e) => { if (dragged) { dragged = false; return; } const id = idFromEvent(e); hideTip(); if (!id) { if (selected) select(null); return; } if (mode === 'view') openView(id); else openEdit(id); });
  svg.addEventListener('dblclick', (e) => { const id = idFromEvent(e); if (id) zoomToCountry(id); });

  function select(id) { selected = id; render(); if (!id) drawer.classList.remove('open'); }

  // ---------- drawer: view ----------
  function head(p, name, eyebrow) {
    drawerHead.innerHTML = `${p && p.cc ? flagImg(p, 'w160', 'flag') : ''}<div><p class="a-eyebrow">${eyebrow}</p><h2>${esc(name)}</h2><div class="chips">${p ? typeChip(p.type) + `<span class="chip status ${esc(p.status)}">${esc(p.status)}</span>` : ''}</div></div><button type="button" class="drawer-close" aria-label="Close">&#10005;</button>`;
    drawerHead.querySelector('.drawer-close').onclick = () => select(null);
  }
  const imgSrc = (u) => (u && u.startsWith('SEED:') ? SEED_IMGS[u.slice(5)] : u);
  function openView(id) {
    const p = P[id]; const name = p ? p.n : byId[id] ? byId[id].name : id; select(id); zoomToCountry(id);
    if (!p) {
      head(null, name, 'No profile yet');
      drawerBody.innerHTML = `<p class="empty">No digital identity profile has been added for ${esc(name)}.</p><button type="button" class="a-btn a-btn-primary" id="goEdit">Add profile in Edit mode</button>`;
      $('goEdit').onclick = () => { setMode('edit'); openEdit(id); }; drawer.classList.add('open'); return;
    }
    head(p, p.n, 'Country profile');
    const imgs = (p.img || []).map(imgSrc).filter(Boolean).slice(0, 2);
    let gal = '';
    if (imgs.length) {
      const one = imgs.length === 1; const fromReport = (p.img || []).some((u) => u.startsWith('SEED:'));
      gal = `<div class="gallery">${imgs.map((u, i) => `<div class="shot${one ? ' full' : ''}"><img src="${u}" alt="${esc(p.app)}: image ${i + 1}" loading="lazy" referrerpolicy="no-referrer"></div>`).join('')}<div class="gal-cap">${fromReport ? 'Image from the South Asia country profile report.' : 'Images published by the government agency responsible for this system.'}</div></div>`;
    }
    const T = TYPES[p.type] || TYPES.HYBRID;
    const list = (a) => (a && a.length ? '<ul>' + a.map((x) => `<li>${fmt(x)}</li>`).join('') + '</ul>' : '<span class="none">Not recorded</span>');
    const paras = (p.sum || '').split(/\n+/).map((x) => `<p>${fmt(x)}</p>`).join('');
    drawerBody.innerHTML = gal + `<dl class="facts">
 <dt>Population</dt><dd>${esc(p.pop)}</dd>
 <dt>Digital identity type</dt><dd><div class="type-box">${typeChip(p.type)}<div class="def">${esc(T.def)}</div>${p.type === 'HYBRID' || (p.comps || []).length > 1 ? '<div class="k2">Component models</div>' + compsHTML(p, false) : ''}</div></dd>
 <dt>Primary platform / wallet</dt><dd>${esc(p.app)}</dd>
 <dt>Take-up</dt><dd>${fmt(p.takeup)}</dd>
 <dt>Legislation and regulation</dt><dd>${list(p.leg)}</dd>
 <dt>Key government identity agencies</dt><dd>${list(p.ag)}</dd>
 <dt>Summary</dt><dd class="summary">${paras}</dd>
 <dt>Official government links</dt><dd class="links">${p.links && p.links.length ? '<ul>' + p.links.map((l) => `<li><a href="${esc(l[1])}" target="_blank" rel="noopener">${esc(l[0])}</a><span class="u">${esc(l[1])}</span></li>`).join('') + '</ul>' : 'Not recorded'}</dd>
 </dl><div class="note">Compiled October 2026 from the project reports (South Asia, ASEAN, LAC, ID4D, DPI 2025, VC whitepaper) and public sources. Figures marked "verify" and any adoption counts should be confirmed against the primary source before external use.</div>
 <div class="actions"><button type="button" class="a-btn a-btn-ghost" id="goEdit">Edit this profile</button></div>`;
    drawerBody.querySelectorAll('.gallery img').forEach((img) => (img.onerror = () => galFail(img)));
    $('goEdit').onclick = () => { setMode('edit'); openEdit(id); };
    drawer.classList.add('open'); drawerBody.scrollTop = 0;
  }
  function galFail(img) { const shot = img.parentNode, g = shot.parentNode; shot.remove(); const left = g.querySelectorAll('.shot'); if (!left.length) { g.remove(); return; } if (left.length === 1) left[0].classList.add('full'); }

  // ---------- drawer: edit ----------
  function openEdit(id) {
    const p = P[id] || normalise({ i: id, n: byId[id] ? byId[id].name : id, type: 'SSO', status: 'Proposed', region: 'other' }, id);
    select(id); zoomToCountry(id); head(P[id], p.n, P[id] ? 'Edit profile' : 'New profile');
    const f = (k, l, v, ta, hint) => `<div class="field"><label for="f_${k}">${l}</label>${ta ? `<textarea id="f_${k}">${esc(v)}</textarea>` : `<input id="f_${k}" value="${esc(v)}">`}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`;
    drawerBody.innerHTML =
      `<p class="edit-note">Edits are saved in your browser only and are not published to other visitors.</p>` +
      f('n', 'Country', p.n) + f('cc', 'ISO country code (for flag)', p.cc || '') + f('pop', 'Population', p.pop) +
      `<div class="field"><label for="f_type">Digital identity type</label><select id="f_type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}"${p.type === k ? ' selected' : ''}>${t.label}</option>`).join('')}</select></div>` +
      `<div class="field"><label for="f_status">Status</label><select id="f_status">${['Production', 'Pilot', 'Proposed'].map((s) => `<option${p.status === s ? ' selected' : ''}>${s}</option>`).join('')}</select></div>` +
      f('app', 'Primary platform / wallet', p.app) + f('takeup', 'Take-up', p.takeup, true) +
      f('leg', 'Legislation and regulation', (p.leg || []).join('\n'), true, 'One item per line.') +
      f('ag', 'Key government agencies', (p.ag || []).join('\n'), true, 'One item per line.') +
      f('sum', 'Summary', p.sum, true, 'Supports **bold** and *italic*.') +
      f('links', 'Official links', (p.links || []).map((l) => l[0] + ' | ' + l[1]).join('\n'), true, 'One per line: Title | https://url') +
      f('img', 'Wallet image URLs (max 2)', (p.img || []).filter((u) => !u.startsWith('SEED:')).join('\n'), true, 'Paste image URLs, one per line, or upload below.') +
      `<div class="field"><label for="f_file">Upload wallet image</label><input type="file" id="f_file" accept="image/*"></div>` +
      `<div class="actions"><button type="button" class="a-btn a-btn-primary" id="saveBtn">Save profile</button>${P[id] ? '<button type="button" class="a-btn a-btn-danger" id="delBtn">Remove</button>' : ''}</div><div class="save-status" id="saveStatus"></div>`;
    let uploaded = null;
    const st = (m, c) => { const s = $('saveStatus'); s.textContent = m; s.className = 'save-status ' + (c || ''); };
    $('f_file').onchange = (e) => { const file = e.target.files[0]; if (!file) return; resize(file, 640, 0.82).then((d) => { uploaded = d; st('Image ready, it will be saved with the profile.', 'ok'); }); };
    const v = (k) => $('f_' + k).value.trim(); const lines = (k) => v(k).split('\n').map((x) => x.trim()).filter(Boolean);
    $('saveBtn').onclick = async () => {
      const seedImgs = (p.img || []).filter((u) => u.startsWith('SEED:'));
      let imgs = lines('img'); if (uploaded) imgs = [uploaded, ...imgs]; imgs = [...imgs, ...seedImgs].slice(0, 2);
      const np = { ...p, n: v('n') || p.n, cc: v('cc').toUpperCase(), pop: v('pop'), type: v('type'), status: v('status'), app: v('app'), takeup: v('takeup'), leg: lines('leg'), ag: lines('ag'), sum: v('sum'), links: lines('links').map((l) => { const [a, b] = l.split('|').map((x) => x.trim()); return [a, b || a]; }), img: imgs, updatedAt: Date.now() };
      try { normalise(np, id); await store.set(PREFIX + id, JSON.stringify(np)); P[id] = np; render(); st('Saved.', 'ok'); head(np, np.n, 'Edit profile'); } catch (e) { st('Save failed, please try again.', 'err'); }
    };
    const del = root.querySelector('#delBtn');
    if (del) del.onclick = async () => { if (!confirm('Remove the profile for ' + p.n + '? Seeded profiles are restored on reload.')) return; await store.del(PREFIX + id); delete P[id]; select(null); };
    drawer.classList.add('open'); drawerBody.scrollTop = 0;
  }
  function resize(file, max, q) {
    return new Promise((res, rej) => {
      const r = new FileReader(); r.onerror = rej;
      r.onload = () => { const im = new Image(); im.onerror = rej; im.onload = () => { let w = im.width, h = im.height; if (Math.max(w, h) > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h); res(c.toDataURL('image/jpeg', q)); }; im.src = r.result; };
      r.readAsDataURL(file);
    });
  }

  // ---------- mode ----------
  function setMode(m) {
    mode = m; $('btnView').classList.toggle('active', m === 'view'); $('btnEdit').classList.toggle('active', m === 'edit');
    mapWrap.classList.toggle('edit-mode', m === 'edit'); $('editBanner').classList.toggle('show', m === 'edit'); hideTip();
  }
  $('btnView').onclick = () => { setMode('view'); if (selected) openView(selected); };
  $('btnEdit').onclick = () => { setMode('edit'); if (selected) openEdit(selected); };

  // ---------- search ----------
  const si = $('searchInput'), sr = $('searchResults');
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function allEntries() { const m = {}; COUNTRIES.forEach((c) => (m[c.id] = { id: c.id, name: c.name })); Object.values(P).forEach((p) => (m[p.i] = { id: p.i, name: p.n })); return Object.values(m); }
  si.addEventListener('input', () => {
    const q = norm(si.value.trim()); sr.innerHTML = ''; if (!q) { sr.classList.remove('open'); return; }
    const res = allEntries().filter((e) => norm(e.name).includes(q) || (P[e.id] && norm(P[e.id].app || '').includes(q))).sort((a, b) => norm(b.name).startsWith(q) - norm(a.name).startsWith(q) || !!P[b.id] - !!P[a.id]).slice(0, 10);
    if (!res.length) sr.innerHTML = '<div class="search-item none">No match</div>';
    res.forEach((e) => {
      const p = P[e.id]; const d = document.createElement('button'); d.type = 'button'; d.className = 'search-item';
      d.innerHTML = `${p && p.cc ? `<img src="${flagUrl(p, 'w40')}" alt="" onerror="this.replaceWith(document.createTextNode('${flagEmoji(p.cc)}'))">` : ''}<span>${esc(e.name)}</span><span class="tag">${p ? esc((TYPES[p.type] || {}).label || '') : 'no data'}</span>`;
      d.onclick = () => { sr.classList.remove('open'); si.value = ''; mode === 'edit' ? openEdit(e.id) : openView(e.id); }; sr.appendChild(d);
    });
    sr.classList.add('open');
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search-wrap')) sr.classList.remove('open'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { select(null); hideTip(); } });

  // ---------- init ----------
  zoomHint.innerHTML = DEFAULT_HINT;
  apply(); render();
  try {
    for (const key of await store.list()) {
      const v = await store.get(key);
      if (v) { try { const id = key.slice(PREFIX.length); const p = normalise(JSON.parse(v), id); P[p.i] = p; } catch (e) { console.warn('Skipped stored profile', key, e); } }
    }
  } catch (e) { console.warn('Storage unavailable', e); }
  render();
}
