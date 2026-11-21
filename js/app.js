/* 시냅스 아레나 — 화면 흐름
 * 홈(실험 목록) · 플레이(실험/연구실) · 대결 · 개념 노트 · 설계 노트 · 설정
 */
(function () {
  'use strict';
  const SA = globalThis.SA;
  const { sim, content, audio } = SA;
  const { STAGES, TRACKS, TAGS, RATES, SIGMAS, LAB_ARENAS, VERSUS_ARENAS, RIVALS, CONCEPTS, GLOSSARY, FUNCS_ALL, PAPERS, CONCEPT_PAPERS } = content;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tagClass = (t) => ({ '사고력': 't-think', '심화': 't-adv' }[t] || 't-ai');
  const CONCEPT_ORDER = [...new Set(STAGES.map((s) => s.concept).concat(['connectome']))];
  const SENSOR_COLOR = { bias: '#c9d3ea', eye: '#ffd166', danger: '#ff5fa2', wall: '#5ee6d0', input: '#8fd3ff', memory: '#f59f80' };

  // ===================================================================
  // 저장
  // ===================================================================
  const KEY = 'synapse-arena:v1';
  const DEFAULTS = {
    progress: {}, brains: {}, lab: { arena: 'lab-field', brain: null }, slots: [null, null, null, null, null, null],
    versus: { played: 0, records: {} }, concepts: [], tours: {},
    settings: { master: 0.8, bgm: 0.4, sfx: 0.7, bgmOn: true, spikes: true, sense: false, trail: true, dev: false, theme: 'light' },
  };
  let S = load();
  function load() {
    const base = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return base;
      const d = JSON.parse(raw);
      for (const k of Object.keys(base)) if (d[k] !== undefined) base[k] = d[k];
      base.settings = Object.assign({}, DEFAULTS.settings, d.settings || {});
      if (!Array.isArray(base.slots)) base.slots = [];
      while (base.slots.length < 6) base.slots.push(null); // 저장 슬롯 6개(예전 3개짜리 기록도 이어서 쓴다)
      if (!Array.isArray(base.concepts)) base.concepts = [];
      return base;
    } catch (e) { return base; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 저장 못 해도 게임은 된다 */ } }

  const emptyBrain = () => ({ hidden: [], synapses: [] });
  const cleared = (id) => !!(S.progress[id] && S.progress[id].cleared);
  // 잠금은 실험 순서대로 이어진다(튜토리얼은 건너뛰어도 된다)
  const trackOf = (st) => TRACKS.find((t) => t.id === st.track) || TRACKS[0];
  const trackList = (st) => STAGES.filter((x) => x.track === st.track);
  const isUnlockedSt = (st) => {
    const list = trackList(st), k = list.indexOf(st);
    return S.settings.dev || k <= 0 || list[k - 1].id === 'tut' || cleared(st.id) || cleared(list[k - 1].id);
  };
  const isUnlocked = (i) => isUnlockedSt(STAGES[i]);
  const neighbors = (st) => { const list = trackList(st), k = list.indexOf(st); return { prev: list[k - 1], next: list[k + 1] }; };
  const conceptOpen = (k) => S.settings.dev || S.concepts.includes(k);
  const mirrorUnlocked = () => S.settings.dev || !!(S.progress.s7 && S.progress.s7.cleared);
  function unlockConcept(k) {
    if (!k || S.concepts.includes(k)) return false;
    S.concepts.push(k);
    save();
    return true;
  }
  function totalStars() {
    let n = 0;
    for (const st of STAGES) { const p = S.progress[st.id]; if (p && p.stars) n += p.stars.filter(Boolean).length; }
    return n;
  }

  // ===================================================================
  // 공통 UI
  // ===================================================================
  let toastTimer = null;
  function toast(msg) {
    const root = $('#toastRoot');
    root.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, 2600);
  }
  let modalClose = null;
  function openModal(html, onClose) {
    const root = $('#modalRoot');
    root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    modalClose = onClose || null;
    const back = root.firstElementChild;
    back.addEventListener('mousedown', (e) => { if (e.target === back) closeModal(); });
    const first = root.querySelector('[data-autofocus]') || root.querySelector('.modal-actions .btn.primary') || root.querySelector('.modal-actions button');
    if (first) first.focus({ preventScroll: true });
    root.querySelector('.modal').scrollTop = 0;
    return root.querySelector('.modal');
  }
  function closeModal() {
    $('#modalRoot').innerHTML = '';
    const f = modalClose;
    modalClose = null;
    if (f) f();
  }
  const modalOpen = () => !!$('#modalRoot').firstElementChild;
  function starsHtml(arr, n = 3) {
    let h = '<span class="stars" aria-label="별">';
    for (let i = 0; i < n; i++) h += `<span class="${arr && arr[i] ? 'on' : ''}">★</span>`;
    return h + '</span>';
  }
  function fmtT(t) { return t.toFixed(1) + '초'; }

  // 실험 미리보기 그림(SVG)
  function stageThumb(cfg) {
    if (cfg.type === 'descent') {
      let g = `<svg class="stage-mini" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
      for (let k = 5; k >= 1; k--) g += `<ellipse cx="170" cy="52" rx="${k * 22}" ry="${k * (cfg.surface === 'valley' || cfg.surface === 'scales' ? 6 : 9)}" fill="rgba(${34 + k * 30},${86 + k * 18},${102 - k * 2},0.55)"/>`;
      g += '<path d="M60 20 L95 70 L120 30 L140 64 L160 44 L170 52" stroke="#fff" stroke-width="2.5" fill="none"/><circle cx="170" cy="52" r="6" fill="none" stroke="#f4c95d" stroke-width="2.5"/>';
      return g + '</svg>';
    }
    if (cfg.type === 'grid') {
      const rows = cfg.grid, cs = Math.min(84 / rows.length, 240 / rows[0].length), ox = (300 - cs * rows[0].length) / 2, oy = (100 - cs * rows.length) / 2;
      let g = `<svg class="stage-mini" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
      rows.forEach((line, y) => [...line].forEach((ch, x) => { g += `<rect x="${ox + x * cs + 1}" y="${oy + y * cs + 1}" width="${cs - 2}" height="${cs - 2}" rx="2" fill="${ch === '#' ? '#3a404b' : ch === 'G' ? '#f4c95d' : ch === 'g' ? 'rgba(244,201,93,.5)' : ch === 'S' ? '#8fd3ff' : '#262b33'}"/>`; }));
      return g + '</svg>';
    }
    if (cfg.plot) {
      let g = `<svg class="stage-mini" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect x="100" y="4" width="92" height="92" fill="none" stroke="#3a404b"/>`;
      const CL = ['#ffa94d', '#5aa9ff', '#7ee081', '#c3a6ff'];
      for (const r of cfg.rows) g += `<circle cx="${100 + r[0] * 92}" cy="${4 + (1 - r[1]) * 92}" r="3.6" fill="${cfg.classes ? CL[r[2]] : r[2] ? '#5aa9ff' : '#ffa94d'}"/>`;
      return g + '</svg>';
    }
    if (cfg.type === 'seq') {
      let g = `<svg class="stage-mini" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
      const q = cfg.seqs[0];
      q.x.forEach((v0, i) => {
        const v = Array.isArray(v0) ? v0[0] : v0;
        const step = Math.min(36, 236 / q.x.length), sz = step * 0.78, x = 24 + i * step;
        g += `<rect x="${x}" y="18" width="${sz}" height="${sz}" rx="5" fill="${v ? '#8fd3ff' : 'none'}" fill-opacity="${v ? Math.max(0.35, v) : 1}" stroke="#33415f" stroke-width="2"/>`;
        g += `<circle cx="${x + sz / 2}" cy="74" r="${sz * 0.4}" fill="${q.t[i] ? '#7ee081' : 'none'}" fill-opacity="${q.t[i] ? Math.max(0.35, q.t[i]) : 1}" stroke="${q.t[i] ? '#7ee081' : '#33415f'}" stroke-width="2.5"/>`;
      });
      return g + `<path d="M270 74 C 290 74, 290 32, 270 32" stroke="#f59f80" stroke-width="2" fill="none" stroke-dasharray="3 4"/></svg>`;
    }
    if (cfg.type === 'cluster') {
      let g = `<svg class="stage-mini" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect x="100" y="4" width="92" height="92" fill="none" stroke="#3a404b"/>`;
      for (const p of cfg.pts) g += `<circle cx="${100 + p[0] * 92}" cy="${4 + (1 - p[1]) * 92}" r="3.2" fill="#aab3c5"/>`;
      return g + '</svg>';
    }
    if (cfg.latent) {
      const n = cfg.inputs.length, m = (cfg.init || cfg.solution).hidden.length || 1;
      const col = (k, x, color) => Array.from({ length: k }, (_, i) => [x, 50 + (i - (k - 1) / 2) * 22, color]);
      const L = col(n, 80, '#8fd3ff'), M = col(m, 150, '#c3a6ff'), R = col(n, 220, '#7ee081');
      let g = `<svg class="stage-mini" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
      for (const a of L) for (const b of M) g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#5aa9ff" stroke-width="1.5" opacity=".5"/>`;
      for (const a of M) for (const b of R) g += `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#5aa9ff" stroke-width="1.5" opacity=".5"/>`;
      for (const [x, y, c] of L.concat(M, R)) g += `<circle cx="${x}" cy="${y}" r="7" fill="${c}"/>`;
      return g + '</svg>';
    }
    if (cfg.type === 'vision') {
      let g = `<svg class="stage-mini" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
      cfg.images.slice(0, 3).forEach((rows, k) => rows.forEach((line, y) => [...line].forEach((ch, x) => { g += `<rect x="${30 + k * 90 + x * 12}" y="${14 + y * 12}" width="11" height="11" fill="${ch === '#' ? '#e9e5dd' : '#2a2f38'}"/>`; })));
      return g + '</svg>';
    }
    if (cfg.type === 'logic' || cfg.type === 'train') {
      // 진리표 네 칸: 목표가 1인 칸만 불이 켜진다. 학습 실험은 오차 그래프를 덧그린다.
      let g = `<svg class="stage-mini" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
      cfg.rows.forEach((r, i) => {
        const x = 30 + i * 62;
        g += `<text x="${x + 14}" y="22" font-size="13" text-anchor="middle" fill="#8fd3ff" font-weight="700">${r[0]}${r[1]}</text>`;
        g += `<circle cx="${x + 14}" cy="56" r="17" fill="${r[2] ? '#ffd166' : 'none'}" stroke="${r[2] ? '#ffd166' : '#33415f'}" stroke-width="3"/>`;
      });
      if (cfg.type === 'train') g += `<path d="M20 92 C 80 92, 110 40, 280 ${cfg.id === 'T3' ? 70 : 96}" stroke="#ff5d73" stroke-width="3" fill="none" opacity=".8"/>`;
      return g + '</svg>';
    }
    let s = `<svg class="stage-mini" viewBox="0 0 900 600" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
    for (const [x, y, w, h] of cfg.walls || []) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#26324f"/>`;
    for (const [x, y, r] of cfg.marks || []) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(244,201,93,.15)" stroke="#f4c95d" stroke-width="5" stroke-dasharray="6 10"/>`;
    for (const [x, y, r] of cfg.hazards || []) s += `<circle cx="${x}" cy="${y}" r="${r * 1.5}" fill="#ff5fa2" opacity=".85"/>`;
    for (const [x, y] of cfg.decoys || []) s += `<circle cx="${x}" cy="${y}" r="40" fill="rgba(255,243,214,.18)"/><circle cx="${x}" cy="${y}" r="20" fill="#fff3d6"/>`;
    const foods = (cfg.foods || []).concat(cfg.foodQueue || []);
    foods.forEach(([x, y], i) => {
      s += `<circle cx="${x}" cy="${y}" r="44" fill="rgba(255,209,102,.16)"/><circle cx="${x}" cy="${y}" r="24" fill="#ffd166"/>`;
      if (cfg.foodQueue && cfg.foodQueue.length > 1) s += `<text x="${x}" y="${y + 11}" font-size="32" font-weight="800" text-anchor="middle" fill="#3a2a00">${i + 1}</text>`;
    });
    for (const p of cfg.predators || []) s += `<circle cx="${p.x}" cy="${p.y}" r="${p.r * 1.4}" fill="none" stroke="#c88cff" stroke-width="12" stroke-dasharray="6 10"/>`;
    const st = cfg.start || (cfg.starts && cfg.starts[0]);
    if (st) s += `<circle cx="${st.x}" cy="${st.y}" r="24" fill="none" stroke="#e9eefb" stroke-width="9"/><line x1="${st.x}" y1="${st.y}" x2="${st.x + Math.cos(st.a) * 56}" y2="${st.y + Math.sin(st.a) * 56}" stroke="#e9eefb" stroke-width="10" stroke-linecap="round"/>`;
    return s + '</svg>';
  }

  // 개념 카드 그림(SVG): 점과 선으로 그린 작은 회로도
  function conceptGlyph(key) {
    const L = [[14, 16], [14, 40]], R = [[60, 16], [60, 40]];
    const dot = (x, y, c) => `<circle cx="${x}" cy="${y}" r="5" fill="${c}"/>`;
    const line = (a, b, c, extra = '') => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${c}" stroke-width="2" ${extra}/>`;
    const B = '#5aa9ff', Rr = '#ff5d73', Y = '#ffd166', G = '#7ee081';
    let body = '';
    switch (key) {
      case 'bias': body = line([14, 28], R[0], B) + line([14, 28], R[1], B) + `<circle cx="14" cy="28" r="6" fill="#c9d3ea"/><text x="14" y="31.5" font-size="9" text-anchor="middle" font-weight="800" fill="#0a0e19">1</text>` + dot(...R[0], G) + dot(...R[1], G); break;
      case 'cross': body = line(L[0], R[1], B) + line(L[1], R[0], B) + dot(...L[0], Y) + dot(...L[1], Y) + dot(...R[0], G) + dot(...R[1], G); break;
      case 'reflex': body = line(L[0], R[0], B) + line(L[1], R[1], B) + dot(...L[0], '#ff5fa2') + dot(...L[1], '#ff5fa2') + dot(...R[0], G) + dot(...R[1], G); break;
      case 'inhibition': body = line(L[0], [54, 16], Rr) + line(L[1], [54, 40], Rr) + line([54, 10], [54, 22], Rr) + line([54, 34], [54, 46], Rr) + dot(...L[0], Y) + dot(...L[1], Y) + dot(...R[0], G) + dot(...R[1], G); break;
      case 'whisker': body = line([20, 28], [62, 10], '#5ee6d0') + line([20, 28], [62, 46], '#5ee6d0') + line([20, 28], [66, 28], '#5ee6d0', 'stroke-dasharray="3 3"') + dot(20, 28, '#e9eefb'); break;
      case 'hidden': body = line(L[0], [37, 16], B) + line(L[1], [37, 40], B) + line(L[1], [37, 16], Rr) + line(L[0], [37, 40], Rr) + line([37, 16], R[1], B) + line([37, 40], R[0], B) + dot(...L[0], Y) + dot(...L[1], Y) + dot(37, 16, '#c3a6ff') + dot(37, 40, '#c3a6ff') + dot(...R[0], G) + dot(...R[1], G); break;
      case 'weight': body = line([14, 28], [60, 28], B, 'stroke-width="5"') + dot(14, 28, '#8fd3ff') + dot(60, 28, G); break;
      case 'sum': body = line(L[0], [60, 28], B) + line(L[1], [60, 28], B) + line([14, 28], [60, 28], B) + dot(...L[0], '#8fd3ff') + dot(...L[1], '#8fd3ff') + dot(14, 28, '#8fd3ff') + dot(60, 28, G); break;
      case 'threshold': body = line([8, 40], [66, 40], '#33415f') + `<path d="M8 46 Q30 46 37 28 Q44 10 66 10" stroke="${Y}" stroke-width="2" fill="none"/>` + line([37, 4], [37, 52], Rr, 'stroke-dasharray="3 3"'); break;
      case 'negative': body = line([14, 28], [54, 28], Rr) + line([54, 20], [54, 36], Rr) + dot(14, 28, '#8fd3ff') + dot(62, 28, G); break;
      case 'xor': body = line(L[0], [37, 16], B) + line(L[1], [37, 40], B) + line(L[1], [37, 16], Rr) + line(L[0], [37, 40], Rr) + line([37, 16], [62, 28], B) + line([37, 40], [62, 28], B) + dot(...L[0], '#8fd3ff') + dot(...L[1], '#8fd3ff') + dot(37, 16, '#c3a6ff') + dot(37, 40, '#c3a6ff') + dot(62, 28, G); break;
      case 'learning': body = `<path d="M8 10 C 22 40, 40 46, 66 48" stroke="${Rr}" stroke-width="2.4" fill="none"/>` + line([8, 50], [68, 50], '#33415f'); break;
      case 'rate': body = `<path d="M8 10 L20 44 L32 14 L44 42 L56 18 L66 38" stroke="${Rr}" stroke-width="2" fill="none"/>` + `<path d="M8 10 C 24 36, 44 44, 66 46" stroke="${G}" stroke-width="2" fill="none"/>`; break;
      case 'limit': body = `<path d="M8 10 C 20 30, 30 30, 66 30" stroke="${Rr}" stroke-width="2.4" fill="none"/>` + line([8, 50], [68, 50], '#33415f') + line([8, 30], [68, 30], Rr, 'stroke-dasharray="2 4" opacity=".5"'); break;
      case 'backprop': body = line(L[0], [37, 16], B) + line(L[1], [37, 40], B) + line([37, 16], [62, 28], B) + line([37, 40], [62, 28], B) + `<path d="M60 36 Q48 50 34 46" stroke="${Rr}" stroke-width="2" fill="none"/><path d="M38 42 L33 46 L39 49" stroke="${Rr}" stroke-width="2" fill="none"/>` + dot(...L[0], '#8fd3ff') + dot(...L[1], '#8fd3ff') + dot(37, 16, '#c3a6ff') + dot(37, 40, '#c3a6ff') + dot(62, 28, G); break;
      case 'adversarial': body = `<circle cx="28" cy="34" r="12" fill="none" stroke="#c88cff" stroke-width="2" stroke-dasharray="2 3"/><path d="M34 24 Q44 6 58 18" stroke="#c88cff" stroke-width="1.6" fill="none"/>` + `<circle cx="58" cy="20" r="6" fill="#fff3d6"/><circle cx="58" cy="20" r="11" fill="rgba(255,209,102,.25)"/>`; break;
      case 'recurrent': case 'latch': case 'sequence': case 'longmem': case 'parity':
        body = line([14, 34], [60, 34], B) + `<path d="M60 26 C 62 6, 18 6, 16 24" stroke="#f59f80" stroke-width="2" fill="none" stroke-dasharray="3 3"/><path d="M12 20 L16 26 L21 21" stroke="#f59f80" stroke-width="2" fill="none"/>` + dot(14, 34, '#f59f80') + dot(60, 34, G); break;
      case 'unsupervised': case 'kmeans': case 'localmin': case 'choosek': {
        const rng = sim.makeRng('km' + key);
        [[20, 18, B], [52, 20, '#ffa94d'], [36, 42, G]].forEach(([cx, cy, c]) => { for (let i = 0; i < 6; i++) body += `<circle cx="${cx + (rng() - 0.5) * 16}" cy="${cy + (rng() - 0.5) * 12}" r="2.4" fill="${c}"/>`; body += `<circle cx="${cx}" cy="${cy}" r="5" fill="none" stroke="#f4f1ea" stroke-width="1.6"/>`; });
        break;
      }
      case 'autoencoder': case 'latent': case 'denoise': case 'representation':
        body = [[10, 10], [10, 28], [10, 46]].map((a) => line(a, [37, 22], B) + line(a, [37, 34], B)).join('') + [[64, 10], [64, 28], [64, 46]].map((b) => line([37, 22], b, B) + line([37, 34], b, B)).join('') +
          [[10, 10], [10, 28], [10, 46]].map((a) => dot(...a, '#8fd3ff')).join('') + dot(37, 22, '#c3a6ff') + dot(37, 34, '#c3a6ff') + [[64, 10], [64, 28], [64, 46]].map((b) => dot(...b, G)).join(''); break;
      default: {
        const rng = sim.makeRng('glyph');
        const pts = Array.from({ length: 11 }, () => [8 + rng() * 58, 8 + rng() * 40]);
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < 22) body += line(pts[i], pts[j], 'rgba(90,169,255,.6)');
        body += pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="${['#ffd166', '#7ee081', '#c3a6ff', '#ff5fa2'][i % 4]}"/>`).join('');
      }
    }
    return `<svg viewBox="0 0 74 56" aria-hidden="true">${body}</svg>`;
  }

  // ===================================================================
  // 라우팅
  // ===================================================================
  let view = 'home';
  let homeTrack = 'ai';
  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [v, arg] = h.split('/');
    if (play.state === 'running') setPlayState('paused');
    if (vs.state === 'playing') vs.paused = true;
    if (v === 'stage') {
      const i = STAGES.findIndex((s) => s.id === arg);
      if (i < 0) return go('home');
      if (!isUnlocked(i)) { toast('이전 실험을 먼저 깨야 열려요'); return go('home'); }
      play.mode = 'stage'; show('play'); openStage(STAGES[i]);
    } else if (v === 'lab') { play.mode = 'lab'; show('play'); openLab(); }
    else if (v === 'puzzles') { S.settings.tagFilter = '사고력'; save(); go('home'); }
    else if (v === 'versus') { show('versus'); renderVersus(); }
    else if (v === 'notes') { show('notes'); renderNotes(); }
    else { show('home'); renderHome(); }
  }
  function go(r) {
    const target = '#/' + r;
    if (location.hash === target) route(); else location.hash = target;
  }
  function show(v) {
    view = v;
    for (const id of ['home', 'play', 'versus', 'notes']) $('#view-' + id).classList.toggle('hidden', id !== v);
    const navKey = v === 'play' ? (play.mode === 'lab' ? 'lab' : 'home') : v;
    $$('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.go === navKey));
    document.querySelector('main').classList.toggle('play-mode', v === 'play');
    window.scrollTo(0, 0);
  }
  // 상단바 높이를 CSS에 알려 준다(실험 화면이 남은 높이를 꽉 채우도록)
  function syncTopbar() { document.documentElement.style.setProperty('--topbar-h', $('.topbar').offsetHeight + 'px'); }
  window.addEventListener('resize', syncTopbar);
  syncTopbar();
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) { e.preventDefault(); audio.unlock(); go(b.dataset.go); }
  });

  // ===================================================================
  // 홈
  // ===================================================================
  function renderHome() {
    const tr = TRACKS[0];
    const filter = S.settings.tagFilter || '전체';
    const list = STAGES.filter((st) => filter === '전체' || st.tag === filter);
    const clearedN = list.filter((st) => cleared(st.id)).length;
    const starsN = list.reduce((n, st) => n + ((S.progress[st.id] && S.progress[st.id].stars) || []).filter(Boolean).length, 0);
    const next = STAGES.find((st) => isUnlockedSt(st) && !cleared(st.id) && (filter === '전체' || st.tag === filter)) || list[0] || STAGES[0];
    const card = (st) => {
      const p = S.progress[st.id] || {};
      const locked = !isUnlockedSt(st);
      return `
        <button class="stage-card ${st.boss ? 'boss' : ''} ${locked ? 'locked' : ''} ${p.cleared ? 'cleared' : ''}" ${locked ? 'aria-disabled="true"' : `data-go="stage/${st.id}"`}>
          <span class="no">${st.boss ? '마무리 · ' : ''}${st.code} <span class="tag ${tagClass(st.tag)}">${esc(st.tag)}</span></span>
          <h3>${esc(st.title)}</h3>
          ${stageThumb(st)}
          <p>${esc(st.goalText)}</p>
          <div class="foot">${starsHtml(p.stars)}${locked ? '<span class="chip" title="앞 문제를 깨면 열려요">잠김</span>' : `<span class="chip">${esc(CONCEPTS[st.concept].title)}</span>`}</div>
        </button>`;
    };
    const chapters = tr.chapters.map((ch) => {
      const chList = list.filter((st) => st.chapter === ch.no);
      if (!chList.length) return '';
      const done = chList.filter((st) => cleared(st.id)).length;
      return `
        <div class="section-head chapter-head"><div><div class="eyebrow">${ch.no}장 · ${done}/${chList.length} <span class="tag ${tagClass(ch.tag)}">${esc(ch.tag)}</span></div><h2>${esc(ch.title)}</h2>
          <p class="muted" style="margin:4px 0 0;max-width:760px">${esc(ch.desc)}</p></div>
          <button class="btn sm ghost paper-btn" data-papers="${ch.no}">관련 논문 보러 가기 ↗</button></div>
        <div class="stage-grid">${chList.map(card).join('')}</div>`;
    }).join('');
    const counts = { '전체': STAGES.length };
    for (const t of TAGS) counts[t] = STAGES.filter((st) => st.tag === t).length;
    const heroText = { eyebrow: 'AI 배우기 · 점은 뉴런, 선은 시냅스', h1: '뇌를 <em>직접 이어</em> 보면<br>AI가 <em class="r">보인다</em>', p: '인공지능의 기본 단위는 뉴런 하나다. 입력에 가중치를 곱해 더하고, 문턱을 넘으면 켜진다. 그 뉴런을 손으로 이어 논리 게이트를 만들고, 생명체를 움직이고, 마지막에는 스스로 배우게 한다. 개념을 배우는 실험과 생각하는 힘을 기르는 퍼즐이 번갈아 나온다.' };
    $('#view-home').innerHTML = `
      <div class="hero">
        <canvas id="heroCanvas"></canvas>
        <div class="hero-inner">
          <div class="eyebrow">${heroText.eyebrow}</div>
          <h1>${heroText.h1}</h1>
          <p>${heroText.p}</p>
          <div class="hero-actions">
            <button class="btn primary" data-go="stage/${next.id}">▶ ${next.code} · ${esc(next.title)}</button>
            <button class="btn ghost" data-go="notes">개념 노트</button>
          </div>
        </div>
      </div>
      <div class="progress-row">
        <div class="stat-pill"><div class="k">깬 실험${filter === '전체' ? '' : ' (' + esc(filter) + ')'}</div><div class="v">${clearedN} / ${list.length}</div></div>
        <div class="stat-pill"><div class="k">모은 별</div><div class="v">★ ${starsN} / ${list.length * 3}</div></div>
        <div class="stat-pill"><div class="k">발견한 개념</div><div class="v">${CONCEPT_ORDER.filter(conceptOpen).length} / ${CONCEPT_ORDER.length}</div></div>
        <div class="stat-pill"><div class="k">대결</div><div class="v">${S.versus.played}판</div></div>
      </div>
      <div class="tag-filter"><span class="muted">분류</span>
        <div class="seg" id="tagSeg">${['전체'].concat(TAGS).map((t) => `<button data-t="${t}" class="${t === filter ? 'on' : ''}">${esc(t)} <span class="cnt">${counts[t]}</span></button>`).join('')}</div>
        <span class="muted tag-help">AI 개념: 인공지능의 원리를 배우는 실험 · 사고력: 조건을 쪼개고 조립하는 퍼즐 · 심화: 앞 장을 한 걸음 더 깊이</span></div>
      ${chapters}`;
    $$('#tagSeg button').forEach((b) => (b.onclick = () => { S.settings.tagFilter = b.dataset.t; save(); renderHome(); }));
    $$('#view-home [data-papers]').forEach((b) => (b.onclick = () => openPapers(+b.dataset.papers)));
    hero.attach($('#heroCanvas'));
  }


  // 홈 배경: 떠다니는 뉴런 그물
  const hero = (() => {
    let cv = null, nodes = [], pulses = [];
    const rng = sim.makeRng('hero');
    const COLS = ['#c9962a', '#5f9a6a', '#8a74bd', '#4a7fb8', '#b85c82'];
    function attach(c) {
      cv = c;
      nodes = Array.from({ length: 46 }, () => ({ x: rng(), y: rng(), vx: (rng() - 0.5) * 0.012, vy: (rng() - 0.5) * 0.012, c: COLS[Math.floor(rng() * COLS.length)] }));
      pulses = [];
    }
    function tick(dt) {
      if (!cv || !cv.isConnected) return;
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx * dt; n.y += n.vy * dt;
        if (n.x < 0 || n.x > 1) n.vx *= -1;
        if (n.y < 0 || n.y > 1) n.vy *= -1;
      }
      const P = nodes.map((n) => [0.35 * w + n.x * 0.65 * w, n.y * h]);
      g.lineWidth = 1;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
        const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]);
        if (d < 120) { g.strokeStyle = `rgba(46,94,158,${(1 - d / 120) * 0.22})`; g.beginPath(); g.moveTo(...P[i]); g.lineTo(...P[j]); g.stroke(); }
      }
      if (rng() < dt * 3) {
        const i = Math.floor(rng() * P.length);
        let best = -1, bd = 120;
        for (let j = 0; j < P.length; j++) { const d = Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1]); if (j !== i && d < bd) { bd = d; best = j; } }
        if (best >= 0) pulses.push({ i, j: best, t: 0 });
      }
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k];
        p.t += dt * 1.6;
        if (p.t >= 1) { pulses.splice(k, 1); continue; }
        const a = P[p.i], b = P[p.j];
        g.fillStyle = '#2e5e9e';
        g.beginPath(); g.arc(a[0] + (b[0] - a[0]) * p.t, a[1] + (b[1] - a[1]) * p.t, 2.4, 0, 6.3); g.fill();
      }
      nodes.forEach((n, i) => { g.fillStyle = n.c; g.globalAlpha = 0.7; g.beginPath(); g.arc(P[i][0], P[i][1], 3.2, 0, 6.3); g.fill(); });
      g.globalAlpha = 1;
    }
    return { attach, tick };
  })();

  // ===================================================================
  // 플레이 (실험 · 연구실)
  // ===================================================================
  const play = { mode: 'stage', cfg: null, world: null, state: 'ready', speed: 1, acc: 0, hints: 0, noticeShown: false, finishTimer: null, row: 3, train: null };
  const TABLE_TYPES = ['logic', 'train', 'vision', 'seq', 'cluster', 'descent', 'grid'];
  const SIDE_TYPES = ['vision', 'cluster', 'descent', 'grid']; // 뇌 편집기 대신 왼쪽 설정판을 쓰는 실험
  const isType = (t) => play.mode === 'stage' && !!play.cfg && play.cfg.type === t;
  const isTable = () => play.mode === 'stage' && !!play.cfg && TABLE_TYPES.includes(play.cfg.type);
  const isVision = () => isType('vision');
  const isSeq = () => isType('seq');
  const isCluster = () => isType('cluster');
  const isDescent = () => isType('descent');
  const isGrid = () => isType('grid');
  const isReward = () => play.mode === 'stage' && !!play.cfg && play.cfg.type === 'reward';
  // 강화학습 화면인가: 보상 실험, 또는 연구실의 강화학습 모드
  const isRlView = () => isReward() || (play.mode === 'lab' && play.labMode === 'rl' && !!play.rl);
  const arenaView = SA.arenaView.create($('#arenaCanvas'));
  let inspKey = null, sliderMerge = false, hudCache = '';

  const editor = SA.brainEditor.create($('#brainCanvas'), {
    onChange(brain) {
      if (play.mode === 'stage' && play.cfg && (play.cfg.type === 'train' || play.cfg.type === 'reward')) return;
      if (play.mode === 'stage') S.brains[play.cfg.id] = brain; else S.lab.brain = brain;
      save();
      if (isTable()) { renderLogicPanel(); updateBrainCount(); return; }
      const wasRunning = play.state !== 'ready';
      resetWorld(); // 준비 상태여도 새 뇌로 세계를 다시 만든다
      if (wasRunning && !play.noticeShown) { toast('뇌를 바꿔서 실험을 처음부터 다시 준비했어요'); play.noticeShown = true; }
      updateBrainCount();
    },
    onSelect: renderInspector,
    getLive: () => {
      if (isVision() || isCluster() || isDescent() || isGrid()) return null;
      if (isSeq()) return seqLive();
      if (isTable()) return sim.evalRow(editor.getBrain(), play.cfg.plot ? curRow() : play.cfg.rows[play.row], play.cfg).act;
      return play.state !== 'ready' && play.world ? play.world.creatures[0].brain.act : null;
    },
    toast,
  });

  function openStage(st) {
    play.mode = 'stage';
    play.cfg = st;
    play.hints = 0;
    play.row = st.rows ? (st.plot ? 0 : st.rows.length - 1) : 0;
    play.showTest = false;
    const train = st.type === 'train' || st.type === 'reward';
    play.seqSel = { s: 0, t: 0 };
    editor.setConfig({ sensors: st.sensors, outputs: st.outputs || ['motorL', 'motorR'], maxHidden: st.maxHidden, fixedHidden: train ? 0 : st.fixedHidden || 0, minHidden: 0, readOnly: train, funcs: st.funcs || ['clamp'], noSkip: !!st.noSkip, fixedFn: st.fixedFn || null, hiddenPos: st.hiddenPos || null });
    if (st.type === 'reward') {
      play.rl = newRl(st, play.rl && play.rl.id === st.id ? play.rl : null);
      editor.setBrain(sim.rlBuild(st, play.rl.state.theta));
    } else if (train) {
      play.train = { brain: JSON.parse(JSON.stringify(st.init)), epochs: 0, losses: [], rates: new Set(), lrIdx: play.train && play.train.id === st.id ? play.train.lrIdx : 2, auto: false, acc: 0, id: st.id, done: false };
      play.train.losses.push(sim.lossOf(st, play.train.brain));
      editor.setBrain(play.train.brain);
    } else if (st.type === 'vision') {
      play.vision = loadDesign(st);
      editor.setBrain(emptyBrain());
    } else if (st.type === 'cluster') {
      play.km = newKm(st);
      editor.setBrain(emptyBrain());
    } else if (st.type === 'descent') {
      play.desc = newDesc(st, play.desc);
      editor.setBrain(emptyBrain());
    } else if (st.type === 'grid') {
      play.grid = newGrid(st, play.grid);
      editor.setBrain(emptyBrain());
    } else editor.setBrain(S.brains[st.id] || emptyBrain());
    setSideMode(SIDE_TYPES.includes(st.type) ? st.type : null);
    $('#backLabel').textContent = trackOf(st).title;
    $('#btnAddHidden').classList.add('hidden');
    for (const id of ['#btnUndo', '#btnRedo', '#btnClear']) $(id).classList.toggle('hidden', train || ['cluster', 'descent', 'grid'].includes(st.type) || (st.type === 'vision' && id !== '#btnClear'));
    setTableMode(isTable());
    if (st.type === 'reward') setRewardMode();
    resetWorld();
    renderPlayHead();
    renderBrief();
    renderLogicPanel();
    updateBrainCount();
    // 처음 보는 화면이면 기능 안내(투어)를 띄운다
    const tourName = autoTourFor(st);
    if (tourName && !S.tours[tourName]) setTimeout(() => { if (play.cfg === st) tour.start(tourName); }, 250);
  }
  // 그림·무리 실험: 뇌 편집기 대신 필터 편집기(또는 중심 다루기)를 왼쪽에 보여 준다
  function setSideMode(kind) {
    const on = !!kind;
    $('#brainWrap').classList.toggle('hidden', on);
    $('#inspector').classList.toggle('hidden', on);
    $('#brainCount').classList.toggle('hidden', on);
    $('#visionLeft').classList.toggle('hidden', !on);
    $('#brainTitle').textContent = { vision: '필터', cluster: '중심', descent: '최적화', grid: '학습 설정' }[kind] || '뇌';
    if (kind === 'vision') renderVisionLeft();
    else if (kind === 'cluster') renderKmLeft();
    else if (kind === 'descent') renderDescLeft();
    else if (kind === 'grid') renderGridLeft();
    else $('#visionLeft').innerHTML = '';
  }
  // 처음 열 때 자동으로 띄울 안내(각 장 첫 실험에서만 의미가 있다)
  function autoTourFor(st) {
    return st.tour || (st.type === 'arena' ? 'arena' : st.type === 'train' ? 'train' : st.type === 'reward' ? 'reward' : null);
  }
  // "안내 다시 보기" 버튼이 띄울 안내: 진리표 실험은 기본 조작 안내, 나머지는 화면 종류별 안내
  function tourFor(st) {
    if (!st) return null;
    if (st.type === 'logic') return st.classes ? 'classes' : st.plot ? 'plot' : st.latent ? 'code' : 'basic';
    if (st.type === 'vision') return 'vision';
    if (st.type === 'seq') return st.seqInputs ? 'gate' : 'seq';
    if (st.type === 'cluster') return 'cluster';
    if (st.type === 'descent') return 'descent';
    if (st.type === 'grid') return 'grid';
    if (st.type === 'arena') return 'arena';
    return autoTourFor(st);
  }
  function replayTour() {
    const name = play.mode === 'lab' ? (play.labMode === 'rl' ? 'reward' : 'arena') : tourFor(play.cfg);
    if (!name) return;
    // 튜토리얼 실험이 아니면 "직접 해 보기" 단계는 빼고 설명만 보여 준다
    const explainOnly = !(play.mode === 'stage' && play.cfg.tour === name);
    tour.start(name, { explainOnly });
  }
  // 진리표·학습 실험은 아레나 대신 표 패널을 보여 준다
  function setTableMode(on) {
    $('#arenaWrap').classList.toggle('hidden', on);
    $('#arenaControls').classList.toggle('hidden', on);
    $('#logicPanel').classList.toggle('hidden', !on);
    $('#logicPanel').classList.remove('reward-panel');
    $('#view-play').classList.remove('rl-layout');
    fitFrame = 0;
  }
  // 보상 실험: 위에는 아레나(지금 뇌가 움직이는 모습), 아래에는 점수 규칙 패널
  function setRewardMode() {
    $('#arenaWrap').classList.remove('hidden');
    $('#arenaControls').classList.add('hidden');
    $('#logicPanel').classList.remove('hidden');
    $('#logicPanel').classList.add('reward-panel');
    $('#view-play').classList.add('rl-layout');
    fitFrame = 0;
  }
  function openLab() {
    play.mode = 'lab';
    const arena = LAB_ARENAS.find((a) => a.id === S.lab.arena) || LAB_ARENAS[0];
    play.cfg = arena;
    play.hints = 0;
    setSideMode(null);
    if (play.labMode === 'rl') { startLabRl(false); return; }
    editor.setConfig({ sensors: LAB_SENSORS, outputs: ['motorL', 'motorR'], maxHidden: 6, fixedHidden: 0, minHidden: 2, readOnly: false, funcs: FUNCS_ALL, noSkip: false, fixedFn: null, hiddenPos: null });
    editor.setBrain(S.lab.brain || emptyBrain());
    $('#backLabel').textContent = 'AI 배우기';
    $('#btnAddHidden').classList.remove('hidden');
    for (const id of ['#btnUndo', '#btnRedo', '#btnClear']) $(id).classList.remove('hidden');
    setTableMode(false);
    $('#logicPanel').innerHTML = '';
    resetWorld();
    renderPlayHead();
    renderBrief();
    updateBrainCount();
  }
  // ---- 연구실 강화학습 ----
  // 연구실은 아레나 감각만 쓴다(진리표·좌표·기억 입력은 빼고)
  const LAB_SENSORS = sim.SENSORS.filter((s) => ['bias', 'eye', 'danger', 'wall'].includes(s.group)).map((s) => s.id);
  // 연구실에서 쓰는 학습 설정: 지금 아레나에서 20초씩 시험, 점수 규칙 6가지 모두, 60세대까지
  function labRlCfg() {
    const arena = LAB_ARENAS.find((a) => a.id === S.lab.arena) || LAB_ARENAS[0];
    const mine = S.lab.brain && S.lab.brain.synapses && S.lab.brain.synapses.length ? S.lab.brain : null;
    if (!mine) play.labRlShape = 'all';
    const tpl = play.labRlShape === 'mine' && mine ? JSON.parse(JSON.stringify(mine)) : null;
    return Object.assign({}, arena, {
      id: 'lab-' + arena.id + '-' + (tpl ? 'mine' : 'all'), sensors: LAB_SENSORS, timeLimit: 20, goal: { type: 'free' },
      events: ['eat', 'near', 'hit', 'move', 'bump', 'alive'], preset: { eat: 5, near: 1 },
      maxGens: 60, children: 6, rlTemplate: tpl,
    });
  }
  function startLabRl(keep) {
    play.mode = 'lab';
    play.labMode = 'rl';
    if (!play.labRlShape) play.labRlShape = S.lab.brain && S.lab.brain.synapses && S.lab.brain.synapses.length ? 'mine' : 'all';
    const cfg = labRlCfg();
    play.cfg = LAB_ARENAS.find((a) => a.id === S.lab.arena) || LAB_ARENAS[0];
    const prev = play.rl && play.rl.cfg && String(play.rl.cfg.id).startsWith('lab-') ? play.rl : null;
    play.rl = newRl(cfg, prev);
    setSideMode(null);
    if (!keep && !prev) play.rl.rw = Object.assign({}, cfg.preset);
    editor.setConfig({ sensors: LAB_SENSORS, outputs: ['motorL', 'motorR'], maxHidden: 6, fixedHidden: 0, minHidden: 0, readOnly: true, funcs: FUNCS_ALL, noSkip: false, fixedFn: null, hiddenPos: null });
    editor.setBrain(sim.rlBuild(cfg, play.rl.state.theta));
    $('#btnAddHidden').classList.add('hidden');
    for (const id of ['#btnUndo', '#btnRedo', '#btnClear']) $(id).classList.add('hidden');
    setRewardMode();
    resetWorld();
    renderPlayHead();
    renderBrief();
    renderRewardPanel();
    updateBrainCount();
  }
  function setLabMode(mode) {
    if (mode === (play.labMode || 'wire')) return;
    if (mode === 'wire' && play.rl && play.rl.state.gen > 0) {
      // 강화학습으로 바뀐 뇌를 그대로 이어서 손으로 고칠 수 있게 연구실 뇌로 넘긴다
      S.lab.brain = editor.getBrain();
      save();
      toast('학습한 뇌를 연구실 뇌로 가져왔어요. 이제 직접 고칠 수 있어요');
    }
    if (play.rl) play.rl.running = false;
    play.labMode = mode;
    if (mode === 'rl') startLabRl(false); else openLab();
  }
  function resetWorld() {
    clearTimeout(play.finishTimer);
    if (isTable()) { play.world = null; setPlayState('ready'); return; }
    if (isRlView()) {
      play.world = sim.createWorld(Object.assign({}, play.mode === 'lab' ? play.rl.cfg : play.cfg, { hazardMode: 'count' }), [editor.getBrain()]);
      play.acc = 0;
      arenaView.clearFx();
      setPlayState('running'); // 보상 실험은 지금 뇌의 모습을 계속 되풀이해 보여 준다
      return;
    }
    play.world = sim.createWorld(play.cfg, [editor.getBrain()]);
    play.acc = 0;
    arenaView.clearFx();
    setPlayState('ready');
  }
  function setPlayState(st) {
    play.state = st;
    const b = $('#btnRun');
    b.textContent = { ready: '▶ 실행', running: '⏸ 일시정지', paused: '▶ 계속', done: '▶ 다시 실행' }[st];
    b.classList.toggle('primary', st !== 'running');
  }
  function toggleRun() {
    audio.unlock();
    if (view !== 'play') return;
    if (isTable()) {
      const t = play.cfg.type;
      if (t === 'logic') checkLogic(); else if (t === 'vision') checkVision(); else if (t === 'seq') checkSeq(); else if (t === 'cluster') checkCluster();
      else if (t === 'descent') checkDesc(); else if (t === 'grid') checkGrid(); else toggleAuto();
      return;
    }
    if (isRlView()) { toggleLearn(); return; }
    if (play.state === 'ready') {
      if (!editor.getBrain().synapses.length) toast('뇌가 비어 있어요. 센서를 끌어 바퀴에 이어 보세요');
      audio.sfx.run();
      setPlayState('running');
    } else if (play.state === 'running') setPlayState('paused');
    else if (play.state === 'paused') setPlayState('running');
    else { resetWorld(); audio.sfx.run(); setPlayState('running'); }
  }
  function updateBrainCount() {
    const b = editor.getBrain();
    const used = sim.usedHidden(b);
    $('#brainCount').textContent = `시냅스 ${b.synapses.length}` + (b.hidden.length ? ` · 히든 뉴런 ${used}/${b.hidden.length} 사용` : '');
    $('#btnUndo').disabled = !editor.canUndo();
    $('#btnRedo').disabled = !editor.canRedo();
  }

  function renderPlayHead() {
    const head = $('#playGoal');
    const lab = $('#labBar');
    if (play.mode === 'stage') {
      const st = play.cfg;
      const p = S.progress[st.id] || {};
      const { prev: prevSt, next: nextSt } = neighbors(st);
      const nextOpen = !!nextSt && isUnlockedSt(nextSt);
      $('#playTitle').innerHTML = `<span class="stage-nav">
          <button class="btn sm" id="btnPrevStage" ${prevSt ? '' : 'disabled'} title="${prevSt ? esc(prevSt.code + ' · ' + prevSt.title) : '첫 문제'}">◀ 이전</button>
          <button class="btn sm ghost" id="btnTourAgain" title="이 화면의 기능 안내를 다시 봐요">? 안내 다시 보기</button>
          <button class="btn sm" id="btnNextStage" ${nextOpen ? '' : 'disabled'} title="${nextSt ? (nextOpen ? esc(nextSt.code + ' · ' + nextSt.title) : '이 문제를 깨면 열려요') : '마지막 문제'}">다음 ▶</button>
        </span>${st.boss ? '<span class="chip c-inh">마무리</span> ' : ''}${st.code} · ${esc(st.title)} <span class="tag ${tagClass(st.tag)}">${esc(st.tag)}</span>`;
      $('#btnPrevStage').onclick = () => prevSt && go('stage/' + prevSt.id);
      $('#btnNextStage').onclick = () => nextOpen && go('stage/' + nextSt.id);
      $('#btnTourAgain').onclick = replayTour;
      head.innerHTML = `<span class="chip c-gold">목표 <b>${esc(st.goalText)}</b></span>` +
        (st.stars || []).map((c) => `<span class="chip">★ ${esc(sim.condText(c))}</span>`).join('') +
        `<span class="chip">최고 ${starsHtml(p.stars)}</span>`;
      lab.classList.add('hidden');
    } else {
      $('#playTitle').innerHTML = '연구실 <button class="btn sm ghost" id="btnTourAgain" title="이 화면의 기능 안내를 다시 봐요">? 안내 다시 보기</button>';
      $('#btnTourAgain').onclick = replayTour;
      head.innerHTML = `<span class="chip">모든 감각 · 히든 뉴런 6개 · 60초</span>`;
      lab.classList.remove('hidden');
      const opts = LAB_ARENAS.map((a) => `<option value="${a.id}" ${a.id === play.cfg.id ? 'selected' : ''}>${esc(a.title)}</option>`).join('');
      const slots = `<select class="sel" id="labLoadSlot" aria-label="저장한 뇌 불러오기"><option value="">저장한 뇌 불러오기…</option>${S.slots.map((s, i) => s ? `<option value="${i}">${i + 1}. ${esc(s.name)}</option>` : '').join('')}</select>`;
      const modeSeg = `<div class="seg" id="labModeSeg" title="연구실 방식"><button data-m="wire" class="${play.labMode !== 'rl' ? 'on' : ''}">직접 잇기</button><button data-m="rl" class="${play.labMode === 'rl' ? 'on' : ''}">강화학습</button></div>`;
      lab.innerHTML = `
        ${modeSeg}
        <select class="sel" id="labArena" aria-label="아레나">${opts}</select>
        <select class="sel" id="labLoadStage" aria-label="실험 뇌 불러오기"><option value="">실험 뇌 불러오기…</option>${STAGES.filter((s) => s.type === 'arena' && S.brains[s.id]).map((s) => `<option value="${s.id}">${s.code} · ${esc(s.title)}</option>`).join('')}</select>
        <button class="btn sm" id="labSave">저장…</button>${slots}
        <button class="btn sm" id="labExport" title="뇌를 코드로 복사">내보내기</button>
        <button class="btn sm" id="labImport" title="뇌 코드 붙여넣기">가져오기</button>`;
      $('#labArena').onchange = (e) => { S.lab.arena = e.target.value; save(); if (play.labMode === 'rl') startLabRl(true); else openLab(); };
      $$('#labModeSeg button').forEach((b) => (b.onclick = () => setLabMode(b.dataset.m)));
      $('#labLoadStage').onchange = (e) => {
        const id = e.target.value;
        if (!id) return;
        loadIntoLab(S.brains[id], `${STAGES.find((s) => s.id === id).code}의 뇌를 불러왔어요`);
      };
      $('#labSave').onclick = openSaveDialog;
      $('#labLoadSlot').onchange = (e) => {
        const s = S.slots[+e.target.value];
        if (!e.target.value || !s) return;
        if (play.labMode === 'rl') { play.labMode = 'wire'; if (play.rl) play.rl.running = false; }
        loadIntoLab(s.brain, `"${s.name}"을 불러왔어요`);
        openLab();
      };
      $('#labExport').onclick = exportBrain;
      $('#labImport').onclick = importBrain;
    }
  }
  function loadIntoLab(brain, msg) {
    S.lab.brain = JSON.parse(JSON.stringify(brain));
    save();
    editor.setBrain(S.lab.brain, true);
    resetWorld();
    updateBrainCount();
    toast(msg);
  }
  function openSaveDialog() {
    const rows = S.slots.map((s, i) => `<button class="pick" data-save="${i}"><span class="dot" style="background:${s ? '#5aa9ff' : '#33415f'}"></span><span><span class="t">슬롯 ${i + 1}</span><br><span class="d">${s ? esc(s.name) + ' · 시냅스 ' + s.brain.synapses.length : '비어 있음'}</span></span><span class="lvl">${s ? '덮어쓰기' : '저장'}</span></button>`).join('');
    const m = openModal(`<h2>뇌 저장하기</h2><p class="muted">저장한 뇌는 대결에서 고를 수 있어요.</p>
      <label class="set-row"><span>이름</span><input id="slotName" class="sel" maxlength="20" value="내 뇌 ${new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}" style="flex:1"></label>
      <div class="pick-list" style="margin-top:10px">${rows}</div>
      <div class="modal-actions"><button class="btn" data-close>닫기</button></div>`);
    m.querySelector('[data-close]').onclick = closeModal;
    $$('[data-save]', m).forEach((b) => (b.onclick = () => {
      const name = ($('#slotName').value || '').trim().slice(0, 20) || `슬롯 ${+b.dataset.save + 1}`;
      S.slots[+b.dataset.save] = { name, brain: editor.getBrain(), at: Date.now() };
      save();
      closeModal();
      renderPlayHead();
      toast(`슬롯 ${+b.dataset.save + 1}에 "${name}" 저장했어요`);
    }));
  }
  function exportBrain() {
    const code = 'SA1:' + btoa(unescape(encodeURIComponent(JSON.stringify(editor.getBrain()))));
    const done = () => toast('뇌 코드를 복사했어요. 친구에게 보내 보세요');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => showCode(code));
    else showCode(code);
  }
  function showCode(code) {
    const m = openModal(`<h2>뇌 코드</h2><p class="muted">아래 코드를 복사해서 저장하거나 친구에게 보내세요.</p><textarea class="sel" style="width:100%;height:110px;font-family:var(--mono);font-size:12px" readonly>${esc(code)}</textarea><div class="modal-actions"><button class="btn" data-close>닫기</button></div>`);
    m.querySelector('[data-close]').onclick = closeModal;
    m.querySelector('textarea').select();
  }
  function importBrain() {
    const m = openModal(`<h2>뇌 가져오기</h2><p class="muted">"SA1:"로 시작하는 뇌 코드를 붙여넣으세요.</p><textarea id="importText" class="sel" style="width:100%;height:110px;font-family:var(--mono);font-size:12px" data-autofocus></textarea><div class="modal-actions"><button class="btn" data-close>취소</button><button class="btn primary" id="importGo">가져오기</button></div>`);
    m.querySelector('[data-close]').onclick = closeModal;
    $('#importGo').onclick = () => {
      try {
        const raw = $('#importText').value.trim();
        if (!raw.startsWith('SA1:')) throw new Error('prefix');
        const b = JSON.parse(decodeURIComponent(escape(atob(raw.slice(4)))));
        if (!b || !Array.isArray(b.synapses)) throw new Error('shape');
        closeModal();
        loadIntoLab(b, '뇌 코드를 가져왔어요');
      } catch (e) { toast('코드를 읽지 못했어요. 처음부터 끝까지 다 복사했는지 확인해 주세요'); }
    };
  }

  function renderBrief() {
    const box = $('#brief');
    const cfg = play.cfg;
    const sensors = (play.mode === 'stage' ? cfg.sensors : LAB_SENSORS).map((id) => sim.SENSORS.find((s) => s.id === id));
    const legend = sensors.map((s) => `<span class="chip" title="${esc(s.desc)}"><span class="dot" style="background:${{ eyeL: '#ffa94d', eyeR: '#ffe066' }[s.id] || SENSOR_COLOR[s.group]}"></span>${esc(s.name)}</span>`).join('');
    if (play.mode === 'stage') {
      const hints = cfg.hints.slice(0, play.hints).map((h) => `<li>${esc(h)}</li>`).join('');
      box.innerHTML = `<p>${esc(cfg.brief)}</p>
        ${sensors.length ? `<div class="sensor-legend"><span class="muted" style="font-size:13px">${cfg.type === 'arena' ? '쓸 수 있는 감각' : '입력'}</span>${legend}</div>` : ''}
        ${hints ? `<ul class="hint-list">${hints}</ul>` : ''}
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          ${play.hints < cfg.hints.length ? `<button class="btn sm" id="btnHint">힌트 보기 (${play.hints + 1}/${cfg.hints.length})</button>` : '<button class="btn sm gold" id="btnAnswer">정답 보기</button>'}
          <button class="btn sm ghost" data-go="notes">개념 노트</button>
          <button class="btn sm ghost" id="btnPapers">관련 논문 ↗</button>
        </div>`;
      const hb = $('#btnHint');
      if (hb) hb.onclick = () => { play.hints++; renderBrief(); };
      const ab = $('#btnAnswer');
      if (ab) ab.onclick = confirmAnswer;
      $('#btnPapers').onclick = () => openPapers(cfg.chapter, cfg.concept);
    } else {
      box.innerHTML = play.labMode === 'rl'
        ? `<p><b>강화학습 모드.</b> ${esc(cfg.desc)} 점수 규칙을 정하고 학습시키면 이 아레나에서 20초씩 시험하며 뇌가 스스로 바뀐다. "학습할 선"에서 내가 직접 이은 선만 다듬을지, 감각 → 바퀴를 모두 이은 뇌를 처음부터 배울지 고를 수 있다. 마음에 들면 <b>저장…</b>으로 이름을 붙여 두고 대결에서 불러오자.</p>
        <div class="sensor-legend">${legend}</div>`
        : `<p>${esc(cfg.desc)} 먹이를 먹으면 점대칭 자리에 새 먹이가 생긴다. 만든 뇌는 <b>저장</b>해 두면 대결에 내보낼 수 있다. 위의 <b>강화학습</b>을 누르면 점수 규칙만 정해서 뇌를 학습시킬 수도 있다.</p>
        <div class="sensor-legend">${legend}</div>`;
    }
  }

  function renderInspector(d) {
    const box = $('#inspector');
    if (!d) {
      inspKey = null;
      if (isRlView()) {
        box.innerHTML = `<div class="tips"><div><b>강화학습</b> 뇌는 직접 잇지 않아요. 위쪽 점수 규칙을 정하고 학습시키면, 시행착오로 찾은 가장 좋은 뇌가 여기 나타나요.</div>
          <div>선의 숫자(가중치)가 곧 생명체의 행동 규칙(정책)이에요. 선이나 뉴런을 클릭하면 지금 값을 볼 수 있어요.</div></div>`;
        return;
      }
      if (play.mode === 'stage' && play.cfg && play.cfg.type === 'train') {
        box.innerHTML = `<div class="tips"><div><b>학습 실험</b> 가중치는 직접 바꿀 수 없어요. 오른쪽에서 학습시키면 선의 숫자가 스스로 바뀌는 것을 지켜보세요.</div>
          <div>선이나 뉴런을 클릭하면 지금 값을 볼 수 있어요. 진리표의 줄을 누르면 그 입력일 때의 뇌가 보여요.</div></div>`;
        return;
      }
      const target = play.mode === 'stage' && play.cfg && play.cfg.type === 'logic' ? '히든 뉴런·출력' : '히든 뉴런·바퀴';
      box.innerHTML = `<div class="tips">
        <div><b>잇기</b> 왼쪽 뉴런(또는 뉴런 오른쪽 작은 점)을 끌어서 ${target}에 놓기</div>
        <div><b>세기</b> 선 위에서 마우스 휠, 또는 선을 클릭해 아래 막대로 조절 · 파랑=흥분, 빨강=억제</div>
        <div><b>지우기</b> 우클릭 또는 <kbd>Delete</kbd> · <b>되돌리기</b> <kbd>Ctrl</kbd>+<kbd>Z</kbd> · <b>실행</b> <kbd>Space</kbd></div>
      </div>`;
      return;
    }
    if (d.type === 'syn') {
      const key = d.from + '>' + d.to;
      const exc = d.w >= 0;
      if (inspKey === key && $('#wRange')) {
        $('#wRange').value = d.w;
        $('#wVal').textContent = (d.w > 0 ? '+' : '') + d.w.toFixed(1);
        $('#wVal').style.color = exc ? 'var(--exc)' : 'var(--inh)';
        $('#wKind').outerHTML = kindChip(d.w);
        return;
      }
      if (play.mode === 'stage' && play.cfg && (play.cfg.type === 'train' || play.cfg.type === 'reward')) {
        inspKey = null;
        box.innerHTML = `<h4>${esc(d.fromName)} → ${esc(d.toName)} ${kindChip(d.w)}</h4><div class="row"><span class="muted">지금 가중치</span><span class="wval" style="color:${exc ? 'var(--exc)' : 'var(--inh)'}">${(d.w > 0 ? '+' : '') + d.w.toFixed(2)}</span></div>`;
        return;
      }
      inspKey = key;
      box.innerHTML = `<h4>${esc(d.fromName)} → ${esc(d.toName)} ${kindChip(d.w)}</h4>
        <div class="row">
          <span class="muted">세기</span>
          <input type="range" id="wRange" min="-3" max="3" step="0.1" value="${d.w}" aria-label="시냅스 세기">
          <span class="wval" id="wVal" style="color:${exc ? 'var(--exc)' : 'var(--inh)'}">${(d.w > 0 ? '+' : '') + d.w.toFixed(1)}</span>
        </div>
        <div class="row">
          <button class="btn sm" id="wFlip">부호 바꾸기 (흥분 ↔ 억제)</button>
          <button class="btn sm danger" id="wDel">삭제</button>
          <span class="muted" style="font-size:12.5px">휠: ±0.1</span>
        </div>`;
      const r = $('#wRange');
      r.addEventListener('pointerdown', () => { sliderMerge = false; });
      r.addEventListener('input', () => { editor.setWeight(+r.value, sliderMerge); sliderMerge = true; });
      r.addEventListener('change', () => { sliderMerge = false; });
      $('#wFlip').onclick = () => editor.flipSign();
      $('#wDel').onclick = () => editor.deleteSelection();
      return;
    }
    inspKey = null;
    const liveAct = isSeq() ? seqLive() : isTable() ? (play.cfg.rows ? sim.evalRow(editor.getBrain(), play.cfg.plot ? curRow() : play.cfg.rows[play.row], play.cfg).act : null) : play.state !== 'ready' && play.world ? play.world.creatures[0].brain.act : null;
    const live = liveAct ? liveAct[d.id] : null;
    const kindName = { sensor: isTable() ? '입력 뉴런' : '감각 뉴런', hidden: '히든 뉴런', motor: /^out/.test(d.id) ? '출력 뉴런' : '운동 뉴런' }[d.kind];
    const canDel = d.kind === 'hidden' && play.mode === 'lab' && editor.getBrain().hidden.length > 2;
    box.innerHTML = `<h4>${esc(d.name)} <span class="chip">${kindName}</span>${live != null ? `<span class="chip">지금 ${live.toFixed(2)}</span>` : ''}</h4>
      <div class="muted">${esc(d.desc)}</div>
      <div class="row"><span class="chip">들어오는 선 ${d.inc}</span><span class="chip">나가는 선 ${d.out}</span>
      ${canDel ? '<button class="btn sm danger" id="nDel">이 뉴런 삭제</button>' : ''}</div>
      ${fnPicker(d)}`;
    const del = $('#nDel');
    if (del) del.onclick = () => editor.deleteSelection();
    const fs = $('#fnSel');
    if (fs) fs.onchange = () => editor.setFn(d.id, fs.value);
  }
  // 히든·출력 뉴런의 활성화 함수 고르기(실험마다 쓸 수 있는 함수가 다르다)
  function fnPicker(d) {
    if (d.kind === 'sensor') return '';
    const F = sim.FUNCS;
    if (!d.funcs || d.funcs.length <= 1) {
      const fixed = d.funcs && d.funcs.length === 1 && d.funcs[0] !== 'clamp';
      return `<div class="fn-box"><span class="muted">활성화 함수: <b>${esc(F[d.fn] ? F[d.fn].name : F.clamp.name)}</b> · ${fixed ? '이 실험에서는 정해져 있어요' : isTable() ? '함수 바꾸기는 3장 생명체 길찾기부터, 논리 게이트·소프트맥스는 연구실에서 쓸 수 있어요' : '이 실험에서는 바꿀 수 없어요'}</span></div>`;
    }
    const opts = d.funcs.map((f) => `<option value="${f}" ${f === d.fn ? 'selected' : ''}>${esc(F[f].name)}</option>`).join('');
    return `<div class="fn-box"><label class="fn-row"><span>활성화 함수</span><select class="sel" id="fnSel">${opts}</select></label>
      <div class="muted fn-desc">${esc(F[d.fn].desc)}</div></div>`;
  }
  function kindChip(w) { return w >= 0 ? '<span class="chip c-exc" id="wKind">흥분</span>' : '<span class="chip c-inh" id="wKind">억제</span>'; }

  function updateHud() {
    const w = play.world;
    if (!w) return;
    const c = w.creatures[0];
    let h = `<span class="chip">⏱ <b>${w.t.toFixed(1)}</b> / ${w.cfg.timeLimit}초</span>`;
    const g = w.cfg.goal;
    if (g.type === 'eat') h += `<span class="chip c-gold">먹이 <b>${c.eaten} / ${g.n}</b></span>`;
    else if (g.type === 'charge') h += `<span class="chip c-gold">충전 <b>${Math.round(w.marks[0].charge * 100)}%</b></span>`;
    else h += `<span class="chip c-gold">먹이 <b>${c.eaten}</b></span>` + (w.hazards.length || w.predators.length ? `<span class="chip c-inh">찔림·잡힘 <b>${c.hits}</b></span>` : '');
    if (play.state === 'paused') h += '<span class="chip">일시정지</span>';
    if (play.state === 'ready') h += '<span class="chip">준비 · <kbd>Space</kbd> 실행</span>';
    if (h !== hudCache) { $('#hud').innerHTML = h; hudCache = h; }
  }

  // 넓은 화면에서 아레나 칸 너비를 높이에 맞춘다(아레나가 3:2라서 양옆에 빈 띠가 생기지 않게)
  let fitFrame = 0;
  function fitPlayColumns() {
    const grid = $('#view-play .play-grid');
    const cv = $('#arenaCanvas');
    if (!grid || !cv || !matchMedia('(min-width: 1100px) and (min-height: 600px)').matches) { document.documentElement.style.removeProperty('--arena-col'); return; }
    if (isTable()) { document.documentElement.style.setProperty('--arena-col', Math.round(Math.max(520, grid.clientWidth * 0.42)) + 'px'); return; }
    if (isRlView()) return; // 보상 화면은 한 줄 배치라 칸 너비를 맞출 필요가 없다
    const want = cv.clientHeight * 1.5 + 26;
    const w = Math.max(600, Math.min(want, grid.clientWidth - 434));
    const cur = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--arena-col')) || 0;
    if (Math.abs(cur - w) > 2) document.documentElement.style.setProperty('--arena-col', Math.round(w) + 'px');
  }
  window.addEventListener('resize', () => { fitFrame = 0; });

  function tickPlay(dt) {
    if (fitFrame-- <= 0) { fitPlayColumns(); fitFrame = 20; }
    if (isTable()) { tickTable(dt); editor.draw(dt); return; }
    if (isRlView()) tickLearn(dt);
    const w = play.world;
    if (play.state === 'running') {
      play.acc += dt * play.speed;
      let n = 0;
      while (play.acc >= sim.DT && n < 60 && w.status === 'running') {
        sim.step(w);
        play.acc -= sim.DT;
        n++;
        handleEvents(w, arenaView);
      }
      if (w.status !== 'running') finishPlay();
    }
    arenaView.draw(w, { sense: S.settings.sense, trail: S.settings.trail, showStart: play.state === 'ready', dt: play.state === 'running' ? dt : dt * 0.5 });
    editor.draw(play.state === 'running' ? dt * Math.min(play.speed, 2) : dt);
    updateHud();
  }
  function handleEvents(w, av) {
    if (!w.events.length) return;
    for (const e of w.events) {
      if (e.type === 'eat') audio.sfx.eat();
      else if (e.type === 'hit') audio.sfx.hit();
      else if (e.type === 'charged') audio.sfx.charged();
    }
    av.addEvents(w.events, w);
    w.events.length = 0;
  }

  function finishPlay() {
    if (isRlView()) {
      // 되풀이 보기: 한 판이 끝나면 잠깐 쉬고 다시 시작
      setPlayState('done');
      const w0 = play.world;
      clearTimeout(play.finishTimer);
      play.finishTimer = setTimeout(() => { if (play.world === w0 && isRlView()) resetWorld(); }, 900);
      return;
    }
    setPlayState('done');
    const w = play.world;
    clearTimeout(play.finishTimer);
    if (w.status === 'success') audio.sfx.success(); else if (w.status === 'fail') audio.sfx.fail();
    play.finishTimer = setTimeout(() => { if (view === 'play' && play.world === w) showResult(w); }, w.status === 'fail' ? 700 : 500);
  }

  function showResult(w) {
    const brain = editor.getBrain();
    const c = w.creatures[0];
    if (play.mode === 'lab') {
      const m = openModal(`<div class="eyebrow">연구실 · ${esc(play.cfg.title)}</div><h2>60초 끝</h2>
        <div class="stat-grid">
          <div><div class="k">먹은 먹이</div><div class="v">${c.eaten}</div></div>
          <div><div class="k">찔림·잡힘</div><div class="v">${c.hits}</div></div>
          <div><div class="k">이동 거리</div><div class="v">${Math.round(c.dist)}</div></div>
          <div><div class="k">시냅스</div><div class="v">${brain.synapses.length}</div></div>
        </div>
        <p class="muted">대결에 내보내려면 뇌를 저장하세요. 참고로 빈 들판에서 라이벌 부엉이는 60초에 먹이 26개를 먹는다.</p>
        <div class="modal-actions"><button class="btn" data-a="edit">뇌 고치기</button><button class="btn" data-a="save">저장…</button><button class="btn primary" data-a="again">다시 실행</button></div>`);
      m.querySelector('[data-a="edit"]').onclick = closeModal;
      m.querySelector('[data-a="save"]').onclick = () => { closeModal(); openSaveDialog(); };
      m.querySelector('[data-a="again"]').onclick = () => { closeModal(); resetWorld(); toggleRun(); };
      return;
    }
    const st = play.cfg;
    const goalStat = st.goal.type === 'charge' ? `<div><div class="k">충전</div><div class="v">${Math.round(w.marks[0].charge * 100)}%</div></div>` : `<div><div class="k">먹이</div><div class="v">${c.eaten}/${st.goal.n}</div></div>`;
    stageResult(w, brain, (isNew) => `
        <div><div class="k">걸린 시간</div><div class="v">${fmtT(w.t)}${isNew.time ? '<span class="new-badge">NEW</span>' : ''}</div></div>
        ${goalStat}
        <div><div class="k">시냅스</div><div class="v">${brain.synapses.length}${isNew.syn ? '<span class="new-badge">NEW</span>' : ''}</div></div>
        <div><div class="k">히든 뉴런 사용</div><div class="v">${sim.usedHidden(brain)}</div></div>`, w.reason);
  }

  // 실험 결과 창(아레나·진리표·학습 공통). wl = {status, t, epochs, rates} 같은 결과 요약
  function stageResult(wl, brain, statsHtml, failText) {
    const st = play.cfg;
    const stars = sim.evalStars(st, wl, brain);
    const prev = S.progress[st.id] || { stars: [false, false, false] };
    const success = wl.status === 'success';
    const isNew = { time: false, syn: false };
    let discovered = false;
    if (success) {
      const p = S.progress[st.id] = Object.assign({ stars: [false, false, false] }, prev);
      p.cleared = true;
      p.stars = p.stars.map((v, i) => v || !!stars[i]);
      if (st.type === 'arena' && (p.bestTime == null || wl.t < p.bestTime)) { p.bestTime = wl.t; isNew.time = prev.bestTime != null; }
      if (!['train', 'vision', 'cluster', 'descent', 'grid'].includes(st.type)) {
        if (p.minSyn == null || brain.synapses.length < p.minSyn) { p.minSyn = brain.synapses.length; isNew.syn = prev.minSyn != null; }
        p.bestBrain = brain;
      }
      discovered = unlockConcept(st.concept);
      save();
    }
    const next = neighbors(st).next;
    const conds = [`<li class="${success ? 'ok' : ''}">${esc(st.goalText)}</li>`].concat((st.stars || []).map((cd, i) => `<li class="${stars[i + 1] ? 'ok' : ''}">${esc(sim.condText(cd))}</li>`)).join('');
    const ct = CONCEPTS[st.concept];
    const m = openModal(`
      <div class="eyebrow">${st.code} · ${esc(st.title)}</div>
      <h2>${success ? '실험 성공!' : '아직 아니에요'}</h2>
      <div class="muted">${success ? (stars.every(Boolean) ? '세 가지 조건을 모두 채웠어요.' : '별을 더 모으려면 조건을 확인해 보세요.') : esc(failText || '')}</div>
      <div class="big-stars">${stars.map((v) => `<span class="${v ? 'on' : ''}">★</span>`).join('')}</div>
      <ul class="cond-list">${conds}</ul>
      <div class="stat-grid">${statsHtml(isNew)}</div>
      ${discovered ? `<div class="discover">새 개념 발견 · <b>${esc(ct.title)}</b><div class="muted" style="margin-top:4px">${esc(ct.line)}</div></div>` : ''}
      ${!success && play.hints < st.hints.length ? '<p class="muted">막혔다면 힌트를 열어 보세요.</p>' : ''}
      <div class="modal-actions">
        ${!success && play.hints < st.hints.length ? '<button class="btn" data-a="hint">힌트 보기</button>' : ''}
        ${discovered ? '<button class="btn" data-a="note">개념 노트 보기</button>' : ''}
        <button class="btn" data-a="edit">${st.type === 'train' ? '닫기' : st.type === 'vision' ? '필터 고치기' : st.type === 'cluster' ? '다시 묶기' : '뇌 고치기'}</button>
        ${st.type === 'arena' ? `<button class="btn ${success && next ? '' : 'primary'}" data-a="again">다시 실행</button>` : ''}
        ${success && next ? `<button class="btn primary" data-a="next">다음 실험 →</button>` : ''}
        ${success && !next ? `<button class="btn gold" data-a="versus">대결하러 가기 →</button>` : ''}
      </div>`);
    if (discovered) audio.sfx.discover();
    const on = (a, f) => { const b = m.querySelector(`[data-a="${a}"]`); if (b) b.onclick = f; };
    on('edit', closeModal);
    on('hint', () => { closeModal(); play.hints++; renderBrief(); });
    on('note', () => { closeModal(); go('notes'); });
    on('again', () => { closeModal(); resetWorld(); toggleRun(); });
    on('next', () => { closeModal(); go('stage/' + next.id); });
    on('versus', () => { closeModal(); go('versus'); });
    renderPlayHead();
  }

  // ===================================================================
  // 보상 실험(강화학습): 점수 규칙 정하기 → 시행착오 학습 → 진짜 목표로 시험
  // 연구실에서도 같은 학습기를 쓴다(rl.cfg가 실험이면 목표 시험, 연구실이면 목표 없이 계속 학습).
  // ===================================================================
  const PTS = [-5, -2, -1, 0, 1, 2, 5];
  const LEARN_SPEEDS = [1, 2, 4, 8];
  function newRl(cfg, prev) {
    return {
      id: cfg.id, cfg,
      rw: prev ? prev.rw : Object.assign({}, cfg.preset || {}),
      sigmaIdx: prev ? prev.sigmaIdx : 1,
      speedIdx: prev ? prev.speedIdx : 0,
      state: sim.rlInit(cfg),
      running: false, acc: 0, done: false, lastObj: null,
    };
  }
  const rulesUsed = (rw) => Object.values(rw).filter((v) => v).length;
  const rlIsLab = () => play.mode === 'lab';
  function resetLearn(quiet) {
    const rl = play.rl;
    rl.state = sim.rlInit(rl.cfg);
    rl.running = false; rl.done = false; rl.lastObj = null;
    editor.setBrain(sim.rlBuild(rl.cfg, rl.state.theta), true);
    resetWorld();
    renderRewardPanel();
    if (!quiet) toast(rl.cfg.rlTemplate ? '학습 전의 뇌로 되돌렸어요' : '처음 뇌(모든 가중치 0)로 되돌렸어요');
  }
  function toggleLearn() {
    const rl = play.rl;
    if (!rl) return;
    if (rl.done) { toast('끝난 학습이에요. "처음부터"를 누르고 다시 해 보세요'); return; }
    if (!rl.running && !rulesUsed(rl.rw)) { toast('점수 규칙이 비어 있어요. 무엇에 점수를 줄지 먼저 정해 주세요'); return; }
    audio.unlock();
    rl.running = !rl.running;
    rl.acc = 1;
    updateRewardPanel();
  }
  // 한 세대: 지금 뇌를 조금씩 흔든 후보들을 시험해 보고, 점수가 더 높은 후보가 있으면 바꾼다
  function learnGeneration() {
    const rl = play.rl, cfg = rl.cfg;
    const improved = sim.rlGeneration(cfg, rl.state, rl.rw, SIGMAS[rl.sigmaIdx]);
    const brain = sim.rlBuild(cfg, rl.state.theta);
    editor.setBrain(brain, true);
    if (improved) { resetWorld(); audio.sfx.click(); }
    const ep = sim.runEpisode(cfg, brain, rl.rw, !rlIsLab());
    rl.lastObj = ep.stats;
    if (!rlIsLab() && sim.objectiveOk(cfg, ep)) {
      rl.running = false; rl.done = true;
      resetWorld();
      updateRewardPanel();
      audio.sfx.success();
      const gens = rl.state.gen;
      setTimeout(() => stageResult({ status: 'success', gens, rules: rulesUsed(rl.rw) }, brain, () => `
        <div><div class="k">걸린 세대</div><div class="v">${gens}</div></div>
        <div><div class="k">점수 규칙</div><div class="v">${rulesUsed(rl.rw)}개</div></div>
        <div><div class="k">먹은 먹이</div><div class="v">${ep.stats.eat}</div></div>
        <div><div class="k">가시</div><div class="v">${ep.stats.hit}번</div></div>`), 400);
      return;
    }
    if (rl.state.gen >= cfg.maxGens) {
      rl.running = false; rl.done = true;
      toast(rlIsLab() ? `${cfg.maxGens}세대 학습을 마쳤어요. 마음에 들면 "저장…"으로 이름을 붙여 저장하세요` : `${cfg.maxGens}세대 동안 목표를 못 배웠어요. 점수 규칙이나 탐험 정도를 바꾸고 "처음부터"를 눌러 보세요`);
    }
    updateRewardPanel();
  }
  function tickLearn(dt) {
    const rl = play.rl;
    if (!rl || !rl.running || modalOpen()) return;
    rl.acc += dt;
    const every = 0.3 / LEARN_SPEEDS[rl.speedIdx];
    // 한 프레임에 너무 많이 돌리면 화면이 멈추므로 최대 2세대까지만
    let n = 0;
    while (rl.acc >= every && n < 2 && rl.running) { rl.acc -= every; learnGeneration(); n++; }
    if (rl.acc > every) rl.acc = every;
  }
  // 패널 뼈대는 한 번만 그린다. 학습 중에는 updateRewardPanel이 글자·그래프만 고친다(버튼이 바뀌지 않아야 눌린다).
  function renderRewardPanel() {
    const box = $('#logicPanel'), rl = play.rl, cfg = rl.cfg;
    const E = sim.REWARD_EVENTS;
    const rows = cfg.events.map((k) => `
      <div class="rule">
        <div class="rule-name"><b>${esc(E[k].name)}</b><span class="muted">${esc(E[k].unit)}</span></div>
        <div class="seg pts" data-ev="${k}">${PTS.map((v) => `<button data-v="${v}" class="${(rl.rw[k] || 0) === v ? 'on' : ''} ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v > 0 ? '+' + v : v}</button>`).join('')}</div>
      </div>`).join('');
    const labPick = rlIsLab() ? `
      <div class="set-row" id="rlShapeRow"><span><b>학습할 선</b> <span class="muted">어떤 선의 가중치를 바꾸며 배울까</span></span>
        <div class="seg" id="rlShape"><button data-s="mine" class="${play.labRlShape === 'mine' ? 'on' : ''}">내가 이은 선</button><button data-s="all" class="${play.labRlShape === 'all' ? 'on' : ''}">감각→바퀴 전부</button></div></div>` : '';
    box.innerHTML = `
      <div class="lp-head"><h3>점수 규칙</h3><span class="muted">무엇에 몇 점을 줄지 정하세요. 생명체는 점수의 합이 커지는 쪽으로 스스로 바뀝니다.</span></div>
      <div class="rules" id="rewardRules">${rows}</div>
      ${labPick}
      <div class="set-row" id="sigRow"><span><b>탐험 정도</b> <span class="muted">뇌를 한 번에 얼마나 크게 바꿔 볼까</span></span>
        <div class="seg" id="sigSeg">${SIGMAS.map((v, i) => `<button data-i="${i}" class="${i === rl.sigmaIdx ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <div class="lp-actions">
        <button class="btn primary" id="btnLearn"></button>
        <button class="btn ghost" id="btnLearnReset">↺ 처음부터</button>
        <div class="seg" id="learnSpeed" title="학습 배속">${LEARN_SPEEDS.map((v, i) => `<button data-i="${i}" class="${i === rl.speedIdx ? 'on' : ''}">${v}×</button>`).join('')}</div>
      </div>
      <div class="muted rl-status" id="rlStatus"></div>
      <div class="chart-wrap"><canvas id="rewardChart" aria-label="세대별 점수 그래프"></canvas></div>`;
    $$('#rewardRules .pts').forEach((seg) => seg.querySelectorAll('button').forEach((b) => (b.onclick = () => {
      const k = seg.dataset.ev, v = +b.dataset.v;
      if ((rl.rw[k] || 0) === v) return;
      if (v) rl.rw[k] = v; else delete rl.rw[k];
      audio.sfx.click();
      if (rl.state.gen) { resetLearn(true); toast('점수 규칙이 바뀌어서 처음부터 다시 배워요'); } else renderRewardPanel();
    })));
    $$('#sigSeg button').forEach((b) => (b.onclick = () => {
      const i = +b.dataset.i;
      if (i === rl.sigmaIdx) return;
      rl.sigmaIdx = i;
      if (rl.state.gen) { resetLearn(true); toast('탐험 정도가 바뀌어서 처음부터 다시 배워요'); } else renderRewardPanel();
    }));
    $$('#learnSpeed button').forEach((b) => (b.onclick = () => {
      rl.speedIdx = +b.dataset.i;
      $$('#learnSpeed button').forEach((x) => x.classList.toggle('on', x === b));
    }));
    $$('#rlShape button').forEach((b) => (b.onclick = () => { if (play.labRlShape !== b.dataset.s) { play.labRlShape = b.dataset.s; startLabRl(true); } }));
    $('#btnLearn').onclick = toggleLearn;
    $('#btnLearnReset').onclick = () => resetLearn(false);
    updateRewardPanel();
  }
  function updateRewardPanel() {
    const rl = play.rl;
    if (!rl || !$('#btnLearn')) return;
    const cfg = rl.cfg, o = rl.lastObj;
    $('#btnLearn').innerHTML = `${rl.running ? '⏸ 멈추기' : rl.state.gen ? '▶ 이어서 학습' : '▶ 학습 시작'} <kbd>Space</kbd>`;
    let status = `세대 <b>${rl.state.gen}</b> / ${cfg.maxGens}`;
    if (o) status += rlIsLab()
      ? ` · 지금 뇌: 먹이 ${o.eat}개, 가시 ${o.hit}번`
      : ` · 지금 뇌로 시험하면 먹이 ${o.eat}/${cfg.goal.n}${cfg.maxHits != null ? `, 가시 ${o.hit}번` : ''}`;
    $('#rlStatus').innerHTML = status;
    drawSeries($('#rewardChart'), rl.state.history, '받은 점수(그 세대의 최고)', '세대', '#7ee081');
  }
  // 값 목록을 선 그래프로. 점이 많아지면 점 사이 간격을 줄여서 항상 전부 들어가게 그린다.
  function drawSeries(cv, L, yLabel, xLabel, color) {
    if (!cv) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || 400, h = cv.clientHeight || 120;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1d2128'; g.fillRect(0, 0, w, h);
    g.font = '11px ' + getComputedStyle(document.body).fontFamily; g.fillStyle = '#98a4c2';
    g.textAlign = 'left'; g.fillText(yLabel, 46, 13);
    if (!L.length) { g.textAlign = 'center'; g.fillText('시작하면 여기에 그래프가 그려져요', w / 2, h / 2 + 4); return; }
    const lo = Math.min(0, ...L), hi = Math.max(lo + 1e-6, ...L, L.length ? Math.max(...L) * 1.05 : 1);
    const left = 44, right = w - 12, top = 20, bottom = h - 24;
    const span = Math.max(1, L.length - 1);
    const X = (i) => left + (i / span) * (right - left), Y = (v) => bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top);
    g.strokeStyle = 'rgba(152,164,194,0.22)'; g.lineWidth = 1;
    for (const v of [lo, (lo + hi) / 2, hi]) {
      g.beginPath(); g.moveTo(left, Y(v)); g.lineTo(right, Y(v)); g.stroke();
      g.textAlign = 'right'; g.fillText(Math.abs(hi - lo) < 3 ? v.toFixed(2) : v.toFixed(0), left - 4, Y(v) + 4);
    }
    // 가로축 눈금: 처음, 가운데, 마지막
    g.textAlign = 'center';
    const ticks = [...new Set([0, Math.round(span / 2), span])];
    for (const t of ticks) g.fillText(String(t), X(t), h - 8);
    g.textAlign = 'right'; g.fillText(xLabel + ' →', right, 13);
    g.strokeStyle = color; g.lineWidth = L.length > 120 ? 1.5 : 2.2; g.beginPath();
    L.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v))));
    g.stroke();
    g.fillStyle = color; g.beginPath(); g.arc(X(L.length - 1), Y(L[L.length - 1]), 3.5, 0, 6.3); g.fill();
  }


  // ===================================================================
  // 6장: 점 그래프(분류) — 진리표 대신 평면에 점과 결정 경계를 그린다
  // ===================================================================
  const curRows = () => play.cfg.rows.concat(play.showTest && play.cfg.test ? play.cfg.test : []);
  const curRow = () => curRows()[play.row] || play.cfg.rows[0];
  const CLS_HEX = ['#ffa94d', '#5aa9ff', '#7ee081', '#c3a6ff'], CLS_RGB = ['240,150,70', '90,160,255', '110,210,120', '180,150,250'], CLS_NAME = ['주황', '파랑', '초록', '보라'];
  const meanConf = (res) => res.rows.reduce((a, r) => a + (r.p || 0), 0) / res.rows.length;
  function plotHtml(st, brain) {
    const res = sim.evalLogic(st, brain);
    const okN = res.rows.filter((r) => r.ok).length;
    let accLine = `훈련 데이터 <b>${okN} / ${st.rows.length}</b> 맞음 (${Math.round((okN / st.rows.length) * 100)}%)`;
    if (st.classes) accLine = `맞은 점 <b>${okN} / ${st.rows.length}</b> · 정답 색의 확률 평균 <b>${Math.round(meanConf(res) * 100)}%</b>${st.need && st.need.confidence ? ` (목표 ${Math.round(st.need.confidence * 100)}% 이상)` : ''}`;
    if (st.test) {
      if (play.showTest) {
        const t = sim.evalLogic({ rows: st.test, inputs: st.inputs, outputs: st.outputs }, brain);
        const tk = t.rows.filter((r) => r.ok).length;
        accLine += ` · 시험 데이터 <b>${tk} / ${st.test.length}</b> 맞음 (${Math.round((tk / st.test.length) * 100)}%)`;
      } else accLine += ' · 시험 데이터는 숨겨져 있어요(채점할 때 씀)';
    }
    return `
      <div class="plot-wrap"><canvas id="plotCanvas" aria-label="점 그래프"></canvas></div>
      <div class="plot-legend">${st.classes
        ? st.outputs.map((o, k) => `<span><i class="pt" style="background:${CLS_HEX[k]}"></i>${CLS_NAME[k]} = 출력 ${k + 1}</span>`).join('') + '<span><i class="pt bad"></i>빨간 테두리 = 틀림</span><span class="muted">배경 = 가장 큰 출력의 색(진할수록 확신이 큼)</span>'
        : `<span><i class="pt o"></i>주황 = 0</span><span><i class="pt b"></i>파랑 = 1</span><span><i class="pt bad"></i>빨간 테두리 = 틀림</span>${st.test ? '<span><i class="pt sq"></i>네모 = 시험 데이터</span>' : ''}<span class="muted">배경 = 그 자리에서 뇌의 답, 경계선 = 결정 경계</span>`}</div>
      <div class="muted plot-acc" id="plotAcc">${accLine}</div>
      ${st.test ? `<label class="toggle"><input type="checkbox" id="chkTest" ${play.showTest ? 'checked' : ''}> 시험 데이터 보기</label>` : ''}`;
  }
  function drawPlot(st, brain) {
    const cv = $('#plotCanvas');
    if (!cv) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const size = cv.clientWidth || 360;
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pad = 26, S2 = size - pad - 8;
    const PX = (x) => pad + x * S2, PY = (y) => 8 + (1 - y) * S2;
    g.fillStyle = '#1d2128'; g.fillRect(0, 0, size, size);
    // 배경: 평면 곳곳에서 뇌의 답
    const rt = sim.compileBrain(brain);
    const N = 70, cell = S2 / N, grid = [];
    for (let j = 0; j < N; j++) {
      grid.push([]);
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N, y = 1 - (j + 0.5) / N;
        rt.step({ bias: 1, inX: x, inY: y });
        if (st.classes) {
          // 여러 갈래: 가장 큰 출력의 색, 그 확률이 클수록 진하게
          const ys = st.outputs.map((o) => rt.act[o]);
          let k = 0;
          ys.forEach((v2, q) => { if (v2 > ys[k]) k = q; });
          grid[j].push(k);
          const K = st.outputs.length, a = Math.max(0, (ys[k] - 1 / K) / (1 - 1 / K)) * 0.34 + 0.08;
          g.fillStyle = `rgba(${CLS_RGB[k]},${a})`;
          g.fillRect(pad + i * cell, 8 + j * cell, cell + 0.6, cell + 0.6);
          continue;
        }
        const v = rt.act.out;
        grid[j].push(v >= 0.5 ? 1 : 0);
        const a = Math.min(1, Math.abs(v - 0.5) * 2) * 0.32 + 0.1;
        g.fillStyle = v >= 0.5 ? `rgba(90,160,255,${a})` : `rgba(240,150,70,${a})`;
        g.fillRect(pad + i * cell, 8 + j * cell, cell + 0.6, cell + 0.6);
      }
    }
    // 결정 경계: 답이 바뀌는 칸 사이에 선
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.6; g.beginPath();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (i + 1 < N && grid[j][i] !== grid[j][i + 1]) { g.moveTo(pad + (i + 1) * cell, 8 + j * cell); g.lineTo(pad + (i + 1) * cell, 8 + (j + 1) * cell); }
      if (j + 1 < N && grid[j][i] !== grid[j + 1][i]) { g.moveTo(pad + i * cell, 8 + (j + 1) * cell); g.lineTo(pad + (i + 1) * cell, 8 + (j + 1) * cell); }
    }
    g.stroke();
    // 축
    g.strokeStyle = 'rgba(200,200,210,0.35)'; g.lineWidth = 1;
    g.strokeRect(pad, 8, S2, S2);
    g.fillStyle = '#9aa3b5'; g.font = '11px ' + getComputedStyle(document.body).fontFamily;
    g.textAlign = 'center'; g.fillText('0', pad, size - 8); g.fillText('x →', pad + S2 / 2, size - 8); g.fillText('1', pad + S2, size - 8);
    g.textAlign = 'right'; g.fillText('1', pad - 6, 16); g.fillText('y', pad - 6, 8 + S2 / 2); g.fillText('0', pad - 6, 8 + S2);
    // 점
    const rows = curRows(), nTrain = st.rows.length;
    rows.forEach((r, k) => {
      const ev = sim.evalRow(rt, r, st), ok = st.classes ? ev.ok : (ev.y >= 0.5 ? 1 : 0) === r[2];
      const cx = PX(r[0]), cy = PY(r[1]), test = k >= nTrain;
      g.fillStyle = st.classes ? CLS_HEX[r[2]] : r[2] ? '#5aa9ff' : '#ffa94d';
      g.strokeStyle = ok ? '#14161a' : '#ff4d5e';
      g.lineWidth = ok ? 1.5 : 3;
      g.beginPath();
      if (test) g.rect(cx - 5.5, cy - 5.5, 11, 11); else g.arc(cx, cy, 6, 0, 6.283);
      g.fill(); g.stroke();
      if (k === play.row) { g.strokeStyle = '#f4c95d'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 11, 0, 6.283); g.stroke(); }
    });
    cv.onclick = (e) => {
      const b = cv.getBoundingClientRect(), mx = e.clientX - b.left, my = e.clientY - b.top;
      let best = -1, bd = 16;
      curRows().forEach((r, k) => { const d = Math.hypot(PX(r[0]) - mx, PY(r[1]) - my); if (d < bd) { bd = d; best = k; } });
      if (best >= 0) { play.row = best; renderLogicPanel(); }
    };
  }

  // ===================================================================
  // 7장: 그림을 보는 뇌 — 필터 편집기(왼쪽)와 그림·특징 맵(오른쪽)
  // ===================================================================
  function blankDesign(st) {
    const n = st.mode === 'class' ? 2 : 1;
    return { filters: Array.from({ length: n }, () => ({ w: [0, 0, 0, 0, 0, 0, 0, 0, 0], b: 0 })), out: { w: new Array(n).fill(0), b: 0 } };
  }
  function loadDesign(st) {
    const saved = S.brains[st.id];
    if (saved && saved.vision && Array.isArray(saved.vision.filters) && saved.vision.filters.length === blankDesign(st).filters.length) return JSON.parse(JSON.stringify(saved.vision));
    return blankDesign(st);
  }
  function saveDesign() {
    S.brains[play.cfg.id] = { vision: play.vision };
    save();
  }
  const FNAMES = ['A', 'B'];
  const fmt = (v) => (v > 0 ? '+' : '') + (Math.round(v * 10) / 10);
  function renderVisionLeft() {
    const st = play.cfg, d = play.vision, box = $('#visionLeft');
    const cards = d.filters.map((f, k) => `
      <div class="filter-card">
        <h4>필터 ${d.filters.length > 1 ? FNAMES[k] : ''} <span class="muted">3×3</span></h4>
        <div class="fgrid" data-f="${k}">${f.w.map((v, i) => `<button class="fcell ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}" data-i="${i}" title="클릭: 0 → +1 → -1 · 휠: ±0.5 · 우클릭: 0">${v ? fmt(v) : '0'}</button>`).join('')}</div>
        <label class="set-row fbias"><span>편향</span><span class="fb-wrap"><input type="range" min="-6" max="2" step="0.5" value="${f.b}" data-fb="${k}"><b class="wval">${fmt(f.b)}</b></span></label>
      </div>`).join('');
    const outCard = st.mode === 'class' ? `
      <div class="filter-card out-card">
        <h4>출력 뉴런 <span class="muted">풀링한 값 → 답</span></h4>
        ${d.filters.map((_, k) => `<label class="set-row"><span>필터 ${FNAMES[k]}의 최댓값 ×</span><span class="fb-wrap"><input type="range" min="-2" max="2" step="0.5" value="${d.out.w[k]}" data-ow="${k}"><b class="wval">${fmt(d.out.w[k])}</b></span></label>`).join('')}
        <label class="set-row"><span>편향</span><span class="fb-wrap"><input type="range" min="-2" max="2" step="0.5" value="${d.out.b}" data-ob="1"><b class="wval">${fmt(d.out.b)}</b></span></label>
      </div>` : '';
    box.innerHTML = `<div class="vl-head"><h3>필터 편집기</h3><span class="muted">칸을 누르면 0 → +1 → -1 순서로 바뀌어요 · 휠로 ±0.5 · 우클릭은 0</span></div>
      <div class="filter-cards">${cards}${outCard}</div>`;
    const changed = () => { saveDesign(); renderVisionRight(); };
    $$('#visionLeft .fcell').forEach((b) => {
      const k = +b.parentElement.dataset.f, i = +b.dataset.i;
      const setV = (v) => { d.filters[k].w[i] = Math.max(-2, Math.min(2, Math.round(v * 2) / 2)); renderVisionLeft(); changed(); };
      b.onclick = () => { const v = d.filters[k].w[i]; setV(v === 0 ? 1 : v > 0 ? -1 : 0); audio.sfx.click(); };
      b.oncontextmenu = (e) => { e.preventDefault(); setV(0); };
      b.onwheel = (e) => { e.preventDefault(); setV(d.filters[k].w[i] + (e.deltaY < 0 ? 0.5 : -0.5)); };
    });
    $$('#visionLeft input[data-fb]').forEach((r) => (r.oninput = () => { d.filters[+r.dataset.fb].b = +r.value; r.nextElementSibling.textContent = fmt(+r.value); changed(); }));
    $$('#visionLeft input[data-ow]').forEach((r) => (r.oninput = () => { d.out.w[+r.dataset.ow] = +r.value; r.nextElementSibling.textContent = fmt(+r.value); changed(); }));
    $$('#visionLeft input[data-ob]').forEach((r) => (r.oninput = () => { d.out.b = +r.value; r.nextElementSibling.textContent = fmt(+r.value); changed(); }));
  }
  function gridHtml(cls, w, h, vals, extra) {
    let s = `<div class="${cls}" style="grid-template-columns:repeat(${w},1fr)">`;
    for (let i = 0; i < w * h; i++) s += extra(i, vals[i]);
    return s + '</div>';
  }
  function renderVisionRight() {
    const st = play.cfg, box = $('#logicPanel');
    const res = sim.evalVision(st, play.vision);
    const okN = res.items.filter((it) => it.ok).length;
    const imgCell = (i, v) => `<i class="${v ? 'on' : ''}"></i>`;
    const mapCell = (target) => (i, v) => `<i class="${v >= 0.5 ? 'on' : ''} ${target && target[i] ? 'tg' : ''}" style="--v:${v.toFixed(2)}"></i>`;
    const items = res.items.map((it, k) => {
      if (st.mode === 'class') {
        return `<div class="vrow ${it.ok ? 'ok' : 'bad'}">
          ${gridHtml('vimg', it.img.w, it.img.h, it.img.px, imgCell)}
          <span class="varrow">→</span>
          ${it.maps.map((m, f) => `<div class="vcol"><span class="muted">필터 ${FNAMES[f]}</span>${gridHtml('vmap sm', m.w, m.h, m.vals, mapCell(null))}<span class="vpool">최댓값 <b>${it.pools[f].toFixed(2)}</b></span></div>`).join('')}
          <span class="varrow">→</span>
          <div class="vout"><span class="muted">출력</span><b>${it.y.toFixed(2)}</b><span class="muted">정답 ${st.labels[k] ? '1 (세로만)' : '0'}</span></div>
          <span class="mark">${it.ok ? '✓' : '✗'}</span></div>`;
      }
      const m = it.maps[0];
      return `<div class="vrow ${it.ok ? 'ok' : 'bad'}">
        ${gridHtml('vimg', it.img.w, it.img.h, it.img.px, imgCell)}
        <span class="varrow">필터 →</span>
        ${gridHtml('vmap', m.w, m.h, m.vals, mapCell(it.target))}
        <span class="mark">${it.ok ? '✓' : '✗'}</span></div>`;
    }).join('');
    box.innerHTML = `
      <div class="lp-head"><h3>${st.mode === 'class' ? '그림 분류' : '그림과 특징 맵'}</h3><span class="muted">${st.mode === 'class'
        ? '그림 → 필터 A·B의 특징 맵 → 각각 최댓값(풀링) → 출력. 출력 0.5 이상이면 1.'
        : '왼쪽 그림에 필터를 겹쳐 계산한 결과가 오른쪽 특징 맵이에요. 밝은 칸 = 켜짐(0.5 이상), 금색 테두리 = 켜져야 할 칸.'}</span></div>
      <div class="vlist">${items}</div>
      <div class="lp-actions"><button class="btn primary" id="btnCheck">✓ 채점하기 <kbd>Space</kbd></button>
        <span class="muted">맞은 그림 ${okN} / ${res.items.length}</span></div>`;
    $('#btnCheck').onclick = checkVision;
  }
  function checkVision() {
    const st = play.cfg;
    const res = sim.evalVision(st, play.vision);
    const stats = sim.visionStats(play.vision);
    if (res.ok) audio.sfx.success(); else audio.sfx.fail();
    stageResult(Object.assign({ status: res.ok ? 'success' : 'fail' }, stats), emptyBrain(), () => `
      <div><div class="k">맞은 그림</div><div class="v">${res.items.filter((it) => it.ok).length}/${res.items.length}</div></div>
      <div><div class="k">쓴 필터 칸</div><div class="v">${stats.cells}</div></div>`, `틀린 그림 ${res.items.filter((it) => !it.ok).length}장`);
  }

  // ===================================================================
  // 8장: 시간표(기억 실험) — 한 줄이 한 순서, 왼쪽 칸부터 차례로 입력이 들어온다
  // ===================================================================
  const MEM_NAME = { mem1: '기억 1', mem2: '기억 2', memO: '출력 기억' };
  const seqSel = () => play.seqSel || { s: 0, t: 0 };
  const v01 = (v) => (Math.abs(v) < 0.005 ? '0' : Math.abs(v - 1) < 0.005 ? '1' : v.toFixed(1));
  function seqLive() {
    const res = sim.evalSeq(play.cfg, editor.getBrain()), sel = seqSel();
    const q = res.seqs[sel.s] || res.seqs[0];
    return (q.steps[sel.t] || q.steps[0]).act;
  }
  function renderSeqPanel() {
    const st = play.cfg, box = $('#logicPanel');
    const res = sim.evalSeq(st, editor.getBrain());
    const mems = st.sensors.filter((id) => sim.MEM_SRC[id]);
    const sel = seqSel();
    const okN = res.seqs.filter((q) => q.ok).length;
    const blocks = res.seqs.map((q, s) => {
      const isSel = (t) => sel.s === s && sel.t === t;
      const cell = (t, inner, cls) => `<button class="seq-cell ${cls || ''} ${isSel(t) ? 'sel' : ''}" data-s="${s}" data-t="${t}">${inner}</button>`;
      const line = (label, cls, f) => `<span class="seq-lbl ${cls}">${label}</span>` + q.steps.map(f).join('');
      return `<div class="seq ${q.ok ? 'ok' : 'bad'}">
        <div class="seq-grid" style="--n:${q.steps.length}">
          ${line('시간', 'dim', (p, t) => `<span class="seq-t">${t + 1}</span>`)}
          ${(st.seqInputs || ['inA']).map((id, k) => line(st.inputNames ? st.inputNames[k] : '입력 A', 'in', (p, t) => { const v = Array.isArray(p.x) ? p.x[k] : p.x; return cell(t, v01(v), 'in ' + (v ? 'on' : '')); })).join('')}
          ${mems.map((m) => line(MEM_NAME[m], 'mem', (p, t) => cell(t, v01(p.act[m]), 'mem ' + (p.act[m] >= 0.5 ? 'on' : '')))).join('')}
          ${line('출력', 'out', (p, t) => cell(t, v01(p.y), 'out ' + (p.y >= 0.5 ? 'on ' : '') + (p.ok ? '' : 'bad')))}
          ${line('목표', 'dim', (p) => `<span class="seq-tg">${p.target == null ? '·' : v01(p.target)}</span>`)}
        </div>
        <span class="mark">${q.ok ? '✓' : '✗'}</span></div>`;
    }).join('');
    box.innerHTML = `
      <div class="lp-head"><h3>시간표</h3><span class="muted">${st.tol != null ? `출력은 목표 값과 ${st.tol}까지 가까우면 맞아요. ` : ''}입력이 왼쪽 칸부터 한 칸씩 들어와요. 칸을 누르면 그 순간의 뇌가 왼쪽에 보여요. 기억 줄은 바로 전 칸에서 되돌아온 값이고, 새 순서(줄)가 시작되면 0으로 비워져요.</span></div>
      <div class="seq-list">${blocks}</div>
      <div class="lp-actions"><button class="btn primary" id="btnCheck">✓ 채점하기 <kbd>Space</kbd></button>
        <span class="muted">맞은 순서 ${okN} / ${res.seqs.length}</span></div>`;
    $$('#logicPanel .seq-cell').forEach((b) => (b.onclick = () => { play.seqSel = { s: +b.dataset.s, t: +b.dataset.t }; renderSeqPanel(); }));
    $('#btnCheck').onclick = checkSeq;
  }
  function checkSeq() {
    const st = play.cfg, brain = editor.getBrain();
    const res = sim.evalSeq(st, brain);
    if (res.ok) audio.sfx.success(); else audio.sfx.fail();
    const badN = res.seqs.reduce((a, q) => a + q.steps.filter((p) => !p.ok).length, 0);
    stageResult({ status: res.ok ? 'success' : 'fail' }, brain, (isNew) => `
      <div><div class="k">맞은 순서</div><div class="v">${res.seqs.filter((q) => q.ok).length}/${res.seqs.length}</div></div>
      <div><div class="k">시냅스</div><div class="v">${brain.synapses.length}${isNew.syn ? '<span class="new-badge">NEW</span>' : ''}</div></div>
      <div><div class="k">히든 뉴런 사용</div><div class="v">${sim.usedHidden(brain)}</div></div>`, `틀린 칸 ${badN}개`);
  }

  // ===================================================================
  // 9장: 무리 짓기(k-평균) — 왼쪽은 중심 다루기, 오른쪽은 점 지도
  // ===================================================================
  const KM_COLORS = ['#5aa9ff', '#ffa94d', '#7ee081', '#c3a6ff', '#ff5fa2', '#5ee6d0'];
  function newKm(st, k) {
    const kk = k || (st.chooseK ? st.k0 : st.init.length);
    const init = st.chooseK ? st.inits[kk] : st.init;
    const prev = play.km && play.km.id === st.id ? play.km : null;
    return { id: st.id, k: kk, centers: init.map((c) => c.slice()), steps: 0, moved: false, auto: false, acc: 0, drag: -1,
      kTried: prev ? prev.kTried : new Set([kk]), elbow: prev ? prev.elbow : {} };
  }
  function kmReset() {
    const st = play.cfg, km = play.km;
    play.km = newKm(st, km.k);
    renderKmLeft(); renderKmRight();
  }
  function kmRecordElbow() {
    const st = play.cfg, km = play.km;
    if (!st.chooseK || !sim.kmConverged(st.pts, km.centers)) return;
    const v = sim.kmInertia(st.pts, km.centers);
    km.elbow[km.k] = km.elbow[km.k] == null ? v : Math.min(km.elbow[km.k], v);
  }
  // 한 걸음: 중심이 실제로 움직였을 때만 걸음 수를 센다
  function kmStepOnce() {
    const st = play.cfg, km = play.km;
    if (sim.kmConverged(st.pts, km.centers)) { km.auto = false; kmRecordElbow(); return false; }
    km.centers = sim.kmStep(st.pts, km.centers);
    km.steps++;
    audio.sfx.click();
    kmRecordElbow();
    return true;
  }
  function kmStatsHtml() {
    const st = play.cfg, km = play.km;
    const conv = sim.kmConverged(st.pts, km.centers);
    return `<div class="stat-grid">
      ${st.stepper ? `<div><div class="k">걸음 수</div><div class="v">${km.steps}</div></div>` : ''}
      <div><div class="k">거리 합</div><div class="v">${sim.kmInertia(st.pts, km.centers).toFixed(3)}</div></div>
      ${st.stepper ? `<div><div class="k">상태</div><div class="v">${conv ? '멈춤' : '움직임'}</div></div>` : ''}</div>
      <p class="muted km-note">거리 합 = 모든 점과 자기 중심 사이 거리(제곱)의 합. 작을수록 잘 묶인 거예요. k-평균은 이 값을 줄이는 쪽으로만 움직여요.</p>`;
  }
  function renderKmLeft() {
    const st = play.cfg, km = play.km, box = $('#visionLeft');
    box.innerHTML = `<div class="vl-head"><h3>중심 다루기</h3><span class="muted">${st.drag ? '중심(큰 동그라미)은 오른쪽 점 지도에서 끌어서 옮길 수 있어요.' : '이번에는 중심을 손으로 옮길 수 없어요. 한 걸음 버튼을 써요.'}</span></div>
      <div class="filter-cards">
        ${st.chooseK ? `<div class="filter-card out-card"><h4>중심 수 k <span class="muted">바꾸면 중심이 처음 자리로 돌아가요</span></h4>
          <div class="seg" id="kSeg">${[1, 2, 3, 4, 5, 6].map((k) => `<button data-k="${k}" class="${k === km.k ? 'on' : ''}">${k}</button>`).join('')}</div></div>` : ''}
        ${st.stepper ? `<div class="filter-card out-card"><h4>k-평균 한 걸음</h4>
          <ol class="km-steps"><li><b>묶기</b> 각 점은 가장 가까운 중심의 색을 받는다.</li><li><b>옮기기</b> 각 중심은 자기 색 점들의 한가운데(평균)로 간다.</li></ol>
          <div class="lp-actions"><button class="btn" id="btnKmStep">한 걸음</button><button class="btn" id="btnKmRun">${km.auto ? '⏸ 멈추기' : '▶ 멈출 때까지'}</button><button class="btn ghost" id="btnKmReset">↺ 처음 자리로 <kbd>R</kbd></button></div></div>`
        : `<div class="filter-card out-card"><div class="lp-actions"><button class="btn ghost" id="btnKmReset">↺ 처음 자리로 <kbd>R</kbd></button></div></div>`}
        <div class="filter-card out-card" id="kmStats">${kmStatsHtml()}</div>
        <div class="filter-card out-card km-neuron"><h4>중심 = 뉴런</h4><p class="muted">중심 하나는 가중치 두 개(x, y)를 가진 뉴런과 같아요. 점이 들어오면 가장 가까운 뉴런 하나만 이겨서 켜져요(승자 독식). 그래서 k-평균은 서로 경쟁하는 뉴런들이 배우는 것과 같아요.</p></div>
      </div>`;
    const sb = $('#btnKmStep');
    if (sb) sb.onclick = () => { if (!kmStepOnce()) toast('중심이 더 움직이지 않아요(멈춤). 채점해 보세요'); renderKmLeft(); renderKmRight(); };
    const rb = $('#btnKmRun');
    if (rb) rb.onclick = () => { km.auto = !km.auto; km.acc = 0.3; renderKmLeft(); };
    $('#btnKmReset').onclick = kmReset;
    $$('#kSeg button').forEach((b) => (b.onclick = () => {
      const k = +b.dataset.k;
      play.km = newKm(st, k);
      play.km.kTried.add(k);
      renderKmLeft(); renderKmRight();
    }));
  }
  function renderKmRight() {
    const st = play.cfg, box = $('#logicPanel');
    const elbow = st.chooseK ? (() => {
      const km = play.km, vals = [1, 2, 3, 4, 5, 6].map((k) => km.elbow[k]);
      const max = Math.max(0.001, ...vals.filter((v) => v != null));
      return `<div class="elbow"><h4>k별 거리 합 <span class="muted">그 k로 멈출 때까지 걸었을 때의 값</span></h4>
        <div class="elbow-bars">${vals.map((v, i) => `<div class="eb ${i + 1 === km.k ? 'cur' : ''}"><em>${v == null ? '?' : v.toFixed(2)}</em><span class="bar ${v == null ? 'empty' : ''}" style="height:${v == null ? 100 : Math.max(3, (v / max) * 100)}%"></span><b>k=${i + 1}</b></div>`).join('')}</div></div>`;
    })() : '';
    box.innerHTML = `
      <div class="lp-head"><h3>점 지도 · 정답 없음</h3><span class="muted">점의 색은 정답이 아니라 "가장 가까운 중심"의 색이에요.${st.stepper ? ' 점선 화살표 끝은 다음 걸음에 중심이 갈 자리(자기 색 점들의 평균)예요.' : ' 가는 선은 점이 어느 중심에 묶였는지 보여 줘요.'}</span></div>
      <div class="plot-wrap"><canvas id="kmCanvas" aria-label="점 지도"></canvas></div>
      ${elbow}
      <div class="lp-actions"><button class="btn primary" id="btnCheck">✓ 채점하기 <kbd>Space</kbd></button>
        <span class="muted">${st.goal === 'match' ? '눈에 보이는 무리마다 다른 색이 되면 채점하세요.' : '무리를 찾고 중심이 멈추면 채점하세요.'}</span></div>`;
    $('#btnCheck').onclick = checkCluster;
    drawKm();
    const cv = $('#kmCanvas');
    const toXY = (e) => { const b = cv.getBoundingClientRect(), g = kmGeom(cv); return [(e.clientX - b.left - g.pad) / g.S2, 1 - (e.clientY - b.top - 8) / g.S2]; };
    cv.onpointerdown = (e) => {
      if (!st.drag || e.button !== 0) return;
      const [x, y] = toXY(e), g = kmGeom(cv);
      let best = -1, bd = 22 / g.S2;
      play.km.centers.forEach((c, k) => { const d = Math.hypot(c[0] - x, c[1] - y); if (d < bd) { bd = d; best = k; } });
      if (best < 0) return;
      play.km.drag = best; play.km.auto = false;
      cv.setPointerCapture(e.pointerId);
    };
    cv.onpointermove = (e) => {
      const km = play.km;
      if (km.drag < 0) { if (st.drag) { const [x, y] = toXY(e), g = kmGeom(cv); cv.style.cursor = km.centers.some((c) => Math.hypot(c[0] - x, c[1] - y) < 22 / g.S2) ? 'grab' : 'default'; } return; }
      const [x, y] = toXY(e);
      km.centers[km.drag] = [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
      km.dragMoved = true;
      drawKm();
      $('#kmStats').innerHTML = kmStatsHtml();
    };
    cv.onpointerup = cv.onpointercancel = () => {
      const km = play.km;
      if (km.drag < 0) return;
      km.drag = -1;
      if (km.dragMoved) { km.moved = true; km.dragMoved = false; }
      kmRecordElbow(); renderKmRight();
    };
  }
  function kmGeom(cv) { const size = cv.clientWidth || 360, pad = 26; return { size, pad, S2: size - pad - 8 }; }
  function drawKm() {
    const cv = $('#kmCanvas');
    if (!cv) return;
    const st = play.cfg, km = play.km;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const { size, pad, S2 } = kmGeom(cv);
    cv.width = Math.round(size * dpr); cv.height = Math.round(size * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const PX = (x) => pad + x * S2, PY = (y) => 8 + (1 - y) * S2;
    g.fillStyle = '#1d2128'; g.fillRect(0, 0, size, size);
    g.strokeStyle = 'rgba(200,200,210,0.35)'; g.lineWidth = 1; g.strokeRect(pad, 8, S2, S2);
    g.fillStyle = '#9aa3b5'; g.font = '11px ' + getComputedStyle(document.body).fontFamily;
    g.textAlign = 'center'; g.fillText('0', pad, size - 8); g.fillText('x →', pad + S2 / 2, size - 8); g.fillText('1', pad + S2, size - 8);
    g.textAlign = 'right'; g.fillText('1', pad - 6, 16); g.fillText('y', pad - 6, 8 + S2 / 2); g.fillText('0', pad - 6, 8 + S2);
    const a = sim.kmAssign(st.pts, km.centers);
    // 점 → 자기 중심 가는 선(묶기)
    g.lineWidth = 1;
    st.pts.forEach((p, i) => { const c = km.centers[a[i]]; g.strokeStyle = KM_COLORS[a[i] % 6] + '33'; g.beginPath(); g.moveTo(PX(p[0]), PY(p[1])); g.lineTo(PX(c[0]), PY(c[1])); g.stroke(); });
    st.pts.forEach((p, i) => { g.fillStyle = KM_COLORS[a[i] % 6]; g.strokeStyle = '#14161a'; g.lineWidth = 1.5; g.beginPath(); g.arc(PX(p[0]), PY(p[1]), 5.5, 0, 6.283); g.fill(); g.stroke(); });
    // 다음 걸음에 갈 자리(옮기기). 한 걸음 버튼이 없는 실험에서는 그리지 않는다
    const next = st.stepper ? sim.kmStep(st.pts, km.centers) : [];
    next.forEach((n, k) => {
      const c = km.centers[k];
      if (Math.hypot(n[0] - c[0], n[1] - c[1]) < 0.004) return;
      g.strokeStyle = KM_COLORS[k % 6]; g.lineWidth = 1.6; g.setLineDash([4, 4]);
      g.beginPath(); g.moveTo(PX(c[0]), PY(c[1])); g.lineTo(PX(n[0]), PY(n[1])); g.stroke(); g.setLineDash([]);
      g.beginPath(); g.arc(PX(n[0]), PY(n[1]), 6, 0, 6.283); g.stroke();
    });
    // 중심
    km.centers.forEach((c, k) => {
      const x = PX(c[0]), y = PY(c[1]);
      g.fillStyle = KM_COLORS[k % 6]; g.strokeStyle = '#f4f1ea'; g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, 12, 0, 6.283); g.fill(); g.stroke();
      g.strokeStyle = '#14161a'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x - 5, y - 5); g.lineTo(x + 5, y + 5); g.moveTo(x + 5, y - 5); g.lineTo(x - 5, y + 5); g.stroke();
    });
  }
  function checkCluster() {
    const st = play.cfg, km = play.km;
    km.auto = false;
    kmRecordElbow();
    const match = sim.kmMatches(st.pts, km.centers), conv = sim.kmConverged(st.pts, km.centers);
    const ok = match && (st.goal !== 'converged' || conv);
    const inertia = sim.kmInertia(st.pts, km.centers);
    const groups = new Set(st.pts.map((p) => p[2])).size;
    if (ok) audio.sfx.success(); else audio.sfx.fail();
    renderKmLeft(); renderKmRight();
    stageResult({ status: ok ? 'success' : 'fail', inertia, steps: km.steps, kTried: km.kTried.size }, emptyBrain(), () => `
      <div><div class="k">중심 수</div><div class="v">${km.centers.length}</div></div>
      <div><div class="k">거리 합</div><div class="v">${inertia.toFixed(3)}</div></div>
      <div><div class="k">걸음 수</div><div class="v">${km.steps}</div></div>`,
    !match ? (km.centers.length !== groups ? `중심 수가 무리 수와 달라요. 무리를 하나로 합쳤거나 억지로 쪼갰어요.` : '아직 한 무리가 두 색으로 나뉘었거나, 두 무리가 한 색이에요.')
      : '무리는 맞게 나뉘었지만 중심이 아직 움직이는 중이에요. 멈출 때까지 걸어 보세요.');
  }

  // ===================================================================
  // 10장: 코드 지도(잠재 공간) — 입력마다 히든 뉴런 값을 점으로 찍는다
  // ===================================================================
  function codeOf(r, brain) { return (brain.hidden || []).map((h) => h.id).sort().map((id) => r.act[id] || 0); }
  function drawCodeMap(st, res, brain) {
    const cv = $('#codeMap');
    if (!cv) return;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const W = cv.clientWidth || 300, two = (brain.hidden || []).length >= 2, H = two ? Math.min(W, 240) : 56 + 12 * Math.min(6, res.rows.length);
    const lineY = H - 40;
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1d2128'; g.fillRect(0, 0, W, H);
    const font = getComputedStyle(document.body).fontFamily;
    g.font = '11px ' + font; g.fillStyle = '#9aa3b5';
    const pad = 30;
    let PX, PY;
    if (two) {
      const S2 = Math.min(W - pad * 2, H - 36);
      const ox = (W - S2) / 2;
      PX = (v) => ox + Math.max(0, Math.min(1, v)) * S2; PY = (v) => 10 + (1 - Math.max(0, Math.min(1, v))) * S2;
      g.strokeStyle = 'rgba(200,200,210,0.35)'; g.strokeRect(ox, 10, S2, S2);
      g.textAlign = 'center'; g.fillText('히든 1 →', ox + S2 / 2, H - 8);
      g.textAlign = 'right'; g.fillText('히든 2', ox - 6, 10 + S2 / 2); g.fillText('1', ox - 6, 18); g.fillText('0', ox - 6, 10 + S2);
    } else {
      PX = (v) => pad + Math.max(0, Math.min(1, v)) * (W - pad * 2); PY = () => lineY;
      g.strokeStyle = 'rgba(200,200,210,0.45)'; g.beginPath(); g.moveTo(pad, lineY); g.lineTo(W - pad, lineY); g.stroke();
      g.textAlign = 'center'; g.fillText('0', pad, lineY + 20); g.fillText('히든 1 (코드) →', W / 2, lineY + 34); g.fillText('1', W - pad, lineY + 20);
    }
    const seen = [];
    res.rows.forEach((r, i) => {
      const c = codeOf(r, brain);
      const x = PX(c[0] || 0), y = PY(c[1] || 0);
      const n = seen.filter((p) => Math.hypot(p[0] - x, p[1] - y) < 10).length;
      seen.push([x, y]);
      g.fillStyle = r.ok ? '#7ee081' : '#ff5d73';
      g.beginPath(); g.arc(x, y, 6, 0, 6.283); g.fill();
      g.fillStyle = '#ece8e0'; g.font = '700 11px ' + font; const right = x > W - 60; g.textAlign = right ? 'right' : 'left';
      g.fillText((st.rowLabels || [])[i] || String(i + 1), right ? x - 9 : x + 9, y - 6 - n * 12);
    });
  }

  // ===================================================================
  // 11장 심화: 오차 지형 위에서 공 굴리기(최적화)
  // ===================================================================
  const OPT_NAME = { gd: '경사 하강', momentum: '모멘텀', adam: 'Adam' };
  const OPT_DESC = {
    gd: '지금 자리의 기울기만 보고, 가장 가파르게 내려가는 쪽으로 "학습률 × 기울기"만큼 간다.',
    momentum: '지난 걸음의 속도를 β만큼 기억해서 지금 기울기에 더한다. 같은 쪽으로 가던 힘(관성)이 쌓인다.',
    adam: '가중치마다 기울기의 평균과 크기를 따로 기억해서, 기울기를 그 크기로 나눠 걸음을 정한다. 가파른 쪽도 평평한 쪽도 학습률 정도씩 간다.',
  };
  function newDesc(st, prev) {
    const keep = prev && prev.id === st.id;
    const o = keep ? prev.o : { opt: st.opts[0], beta: st.betas[st.betas.length - 1], lr: st.lr0 };
    const start = keep ? prev.start : st.start.slice();
    return { id: st.id, o, start, startMoved: keep ? prev.startMoved : false, s: sim.descInit(start), auto: false, acc: 0, done: null, drag: false };
  }
  function descReset() { play.desc = newDesc(play.cfg, play.desc); renderDescLeft(); renderDescRight(); }
  function descStepOnce() {
    const st = play.cfg, d = play.desc;
    if (d.done) return false;
    sim.descStep(st, d.s, d.o);
    if (sim.descDiverged(st, d.s)) d.done = 'diverged';
    else if (sim.descArrived(st, d.s)) d.done = 'arrived';
    else if (d.s.t >= st.maxSteps) d.done = 'max';
    return true;
  }
  const DONE_TOAST = { arrived: '공이 바닥에 멈췄어요. 채점해 보세요', diverged: '공이 지형 밖으로 튀어 나갔어요. 학습률이 너무 커요', max: '걸음을 다 썼어요. 설정을 바꿔 다시 해 보세요' };
  function descStatsHtml() {
    const st = play.cfg, d = play.desc;
    const f = sim.descF(st, d.s.w);
    const state = d.done === 'arrived' ? '도착' : d.done === 'diverged' ? '튀어 나감' : d.done === 'max' ? '걸음 끝' : d.s.t ? '굴러감' : '준비';
    return `<div class="stat-grid">
      <div><div class="k">걸음</div><div class="v">${d.s.t} / ${st.maxSteps}</div></div>
      <div><div class="k">오차</div><div class="v">${Number.isFinite(f) && f < 1e4 ? f.toFixed(3) : '∞'}</div></div>
      <div><div class="k">상태</div><div class="v">${state}</div></div></div>`;
  }
  function renderDescLeft() {
    const st = play.cfg, d = play.desc, box = $('#visionLeft');
    const seg = (id, items, cur, label) => `<div class="seg" id="${id}">${items.map((v) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${label(v)}</button>`).join('')}</div>`;
    box.innerHTML = `<div class="vl-head"><h3>공 굴리기</h3><span class="muted">설정을 바꾸면 공이 출발점으로 돌아가요.${st.dragStart ? ' 출발점(흰 고리)은 오른쪽 지형에서 끌어서 옮길 수 있어요.' : ''}</span></div>
      <div class="filter-cards">
        <div class="filter-card out-card"><h4>최적화 방법${st.opts.length > 1 ? '' : ' · 경사 하강'}</h4>${st.opts.length > 1 ? seg('optSeg', st.opts, d.o.opt, (v) => OPT_NAME[v]) : ''}<p class="muted km-note">${esc(OPT_DESC[d.o.opt])}</p></div>
        ${d.o.opt === 'momentum' ? `<div class="filter-card out-card"><h4>관성 β <span class="muted">지난 속도를 얼마나 기억할까</span></h4>${seg('betaSeg', st.betas, d.o.beta, (v) => v)}</div>` : ''}
        <div class="filter-card out-card"><h4>학습률 <span class="muted">한 걸음의 크기</span></h4>${seg('lrSeg', st.lrs, d.o.lr, (v) => v)}</div>
        <div class="filter-card out-card"><div class="lp-actions"><button class="btn" id="btnDStep">한 걸음</button><button class="btn" id="btnDRun">${d.auto ? '⏸ 멈추기' : '▶ 멈출 때까지'}</button><button class="btn ghost" id="btnDReset">↺ 처음으로 <kbd>R</kbd></button></div></div>
        <div class="filter-card out-card" id="descStats">${descStatsHtml()}</div>
      </div>`;
    const change = (fn) => { fn(); play.desc = Object.assign(newDesc(st, play.desc), { o: d.o }); renderDescLeft(); renderDescRight(); };
    $$('#optSeg button').forEach((b) => (b.onclick = () => change(() => { d.o.opt = b.dataset.v; })));
    $$('#betaSeg button').forEach((b) => (b.onclick = () => change(() => { d.o.beta = +b.dataset.v; })));
    $$('#lrSeg button').forEach((b) => (b.onclick = () => change(() => { d.o.lr = +b.dataset.v; })));
    $('#btnDStep').onclick = () => {
      const dd = play.desc;
      if (!descStepOnce()) { toast(DONE_TOAST[dd.done] || ''); return; }
      if (dd.done) toast(DONE_TOAST[dd.done]);
      descRefresh();
    };
    $('#btnDRun').onclick = () => {
      const dd = play.desc;
      if (dd.done) { toast(DONE_TOAST[dd.done] + ' (↺ 처음으로)'); return; }
      dd.auto = !dd.auto; dd.acc = 0; renderDescLeft();
    };
    $('#btnDReset').onclick = descReset;
  }
  function descRefresh() { drawDesc(); drawFit(); const s = $('#descStats'); if (s) s.innerHTML = descStatsHtml(); }
  function renderDescRight() {
    const st = play.cfg, box = $('#logicPanel');
    box.innerHTML = `
      <div class="lp-head"><h3>오차 지형</h3><span class="muted">가로는 ${esc(st.axes[0])}, 세로는 ${esc(st.axes[1])}. 어두울수록 오차가 작아요. 흰 공이 지금 가중치, 선은 지나온 길, 금색 원이 바닥이에요.</span></div>
      <div class="plot-wrap"><canvas id="descCanvas" aria-label="오차 지형"></canvas></div>
      ${st.surface === 'fit' ? '<div class="fit-inset"><h4>지금 가중치로 그은 선 <span class="muted">점 네 개를 모두 지나면 오차 0</span></h4><canvas id="fitCanvas" aria-label="지금 선"></canvas></div>' : ''}
      <div class="lp-actions"><button class="btn primary" id="btnCheck">✓ 채점하기 <kbd>Space</kbd></button><span class="muted">공이 금색 원 안에 멈추면 채점하세요.</span></div>`;
    $('#btnCheck').onclick = checkDesc;
    drawDesc(); drawFit();
    const cv = $('#descCanvas');
    const toW = (e) => { const b = cv.getBoundingClientRect(), m = descGeom(cv, st); return [m.iw(e.clientX - b.left), m.ib(e.clientY - b.top)]; };
    const nearStart = (e) => { const b = cv.getBoundingClientRect(), m = descGeom(cv, st), d = play.desc; return Math.hypot(m.X(d.start[0]) - (e.clientX - b.left), m.Y(d.start[1]) - (e.clientY - b.top)) < 16; };
    cv.onpointerdown = (e) => {
      if (!st.dragStart || e.button !== 0 || !nearStart(e)) return;
      play.desc.drag = true; play.desc.auto = false;
      cv.setPointerCapture(e.pointerId);
    };
    cv.onpointermove = (e) => {
      const d = play.desc;
      if (!d.drag) { if (st.dragStart) cv.style.cursor = nearStart(e) ? 'grab' : 'default'; return; }
      const [w, b] = toW(e);
      const v = st.view;
      d.start = [Math.max(v[0], Math.min(v[1], w)), Math.max(v[2], Math.min(v[3], b))].map((x) => Math.round(x * 100) / 100);
      d.startMoved = true;
      d.s = sim.descInit(d.start); d.done = null;
      descRefresh();
    };
    cv.onpointerup = cv.onpointercancel = () => { if (play.desc.drag) { play.desc.drag = false; renderDescLeft(); } };
  }
  function descGeom(cv, st) {
    const size = cv.clientWidth || 360, pad = 30, S2 = size - pad - 10, v = st.view;
    const X = (w) => pad + ((w - v[0]) / (v[1] - v[0])) * S2, Y = (b) => 8 + (1 - (b - v[2]) / (v[3] - v[2])) * S2;
    return { size, pad, S2, X, Y, iw: (px) => v[0] + ((px - pad) / S2) * (v[1] - v[0]), ib: (py) => v[2] + (1 - (py - 8) / S2) * (v[3] - v[2]) };
  }
  // 지형 그림은 실험마다 한 번만 계산해 둔다
  const descBg = { key: '', img: null };
  function drawDesc() {
    const cv = $('#descCanvas');
    if (!cv) return;
    const st = play.cfg, d = play.desc;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const m = descGeom(cv, st);
    cv.width = Math.round(m.size * dpr); cv.height = Math.round(m.size * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1d2128'; g.fillRect(0, 0, m.size, m.size);
    const key = st.id + ':' + m.size;
    if (descBg.key !== key) {
      const N = 90, vals = [];
      let lo = Infinity, hi = -Infinity;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const w = st.view[0] + ((i + 0.5) / N) * (st.view[1] - st.view[0]), b = st.view[3] - ((j + 0.5) / N) * (st.view[3] - st.view[2]);
        const v = Math.log(1 + Math.max(0, sim.descF(st, [w, b]) - sim.descF(st, st.min)));
        vals.push(v); lo = Math.min(lo, v); hi = Math.max(hi, v);
      }
      const off = document.createElement('canvas');
      off.width = N; off.height = N;
      const og = off.getContext('2d'), im = og.createImageData(N, N);
      const C = [[18, 30, 48], [34, 86, 102], [96, 140, 110], [214, 168, 92], [236, 214, 170]];
      vals.forEach((v, k) => {
        const t = Math.floor(((v - lo) / (hi - lo || 1)) * 14) / 14; // 띠(등고선)처럼 끊어 칠한다
        const x = t * (C.length - 1), a = Math.floor(Math.min(C.length - 2, x)), f = x - a;
        for (let c = 0; c < 3; c++) im.data[k * 4 + c] = Math.round(C[a][c] + (C[a + 1][c] - C[a][c]) * f);
        im.data[k * 4 + 3] = 255;
      });
      og.putImageData(im, 0, 0);
      descBg.key = key; descBg.img = off;
    }
    g.imageSmoothingEnabled = false;
    g.drawImage(descBg.img, m.pad, 8, m.S2, m.S2);
    g.strokeStyle = 'rgba(200,200,210,0.35)'; g.lineWidth = 1; g.strokeRect(m.pad, 8, m.S2, m.S2);
    g.fillStyle = '#9aa3b5'; g.font = '11px ' + getComputedStyle(document.body).fontFamily;
    g.textAlign = 'center';
    g.fillText(String(st.view[0]), m.pad, m.size - 2); g.fillText(st.axes[0] + ' →', m.pad + m.S2 / 2, m.size - 2); g.fillText(String(st.view[1]), m.pad + m.S2, m.size - 2);
    g.textAlign = 'right'; g.fillText(String(st.view[3]), m.pad - 4, 16); g.fillText(String(st.view[2]), m.pad - 4, 8 + m.S2);
    // 바닥(금색 원)
    const rx = (st.goalR / (st.view[1] - st.view[0])) * m.S2, ry = (st.goalR / (st.view[3] - st.view[2])) * m.S2;
    g.strokeStyle = '#f4c95d'; g.lineWidth = 2; g.setLineDash([4, 3]);
    g.beginPath(); g.ellipse(m.X(st.min[0]), m.Y(st.min[1]), Math.max(5, rx), Math.max(5, ry), 0, 0, 6.283); g.stroke(); g.setLineDash([]);
    g.save(); g.beginPath(); g.rect(m.pad, 8, m.S2, m.S2); g.clip();
    // 지나온 길
    const P = d.s.path;
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.6; g.beginPath();
    P.forEach((p, k) => { const x = m.X(p[0]), y = m.Y(p[1]); if (k) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)';
    P.forEach((p) => { g.beginPath(); g.arc(m.X(p[0]), m.Y(p[1]), 1.8, 0, 6.283); g.fill(); });
    g.restore();
    // 출발점(고리)과 공
    g.strokeStyle = '#ece8e0'; g.lineWidth = 2;
    g.beginPath(); g.arc(m.X(d.start[0]), m.Y(d.start[1]), 8, 0, 6.283); g.stroke();
    if (Number.isFinite(d.s.w[0] + d.s.w[1])) {
      const bx = Math.max(m.pad, Math.min(m.pad + m.S2, m.X(d.s.w[0]))), by = Math.max(8, Math.min(8 + m.S2, m.Y(d.s.w[1])));
      g.fillStyle = d.done === 'diverged' ? '#ff5d73' : '#ffffff'; g.strokeStyle = '#14161a'; g.lineWidth = 2;
      g.beginPath(); g.arc(bx, by, 6.5, 0, 6.283); g.fill(); g.stroke();
    }
  }
  // 1번 실험: 지금 가중치로 그은 직선과 맞혀야 할 점 네 개
  function drawFit() {
    const cv = $('#fitCanvas');
    if (!cv) return;
    const d = play.desc, [w, b] = d.s.w;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const W = cv.clientWidth || 300, H = 140;
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#1d2128'; g.fillRect(0, 0, W, H);
    const X = (x) => 24 + ((x + 0.5) / 4) * (W - 36), Y = (y) => 8 + (1 - (y + 2) / 11) * (H - 22);
    g.strokeStyle = 'rgba(200,200,210,0.3)'; g.beginPath(); g.moveTo(X(-0.5), Y(0)); g.lineTo(X(3.5), Y(0)); g.stroke();
    g.fillStyle = '#9aa3b5'; g.font = '11px ' + getComputedStyle(document.body).fontFamily; g.textAlign = 'left';
    g.fillText(`출력 = ${Number.isFinite(w) ? w.toFixed(2) : '?'} × 입력 + ${Number.isFinite(b) ? b.toFixed(2) : '?'}`, 28, H - 4);
    if (Number.isFinite(w + b)) {
      g.save(); g.beginPath(); g.rect(0, 0, W, H - 14); g.clip();
      g.strokeStyle = '#5aa9ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(-0.5), Y(w * -0.5 + b)); g.lineTo(X(3.5), Y(w * 3.5 + b)); g.stroke();
      g.restore();
    }
    [[0, 1], [1, 3], [2, 5], [3, 7]].forEach(([x, y]) => { g.fillStyle = '#ffd166'; g.beginPath(); g.arc(X(x), Y(y), 4.5, 0, 6.283); g.fill(); });
  }
  function checkDesc() {
    const st = play.cfg, d = play.desc;
    d.auto = false;
    const ok = d.done === 'arrived';
    if (ok) audio.sfx.success(); else audio.sfx.fail();
    renderDescLeft();
    stageResult({ status: ok ? 'success' : 'fail', steps: d.s.t, startMoved: d.startMoved, opt: d.o.opt }, emptyBrain(), () => `
      <div><div class="k">걸음</div><div class="v">${d.s.t}</div></div>
      <div><div class="k">방법</div><div class="v">${OPT_NAME[d.o.opt]}${d.o.opt === 'momentum' ? ' β' + d.o.beta : ''}</div></div>
      <div><div class="k">학습률</div><div class="v">${d.o.lr}</div></div>`,
    d.done === 'diverged' ? '공이 지형 밖으로 튀어 나갔어요. 학습률이 너무 커요.' : d.done === 'max' ? `${st.maxSteps}걸음 안에 바닥에 멈추지 못했어요. 학습률이나 방법을 바꿔 보세요.` : d.s.t === 0 ? '아직 공을 굴리지 않았어요. "멈출 때까지"를 눌러 보세요.' : '공이 아직 바닥(금색 원)에 멈추지 않았어요.');
  }

  // ===================================================================
  // 12장 심화: 격자 세상 — 가치 퍼뜨리기와 Q러닝
  // ===================================================================
  function newGrid(st, prev) {
    const keep = prev && prev.id === st.id;
    const g = sim.gridOf(st);
    return {
      id: st.id, g,
      gamma: keep ? prev.gamma : st.gamma0 != null ? st.gamma0 : st.gamma,
      alpha: keep ? prev.alpha : st.alpha0, eps: keep ? prev.eps : st.eps0,
      V: new Array(g.N).fill(0), Q: Array.from({ length: g.N }, () => [0, 0, 0, 0]),
      sweeps: 0, episodes: 0, rng: sim.makeRng(st.seed || st.id), last: null, auto: false, acc: 0, settled: false,
    };
  }
  function gridReset() { play.grid = newGrid(play.cfg, play.grid); renderGridLeft(); renderGridRight(); }
  const gridActs = (st, gs) => (i) => (st.mode === 'vi' ? sim.vActionValues(st, gs.g, gs.V, gs.gamma, i) : gs.Q[i]);
  const cellVal = (st, gs, i) => (st.mode === 'vi' ? gs.V[i] : Math.max(...gs.Q[i]));
  const gridPath = (st, gs) => sim.greedyPath(st, gs.g, gridActs(st, gs));
  function gridGoalMet(st, gs) {
    const p = gridPath(st, gs);
    if (p.stuck || gs.g.cell[p.end] !== st.target) return false;
    return !st.shortest || p.path.length - 1 === sim.gridShortest(st, gs.g, st.target);
  }
  // 한 번: 가치 퍼뜨리기는 모든 칸을 한 번 고치고, Q러닝은 한 판을 해 본다
  function gridStepOnce() {
    const st = play.cfg, gs = play.grid;
    if (st.mode === 'vi') {
      if (gs.sweeps >= 40) return false;
      const V = sim.valueSweep(st, gs.g, gs.V, gs.gamma);
      gs.settled = V.every((v, i) => Math.abs(v - gs.V[i]) < 1e-9);
      gs.V = V; gs.sweeps++;
    } else {
      if (gs.episodes >= st.maxEpisodes) return false;
      gs.last = sim.qEpisode(st, gs.g, gs.Q, { alpha: gs.alpha, eps: gs.eps, gamma: gs.gamma }, gs.rng);
      gs.episodes++;
    }
    return true;
  }
  function gridStatsHtml() {
    const st = play.cfg, gs = play.grid;
    const v0 = cellVal(st, gs, gs.g.start);
    return `<div class="stat-grid">
      ${st.mode === 'vi' ? `<div><div class="k">퍼뜨린 횟수</div><div class="v">${gs.sweeps}</div></div>` : `<div><div class="k">해 본 판</div><div class="v">${gs.episodes} / ${st.maxEpisodes}</div></div>
      <div><div class="k">지난 판</div><div class="v">${gs.last ? `${gs.last.path.length - 1}걸음 · ${gs.last.total > 0 ? '+' : ''}${Math.round(gs.last.total * 10) / 10}점` : '-'}</div></div>`}
      <div><div class="k">출발 칸의 가치</div><div class="v">${v0.toFixed(2)}</div></div></div>`;
  }
  function renderGridLeft() {
    const st = play.cfg, gs = play.grid, box = $('#visionLeft');
    const seg = (id, items, cur) => `<div class="seg" id="${id}">${items.map((v) => `<button data-v="${v}" class="${v === cur ? 'on' : ''}">${v}</button>`).join('')}</div>`;
    const vi = st.mode === 'vi';
    box.innerHTML = `<div class="vl-head"><h3>${vi ? '가치 퍼뜨리기' : 'Q러닝'}</h3><span class="muted">${vi ? '지도를 다 알 때: 칸마다 가치를 계산해서 퍼뜨린다.' : '지도를 모를 때: 직접 돌아다니며 칸마다 방향별 점수(Q)를 고친다.'} 설정을 바꾸면 처음부터 다시 배워요.</span></div>
      <div class="filter-cards">
        <div class="filter-card out-card"><h4>할인율 γ <span class="muted">나중 보상을 얼마로 칠까</span></h4>${st.gammas ? seg('gammaSeg', st.gammas, gs.gamma) : `<p class="muted km-note">이 실험은 γ = ${gs.gamma}로 정해져 있어요.</p>`}</div>
        ${vi ? '' : `<div class="filter-card out-card"><h4>학습률 α <span class="muted">한 번에 Q를 얼마나 고칠까</span></h4>${seg('alphaSeg', st.alphas, gs.alpha)}</div>
        <div class="filter-card out-card"><h4>탐험 ε <span class="muted">일부러 아무 데나 가 볼 비율</span></h4>${seg('epsSeg', st.epss, gs.eps)}</div>`}
        <div class="filter-card out-card"><p class="muted km-note">${vi ? '가치 = 가장 좋은 방향의 (한 걸음 보상 + γ × 다음 칸의 가치)' : 'Q ← Q + α × (받은 보상 + γ × 다음 칸의 가장 큰 Q − Q)'}</p>
          <div class="lp-actions"><button class="btn" id="btnGStep">${vi ? '한 번 퍼뜨리기' : '한 판 해 보기'}</button><button class="btn" id="btnGRun">${gs.auto ? '⏸ 멈추기' : vi ? '▶ 길이 이어질 때까지' : '▶ 자동 학습'}</button><button class="btn ghost" id="btnGReset">↺ 처음부터 <kbd>R</kbd></button></div></div>
        <div class="filter-card out-card" id="gridStats">${gridStatsHtml()}</div>
      </div>`;
    const change = (fn) => { fn(); play.grid = newGrid(st, play.grid); renderGridLeft(); renderGridRight(); };
    $$('#gammaSeg button').forEach((b) => (b.onclick = () => change(() => { gs.gamma = +b.dataset.v; })));
    $$('#alphaSeg button').forEach((b) => (b.onclick = () => change(() => { gs.alpha = +b.dataset.v; })));
    $$('#epsSeg button').forEach((b) => (b.onclick = () => change(() => { gs.eps = +b.dataset.v; })));
    $('#btnGStep').onclick = () => { if (!gridStepOnce()) toast(vi ? '더 퍼뜨려도 가치가 바뀌지 않아요' : '판을 다 썼어요. ↺ 처음부터 다시 해 보세요'); else audio.sfx.click(); gridRefresh(); };
    $('#btnGRun').onclick = () => { const g2 = play.grid; g2.auto = !g2.auto; g2.acc = 0; renderGridLeft(); };
    $('#btnGReset').onclick = gridReset;
  }
  function gridRefresh() { drawGrid(); const s = $('#gridStats'); if (s) s.innerHTML = gridStatsHtml(); }
  function renderGridRight() {
    const st = play.cfg, box = $('#logicPanel');
    box.innerHTML = `
      <div class="lp-head"><h3>격자 세상</h3><span class="muted">칸의 숫자는 그 칸의 가치(앞으로 받을 점수), 화살표는 가장 좋은 방향, 회색 칸은 벽이에요. 금색 선은 출발(S)에서 화살표만 따라간 길, 흐린 점선은 지난 판에 실제로 걸은 길이에요.</span></div>
      <div class="plot-wrap"><canvas id="gridCanvas" aria-label="격자 세상"></canvas></div>
      <div class="lp-actions"><button class="btn primary" id="btnCheck">✓ 채점하기 <kbd>Space</kbd></button><span class="muted">금색 길이 목표에 닿으면 채점하세요.</span></div>`;
    $('#btnCheck').onclick = checkGrid;
    drawGrid();
  }
  function drawGrid() {
    const cv = $('#gridCanvas');
    if (!cv) return;
    const st = play.cfg, gs = play.grid, g = gs.g;
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const W = cv.clientWidth || 420, cs = Math.floor(Math.min(W / g.W, 64)), H = cs * g.H;
    cv.style.height = H + 'px';
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#1d2128'; c.fillRect(0, 0, W, H);
    const ox = (W - cs * g.W) / 2;
    const cx = (i) => ox + (i % g.W) * cs + cs / 2, cy = (i) => Math.floor(i / g.W) * cs + cs / 2;
    const vals = g.cell.map((ch, i) => (ch === '#' || g.terminal(i) ? 0 : cellVal(st, gs, i)));
    const vmax = Math.max(0.001, ...vals), vmin = Math.min(-0.001, ...vals);
    const font = getComputedStyle(document.body).fontFamily;
    g.cell.forEach((ch, i) => {
      const x = ox + (i % g.W) * cs, y = Math.floor(i / g.W) * cs;
      if (ch === '#') { c.fillStyle = '#3a404b'; c.fillRect(x + 1, y + 1, cs - 2, cs - 2); return; }
      if (g.terminal(i)) {
        const r = st.rewards[ch];
        c.fillStyle = r > 0 ? (r >= 5 ? 'rgba(244,201,93,0.9)' : 'rgba(244,201,93,0.45)') : 'rgba(255,93,115,0.7)';
        c.fillRect(x + 1, y + 1, cs - 2, cs - 2);
        c.fillStyle = '#14161a'; c.font = `800 ${Math.round(cs * 0.3)}px ${font}`; c.textAlign = 'center';
        c.fillText((r > 0 ? '+' : '') + r, x + cs / 2, y + cs / 2 + cs * 0.1);
        return;
      }
      const v = vals[i];
      c.fillStyle = v > 0 ? `rgba(126,224,129,${0.08 + 0.5 * (v / vmax)})` : v < 0 ? `rgba(255,93,115,${0.08 + 0.4 * (v / vmin)})` : 'rgba(255,255,255,0.04)';
      c.fillRect(x + 1, y + 1, cs - 2, cs - 2);
      c.fillStyle = '#ece8e0'; c.font = `600 ${Math.round(cs * 0.2)}px ${font}`; c.textAlign = 'center';
      if (Math.abs(v) > 1e-9) c.fillText(v.toFixed(1), x + cs / 2, y + cs - 6);
      // 가장 좋은 방향
      const q = gridActs(st, gs)(i), m = Math.max(...q);
      if (q.some((a) => Math.abs(a - q[0]) > 1e-9)) {
        const a = q.indexOf(m), [dx, dy] = sim.DIRS[a], L = cs * 0.22, mx = x + cs / 2, my = y + cs * 0.42;
        c.strokeStyle = 'rgba(236,232,224,0.9)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(mx - dx * L, my - dy * L); c.lineTo(mx + dx * L, my + dy * L); c.stroke();
        c.beginPath(); c.moveTo(mx + dx * L, my + dy * L); c.lineTo(mx + dx * L * 0.35 - dy * L * 0.5, my + dy * L * 0.35 + dx * L * 0.5); c.lineTo(mx + dx * L * 0.35 + dy * L * 0.5, my + dy * L * 0.35 - dx * L * 0.5); c.closePath();
        c.fillStyle = 'rgba(236,232,224,0.9)'; c.fill();
      }
      if (ch === 'S') { c.fillStyle = '#8fd3ff'; c.font = `800 ${Math.round(cs * 0.24)}px ${font}`; c.textAlign = 'left'; c.fillText('S', x + 5, y + cs * 0.28); }
    });
    // 지난 판에 걸은 길(흐린 점선)과 지금 배운 길(금색)
    const line = (path, style, width, dash) => { c.strokeStyle = style; c.lineWidth = width; c.setLineDash(dash); c.beginPath(); path.forEach((i, k) => (k ? c.lineTo(cx(i), cy(i)) : c.moveTo(cx(i), cy(i)))); c.stroke(); c.setLineDash([]); };
    if (gs.last && st.mode === 'q') line(gs.last.path, 'rgba(255,255,255,0.28)', 1.5, [3, 4]);
    const p = gridPath(st, gs);
    if (p.path.length > 1) line(p.path, '#f4c95d', 3, []);
  }
  function checkGrid() {
    const st = play.cfg, gs = play.grid;
    gs.auto = false;
    const p = gridPath(st, gs);
    const ok = gridGoalMet(st, gs);
    if (ok) audio.sfx.success(); else audio.sfx.fail();
    renderGridLeft();
    const endCh = gs.g.cell[p.end];
    const short = st.shortest ? sim.gridShortest(st, gs.g, st.target) : null;
    stageResult({ status: ok ? 'success' : 'fail', sweeps: gs.sweeps, episodes: gs.episodes, gamma: gs.gamma }, emptyBrain(), () => `
      <div><div class="k">${st.mode === 'vi' ? '퍼뜨린 횟수' : '해 본 판'}</div><div class="v">${st.mode === 'vi' ? gs.sweeps : gs.episodes}</div></div>
      <div><div class="k">길이</div><div class="v">${p.stuck ? '-' : p.path.length - 1 + '걸음'}</div></div>
      <div><div class="k">할인율 γ</div><div class="v">${gs.gamma}</div></div>`,
    p.stuck ? '아직 출발 칸에서 목표까지 길이 이어지지 않아요. 더 퍼뜨리거나 더 배워 보세요.'
      : endCh !== st.target ? `지금 배운 길은 ${st.rewards[endCh] > 0 ? '+' : ''}${st.rewards[endCh]}점 칸으로 가요. 목표는 +${st.rewards[st.target]}점 칸이에요.`
      : `길이 ${p.path.length - 1}걸음이에요. 가장 짧은 길은 ${short}걸음이에요. 조금 더 배워 보세요.`);
  }

  // ===================================================================
  // 관련 논문 보러 가기: 개념마다 원전·대표 논문 (링크는 새 탭)
  // ===================================================================
  function paperItems(keys) {
    return keys.map((k) => PAPERS[k]).filter(Boolean).map((p) => `<li>
      <a href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${esc(p.title)}<span class="ext" aria-hidden="true"> ↗</span></a>
      <div class="pmeta">${esc(p.who)} · ${p.year}</div><p>${esc(p.note)}</p></li>`).join('');
  }
  // 한 장의 논문을 실험(개념)별로 묶어 보여 준다. 지금 하는 실험의 개념이 맨 위.
  function openPapers(chapterNo, firstConcept) {
    const ch = TRACKS[0].chapters.find((c) => c.no === chapterNo);
    const sts = STAGES.filter((x) => x.chapter === chapterNo);
    if (firstConcept) sts.sort((a, b) => (b.concept === firstConcept) - (a.concept === firstConcept));
    const seen = new Set();
    const groups = sts.map((st) => {
      const keys = (CONCEPT_PAPERS[st.concept] || []).filter((x) => !seen.has(x));
      keys.forEach((x) => seen.add(x));
      if (!keys.length) return '';
      const name = conceptOpen(st.concept) ? CONCEPTS[st.concept].title : st.title;
      return `<section class="paper-group"><h4>${esc(st.code)} · ${esc(name)}${st.concept === firstConcept ? ' <span class="chip c-gold">지금 실험</span>' : ''}</h4><ul class="paper-list">${paperItems(keys)}</ul></section>`;
    }).join('');
    const m = openModal(`<div class="eyebrow">${chapterNo}장 · ${esc(ch ? ch.title : '')}</div><h2>관련 논문 보러 가기</h2>
      <p class="muted">이 장의 개념이 처음 나온 논문과 대표 논문이에요. 제목을 누르면 원문(학술지·arXiv) 페이지가 새 탭으로 열려요. 오래된 학술지 논문은 일부 유료일 수 있어요.</p>
      <div class="paper-groups">${groups}</div>
      <div class="modal-actions"><button class="btn primary" data-a="close" data-autofocus>닫기</button></div>`);
    m.classList.add('modal-wide');
    m.querySelector('[data-a="close"]').onclick = closeModal;
  }

  // ===================================================================
  // 정답 보기
  // ===================================================================
  function confirmAnswer() {
    const st = play.cfg;
    const m = openModal(`<h2>정말 정답을 보시겠습니까?</h2>
      <p class="muted">${st.type === 'vision' ? '필터가 정답 값으로 바뀝니다.' : st.type === 'cluster' ? '중심이 정답 자리로 옮겨집니다.' : st.type === 'descent' ? '최적화 방법과 학습률이 정답 값으로 바뀌고 공이 출발점으로 돌아갑니다.' : st.type === 'grid' ? '설정이 정답 값으로 바뀌고 처음부터 다시 배웁니다.' : st.type === 'reward' ? '점수 규칙과 탐험 정도가 정답 값으로 바뀌고 학습이 처음부터 시작됩니다.' : st.type === 'train' ? '학습이 처음 가중치로 돌아가고 학습률이 추천 값으로 바뀝니다.' : '지금 뇌가 정답 뇌로 바뀝니다. Ctrl+Z로 되돌릴 수 있어요.'} 직접 풀어 볼수록 더 많이 배워요.</p>
      <div class="modal-actions"><button class="btn primary" data-a="no" data-autofocus>아니요</button><button class="btn gold" data-a="yes">예</button></div>`);
    m.querySelector('[data-a="no"]').onclick = closeModal;
    m.querySelector('[data-a="yes"]').onclick = () => { closeModal(); showAnswer(); };
  }
  function showAnswer() {
    const st = play.cfg;
    if (st.type === 'reward') {
      play.rl.rw = Object.assign({}, st.solution.rw);
      play.rl.sigmaIdx = Math.max(0, SIGMAS.indexOf(st.solution.sigma));
      resetLearn(true);
      toast('정답 점수 규칙을 넣었어요. 학습 시작을 눌러 보세요');
      return;
    }
    if (st.type === 'train') {
      play.train.lrIdx = Math.max(0, RATES.indexOf(st.solution.lr));
      resetTrain();
      toast(st.goal && st.goal.type === 'epochsAtLeast'
        ? '정답: 학습률 0.1로 자동 학습 → 잠깐 멈추고 1로 바꿔 이어서 → 다시 멈추고 3으로 바꿔 50번을 채우면 별 3개예요'
        : `정답: 학습률 ${st.solution.lr}로 처음부터 다시 준비했어요. 자동 학습을 눌러 보세요`);
      return;
    }
    if (st.type === 'vision') {
      play.vision = JSON.parse(JSON.stringify(Object.assign(blankDesign(st), st.solution)));
      saveDesign(); renderVisionLeft(); renderVisionRight();
      toast('정답 필터를 넣었어요. 채점해 보세요');
      return;
    }
    if (st.type === 'descent') {
      const sol = st.solution;
      play.desc = newDesc(st, null);
      play.desc.o = { opt: sol.opt, beta: sol.beta != null ? sol.beta : st.betas[st.betas.length - 1], lr: sol.lr };
      renderDescLeft(); renderDescRight();
      toast(`정답: ${OPT_NAME[sol.opt]}${sol.opt === 'momentum' ? ` β ${sol.beta}` : ''}, 학습률 ${sol.lr}. "멈출 때까지"를 누르고 채점해 보세요`);
      return;
    }
    if (st.type === 'grid') {
      const sol = st.solution;
      play.grid = newGrid(st, null);
      if (sol.gamma != null) play.grid.gamma = sol.gamma;
      if (sol.alpha != null) { play.grid.alpha = sol.alpha; play.grid.eps = sol.eps; }
      for (let i = 0; i < (sol.sweeps || 0); i++) gridStepOnce();
      renderGridLeft(); renderGridRight();
      toast(st.mode === 'vi' ? `정답: γ ${play.grid.gamma}로 ${sol.sweeps}번 퍼뜨렸어요. 채점해 보세요` : `정답: α ${sol.alpha}, ε ${sol.eps}. "자동 학습"을 누르고 채점해 보세요`);
      return;
    }
    if (st.type === 'cluster') {
      const sol = st.solution;
      if (st.chooseK) {
        // k별 거리 합을 모두 계산해서 팔꿈치 그래프를 채운 뒤 k = 4로 둔다
        play.km = newKm(st, sol.k);
        for (let k = 1; k <= 6; k++) { play.km.elbow[k] = st.elbow[k]; play.km.kTried.add(k); }
        toast('k별 거리 합을 모두 채웠어요. 팔꿈치는 k = 4예요. "멈출 때까지"를 누르고 채점해 보세요');
      } else {
        play.km = newKm(st);
        if (sol.centers) play.km.centers = sol.centers.map((c) => c.slice());
        toast(sol.centers && !sol.fresh ? '중심을 각 무리의 한가운데로 옮겼어요. 채점해 보세요' : sol.centers ? '시작 자리를 고쳤어요. "멈출 때까지"를 누르고 채점해 보세요' : '"한 걸음"을 세 번(또는 "멈출 때까지") 누르고 채점해 보세요');
      }
      renderKmLeft(); renderKmRight();
      return;
    }
    editor.loadBrain(st.solution);
    toast(st.type === 'logic' || st.type === 'seq' ? '정답 뇌를 불러왔어요. 채점해 보세요' : '정답 뇌를 불러왔어요. 실행해 보세요');
  }

  // ===================================================================
  // 진리표 · 학습 패널
  // ===================================================================
  function renderLogicPanel() {
    const box = $('#logicPanel');
    if (isRlView()) { renderRewardPanel(); return; }
    if (!isTable()) { box.innerHTML = ''; return; }
    if (isVision()) { renderVisionRight(); return; }
    if (isSeq()) { renderSeqPanel(); return; }
    if (isCluster()) { renderKmRight(); return; }
    if (isDescent()) { renderDescRight(); return; }
    if (isGrid()) { renderGridRight(); return; }
    const st = play.cfg;
    const brain = st.type === 'train' ? play.train.brain : editor.getBrain();
    const res = sim.evalLogic(st, brain);
    const okN = res.rows.filter((r) => r.ok).length;
    const ins = st.inputs || ['inA', 'inB'], outs = st.outputs || ['out'];
    const inName = { inA: 'A', inB: 'B', inC: 'C', inD: 'D' }, outName = { out: outs.length > 1 ? '출력 1' : '출력', out2: '출력 2', out3: '출력 3', out4: '출력 4' };
    const many = outs.length > 2 || !!st.latent;
    const codeCell = (r) => (st.latent ? `<td class="c-code">${codeOf(r, brain).map((v) => v.toFixed(2)).join(' · ') || '-'}</td>` : '');
    const codeHead = st.latent ? '<th class="c-code">코드</th>' : '';
    const bar = (y) => `<div class="ybar"><em>${y.toFixed(2)}</em><span class="track"><i style="width:${(Math.max(0, Math.min(1, y)) * 100).toFixed(0)}%"></i><span class="half"></span></span></div>`;
    // 출력이 많으면(오토인코더) 목표를 한 칸에 몰아 쓰고, 출력은 작은 막대 여러 개로 보여 준다
    const head = many
      ? `<th class="c-in">입력 ${ins.map((id) => inName[id]).join('')}</th><th class="c-t">목표</th><th>출력 ${outs.map((_, k) => k + 1).join(' ')}</th>${codeHead}<th></th>`
      : ins.map((id) => `<th class="c-in">${inName[id]}</th>`).join('') +
        outs.map((id) => `<th class="c-t">${outs.length > 1 ? esc(outName[id]) + ' 목표' : '목표'}</th><th>${esc(outName[id])}</th>`).join('') + codeHead + '<th></th>';
    const mini = (r) => `<div class="mbars">${outs.map((id, k) => { const y = r.ys[k], on = y >= 0.5 ? 1 : 0; return `<span class="mb ${on ? 'on' : ''} ${on !== r.row[ins.length + k] ? 'bad' : ''}" title="${esc(outName[id])} ${y.toFixed(2)}"><i style="height:${(Math.max(0, Math.min(1, y)) * 100).toFixed(0)}%"></i><em>${y.toFixed(1)}</em></span>`; }).join('')}</div>`;
    const rows = res.rows.map((r, i) => many ? `
      <tr data-row="${i}" class="${i === play.row ? 'sel' : ''} ${r.ok ? 'ok' : 'bad'}">
        <td class="c-in">${ins.map((_, k) => r.row[k]).join('')}</td>
        <td class="c-t"><b>${outs.map((_, k) => r.row[ins.length + k]).join('')}</b></td>
        <td>${mini(r)}</td>${codeCell(r)}
        <td class="mark">${r.ok ? '✓' : '✗'}</td>
      </tr>` : `
      <tr data-row="${i}" class="${i === play.row ? 'sel' : ''} ${r.ok ? 'ok' : 'bad'}">
        ${ins.map((_, k) => `<td class="c-in">${r.row[k]}</td>`).join('')}
        ${outs.map((_, k) => `<td class="c-t"><b>${r.row[ins.length + k]}</b></td><td>${bar(r.ys[k])}</td>`).join('')}${codeCell(r)}
        <td class="mark">${r.ok ? '✓' : '✗'}</td>
      </tr>`).join('');
    const codeMap = st.latent ? `<div class="code-map"><h4>코드 지도 <span class="muted">입력마다 히든 뉴런(코드) 값으로 찍은 자리 · 잠재 공간</span></h4><canvas id="codeMap" aria-label="코드 지도"></canvas></div>` : '';
    let tail = '';
    if (st.type === 'logic') {
      const unit = st.plot ? '점' : '줄';
      tail = `<div class="lp-actions"><button class="btn primary" id="btnCheck">✓ 채점하기 <kbd>Space</kbd></button>
        <span class="muted">${st.need && st.need.test ? '목표는 시험 데이터예요. 채점하면 시험 데이터로 잽니다.' : okN === st.rows.length ? `모든 ${unit}이 맞았어요. 채점해 보세요!` : `맞은 ${unit} ${okN} / ${st.rows.length}`}</span></div>`;
    } else {
      const t = play.train;
      const lr = RATES[t.lrIdx];
      const loss = t.losses[t.losses.length - 1];
      tail = `
        <div class="train-box">
          <label class="set-row"><span><b>학습률</b> <span class="muted">한 번에 얼마나 고칠까</span></span>
            <span style="display:flex;gap:10px;align-items:center"><input type="range" id="lrRange" min="0" max="${RATES.length - 1}" step="1" value="${t.lrIdx}"><b class="wval" id="lrVal">${lr}</b></span></label>
          <div class="lp-actions">
            <button class="btn" id="btnLearn1">한 번 배우기</button>
            <button class="btn primary" id="btnAuto">${t.auto ? '⏸ 멈추기' : '▶ 자동 학습'} <kbd>Space</kbd></button>
            <div class="seg" id="trainSpeed" title="학습 배속">${LEARN_SPEEDS.map((v, i) => `<button data-i="${i}" class="${i === (t.speedIdx || 0) ? 'on' : ''}">${v}×</button>`).join('')}</div>
            <button class="btn ghost" id="btnTrainReset">↺ 처음 가중치로 <kbd>R</kbd></button>
          </div>
          <div class="stat-grid">
            <div><div class="k">학습 횟수</div><div class="v">${t.epochs}</div></div>
            <div><div class="k">${st.loss === 'ce' ? '오차(교차 엔트로피)' : '오차(평균 제곱)'}</div><div class="v">${loss.toFixed(3)}</div></div>
            <div><div class="k">${st.plot ? '맞은 점' : '맞은 줄'}</div><div class="v">${okN} / ${st.rows.length}</div></div>
            <div><div class="k">써 본 학습률</div><div class="v">${t.rates.size}</div></div>
          </div>
          <div class="chart-wrap"><canvas id="lossChart" aria-label="오차 그래프"></canvas></div>
        </div>`;
    }
    box.innerHTML = st.plot ? `
      <div class="lp-head"><h3>${st.type === 'train' ? '점 그래프 · 배우는 중' : '점 그래프'}</h3><span class="muted">점을 누르면 그 점일 때 뇌가 어떻게 반응하는지 왼쪽에 보여요. ${st.classes ? '출력 뉴런마다 그 색일 확률이고, 가장 큰 확률의 색이 뇌의 답이에요.' : '출력이 0.5 이상이면 파랑(1), 아래면 주황(0).'}</span></div>
      ${plotHtml(st, brain)}
      ${tail}` : `
      <div class="lp-head"><h3>${st.type === 'train' ? '진리표 · 배우는 중' : '진리표'}</h3><span class="muted">줄을 누르면 그 입력일 때 뇌가 어떻게 반응하는지 왼쪽에 보여요. 출력이 0.5 이상이면 1로 읽어요.${st.latent ? ' "코드"는 그 입력일 때 히든 뉴런의 값이에요.' : ''}</span></div>
      <div class="table-scroll"><table class="truth ${many ? 'many' : ''}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
      ${codeMap}
      ${tail}`;
    if (st.latent) drawCodeMap(st, res, brain);
    if (st.plot) {
      drawPlot(st, brain);
      const ct = $('#chkTest');
      if (ct) ct.onchange = () => { play.showTest = ct.checked; if (!play.showTest && play.row >= st.rows.length) play.row = 0; renderLogicPanel(); };
    }
    $$('#logicPanel tr[data-row]').forEach((tr) => (tr.onclick = () => { play.row = +tr.dataset.row; renderLogicPanel(); }));
    const ck = $('#btnCheck');
    if (ck) ck.onclick = checkLogic;
    if (st.type === 'train') {
      $('#lrRange').oninput = (e) => { play.train.lrIdx = +e.target.value; $('#lrVal').textContent = RATES[play.train.lrIdx]; };
      // 자동 학습 중에는 패널이 계속 새로 그려져서 클릭(누름+뗌)이 끊길 수 있다 → 누르는 순간 반응
      $('#btnLearn1').onpointerdown = (e) => { if (e.button === 0) { audio.unlock(); learnOnce(); } };
      $('#btnAuto').onpointerdown = (e) => { if (e.button === 0) { audio.unlock(); toggleAuto(); } };
      $$('#trainSpeed button').forEach((b) => (b.onpointerdown = (e) => { if (e.button === 0) { play.train.speedIdx = +b.dataset.i; renderLogicPanel(); } }));
      $('#btnTrainReset').onclick = resetTrain;
      drawLossChart();
    }
  }
  function checkLogic() {
    const brain = editor.getBrain();
    const st = play.cfg;
    const res = sim.evalLogic(st, brain);
    if (st.plot) { checkPlot(st, brain, res); return; }
    if (res.ok) audio.sfx.success(); else audio.sfx.fail();
    const insN = (play.cfg.inputs || ['inA', 'inB']).map((id) => ({ inA: 'A', inB: 'B', inC: 'C', inD: 'D' })[id]);
    const bad = res.rows.filter((r) => !r.ok).map((r) => insN.map((n, k) => `${n}=${r.row[k]}`).join(', ')).join(' / ');
    stageResult({ status: res.ok ? 'success' : 'fail' }, brain, (isNew) => `
      <div><div class="k">맞은 줄</div><div class="v">${res.rows.filter((r) => r.ok).length}/${res.rows.length}</div></div>
      <div><div class="k">시냅스</div><div class="v">${brain.synapses.length}${isNew.syn ? '<span class="new-badge">NEW</span>' : ''}</div></div>
      <div><div class="k">히든 뉴런 사용</div><div class="v">${sim.usedHidden(brain)}</div></div>`, `틀린 줄: ${bad}`);
  }
  // 점 그래프 채점: 훈련 데이터(와 시험 데이터)의 정확도
  function checkPlot(st, brain, res) {
    const trainN = res.rows.filter((r) => r.ok).length;
    let testAcc = null, testN = 0;
    if (st.test) {
      const t = sim.evalLogic({ rows: st.test, inputs: st.inputs, outputs: st.outputs }, brain);
      testN = t.rows.filter((r) => r.ok).length;
      testAcc = testN / st.test.length;
      play.showTest = true;
      renderLogicPanel();
    }
    const confidence = st.classes ? meanConf(res) : null;
    const ok = st.need && st.need.test ? testAcc >= st.need.test - 1e-9 : res.ok && (!(st.need && st.need.confidence) || confidence >= st.need.confidence - 1e-9);
    if (ok) audio.sfx.success(); else audio.sfx.fail();
    stageResult({ status: ok ? 'success' : 'fail', testAcc, confidence }, brain, (isNew) => `
      <div><div class="k">${st.classes ? '맞은 점' : '훈련 데이터'}</div><div class="v">${trainN}/${st.rows.length}</div></div>
      ${st.classes ? `<div><div class="k">정답 확률 평균</div><div class="v">${Math.round(confidence * 100)}%</div></div>` : ''}
      ${st.test ? `<div><div class="k">시험 데이터</div><div class="v">${testN}/${st.test.length}</div></div>` : ''}
      <div><div class="k">시냅스</div><div class="v">${brain.synapses.length}${isNew.syn ? '<span class="new-badge">NEW</span>' : ''}</div></div>
      <div><div class="k">히든 뉴런 사용</div><div class="v">${sim.usedHidden(brain)}</div></div>`,
    st.test ? `시험 데이터 ${testN}/${st.test.length} (${Math.round(testAcc * 100)}%) — 목표는 ${Math.round(st.need.test * 100)}% 이상이에요. 훈련 데이터의 잘못된 점까지 맞히려다 처음 보는 점을 틀린 건 아닐까요?`
      : res.ok && st.need && st.need.confidence ? `모두 맞혔지만 정답 확률 평균이 ${Math.round(confidence * 100)}%예요. 목표는 ${Math.round(st.need.confidence * 100)}% 이상이에요. 같은 경계에서 가중치를 키워 보세요.` : `틀린 점 ${st.rows.length - trainN}개`);
  }
  function learnOnce() {
    const st = play.cfg, t = play.train;
    if (!t || t.done) return;
    const lr = RATES[t.lrIdx];
    sim.trainEpoch(st, t.brain, lr);
    t.epochs++;
    t.rates.add(lr);
    t.losses.push(sim.lossOf(st, t.brain));
    editor.setBrain(t.brain, true);
    const goalMet = st.goal && st.goal.type === 'epochsAtLeast' ? t.epochs >= st.goal.n : sim.evalLogic(st, t.brain).ok;
    if (goalMet) {
      t.done = true;
      t.auto = false;
      renderLogicPanel();
      audio.sfx.success();
      setTimeout(() => stageResult({ status: 'success', epochs: t.epochs, rates: t.rates.size }, t.brain, () => `
        <div><div class="k">학습 횟수</div><div class="v">${t.epochs}</div></div>
        <div><div class="k">마지막 오차</div><div class="v">${t.losses[t.losses.length - 1].toFixed(3)}</div></div>
        <div><div class="k">써 본 학습률</div><div class="v">${t.rates.size}가지</div></div>`), 350);
      return;
    }
    if (t.epochs >= st.maxEpochs) { t.auto = false; t.done = true; toast(`${st.maxEpochs}번 배워도 못 배웠어요. 학습률을 바꾸고 "처음 가중치로"를 눌러 다시 해 보세요`); }
    renderLogicPanel();
  }
  function toggleAuto() {
    const t = play.train;
    if (!t) return;
    if (t.done) { toast('끝난 학습이에요. "처음 가중치로"를 눌러 다시 해 보세요'); return; }
    t.auto = !t.auto;
    t.acc = 0;
    renderLogicPanel();
  }
  function resetTrain() {
    const st = play.cfg, keep = play.train ? play.train.lrIdx : 2, sp = play.train ? play.train.speedIdx || 0 : 0;
    play.train = { brain: JSON.parse(JSON.stringify(st.init)), epochs: 0, losses: [], rates: new Set(), lrIdx: keep, speedIdx: sp, auto: false, acc: 0, id: st.id, done: false };
    play.train.losses.push(sim.lossOf(st, play.train.brain));
    editor.setBrain(play.train.brain, true);
    renderLogicPanel();
  }
  function tickTable(dt) {
    const dd = play.desc;
    if (isDescent() && dd && dd.auto && !modalOpen()) {
      dd.acc += dt;
      let n = 0;
      while (dd.acc >= 0.07 && dd.auto && n < 4) {
        dd.acc -= 0.07; n++;
        descStepOnce();
        if (dd.done) { dd.auto = false; toast(DONE_TOAST[dd.done]); renderDescLeft(); }
      }
      if (n) descRefresh();
    }
    const gs = play.grid;
    if (isGrid() && gs && gs.auto && !modalOpen()) {
      gs.acc += dt;
      if (gs.acc >= (play.cfg.mode === 'vi' ? 0.3 : 0.12)) {
        gs.acc = 0;
        const stepped = gridStepOnce();
        const met = gridGoalMet(play.cfg, gs);
        if (!stepped || met || (play.cfg.mode === 'vi' && gs.settled)) {
          gs.auto = false;
          toast(met ? (play.cfg.mode === 'vi' ? '길이 목표까지 이어졌어요. 채점해 보세요' : '목표까지 가는 길을 배웠어요. 채점해 보세요') : play.cfg.mode === 'vi' ? '가치가 더 바뀌지 않아요. 지금 길을 보고 채점하거나 설정을 바꿔 보세요' : '판을 다 썼어요. 설정을 바꿔 다시 해 보세요');
          renderGridLeft();
        }
        gridRefresh();
      }
    }
    const km = play.km;
    if (isCluster() && km && km.auto && !modalOpen()) {
      km.acc += dt;
      if (km.acc >= 0.45) {
        km.acc = 0;
        if (!kmStepOnce()) { km.auto = false; toast('중심이 멈췄어요. 채점해 보세요'); }
        renderKmLeft(); renderKmRight();
      }
    }
    const t = play.train;
    if (play.cfg.type === 'train' && t && t.auto && !modalOpen()) {
      t.acc += dt;
      const every = 0.18 / LEARN_SPEEDS[t.speedIdx || 0];
      let n = 0;
      while (t.acc >= every && t.auto && n < 8) { t.acc -= every; learnOnce(); n++; }
      if (t.acc > every) t.acc = every;
    }
  }
  function drawLossChart() {
    drawSeries($('#lossChart'), play.train.losses, play.cfg.loss === 'ce' ? '교차 엔트로피' : '오차', '학습 횟수', '#ff5d73');
  }


  // 플레이 버튼들
  $('#btnRun').onclick = toggleRun;
  $('#btnReset').onclick = () => { audio.unlock(); resetWorld(); };
  $('#btnBack').onclick = () => go(play.mode === 'stage' && play.cfg ? trackOf(play.cfg).route : 'home');
  $('#btnAddHidden').onclick = () => editor.addHidden();
  $('#btnUndo').onclick = () => { editor.undo(); updateBrainCount(); };
  $('#btnRedo').onclick = () => { editor.redo(); updateBrainCount(); };
  $('#btnClear').onclick = () => {
    if (isVision()) { play.vision = blankDesign(play.cfg); saveDesign(); renderVisionLeft(); renderVisionRight(); toast('필터를 모두 0으로 비웠어요'); return; }
    if (!editor.getBrain().synapses.length && !editor.getBrain().hidden.length) return;
    editor.clearAll();
    toast('뇌를 비웠어요. 되돌리려면 Ctrl+Z');
  };
  $$('#speedSeg button').forEach((b) => (b.onclick = () => setSpeed(+b.dataset.speed)));
  function setSpeed(s) {
    play.speed = s;
    $$('#speedSeg button').forEach((x) => x.classList.toggle('on', +x.dataset.speed === s));
  }
  $('#chkSense').checked = S.settings.sense;
  $('#chkTrail').checked = S.settings.trail;
  $('#chkSense').onchange = (e) => { S.settings.sense = e.target.checked; save(); };
  $('#chkTrail').onchange = (e) => { S.settings.trail = e.target.checked; save(); };

  // ===================================================================
  // 대결
  // ===================================================================
  const vs = { a: null, b: 'rival:jelly', arena: 'vs-field', state: 'setup', round: 0, world: null, speed: 2, acc: 0, score: [0, 0], rounds: [], paused: false, view: null, brains: null, between: 0 };

  function vsCandidates(side) {
    const list = [];
    const lab = S.lab.brain || emptyBrain();
    list.push({ key: 'lab', name: '연구실의 뇌', desc: lab.synapses.length ? `지금 연구실에 있는 뇌 · 시냅스 ${lab.synapses.length}` : '연구실의 뇌가 비어 있어요', brain: lab, mine: true });
    S.slots.forEach((s, i) => { if (s) list.push({ key: 'slot' + i, name: s.name, desc: `저장 슬롯 ${i + 1} · 시냅스 ${s.brain.synapses.length}`, brain: s.brain, mine: true }); });
    STAGES.filter((st) => st.type === 'arena').forEach((st) => {
      const p = S.progress[st.id];
      if (p && p.cleared && p.bestBrain) list.push({ key: 'stage:' + st.id, name: `${st.code}의 뇌`, desc: `${st.title}을 깬 뇌 · 시냅스 ${p.bestBrain.synapses.length}`, brain: p.bestBrain, mine: true });
    });
    RIVALS.forEach((r) => list.push({ key: 'rival:' + r.id, name: r.name, desc: `${r.style} · ${r.desc}`, level: r.level, brain: r.brain, rival: r, color: r.color }));
    if (side === 'b' && mirrorUnlocked()) list.push({ key: 'mirror', name: '거울 속의 나', desc: '파랑 뇌의 좌우를 뒤집은 복제. 히든 상대.', level: '???', mirror: true, color: '#e9eefb' });
    return list;
  }
  function vsPick(side) {
    const list = vsCandidates(side);
    const found = list.find((c) => c.key === vs[side]);
    if (found) return found;
    if (side === 'b') return list.find((c) => c.rival);
    // 파랑 기본값: 비어 있지 않은 내 뇌 중 가장 최근 것(연구실 → 슬롯 → 깬 실험 순으로 뒤쪽이 최근)
    const mine = list.filter((c) => c.mine && c.brain && c.brain.synapses.length);
    return mine.length ? (mine[0].key === 'lab' ? mine[0] : mine[mine.length - 1]) : list[0];
  }

  function renderVersus() {
    if (vs.state !== 'setup') { renderVsMatch(); return; }
    const row = (side, c) => `
      <button class="pick ${side === 'b' ? 'orange' : ''} ${vsPick(side).key === c.key ? 'on' : ''}" data-pick="${side}" data-key="${esc(c.key)}">
        <span class="dot" style="background:${c.color || '#e9eefb'}"></span>
        <span><span class="t">${esc(c.name)}</span><br><span class="d">${esc(c.desc)}</span></span>
        <span class="lvl">${c.level ? esc(c.level) : ''}</span>
      </button>`;
    const pickHtml = (side) => {
      const list = vsCandidates(side);
      const mine = list.filter((c) => c.mine), others = list.filter((c) => !c.mine);
      return `<div class="pick-group">라이벌</div>${others.map((c) => row(side, c)).join('')}
        <div class="pick-group">내 뇌</div>${mine.map((c) => row(side, c)).join('')}`;
    };
    const arena = VERSUS_ARENAS.find((a) => a.id === vs.arena);
    const recs = RIVALS.map((r) => { const x = S.versus.records[r.id]; return x ? `<span class="chip">${esc(r.name)} <b>${x.w}승 ${x.l}패 ${x.d}무</b></span>` : ''; }).join('');
    $('#view-versus').innerHTML = `
      <div class="section-head" style="margin-top:6px"><div><div class="eyebrow">대결</div><h2>뇌 대 뇌</h2>
        <p class="muted" style="margin:6px 0 0;max-width:720px">두 생명체가 같은 아레나에서 먹이를 두고 겨룬다. 출발점과 먹이는 점대칭으로 놓여 공평하고, 자리를 바꿔 두 판을 한 뒤 먹은 먹이를 합친다. 수염과 눈만 쓴다(더듬이는 꺼짐).</p></div></div>
      <div class="vs-arena-row panel" style="padding:12px 14px">
        <span class="muted">아레나</span>
        <div class="seg">${VERSUS_ARENAS.map((a) => `<button data-arena="${a.id}" class="${a.id === vs.arena ? 'on' : ''}">${esc(a.title)}</button>`).join('')}</div>
        <span class="muted" style="font-size:13.5px">${esc(arena.desc)} · 한 판 ${arena.timeLimit}초 × 2</span>
        <span style="flex:1"></span>
        <span class="chip"><span class="dot" style="background:#5aa9ff"></span><b>${esc(vsPick('a').name)}</b></span>
        <span class="muted">vs</span>
        <span class="chip"><span class="dot" style="background:#ffb35c"></span><b>${esc(vsPick('b').name)}</b></span>
        <button class="btn primary" id="vsStart">대결 시작</button>
      </div>
      <div class="vs-setup">
        <div class="panel vs-side"><h3><span class="dot" style="background:#5aa9ff"></span>파랑 고르기</h3><div class="pick-list">${pickHtml('a')}</div></div>
        <div class="panel vs-side"><h3><span class="dot" style="background:#ffb35c"></span>주황 고르기</h3><div class="pick-list">${pickHtml('b')}</div></div>
      </div>
      ${recs ? `<div class="sensor-legend"><span class="muted" style="font-size:13px">내 뇌의 전적</span>${recs}</div>` : ''}
      ${!mirrorUnlocked() ? '<p class="muted" style="font-size:13px;margin-top:14px">보스 실험을 깨면 숨은 상대가 하나 나타난다.</p>' : ''}`;
    $$('[data-pick]').forEach((b) => (b.onclick = () => { vs[b.dataset.pick] = b.dataset.key; audio.sfx.click(); renderVersus(); }));
    $$('[data-arena]').forEach((b) => (b.onclick = () => { vs.arena = b.dataset.arena; renderVersus(); }));
    $('#vsStart').onclick = startMatch;
  }

  function startMatch() {
    audio.unlock();
    const A = vsPick('a'), Bp = vsPick('b');
    const brainA = A.brain || emptyBrain();
    const brainB = Bp.mirror ? sim.mirrorBrain(brainA) : Bp.brain || emptyBrain();
    vs.brains = [brainA, brainB];
    vs.names = [A.name, Bp.mirror ? '거울 속의 나' : Bp.name];
    vs.meta = [A, Bp];
    vs.score = [0, 0];
    vs.rounds = [];
    vs.round = 0;
    vs.state = 'playing';
    vs.paused = false;
    vs.between = 0;
    renderVsMatch();
    beginRound();
    audio.sfx.run();
  }
  function arenaCfg() { return VERSUS_ARENAS.find((a) => a.id === vs.arena); }
  function beginRound() {
    const [a, b] = vs.brains;
    vs.world = sim.createWorld(arenaCfg(), vs.round === 0 ? [a, b] : [b, a]);
    vs.acc = 0;
    if (vs.view) vs.view.clearFx();
  }
  // 파랑(A)이 이번 판에서 몇 번 생명체인가
  const sideIndex = (round, side) => (round === 0 ? side : 1 - side);

  function renderVsMatch() {
    $('#view-versus').innerHTML = `
      <div class="scoreboard">
        <div class="score-side"><span class="dot" style="background:#5aa9ff;width:14px;height:14px"></span><div style="flex:1"><div class="name">${esc(vs.names[0])}</div><div class="sub">파랑</div></div><div class="n" id="vsA">0</div></div>
        <div class="score-mid"><span id="vsRound">1라운드</span><b id="vsTime">0.0</b></div>
        <div class="score-side right"><span class="dot" style="background:#ffb35c;width:14px;height:14px"></span><div style="flex:1"><div class="name">${esc(vs.names[1])}</div><div class="sub">주황</div></div><div class="n" id="vsB">0</div></div>
      </div>
      <div class="bar-race"><i id="vsBarA" style="background:#5aa9ff;width:50%"></i><i id="vsBarB" style="background:#ffb35c;width:50%"></i></div>
      <div class="panel">
        <div class="canvas-wrap vs-canvas"><canvas class="arena" id="vsCanvas" width="900" height="600" aria-label="대결 아레나"></canvas></div>
        <div class="controls">
          <button class="btn" id="vsPause">⏸ 일시정지</button>
          <div class="seg" id="vsSpeed">${[1, 2, 4, 8].map((s) => `<button data-s="${s}" class="${s === vs.speed ? 'on' : ''}">${s}×</button>`).join('')}</div>
          <span class="spacer"></span>
          <button class="btn" id="vsSkip">그만 보기 (결과로)</button>
          <button class="btn ghost" id="vsBack">설정으로</button>
        </div>
      </div>`;
    vs.view = SA.arenaView.create($('#vsCanvas'));
    $('#vsPause').onclick = () => { vs.paused = !vs.paused; $('#vsPause').textContent = vs.paused ? '▶ 계속' : '⏸ 일시정지'; };
    $$('#vsSpeed button').forEach((b) => (b.onclick = () => { vs.speed = +b.dataset.s; $$('#vsSpeed button').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#vsSkip').onclick = skipMatch;
    $('#vsBack').onclick = () => { vs.state = 'setup'; renderVersus(); };
  }

  function tickVersus(dt) {
    if (vs.state === 'setup' || !vs.world || !vs.view) return;
    const w = vs.world;
    if (vs.state === 'playing' && !vs.paused && !modalOpen()) {
      if (vs.between > 0) {
        vs.between -= dt;
        if (vs.between <= 0) { vs.round = 1; beginRound(); }
      } else {
        vs.acc += dt * vs.speed;
        let n = 0;
        while (vs.acc >= sim.DT && n < 60 && w.status === 'running') { sim.step(w); vs.acc -= sim.DT; n++; handleEvents(w, vs.view); }
        if (w.status !== 'running') endRound();
      }
    }
    const banner = vs.between > 0 ? '2라운드 · 자리를 바꿉니다' : null;
    vs.view.draw(vs.world, { versus: true, trail: S.settings.trail, sense: S.settings.sense, dt, banner });
    // 점수판
    const cur = vs.between > 0 ? [0, 0] : [vs.world.creatures[sideIndex(vs.round, 0)].eaten, vs.world.creatures[sideIndex(vs.round, 1)].eaten];
    const a = vs.score[0] + cur[0], b = vs.score[1] + cur[1];
    const ea = $('#vsA'), eb = $('#vsB');
    if (!ea) return;
    ea.textContent = a; eb.textContent = b;
    $('#vsRound').textContent = vs.state === 'done' ? '끝' : `${vs.round + 1}라운드`;
    $('#vsTime').textContent = vs.world.t.toFixed(1);
    const tot = a + b || 1;
    $('#vsBarA').style.width = (a + b ? (a / tot) * 100 : 50) + '%';
    $('#vsBarB').style.width = (a + b ? (b / tot) * 100 : 50) + '%';
  }
  function endRound() {
    const w = vs.world;
    const r = [w.creatures[sideIndex(vs.round, 0)].eaten, w.creatures[sideIndex(vs.round, 1)].eaten];
    vs.rounds.push(r);
    vs.score[0] += r[0]; vs.score[1] += r[1];
    if (vs.round === 0) { vs.between = 1.4; return; }
    finishMatch();
  }
  function skipMatch() {
    if (vs.state !== 'playing') return;
    // 남은 판을 화면 없이 끝까지 계산한다(결정론이라 끝까지 본 것과 결과가 같다)
    if (vs.between > 0) { vs.between = 0; vs.round = 1; beginRound(); }
    while (vs.world.status === 'running') { sim.step(vs.world); vs.world.events.length = 0; }
    endRound();
    if (vs.state === 'playing') { vs.between = 0; vs.round = 1; beginRound(); while (vs.world.status === 'running') { sim.step(vs.world); vs.world.events.length = 0; } endRound(); }
  }
  function finishMatch() {
    vs.state = 'done';
    const [a, b] = vs.score;
    const winner = a > b ? 0 : b > a ? 1 : -1;
    S.versus.played++;
    const [A, Bp] = vs.meta;
    let recMsg = '';
    const rec = (rid, res) => { const x = S.versus.records[rid] || { w: 0, l: 0, d: 0 }; x[res]++; S.versus.records[rid] = x; };
    if (A.mine && Bp.rival) { rec(Bp.rival.id, winner === 0 ? 'w' : winner === 1 ? 'l' : 'd'); recMsg = `${Bp.name} 상대 전적에 기록했어요.`; }
    else if (Bp.mine && A.rival) { rec(A.rival.id, winner === 1 ? 'w' : winner === 0 ? 'l' : 'd'); recMsg = `${A.name} 상대 전적에 기록했어요.`; }
    const discovered = unlockConcept('connectome');
    save();
    winner === -1 ? audio.sfx.charged() : audio.sfx.success();
    if (discovered) audio.sfx.discover();
    const mirrorNote = Bp.mirror ? (winner === -1 ? '거울 속의 나와는 비겼다. 좌우가 대칭인 뇌는 거울에 비쳐도 같은 뇌다.' : '거울 속의 나와 승부가 갈렸다. 내 뇌는 좌우가 조금 다르다는 뜻이다. 아레나는 점대칭이라 좌우를 뒤집으면 다른 길로 간다.') : '';
    const m = openModal(`
      <div class="eyebrow">대결 결과 · ${esc(arenaCfg().title)}</div>
      <h2>${winner === -1 ? '무승부' : `${esc(vs.names[winner])} 승리`}</h2>
      <div class="stat-grid">
        <div><div class="k">파랑 · ${esc(vs.names[0])}</div><div class="v">${a}</div></div>
        <div><div class="k">주황 · ${esc(vs.names[1])}</div><div class="v">${b}</div></div>
        <div><div class="k">1라운드</div><div class="v">${vs.rounds[0][0]} : ${vs.rounds[0][1]}</div></div>
        <div><div class="k">2라운드</div><div class="v">${vs.rounds[1][0]} : ${vs.rounds[1][1]}</div></div>
      </div>
      ${mirrorNote ? `<p class="muted">${esc(mirrorNote)}</p>` : ''}
      ${recMsg ? `<p class="muted">${esc(recMsg)}</p>` : ''}
      ${discovered ? `<div class="discover">새 개념 발견 · <b>${esc(CONCEPTS.connectome.title)}</b><div class="muted" style="margin-top:4px">${esc(CONCEPTS.connectome.line)}</div></div>` : ''}
      <div class="modal-actions">
        <button class="btn" data-a="setup">설정 바꾸기</button>
        <button class="btn" data-a="lab">연구실에서 고치기</button>
        <button class="btn primary" data-a="again">한 번 더</button>
      </div>`);
    m.querySelector('[data-a="setup"]').onclick = () => { closeModal(); vs.state = 'setup'; renderVersus(); };
    m.querySelector('[data-a="lab"]').onclick = () => { closeModal(); vs.state = 'setup'; go('lab'); };
    m.querySelector('[data-a="again"]').onclick = () => { closeModal(); startMatch(); };
  }

  // ===================================================================
  // 개념 노트
  // ===================================================================
  function renderNotes() {
    const open = CONCEPT_ORDER.filter(conceptOpen).length;
    const cards = CONCEPT_ORDER.map((k) => {
      const c = CONCEPTS[k];
      const isOpen = conceptOpen(k);
      const st = STAGES.find((s) => s.concept === k);
      const how = st ? `${st.code} · ${st.title}을 깨면 열려요` : '대결을 한 판 하면 열려요';
      return `<article class="panel note-card ${isOpen ? '' : 'locked'}">
        <div class="top">${conceptGlyph(k)}<div><div class="eyebrow">${st ? `${trackOf(st).title} · ${st.code}` : '대결'}</div><h3>${isOpen ? esc(c.title) : '???'}</h3><div class="line">${isOpen ? esc(c.line) : esc(how)}</div></div></div>
        <div class="two">
          <div class="b-brain"><b>뇌에서는</b>${isOpen ? esc(c.brain) : '아직 발견하지 못한 개념입니다. 실험을 깨면 이 자리에 설명이 나타납니다.'}</div>
          <div class="b-ai"><b>AI에서는</b>${isOpen ? esc(c.ai) : '아직 발견하지 못한 개념입니다.'}</div>
        </div>
        ${isOpen && (CONCEPT_PAPERS[k] || []).length ? `<details class="papers"><summary>관련 논문 보러 가기 (${CONCEPT_PAPERS[k].length})</summary><ul class="paper-list">${paperItems(CONCEPT_PAPERS[k])}</ul></details>` : ''}
      </article>`;
    }).join('');
    const terms = GLOSSARY.map((g) => `<div class="term"><div class="term-head"><b>${esc(g.term)}</b><span>${esc(g.en)}</span></div><p>${esc(g.def)}</p></div>`).join('');
    $('#view-notes').innerHTML = `
      <div class="section-head" style="margin-top:6px"><div><div class="eyebrow">개념 노트</div><h2>기본 용어</h2>
      <p class="muted" style="margin:6px 0 0;max-width:760px">실험을 하다 모르는 말이 나오면 여기서 찾아보세요. 언제나 열려 있습니다.</p></div></div>
      <div class="glossary">${terms}</div>
      <div class="section-head"><div><h2>발견한 개념 ${open} / ${CONCEPT_ORDER.length}</h2>
      <p class="muted" style="margin:6px 0 0;max-width:760px">실험을 깨면 한 장씩 열립니다. 직접 만든 회로가 실제 뇌에서는 무엇이고, 인공지능에서는 무엇인지 양쪽에서 비춰 봅니다.</p></div></div>
      <div class="notes-grid">${cards}</div>`;
  }

  // ===================================================================
  // 설정
  // ===================================================================
  function applyAudioSettings() {
    const s = S.settings;
    audio.setVolumes({ master: s.master, bgm: s.bgm, sfx: s.sfx, bgmOn: s.bgmOn, spikes: s.spikes });
  }
  function openSettings() {
    const s = S.settings;
    const m = openModal(`
      <h2>설정</h2>
      <div class="settings-grid">
        <fieldset><legend>소리</legend>
          <label class="set-row"><span>전체 음량</span><input type="range" min="0" max="1" step="0.05" data-set="master" value="${s.master}"></label>
          <label class="set-row"><span>배경음</span><input type="range" min="0" max="1" step="0.05" data-set="bgm" value="${s.bgm}"></label>
          <label class="set-row"><span>효과음</span><input type="range" min="0" max="1" step="0.05" data-set="sfx" value="${s.sfx}"></label>
          <label class="set-row"><span>배경음 켜기</span><input type="checkbox" data-set="bgmOn" ${s.bgmOn ? 'checked' : ''}></label>
          <label class="set-row"><span>바퀴 뉴런 발화음 (틱틱)</span><input type="checkbox" data-set="spikes" ${s.spikes ? 'checked' : ''}></label>
        </fieldset>
        <fieldset><legend>화면</legend>
          <label class="set-row"><span>감각 범위 보기</span><input type="checkbox" data-set="sense" ${s.sense ? 'checked' : ''}></label>
          <label class="set-row"><span>지나간 길 보기</span><input type="checkbox" data-set="trail" ${s.trail ? 'checked' : ''}></label>
        </fieldset>
        <fieldset><legend>단축키</legend>
          <div class="keys">
            <span><kbd>Space</kbd></span><span>실행 / 일시정지</span>
            <span><kbd>R</kbd></span><span>처음으로</span>
            <span><kbd>1</kbd> ~ <kbd>4</kbd></span><span>배속 1× 2× 4× 8×</span>
            <span><kbd>H</kbd></span><span>히든 뉴런 추가</span>
            <span><kbd>Delete</kbd></span><span>고른 선·히든 뉴런 지우기</span>
            <span><kbd>-</kbd></span><span>고른 선의 부호 바꾸기</span>
            <span><kbd>Ctrl+Z</kbd></span><span>되돌리기 (<kbd>Ctrl+Y</kbd> 다시 하기)</span>
            <span><kbd>Esc</kbd></span><span>창 닫기 · 선택 풀기</span>
          </div>
        </fieldset>
        <fieldset><legend>개발</legend>
          <label class="set-row"><span>개발자 모드 (모든 실험·개념·숨은 상대 열기)</span><input type="checkbox" data-set="dev" ${s.dev ? 'checked' : ''}></label>
          <div class="set-row"><span>기능 안내(튜토리얼) 다시 보기</span><button class="btn sm" id="replayTour">다시 보기</button></div>
          <div class="set-row"><span class="muted">별·기록·저장한 뇌를 모두 지웁니다.</span><button class="btn sm danger" id="resetAll">기록 초기화</button></div>
        </fieldset>
      </div>
      <div class="modal-actions"><button class="btn primary" data-close data-autofocus>닫기</button></div>`, () => {
      // 개발자 모드 등이 바뀌었을 수 있으니 목록 화면만 다시 그린다(진행 중인 실험·대결은 건드리지 않는다)
      if (view === 'home' || view === 'notes') route();
      else if (view === 'versus' && vs.state === 'setup') renderVersus();
    });
    $$('[data-set]', m).forEach((el) => {
      el.addEventListener('input', () => {
        const k = el.dataset.set;
        S.settings[k] = el.type === 'checkbox' ? el.checked : +el.value;
        save();
        applyAudioSettings();
        if (k === 'sense') $('#chkSense').checked = S.settings.sense;
        if (k === 'trail') $('#chkTrail').checked = S.settings.trail;
        if (el.type === 'range') audio.sfx.click();
      });
    });
    m.querySelector('[data-close]').onclick = closeModal;
    $('#replayTour').onclick = () => { S.tours = {}; save(); closeModal(); go('stage/tut'); };
    $('#resetAll').onclick = () => {
      const b = $('#resetAll');
      if (b.dataset.armed) {
        const keep = S.settings;
        S = JSON.parse(JSON.stringify(DEFAULTS));
        S.settings = Object.assign({}, keep, { dev: false });
        save();
        closeModal();
        toast('기록을 모두 지웠어요');
        go('home');
      } else { b.dataset.armed = '1'; b.textContent = '정말 지울까요? 한 번 더 누르기'; }
    };
  }
  $('#btnSettings').onclick = () => { audio.unlock(); openSettings(); };
  // 화이트 / 블랙 모드
  const SUN = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>';
  const MOON = '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>';
  function applyTheme() {
    const dark = S.settings.theme === 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark'; else delete document.documentElement.dataset.theme;
    // 지금 모드의 반대(누르면 바뀔 모드)를 보여 준다
    $('#btnTheme svg').innerHTML = dark ? SUN : MOON;
    $('#themeLabel').textContent = dark ? '화이트' : '블랙';
    if (view === 'home') hero.attach($('#heroCanvas'));
  }
  $('#btnTheme').onclick = () => { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); };
  applyTheme();

  // ===================================================================
  // 키보드
  // ===================================================================
  document.addEventListener('keydown', (e) => {
    audio.unlock();
    if (e.key === 'Escape' && tour.active()) { tour.stop(true); return; }
    if (e.key === 'Escape') { if (modalOpen()) closeModal(); else if (view === 'play') editor.selectNone(); return; }
    if (modalOpen()) return;
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (view !== 'play') return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? editor.redo() : editor.undo(); updateBrainCount(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); editor.redo(); updateBrainCount(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.code === 'Space') {
      e.preventDefault();
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
      toggleRun();
    }
    else if (k === 'r') { if (isType('train')) resetTrain(); else if (isCluster()) kmReset(); else if (isDescent()) descReset(); else if (isGrid()) gridReset(); else resetWorld(); }
    else if (k === 'h') editor.addHidden();
    else if (k === 'delete' || k === 'backspace') { e.preventDefault(); editor.deleteSelection(); }
    else if (k === '-') editor.flipSign();
    else if (['1', '2', '3', '4'].includes(k)) setSpeed([1, 2, 4, 8][+k - 1]);
  });

  // ===================================================================
  // 기능 안내(투어): 화면의 한 곳을 비추고 설명한다. wait가 있는 단계는 직접 해야 넘어간다.
  // ===================================================================
  const tour = (() => {
    let steps = null, idx = 0, name = '';
    const q = (sel) => () => document.querySelector(sel);
    const neuron = (id) => () => editor.neuronRect(id);
    const synOf = (from, to) => editor.getBrain().synapses.find((s) => s.from === from && s.to === to);
    const SCRIPTS = {
      basic: [
        { title: '환영해요', text: '시냅스 아레나는 뉴런을 직접 이어 가며 AI를 기초부터 배우는 곳이에요. 이 튜토리얼에서 모든 조작을 하나씩 해 볼게요. 언제든 Esc로 건너뛸 수 있어요.' },
        { target: q('#brainCanvas'), title: '뇌 편집기', text: '여기가 뇌를 만드는 곳이에요. 동그라미 하나가 뉴런, 뉴런을 잇는 선이 시냅스예요. 신호는 왼쪽에서 오른쪽으로 흘러요.' },
        { target: neuron('inA'), title: '입력 뉴런', text: '입력 A예요. 진리표의 A 값(0 또는 1)이 여기로 들어와요. 아래쪽 입력 B도 똑같아요.' },
        { target: neuron('bias'), title: '상시 뉴런', text: '언제나 1인 뉴런이에요. 여기에 붙은 선의 세기가 "편향"이 되어, 켜지기 위한 문턱을 올리거나 내려요.' },
        { target: neuron('h1'), title: '히든 뉴런', text: '입력과 출력 사이에서 중간 계산을 하는 뉴런이에요. 실험마다 처음부터 2개가 있고, 끌어서 옮길 수 있어요. 쓰고 싶을 때 선만 이으면 돼요.' },
        { target: neuron('out'), title: '출력 뉴런', text: '뇌의 답이에요. 값이 0.5 이상이면 1, 아래면 0으로 읽어요.' },
        { target: q('#brainCanvas'), title: '직접 해 보기: 잇기', text: '입력 A 동그라미(또는 오른쪽 작은 점)를 누른 채로 끌어서, 오른쪽 "출력" 위에서 놓아 보세요.', wait: () => !!synOf('inA', 'out') },
        { target: q('#brainCanvas'), title: '직접 해 보기: 선 고르기', text: '선(시냅스)이 생겼어요! 파란 선은 흥분(+), 빨간 선은 억제(-)예요. 방금 생긴 선이나 선 위의 숫자를 클릭해 골라 보세요.', wait: () => { const d = editor.selection; return !!d && d.type === 'syn'; } },
        { target: q('#inspector'), title: '직접 해 보기: 세기 바꾸기', text: '아래 막대를 왼쪽으로 끌어 세기를 0.3까지 내려 보세요. 선 위에서 마우스 휠을 굴려도 0.1씩 바뀌어요. "부호 바꾸기"는 흥분 ↔ 억제를 바꿔요.', wait: () => { const s = synOf('inA', 'out'); return !!s && s.w <= 0.4; } },
        { target: q('#logicPanel .truth'), title: '직접 해 보기: 진리표', text: '세기가 0.3이면 A가 1이어도 출력이 0.3이라 0.5를 못 넘어서 ✗가 됐어요. "목표"는 그 줄의 정답, "출력"은 지금 뇌의 답이에요. 세 번째 줄(A=1, B=0)을 눌러 보세요.', wait: () => play.row === 2 },
        { target: q('#brainCanvas'), title: '그 입력일 때의 뇌', text: '이제 뇌 편집기가 A=1, B=0일 때를 보여 줘요. 동그라미 안의 숫자는 그 뉴런의 지금 값, 선 위를 흐르는 점은 신호예요.' },
        { target: q('#inspector'), title: '직접 해 보기: 다시 올리기', text: '선을 골라 세기를 0.5 이상(예: 1)으로 올려서 진리표의 모든 줄을 ✓로 만들어 보세요.', wait: () => sim.evalLogic(play.cfg, editor.getBrain()).ok },
        { target: q('#view-play .panel-title .tools'), title: '되돌리기와 지우기', text: '↶ 되돌리기(Ctrl+Z), ↷ 다시 하기(Ctrl+Y), 비우기. 선 하나를 지우려면 선을 우클릭하거나, 골라서 Delete를 누르세요.' },
        { target: neuron('h1'), title: '활성화 함수', text: '히든·출력 뉴런을 클릭하면 아래에 설명과 "활성화 함수"가 나와요. 3장 생명체 길찾기부터는 ReLU, 시그모이드, 계단 같은 함수를, 연구실에서는 AND·OR·NOT·XOR 게이트와 소프트맥스까지 직접 넣을 수 있어요.' },
        { target: q('#brief'), title: '힌트와 정답', text: '막히면 "힌트 보기"를 누르세요. 힌트는 개념 → 값 조절 → 거의 답, 세 단계예요. 다 보면 "정답 보기"가 나와요.' },
        { target: q('#view-play .play-head .goal'), title: '목표와 별', text: '노란 칩이 이 실험의 목표, 옆의 칩들은 별 조건이에요. 목표를 채우면 별 1개, 조건까지 채우면 별이 더 생겨요.' },
        { target: q('.stage-nav'), title: '이전 · 다음', text: '실험 사이를 오가는 버튼이에요. 다음 실험은 지금 실험을 깨야 열려요.' },
        { target: q('.nav'), title: '메뉴', text: 'AI 배우기: 모든 실험 목록(분류 태그로 AI 개념/사고력만 골라 볼 수 있어요) · 연구실: 직접 잇거나 강화학습으로 뇌 만들기 · 대결: 만든 뇌끼리 겨루기 · 개념 노트: 기본 용어와 개념 카드.' },
        { target: q('#btnSettings'), title: '설정', text: '소리 크기, 단축키 목록, 이 안내 다시 보기가 있어요.' },
        { target: q('#btnCheck'), title: '마지막: 채점하기', text: '"채점하기"(또는 Space)를 눌러 튜토리얼을 마치세요!', wait: () => modalOpen() },
      ],
      arena: [
        { target: q('#arenaCanvas'), title: '아레나', text: '생명체 길찾기 장부터는 뇌가 몸을 움직여요. 흰 동그라미가 생명체 "도트", 노란 점이 먹이예요. 주황·노랑 부채꼴은 왼눈·오른눈의 시야예요.' },
        { target: q('#brainCanvas'), title: '감각과 바퀴', text: '왼쪽은 감각 뉴런(눈·더듬이·수염·상시), 오른쪽은 왼바퀴·오른바퀴예요. 오른바퀴가 더 빠르면 왼쪽으로 돌아요.' },
        { target: q('#btnRun'), title: '실행', text: '실행(Space)을 누르면 그다음부터는 뇌가 혼자 판단해요. 실행 중에 뇌를 고치면 처음부터 다시 준비돼요.' },
        { target: q('#btnReset'), title: '처음으로', text: '생명체를 출발점으로 되돌려요(R).' },
        { target: q('#speedSeg'), title: '배속', text: '1×~8×로 빨리 볼 수 있어요(키보드 1~4).' },
        { target: () => { const e = $('#chkSense'); return e && e.closest('.controls'); }, title: '감각 범위 · 지나간 길', text: '"감각 범위"를 켜면 더듬이가 닿는 거리와 눈 값이 숫자로 보이고, "지나간 길"은 생명체가 다닌 자국을 남겨요.' },
        { target: q('#hud'), title: '시간과 목표', text: '지난 시간, 남은 목표가 여기 표시돼요.' },
        { target: neuron('h1'), title: '활성화 함수 고르기', text: '이제 히든·바퀴 뉴런을 클릭하면 ReLU, 선형, 계단, 시그모이드, tanh 중에서 함수를 고를 수 있어요.' },
      ],
      reward: [
        { title: '강화학습이란?', text: '지금까지는 사람이 뉴런을 잇거나(1~3장), 정답 표를 보고 배웠어요(4장). 강화학습은 정답이 없어요. 행동해 보고, 그 결과로 받은 "점수(보상)"가 커지는 쪽으로 스스로 바뀌어요. 개를 훈련할 때 잘하면 간식을 주는 것과 같아요.' },
        { target: q('#arenaCanvas'), title: '에이전트와 환경', text: '맨 위 큰 화면이에요. 생명체 "도트"가 배우는 쪽(에이전트), 아레나가 세상(환경)이에요. 지금은 아무것도 배우지 않은 뇌라서 가만히 있어요. 학습하는 동안 여기서 그때까지 찾은 가장 좋은 뇌가 움직여요. 마우스 휠로 내리면 점수 규칙과 뇌가 나와요.' },
        { target: q('#brainCanvas'), title: '정책 = 뇌', text: '맨 아래에 있는 뇌예요. 이번에는 선을 직접 잇지 않아요. 감각 → 바퀴 선이 모두 있고, 가중치(숫자)는 학습이 정해요. 이 가중치들이 "어떤 상황에서 어떻게 움직일까"라는 규칙, 곧 정책이에요.' },
        { target: q('#rewardRules'), title: '당신이 할 일: 점수 정하기', text: '무엇에 몇 점을 줄지 정하세요. 좋은 일에는 +, 피해야 할 일에는 -. 생명체는 우리가 원한 것이 아니라 "점수를 준 것"을 배워요. 이것이 보상 설계예요.' },
        { target: q('#sigRow'), title: '탐험 정도', text: '한 세대마다 뇌를 얼마나 크게 바꿔 볼지예요. 너무 작으면 새로운 행동을 못 찾고, 너무 크면 좋았던 것까지 망가져요.' },
        { target: q('#btnLearn'), title: '학습 시작', text: '한 세대마다 지금 뇌를 조금씩 바꾼 후보 6개를 시험해 보고, 점수를 더 많이 받은 후보가 있으면 그것을 남겨요(시행착오). 이걸 되풀이하면 뇌가 점점 바뀌어요. 학습 중에 다시 누르면 멈춰요.' },
        { target: q('#learnSpeed'), title: '학습 배속', text: '1×는 0.3초에 1세대씩 배워요. 2×·4×·8×로 올리면 더 빨리 배워요(컴퓨터가 느리면 화면이 잠깐씩 멈칫할 수 있어요).' },
        { target: q('#rewardChart'), title: '점수 그래프', text: '세대마다 받은 최고 점수예요. 선이 올라가면 점수를 더 잘 받게 됐다는 뜻이에요. 하지만 점수가 오른다고 진짜 목표를 이룬 건 아닐 수 있어요.' },
        { target: q('#rlStatus'), title: '진짜 목표로 시험', text: '세대마다 지금 뇌로 진짜 목표(먹이 몇 개 등)를 시험해요. 목표를 이루면 실험 성공이에요. 정해진 세대 안에 못 이루면 점수 규칙을 다시 생각해 보세요.' },
        { target: q('#rewardRules'), title: '직접 해 보기', text: '"먹이를 먹으면"에 +5를 주고, 학습 시작(또는 Space)을 눌러 보세요.', wait: () => play.rl && (play.rl.rw.eat || 0) > 0 && (play.rl.running || play.rl.state.gen > 0) },
        { target: q('#arenaCanvas'), title: '지켜보기', text: '휠을 올려 위의 큰 화면을 보세요. 생명체가 점점 먹이 쪽으로 가는 법을 찾아가요. 더 좋은 뇌를 찾을 때마다 처음부터 다시 움직여요. 목표를 이루면 결과 창이 떠요.' },
      ],

      plot: [
        { target: q('#plotCanvas'), title: '점 그래프', text: '가로가 x 좌표, 세로가 y 좌표예요. 점의 색이 정답이에요(주황 = 0, 파랑 = 1). 뇌는 점의 위치(x, y)만 보고 색을 맞혀야 해요.' },
        { target: q('#plotCanvas'), title: '배경 = 뇌의 답', text: '배경은 평면의 모든 자리에서 뇌에게 물어본 답이에요. 파랑 배경은 "파랑이라고 답하는 곳", 주황 배경은 "주황이라고 답하는 곳". 두 색이 만나는 흰 선이 결정 경계예요.' },
        { target: neuron('inX'), title: 'x 좌표·y 좌표 뉴런', text: '점의 위치가 이 두 입력 뉴런으로 들어와요. 0(왼쪽·아래) ~ 1(오른쪽·위).' },
        { target: q('#plotCanvas'), title: '점 고르기', text: '점을 누르면 그 점일 때의 뇌 값이 왼쪽 뇌 편집기에 보여요. 틀린 점은 빨간 테두리로 표시돼요.' },
        { target: q('#plotAcc'), title: '정확도', text: '맞힌 점의 개수예요. 시험 데이터가 있는 실험에서는 채점할 때 처음 보는 점(네모)으로도 잽니다.' },
        { target: q('#brainCanvas'), title: '직접 해 보기', text: 'x 좌표 뉴런을 끌어서 출력에 이어 보세요. 배경 색과 경계가 바로 바뀌어요.', wait: () => editor.getBrain().synapses.some((x) => x.from === 'inX' && x.to === 'out') },
        { target: q('#plotCanvas'), title: '경계 움직이기', text: '선의 세기를 바꾸면 경계가 가팔라지거나 완만해지고, 상시(편향) 선을 이으면 경계가 옆으로 움직여요. 모든 점이 맞으면 채점하세요(Space).' },
      ],
      vision: [
        { title: '그림을 보는 AI', text: '사진 속 고양이를 알아보는 AI(CNN)는 그림 전체를 한 번에 보지 않아요. 작은 "필터"를 그림 위에서 한 칸씩 옮기며, 겹친 칸들로 같은 계산을 되풀이해요. 이 장에서는 그 필터를 직접 칠해 봐요.' },
        { target: q('#logicPanel .vimg'), title: '그림', text: '6×6 칸짜리 그림이에요. 밝은 칸이 1, 어두운 칸이 0이에요.' },
        { target: q('#visionLeft .fgrid'), title: '필터', text: '3×3 필터예요. 칸을 누르면 0 → +1 → -1 순서로 바뀌고, 휠로 0.5씩, 우클릭은 0이에요. 필터를 그림의 3×3 자리에 겹쳐서 (그림 칸 × 필터 칸)을 모두 더해요.' },
        { target: q('#visionLeft .fbias'), title: '편향', text: '더한 값에 마지막으로 더하는 수예요. 음수로 하면 "많이 겹칠 때만" 켜지게 할 수 있어요.' },
        { target: q('#logicPanel .vmap'), title: '특징 맵', text: '필터를 그림의 4×4 자리에 차례로 겹쳐 계산한 결과예요. 0.5 이상이면 밝게(켜짐). 금색 테두리 칸이 켜져야 할 칸이에요. 모든 그림에서 켜진 칸이 금색 테두리와 같으면 성공!' },
        { target: q('#visionLeft .fgrid'), title: '직접 해 보기', text: '필터 가운데 칸을 눌러 +1로 만들어 보세요. 특징 맵이 바로 바뀌어요.', wait: () => play.vision && play.vision.filters[0].w[4] !== 0 },
        { target: q('#btnCheck'), title: '채점하기', text: '목표와 같아지면 채점하기(Space)를 누르세요. 막히면 힌트를 보세요.' },
      ],
      seq: [
        { title: '시간이 흐르는 뇌', text: '이번 장에서는 입력이 한 번에 하나씩, 시간 순서대로 들어와요. 뇌는 칸마다 한 번씩 계산하고, 칸마다 답을 내요.' },
        { target: q('#logicPanel .seq'), title: '시간표', text: '한 줄이 한 순서예요. 왼쪽 칸부터 1, 2, 3… 차례로 입력이 들어와요. "목표"는 그 칸의 정답, "출력"은 뇌의 답이에요. 틀린 칸은 빨갛게 보여요.' },
        { target: neuron('mem1'), title: '기억 뉴런', text: '기억 1에는 히든 1이 바로 전 칸에 낸 값이 들어와요. 점선 화살표가 그 되먹임이에요. 줄의 첫 칸에서는 아직 기억이 없어서 0이에요.' },
        { target: q('#logicPanel .seq-cell'), title: '칸 고르기', text: '칸을 누르면 그 순간의 뇌 값이 왼쪽 뇌 편집기에 보여요.' },
        { target: q('#brainCanvas'), title: '직접 해 보기', text: '입력 A를 끌어서 히든 1에 이어 보세요.', wait: () => !!synOf('inA', 'h1') },
        { target: q('#logicPanel .seq'), title: '기억이 생겼어요', text: '기억 1 줄에 바로 전 칸의 입력이 한 칸씩 밀려 나타나요. 이제 기억 1을 출력에 이어서 모든 칸이 맞으면 채점하세요(Space).' },
      ],
      cluster: [
        { title: '정답 없이 묶기', text: '이번 장의 점에는 정답 색이 없어요. 뇌가 스스로 비슷한 점끼리 묶게 해요. 이것을 비지도 학습이라고 해요.' },
        { target: q('#kmCanvas'), title: '중심', text: '큰 동그라미(×)가 중심이에요. 각 점은 가장 가까운 중심의 색을 받아요. 가는 선은 점이 어느 중심에 묶였는지 보여 줘요.' },
        { target: q('#kmStats'), title: '거리 합', text: '모든 점과 자기 중심 사이 거리(제곱)를 더한 값이에요. 작을수록 잘 묶인 거예요. AI가 줄이려는 "비용"이에요.' },
        { target: q('#kmCanvas'), title: '직접 해 보기', text: '중심 하나를 끌어서 다른 무리로 옮겨 보세요. 점의 색과 거리 합이 바로 바뀌어요.', wait: () => !!(play.km && play.km.moved) },
        { target: q('#btnCheck'), title: '채점하기', text: '눈에 보이는 두 무리가 서로 다른 색이 되면 채점하세요(Space). 다음 실험부터는 "한 걸음" 버튼으로 컴퓨터가 중심을 옮겨요.' },
      ],
      code: [
        { title: '압축하는 뇌', text: '이번 장의 뇌는 입력을 그대로 다시 그려 내요. 단, 가운데 작은 히든 뉴런(코드)을 꼭 거쳐야 해요.' },
        { target: neuron('h1'), title: '코드 뉴런', text: '입력은 출력에 바로 이을 수 없어요. 모든 정보가 이 히든 뉴런을 지나가야 해요. 입력 → 코드를 인코더, 코드 → 출력을 디코더라고 해요.' },
        { target: q('#logicPanel .truth'), title: '진리표와 코드', text: '"코드" 칸은 그 입력일 때 히든 뉴런의 값이에요. 입력마다 코드가 달라야 디코더가 둘을 구별할 수 있어요.' },
        { target: q('#codeMap'), title: '코드 지도', text: '입력마다 코드 값을 점으로 찍은 지도예요(잠재 공간). 서로 다른 입력이 서로 떨어진 자리에 있어야 잘 압축된 거예요.' },
        { target: q('#brainCanvas'), title: '직접 해 보기', text: '입력 A를 끌어서 히든 1에 이어 보세요. 코드 지도에서 A와 B가 갈라져요.', wait: () => !!synOf('inA', 'h1') },
        { target: q('#btnCheck'), title: '채점하기', text: '이제 히든 1에서 출력 1, 2로 가는 디코더를 만들어 모든 줄이 맞으면 채점하세요(Space).' },
      ],
      descent: [
        { title: '오차 지형', text: '가중치 두 개를 가로·세로로 놓고, 모든 자리의 오차를 색으로 칠한 지도예요. 어두운 곳일수록 오차가 작아요. 학습은 이 지형에서 낮은 곳을 찾아 내려가는 일이에요.' },
        { target: q('#descCanvas'), title: '공과 바닥', text: '흰 공이 지금 가중치예요. 금색 원이 가장 낮은 바닥이에요. 공이 금색 원 안에 들어가 거의 멈추면 성공이에요.' },
        { target: q('#lrSeg'), title: '학습률', text: '한 걸음의 크기예요. 너무 작으면 바닥까지 오래 걸리고, 너무 크면 골짜기 건너편으로 튀어 나가요.' },
        { target: q('#btnDStep'), title: '직접 해 보기', text: '"한 걸음"을 눌러 공을 한 번 굴려 보세요. 공은 지금 자리에서 가장 가파르게 내려가는 쪽으로 가요.', wait: () => !!(play.desc && play.desc.s.t > 0) },
        { target: q('#fitCanvas'), title: '지형의 한 점 = 직선 하나', text: '공이 움직이면 뉴런이 긋는 직선도 바뀌어요. 바닥에 가까울수록 선이 노란 점 네 개를 잘 지나요.' },
        { target: q('#btnCheck'), title: '채점하기', text: '학습률을 골라 "멈출 때까지"를 누르고, 공이 바닥에 멈추면 채점하세요(Space).' },
      ],
      grid: [
        { title: '격자 세상', text: '생명체가 칸을 한 칸씩 움직이는 세상이에요. 노란 칸에 들어가면 보상을 받고 끝나요. 이번에는 칸마다 "여기 있으면 앞으로 받을 점수", 곧 가치를 적어요.' },
        { target: q('#gridCanvas'), title: '가치와 화살표', text: '칸의 숫자가 가치, 화살표가 가장 좋은 방향이에요. 처음에는 아무것도 몰라서 모두 비어 있어요.' },
        { target: q('#btnGStep'), title: '직접 해 보기', text: '"한 번 퍼뜨리기"를 눌러 보세요. 목표 바로 옆 칸부터 가치가 생겨요.', wait: () => !!(play.grid && (play.grid.sweeps > 0 || play.grid.episodes > 0)) },
        { target: q('#gridCanvas'), title: '한 칸씩 번지는 가치', text: '누를 때마다 가치가 한 칸씩 더 멀리 번져요. 멀어질수록 할인율 γ만큼 작아져요. 출발(S)까지 닿으면 금색 길이 이어져요.' },
        { target: q('#btnCheck'), title: '채점하기', text: '금색 길이 목표까지 이어지면 채점하세요(Space).' },
      ],
      classes: [
        { title: '여러 갈래 분류', text: '이번에는 점의 색이 셋이에요. 출력 뉴런도 셋이고, 각 출력은 "그 색일 확률"이에요.' },
        { target: neuron('out'), title: '소프트맥스 출력', text: '세 출력은 소프트맥스로 묶여 있어서 합이 언제나 1이에요. 가장 큰 출력의 색이 뇌의 답이에요.' },
        { target: q('#plotCanvas'), title: '배경 = 가장 큰 확률', text: '배경은 그 자리에서 가장 큰 출력의 색이에요. 진할수록 확신이 커요. 경계선에서는 두 색의 확률이 같아요.' },
        { target: q('#brainCanvas'), title: '직접 해 보기', text: 'x 좌표를 끌어서 출력 3에 이어 보세요. 오른쪽이 초록으로 물들어요.', wait: () => editor.getBrain().synapses.some((x) => x.from === 'inX' && x.to === 'out3') },
        { target: q('#plotAcc'), title: '맞은 점과 확률', text: '맞은 점 수와 정답 색의 확률 평균이 나와요. 모든 점이 맞으면 채점하세요(Space).' },
      ],
      gate: [
        { title: '문(게이트)', text: '이번 장의 입력은 두 갈래예요. 하나는 값, 하나는 문(0 = 닫힘, 1 = 열림)이에요. 출력은 값 그대로를 맞혀야 해요.' },
        { target: q('#logicPanel .seq'), title: '시간표', text: '값과 문이 칸마다 함께 들어와요. 목표 줄은 문이 열린 칸에서만 값이 나오고, 닫힌 칸에서는 0이에요.' },
        { target: neuron('out'), title: '곱(×) 함수', text: '출력 뉴런을 눌러 아래에서 활성화 함수를 "곱(×)"으로 바꿔 보세요. 곱 뉴런은 들어온 신호를 모두 곱해요.', wait: () => { const b = editor.getBrain(); return !!(b.fn && b.fn.out === 'mul'); } },
        { target: q('#brainCanvas'), title: '문 만들기', text: '이제 값 A와 문 B를 둘 다 출력에 이으면, 문이 0일 때 곱이 0이 되어 값이 막혀요. 모든 칸이 맞으면 채점하세요(Space).' },
      ],
      train: [
        { target: q('#logicPanel .truth'), title: '배우는 진리표', text: '학습 실험에서는 가중치를 직접 고치지 않아요. 뉴런이 이 진리표를 보면서 스스로 고쳐요.' },
        { target: () => { const e = $('#lrRange'); return e && e.closest('.set-row'); }, title: '학습률', text: '한 번 배울 때 가중치를 얼마나 크게 고칠지 정해요. 너무 작으면 느리고, 너무 크면 못 배워요.' },
        { target: q('#btnLearn1'), title: '한 번 배우기', text: '네 줄을 한 번씩 보고, 줄마다 틀린 만큼 가중치를 고쳐요. 이것을 학습 1번(에포크)이라고 해요.' },
        { target: q('#btnAuto'), title: '자동 학습', text: '맞힐 때까지 계속 배워요(Space). 다시 누르면 멈춰요. 처음 가중치로(R)는 배운 것을 지우고 다시 시작해요.' },
        { target: q('#trainSpeed'), title: '학습 배속', text: '1×~8×로 자동 학습을 빨리 돌릴 수 있어요.' },
        { target: q('#lossChart'), title: '오차 그래프', text: '빨간 선이 내려갈수록 잘 배우고 있다는 뜻이에요.' },
        { target: q('#brainCanvas'), title: '바뀌는 가중치', text: '선 위 숫자가 학습할 때마다 스스로 바뀌어요. 선이나 뉴런을 클릭하면 지금 값을 볼 수 있어요.' },
      ],
    };
    function start(n, opt) {
      if (!SCRIPTS[n]) return;
      if (steps) stop(false);
      name = n; idx = 0;
      steps = opt && opt.explainOnly ? SCRIPTS[n].filter((st) => !st.wait) : SCRIPTS[n];
      $('#tourRoot').innerHTML = '<div class="tour-dim"></div><div class="tour-spot"></div><div class="tour-card" role="dialog" aria-live="polite"></div>';
      render();
    }
    function render() {
      const st = steps[idx];
      const card = $('#tourRoot .tour-card');
      card.innerHTML = `
        <div class="tour-count">${idx + 1} / ${steps.length}</div>
        <h4>${esc(st.title)}</h4>
        <p>${esc(st.text)}</p>
        <div class="tour-actions">
          <button class="btn sm ghost" data-t="skip">건너뛰기</button>
          ${idx > 0 && !steps[idx - 1].wait ? '<button class="btn sm" data-t="prev">이전</button>' : ''}
          ${st.wait ? '<span class="tour-wait">직접 해 보세요</span>' : `<button class="btn sm primary" data-t="next">${idx === steps.length - 1 ? '끝' : '다음'}</button>`}
        </div>`;
      card.querySelector('[data-t="skip"]').onclick = () => stop(true);
      const pv = card.querySelector('[data-t="prev"]');
      if (pv) pv.onclick = () => { idx--; render(); };
      const nx = card.querySelector('[data-t="next"]');
      if (nx) nx.onclick = next;
      bringIntoView(st);
      place();
    }
    function rectOf(st) {
      const t = st.target && st.target();
      if (!t) return null;
      const r = t.getBoundingClientRect ? t.getBoundingClientRect() : t;
      return r.width || r.height ? r : null;
    }
    // 비출 곳이 화면 밖이면 그곳이 보이도록 페이지를 굴린다(보상 실험처럼 세로로 긴 화면용)
    function bringIntoView(st) {
      const r = rectOf(st);
      if (!r) return;
      const top = 70, bottom = innerHeight - 20;
      if (r.top >= top && r.bottom <= bottom) return;
      const want = r.height > bottom - top ? r.top - top : r.top - (innerHeight - r.height) / 2;
      window.scrollBy({ top: want, behavior: 'smooth' });
    }
    function place() {
      const st = steps[idx];
      const spot = $('#tourRoot .tour-spot'), card = $('#tourRoot .tour-card'), dim = $('#tourRoot .tour-dim');
      if (!spot || !card) return;
      const r = rectOf(st);
      const vw = innerWidth, vh = innerHeight, cw = card.offsetWidth || 340, ch = card.offsetHeight || 180, gap = 14;
      if (!r) {
        spot.style.display = 'none'; dim.style.display = 'block';
        card.style.left = (vw - cw) / 2 + 'px'; card.style.top = Math.max(20, (vh - ch) / 2) + 'px';
        return;
      }
      dim.style.display = 'none'; spot.style.display = 'block';
      const pad = 6;
      Object.assign(spot.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
      let x, y;
      if (r.right + gap + cw < vw - 10) { x = r.right + gap; y = r.top; }
      else if (r.left - gap - cw > 10) { x = r.left - gap - cw; y = r.top; }
      else if (r.bottom + gap + ch < vh - 10) { x = r.left; y = r.bottom + gap; }
      else { x = r.left; y = r.top - gap - ch; }
      x = Math.min(Math.max(10, x), vw - cw - 10);
      y = Math.min(Math.max(10, y), vh - ch - 10);
      card.style.left = x + 'px'; card.style.top = y + 'px';
    }
    function tick() {
      if (!steps) return;
      if (view !== 'play') { stop(false); return; }
      place();
      const st = steps[idx];
      if (st.wait && st.wait()) next();
    }
    function next() { idx++; if (idx >= steps.length) stop(false); else render(); }
    function stop(skipped) {
      if (!steps) return;
      S.tours[name] = true;
      save();
      steps = null;
      $('#tourRoot').innerHTML = '';
      if (skipped) toast('안내를 건너뛰었어요. 설정에서 다시 볼 수 있어요');
    }
    return { start, tick, stop, active: () => !!steps };
  })();

  // ===================================================================
  // 시작
  // ===================================================================
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      tour.tick();
      if (view === 'play' && play.cfg) tickPlay(dt);
      else if (view === 'versus') tickVersus(dt);
      else if (view === 'home') hero.tick(dt);
    } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }
  applyAudioSettings();
  renderInspector(null);
  route();
  requestAnimationFrame(frame);

  // 테스트·디버깅용 손잡이(콘솔에서 SA.app.state 등으로 확인)
  SA.app = {
    get state() { return S; }, play, vs, editor, go,
    // 숨겨진 탭에서는 화면 갱신이 느려지므로, QA 때 시뮬레이션을 직접 앞으로 돌리는 손잡이
    debug: {
      toggleRun, resetWorld,
      advance(sec) {
        const w = play.world;
        for (let i = 0; i < Math.ceil(sec / sim.DT) && play.state === 'running' && w.status === 'running'; i++) { sim.step(w); handleEvents(w, arenaView); }
        if (w.status !== 'running' && play.state === 'running') finishPlay();
        return { t: w.t, status: w.status, eaten: w.creatures[0].eaten };
      },
      skipMatch,
    },
  };
})();
