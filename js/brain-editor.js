/* 시냅스 아레나 — 뇌 편집기
 * 뉴런(점)을 끌어서 시냅스(선)를 잇는다. 논리 좌표 480×420.
 *  - 센서/히든 뉴런 오른쪽의 작은 점(또는 센서 몸통)을 끌어 히든 뉴런·바퀴에 놓기 → 시냅스
 *  - 시냅스 클릭 → 선택, 휠 → 세기 ±0.1, 우클릭 → 삭제
 *  - 빈 곳 더블클릭 → 히든 뉴런, 히든 뉴런은 끌어서 옮긴다
 */
(function () {
  'use strict';
  const SA = (globalThis.SA = globalThis.SA || {});
  const { SENSORS, MOTORS, MAX_SYNAPSE_W } = SA.sim;
  const hexA = SA.arenaView.hexA;

  // 캔버스 크기에 맞춰 논리 크기(LW×LH)가 늘어난다. 최소 440×420.
  let LW = 480, LH = 420;
  const NR = 20;                       // 뉴런 반지름
  const SX = 100, HX0 = 196, HY0 = 36; // 센서 열, 히든 뉴런 영역 왼쪽·위
  let MX = 424, HX1 = 340, HY1 = 384, MID = 210, MY_L = 128, MY_R = 292;
  function relayout(w, h) {
    LW = w; LH = h;
    MX = LW - 56; HX1 = LW - 140; HY1 = LH - 36; MID = LH / 2;
    MY_L = LH * 0.305; MY_R = LH * 0.695;
  }
  const ORDER = ['inA', 'inB', 'inC', 'inD', 'inX', 'inY', 'mem1', 'mem2', 'memO', 'eyeL', 'feelL', 'whiskL', 'bias', 'whiskR', 'feelR', 'eyeR'];
  const OUTS = ['motorL', 'motorR', 'out', 'out2', 'out3', 'out4'];
  const MEM_SRC = SA.sim.MEM_SRC;
  const MAX_SYN = 40;
  const GROUP_COLOR = { bias: '#c9d3ea', eye: '#ffd166', danger: '#ff5fa2', wall: '#5ee6d0', hidden: '#c3a6ff', motor: '#7ee081', input: '#8fd3ff', memory: '#f59f80' };
  // 왼눈·오른눈은 아레나의 시야 색과 맞춘다
  const ID_COLOR = { eyeL: '#ffa94d', eyeR: '#ffe066' };
  const GLYPH = { bias: '1', eye: '눈', danger: '촉', wall: '수', motor: '바퀴' };
  const ID_GLYPH = { inA: 'A', inB: 'B', inC: 'C', inD: 'D', inX: 'x', inY: 'y', mem1: '↺1', mem2: '↺2', memO: '↺답', out: '답', out2: '답2', out3: '답3', out4: '답4' };
  const SHORT = { bias: '상시', eyeL: '왼눈', eyeR: '오른눈', feelL: '왼 더듬이', feelR: '오른 더듬이', whiskL: '왼 수염', whiskR: '오른 수염', motorL: '왼바퀴', motorR: '오른바퀴', inA: '입력 A', inB: '입력 B', inC: '입력 C', inD: '입력 D', inX: 'x 좌표', inY: 'y 좌표', mem1: '기억 1', mem2: '기억 2', memO: '출력 기억', out: '출력', out2: '출력 2', out3: '출력 3', out4: '출력 4' };
  const SPIKE_PITCH = { motorL: 520, motorR: 700, out: 610, out2: 760, out3: 840, out4: 920 };

  function create(canvas, hooks = {}) {
    const ctx = canvas.getContext('2d');
    // outputs: 출력 뉴런 목록, fixedHidden: 히든 뉴런 수를 고정(추가·삭제 불가), minHidden: 처음부터 둘 히든 뉴런 수
    // readOnly: 보기만 가능(학습 실험)
    // funcs: 고를 수 있는 활성화 함수 목록(1개뿐이면 함수 고르기를 숨긴다)
    let cfg = { sensors: SENSORS.map((s) => s.id), outputs: ['motorL', 'motorR'], maxHidden: 0, fixedHidden: 0, minHidden: 0, readOnly: false, funcs: ['clamp'], noSkip: false, fixedFn: null, hiddenPos: null };
    let brain = { hidden: [], synapses: [] };
    let sel = null;           // {type:'syn', i} | {type:'neuron', id}
    let hover = null;         // 같은 모양
    let drag = null;          // {kind:'connect', from, x, y} | {kind:'move', id, ox, oy, moved, sx, sy}
    let past = [], future = [];
    let wheelMerge = 0;
    const phase = Object.create(null);
    let pulses = [];
    let scale = 1, cssScale = 1;
    let labelRects = [];      // 이번 프레임에 그린 세기 표시 자리(클릭·휠 판정용)

    // ---- 배치 ----
    function sensorList() { return ORDER.filter((id) => cfg.sensors.includes(id)); }
    function layout() {
      const pos = Object.create(null);
      const ss = sensorList();
      const span = HY1 - HY0;
      ss.forEach((id, i) => { pos[id] = { x: SX, y: HY0 + ((i + 0.5) * span) / ss.length }; });
      const outs = cfg.outputs;
      if (outs.length === 1) pos[outs[0]] = { x: MX, y: MID };
      else if (outs.length === 2) outs.forEach((id, i) => { pos[id] = { x: MX, y: i === 0 ? MY_L : MY_R }; });
      else outs.forEach((id, i) => { pos[id] = { x: MX, y: HY0 + ((i + 0.5) * span) / outs.length }; });
      for (const h of brain.hidden) pos[h.id] = { x: HX0 + h.x * (HX1 - HX0), y: HY0 + h.y * (HY1 - HY0) };
      return pos;
    }
    function kindOf(id) {
      if (OUTS.includes(id)) return 'motor';
      if (/^h\d+$/.test(id)) return 'hidden';
      return 'sensor';
    }
    function groupOf(id) {
      const k = kindOf(id);
      if (k !== 'sensor') return k;
      return SENSORS.find((s) => s.id === id).group;
    }
    function nameOf(id) {
      if (SHORT[id]) return SHORT[id];
      return '히든 ' + id.slice(1);
    }

    // ---- 상태 바꾸기 ----
    function snapshot() { return JSON.stringify(brain); }
    function commit(kind, merge) {
      if (!merge) { past.push(lastSnap); if (past.length > 120) past.shift(); future = []; }
      lastSnap = snapshot();
      if (hooks.onChange) hooks.onChange(getBrain(), kind);
    }
    let lastSnap = snapshot();

    function sanitize(b) {
      const allowed = new Set(cfg.sensors);
      const out = { hidden: [], synapses: [] };
      const hid = Array.isArray(b && b.hidden) ? b.hidden : [];
      for (const h of hid.slice(0, cfg.maxHidden)) {
        if (!h || !/^h\d+$/.test(h.id) || out.hidden.some((o) => o.id === h.id)) continue;
        out.hidden.push({ id: h.id, x: clamp01(+h.x), y: clamp01(+h.y) });
      }
      // 처음부터 있어야 하는 히든 뉴런(h1, h2 …)을 채운다
      const need = Math.max(cfg.fixedHidden || 0, cfg.minHidden || 0);
      const SLOTS = [0.3, 0.7, 0.12, 0.88, 0.5, 0.2];
      for (let n = 1; out.hidden.length < need && n <= 9; n++) {
        const hp = cfg.hiddenPos && cfg.hiddenPos['h' + n];
        if (!out.hidden.some((h) => h.id === 'h' + n)) out.hidden.push({ id: 'h' + n, x: hp ? hp[0] : 0.5, y: hp ? hp[1] : SLOTS[out.hidden.length] ?? 0.5 });
      }
      const ids = new Set(out.hidden.map((h) => h.id));
      for (const s of Array.isArray(b && b.synapses) ? b.synapses : []) {
        if (!s) continue;
        const fromOk = allowed.has(s.from) || ids.has(s.from);
        const toOk = cfg.outputs.includes(s.to) || ids.has(s.to);
        if (!fromOk || !toOk || s.from === s.to) continue;
        if (skipBlocked(s.from, s.to)) continue;
        if (out.synapses.some((o) => o.from === s.from && o.to === s.to)) continue;
        const w = Number(s.w);
        const ww = Number.isFinite(w) ? clampW(w) : 1;
        out.synapses.push({ from: s.from, to: s.to, w: cfg.readOnly ? Math.round(ww * 100) / 100 : round1(ww) });
        if (out.synapses.length >= MAX_SYN) break;
      }
      // 뉴런별 활성화 함수(기본값 clamp는 적지 않는다)
      const fnSrc = (b && b.fn) || {};
      const fnIds = new Set(out.hidden.map((h) => h.id).concat(cfg.outputs));
      for (const id of Object.keys(fnSrc)) {
        const f = fnSrc[id];
        if (fnIds.has(id) && f !== 'clamp' && cfg.funcs.includes(f) && SA.sim.FUNCS[f]) (out.fn = out.fn || {})[id] = f;
      }
      // 실험이 정해 둔 함수(예: 소프트맥스 출력)는 언제나 그대로 둔다
      if (cfg.fixedFn) out.fn = Object.assign(out.fn || {}, cfg.fixedFn);
      return out;
    }
    function clamp01(v) { return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5; }
    function clampW(w) { return Math.max(-MAX_SYNAPSE_W, Math.min(MAX_SYNAPSE_W, w)); }
    function round1(w) { return Math.round(w * 10) / 10; }

    function setConfig(c) { cfg = Object.assign({}, cfg, c); brain = sanitize(brain); }
    function setBrain(b, keepHistory) {
      brain = sanitize(b);
      if (!keepHistory) { past = []; future = []; }
      lastSnap = snapshot();
      sel = null;
      emitSelect();
    }
    function getBrain() { return JSON.parse(JSON.stringify(brain)); }

    // 압축 실험: 입력은 출력에 바로 잇지 못하고 히든 뉴런(코드)을 거쳐야 한다
    function skipBlocked(from, to) {
      return !!cfg.noSkip && kindOf(from) === 'sensor' && from !== 'bias' && kindOf(to) === 'motor';
    }
    function addSynapse(from, to) {
      if (skipBlocked(from, to)) { toast('이 실험은 입력을 출력에 바로 이을 수 없어요. 가운데 히든 뉴런(코드)을 거쳐야 해요'); return; }
      const ex = brain.synapses.findIndex((s) => s.from === from && s.to === to);
      if (ex >= 0) { sel = { type: 'syn', i: ex }; emitSelect(); return; }
      if (brain.synapses.length >= MAX_SYN) { toast(`시냅스는 ${MAX_SYN}개까지 만들 수 있어요`); return; }
      brain.synapses.push({ from, to, w: 1 });
      sel = { type: 'syn', i: brain.synapses.length - 1 };
      SA.audio.sfx.connect();
      commit('add');
      emitSelect();
    }
    function addHidden(x, y) {
      if (cfg.readOnly) return;
      if (cfg.fixedHidden) { toast(`이 실험의 히든 뉴런은 ${cfg.fixedHidden}개로 정해져 있어요. 끌어서 옮기고 이어서 쓰세요`); return; }
      if (brain.hidden.length >= cfg.maxHidden) {
        toast(cfg.maxHidden ? `이 실험에서는 히든 뉴런을 ${cfg.maxHidden}개까지 쓸 수 있어요` : '이 실험에서는 아직 히든 뉴런을 쓸 수 없어요');
        return;
      }
      let n = 1;
      while (brain.hidden.some((h) => h.id === 'h' + n)) n++;
      const nx = x == null ? 0.5 : (x - HX0) / (HX1 - HX0);
      let ny = y == null ? null : (y - HY0) / (HY1 - HY0);
      if (ny == null) {
        const slots = [0.3, 0.7, 0.12, 0.88, 0.5, 0.2, 0.8];
        ny = slots.find((v) => !brain.hidden.some((h) => Math.abs(h.y - v) < 0.08 && Math.abs(h.x - 0.5) < 0.2)) ?? 0.5;
      }
      brain.hidden.push({ id: 'h' + n, x: clamp01(nx), y: clamp01(ny) });
      sel = { type: 'neuron', id: 'h' + n };
      SA.audio.sfx.click();
      commit('add');
      emitSelect();
    }
    function deleteSelection() {
      if (!sel || cfg.readOnly) return;
      if (sel.type === 'neuron' && kindOf(sel.id) === 'hidden' && (cfg.fixedHidden || brain.hidden.length <= (cfg.minHidden || 0))) {
        toast('히든 뉴런은 지울 수 없어요. 쓰지 않으려면 선만 지우면 돼요');
        return;
      }
      if (sel.type === 'syn') {
        brain.synapses.splice(sel.i, 1);
      } else if (kindOf(sel.id) === 'hidden') {
        const id = sel.id;
        brain.hidden = brain.hidden.filter((h) => h.id !== id);
        brain.synapses = brain.synapses.filter((s) => s.from !== id && s.to !== id);
      } else return;
      sel = null;
      SA.audio.sfx.remove();
      commit('delete');
      emitSelect();
    }
    function setWeight(w, merge) {
      if (!sel || sel.type !== 'syn' || cfg.readOnly) return;
      brain.synapses[sel.i].w = round1(clampW(w));
      commit('weight', merge);
      emitSelect();
    }
    function setFn(id, f) {
      if (cfg.readOnly || !cfg.funcs.includes(f)) return;
      brain.fn = brain.fn || {};
      if (f === 'clamp') delete brain.fn[id]; else brain.fn[id] = f;
      if (!Object.keys(brain.fn).length) delete brain.fn;
      commit('fn');
      emitSelect();
    }
    function flipSign() {
      if (!sel || sel.type !== 'syn' || cfg.readOnly) return;
      const s = brain.synapses[sel.i];
      s.w = round1(-s.w) || 0;
      commit('weight');
      emitSelect();
    }
    function clearAll() {
      if (cfg.readOnly || !brain.synapses.length) return;
      brain = sanitize({ hidden: brain.hidden, synapses: [] });
      sel = null;
      commit('clear');
      emitSelect();
    }
    function undo() {
      if (!past.length) return false;
      future.push(snapshot());
      brain = sanitize(JSON.parse(past.pop()));
      lastSnap = snapshot();
      sel = null;
      if (hooks.onChange) hooks.onChange(getBrain(), 'undo');
      emitSelect();
      return true;
    }
    function redo() {
      if (!future.length) return false;
      past.push(snapshot());
      brain = sanitize(JSON.parse(future.pop()));
      lastSnap = snapshot();
      sel = null;
      if (hooks.onChange) hooks.onChange(getBrain(), 'redo');
      emitSelect();
      return true;
    }
    // 다른 뇌로 통째로 바꾼다(정답 보기 등). 되돌리기로 돌아올 수 있다.
    function loadBrain(b) {
      past.push(snapshot());
      future = [];
      brain = sanitize(JSON.parse(JSON.stringify(b)));
      lastSnap = snapshot();
      sel = null;
      if (hooks.onChange) hooks.onChange(getBrain(), 'load');
      emitSelect();
    }
    function emitSelect() { if (hooks.onSelect) hooks.onSelect(describe()); }
    function toast(m) { if (hooks.toast) hooks.toast(m); }

    function describe() {
      if (!sel) return null;
      if (sel.type === 'syn') {
        const s = brain.synapses[sel.i];
        if (!s) { sel = null; return null; }
        return { type: 'syn', from: s.from, to: s.to, w: s.w, fromName: nameOf(s.from), toName: nameOf(s.to) };
      }
      const id = sel.id;
      const k = kindOf(id);
      let desc = '';
      if (k === 'sensor') desc = SENSORS.find((s) => s.id === id).desc;
      else if (k === 'motor') desc = MOTORS.find((m) => m.id === id).desc;
      else desc = '입력과 출력 사이에서 계산하는 뉴런. 들어온 신호의 합을 0~1로 자른다. 0 아래로는 내려가지 않는다.';
      const inc = brain.synapses.filter((s) => s.to === id).length;
      const out = brain.synapses.filter((s) => s.from === id).length;
      const fn = (brain.fn && brain.fn[id]) || 'clamp';
      return { type: 'neuron', id, kind: k, name: nameOf(id), desc, inc, out, fn, funcs: k === 'sensor' ? [] : cfg.funcs };
    }

    // ---- 맞히기(hit test) ----
    function toLocal(e) {
      const r = canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / cssScale, y: (e.clientY - r.top) / cssScale };
    }
    function neuronAt(p, pos) {
      for (const id in pos) {
        if (Math.hypot(p.x - pos[id].x, p.y - pos[id].y) <= NR + 3) return id;
      }
      return null;
    }
    function portAt(p, pos) {
      for (const id in pos) {
        if (kindOf(id) === 'motor') continue;
        if (Math.hypot(p.x - (pos[id].x + NR + 8), p.y - pos[id].y) <= 9) return id;
      }
      return null;
    }
    function curve(a, b) {
      const sx = a.x + NR + 2, sy = a.y, tx = b.x - NR - 4, ty = b.y;
      const dx = Math.max(50, Math.abs(tx - sx) * 0.45);
      return [sx, sy, sx + dx, sy, tx - dx, ty, tx, ty];
    }
    function bez(c, t) {
      const u = 1 - t;
      return {
        x: u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6],
        y: u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7],
      };
    }
    function synAt(p, pos) {
      for (let k = labelRects.length - 1; k >= 0; k--) {
        const r = labelRects[k];
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return r.i;
      }
      let best = -1, bd = 8;
      brain.synapses.forEach((s, i) => {
        if (!pos[s.from] || !pos[s.to]) return;
        const c = curve(pos[s.from], pos[s.to]);
        for (let k = 0; k <= 30; k++) {
          const q = bez(c, k / 30);
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < bd) { bd = d; best = i; }
        }
      });
      return best;
    }

    // ---- 입력 ----
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); // 끌기 시작할 때 주변 글자가 선택되지 않게
      const selection = globalThis.getSelection && getSelection();
      if (selection && selection.rangeCount) selection.removeAllRanges();
      SA.audio.unlock();
      const p = toLocal(e);
      const pos = layout();
      const port = portAt(p, pos);
      const n = neuronAt(p, pos);
      canvas.setPointerCapture(e.pointerId);
      if (cfg.readOnly) {
        const si = n ? -1 : synAt(p, pos);
        sel = n ? { type: 'neuron', id: n } : si >= 0 ? { type: 'syn', i: si } : null;
        emitSelect();
        return;
      }
      if (port || (n && kindOf(n) === 'sensor')) {
        drag = { kind: 'connect', from: port || n, x: p.x, y: p.y, sx: p.x, sy: p.y };
        return;
      }
      if (n && kindOf(n) === 'hidden') {
        drag = { kind: 'move', id: n, ox: p.x - pos[n].x, oy: p.y - pos[n].y, moved: false, sx: p.x, sy: p.y };
        return;
      }
      if (n) { sel = { type: 'neuron', id: n }; emitSelect(); return; }
      const si = synAt(p, pos);
      if (si >= 0) { sel = { type: 'syn', i: si }; SA.audio.sfx.click(); emitSelect(); return; }
      sel = null;
      emitSelect();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = toLocal(e);
      const pos = layout();
      if (drag && drag.kind === 'connect') { drag.x = p.x; drag.y = p.y; return; }
      if (drag && drag.kind === 'move') {
        if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < 4) return;
        drag.moved = true;
        const h = brain.hidden.find((q) => q.id === drag.id);
        if (h) {
          h.x = clamp01((p.x - drag.ox - HX0) / (HX1 - HX0));
          h.y = clamp01((p.y - drag.oy - HY0) / (HY1 - HY0));
        }
        return;
      }
      const port = portAt(p, pos);
      const n = neuronAt(p, pos);
      if (port) hover = { type: 'port', id: port };
      else if (n) hover = { type: 'neuron', id: n };
      else { const si = synAt(p, pos); hover = si >= 0 ? { type: 'syn', i: si } : null; }
      canvas.style.cursor = hover ? (hover.type === 'port' || (hover.type === 'neuron' && kindOf(hover.id) === 'sensor') ? 'crosshair' : hover.type === 'neuron' && kindOf(hover.id) === 'hidden' ? 'grab' : 'pointer') : 'default';
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const p = toLocal(e);
      const pos = layout();
      const d = drag;
      drag = null;
      if (d.kind === 'connect') {
        const n = neuronAt(p, pos);
        const moved = Math.hypot(p.x - d.sx, p.y - d.sy) > 6;
        if (n && n !== d.from && kindOf(n) !== 'sensor') addSynapse(d.from, n);
        else if (!moved) { sel = { type: 'neuron', id: d.from }; emitSelect(); }
        else if (n && kindOf(n) === 'sensor') toast('센서끼리는 이을 수 없어요. 히든 뉴런이나 바퀴에 놓아 주세요');
      } else if (d.kind === 'move') {
        if (d.moved) commit('move');
        else { sel = { type: 'neuron', id: d.id }; emitSelect(); }
      }
    });
    canvas.addEventListener('pointercancel', () => { drag = null; });
    canvas.addEventListener('pointerleave', () => { if (!drag) hover = null; });
    canvas.addEventListener('dblclick', (e) => {
      if (cfg.readOnly) return;
      const p = toLocal(e);
      const pos = layout();
      if (neuronAt(p, pos) || synAt(p, pos) >= 0) return;
      if (p.x < HX0 - 20 || p.x > HX1 + 20) return;
      addHidden(p.x, p.y);
    });
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (cfg.readOnly) return;
      const p = toLocal(e);
      const pos = layout();
      const n = neuronAt(p, pos);
      if (n && kindOf(n) === 'hidden') { sel = { type: 'neuron', id: n }; deleteSelection(); return; }
      const si = synAt(p, pos);
      if (si >= 0) { sel = { type: 'syn', i: si }; deleteSelection(); }
    });
    canvas.addEventListener('wheel', (e) => {
      const p = toLocal(e);
      const pos = layout();
      const si = synAt(p, pos);
      if (si < 0 || cfg.readOnly) return;
      e.preventDefault();
      const merge = performance.now() - wheelMerge < 700 && sel && sel.type === 'syn' && sel.i === si;
      sel = { type: 'syn', i: si };
      wheelMerge = performance.now();
      const s = brain.synapses[si];
      setWeight(s.w + (e.deltaY < 0 ? 0.1 : -0.1), merge);
    }, { passive: false });

    // ---- 그리기 ----
    function fit() {
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth || 480, ch = canvas.clientHeight || 420;
      const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      scale = Math.min(pw / 440, ph / 420);
      cssScale = scale / dpr;
      relayout(pw / scale, ph / scale);
    }
    // 고르거나 마우스를 올린 선·뉴런과 이어진 시냅스 번호들(없으면 null)
    function focusSet() {
      const f = new Set();
      const addNeuron = (id) => brain.synapses.forEach((s, i) => { if (s.from === id || s.to === id) f.add(i); });
      for (const x of [sel, drag ? null : hover]) {
        if (!x) continue;
        if (x.type === 'syn') f.add(x.i);
        else if (x.type === 'neuron' || x.type === 'port') addNeuron(x.id);
      }
      return f.size ? f : null;
    }

    function draw(dt) {
      fit();
      const live = hooks.getLive ? hooks.getLive() : null;
      const pos = layout();
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.fillStyle = '#1d2128';
      ctx.fillRect(0, 0, LW, LH);
      // 점 격자 + 히든 뉴런 영역
      ctx.fillStyle = 'rgba(210,205,195,0.07)';
      for (let x = 10; x < LW; x += 20) for (let y = 10; y < LH; y += 20) ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      if (cfg.maxHidden > 0 && !(cfg.readOnly && !brain.hidden.length)) {
        ctx.strokeStyle = 'rgba(195,166,255,0.18)';
        ctx.setLineDash([4, 6]);
        ctx.strokeRect(HX0 - 24, HY0 - 24, HX1 - HX0 + 48, HY1 - HY0 + 48);
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(195,166,255,0.45)';
        ctx.font = '600 12px ' + fontFamily();
        ctx.textAlign = 'center';
        ctx.fillText(cfg.fixedHidden || cfg.readOnly ? '히든 뉴런 · 끌어서 옮길 수 있어요' : `히든 뉴런 ${brain.hidden.length}/${cfg.maxHidden} · 빈 곳 더블클릭으로 추가`, (HX0 + HX1) / 2, HY1 + 22);
      }
      if (!cfg.outputs.includes('out')) {
      // 몸의 왼쪽/오른쪽 가르는 선
      ctx.strokeStyle = 'rgba(152,164,194,0.16)';
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(14, MID); ctx.lineTo(LW - 14, MID); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(152,164,194,0.6)';
      ctx.font = '600 12px ' + fontFamily();
      ctx.textAlign = 'right';
      ctx.fillText('▲ 몸 왼쪽', LW - 8, MID - 8);
      ctx.fillText('▼ 몸 오른쪽', LW - 8, MID + 18);
      }
      ctx.textAlign = 'center';
      ctx.fillText('감각', SX, 16);
      ctx.fillText(cfg.outputs.includes('out') ? '출력' : '바퀴', MX, 16);

      // 발화(스파이크): 활성값이 클수록 자주 쏜다 → 선을 따라 점이 흐른다
      if (live) {
        for (const id in pos) {
          const v = Math.min(1, live[id] || 0);
          phase[id] = (phase[id] || 0) + v * 7 * dt;
          if (phase[id] >= 1) {
            phase[id] -= 1;
            brain.synapses.forEach((s, i) => { if (s.from === id) pulses.push({ i, t: 0 }); });
            if (SPIKE_PITCH[id]) SA.audio.sfx.spike(SPIKE_PITCH[id]);
          }
        }
      } else { pulses = []; }

      // 시냅스: 선 먼저 다 그리고, 세기 표시는 겹치지 않는 자리를 찾아 나중에 붙인다
      const focus = focusSet();
      const curves = [];
      brain.synapses.forEach((s, i) => {
        const a = pos[s.from], b = pos[s.to];
        if (!a || !b) return;
        const c = curve(a, b);
        curves[i] = c;
        const exc = s.w >= 0;
        const color = exc ? '#5aa9ff' : '#ff5d73';
        const isSel = sel && sel.type === 'syn' && sel.i === i;
        const isHov = hover && hover.type === 'syn' && hover.i === i;
        const width = 1.2 + Math.abs(s.w) * 1.5;
        const flow = live ? Math.min(1, (live[s.from] || 0) * Math.abs(s.w)) : 0;
        ctx.globalAlpha = focus && !focus.has(i) ? 0.16 : 1;
        if (isSel || isHov || (focus && focus.has(i))) {
          ctx.strokeStyle = hexA(color, isSel ? 0.35 : 0.22);
          ctx.lineWidth = width + 8;
          path(c); ctx.stroke();
        }
        ctx.strokeStyle = hexA(color, s.w === 0 ? 0.25 : 0.45 + 0.4 * flow + (isSel ? 0.15 : 0));
        ctx.lineWidth = width;
        if (s.w === 0) ctx.setLineDash([3, 4]);
        path(c); ctx.stroke();
        ctx.setLineDash([]);
        // 끝 모양: 흥분 = 화살표, 억제 = ⊣ 막대 (신경과학 그림 관습)
        const end = bez(c, 1), pre = bez(c, 0.96);
        const ang = Math.atan2(end.y - pre.y, end.x - pre.x);
        ctx.fillStyle = ctx.strokeStyle = hexA(color, 0.95);
        if (exc) {
          ctx.beginPath();
          ctx.moveTo(end.x + Math.cos(ang) * 3, end.y + Math.sin(ang) * 3);
          ctx.lineTo(end.x - Math.cos(ang - 0.5) * 9, end.y - Math.sin(ang - 0.5) * 9);
          ctx.lineTo(end.x - Math.cos(ang + 0.5) * 9, end.y - Math.sin(ang + 0.5) * 9);
          ctx.closePath(); ctx.fill();
        } else {
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(end.x - Math.sin(ang) * 7, end.y + Math.cos(ang) * 7);
          ctx.lineTo(end.x + Math.sin(ang) * 7, end.y - Math.cos(ang) * 7);
          ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
      // 세기 표시 배치: 뉴런과 다른 표시를 피해 선 위의 여러 자리(t)를 차례로 시도한다
      labelRects = [];
      const blocks = Object.values(pos).map((p) => ({ x: p.x - NR - 3, y: p.y - NR - 3, w: NR * 2 + 22, h: NR * 2 + 6 }));
      const hitAny = (r) => labelRects.concat(blocks).some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
      const TRY = [0.5, 0.4, 0.6, 0.32, 0.68, 0.25, 0.75, 0.18, 0.82];
      ctx.font = '700 12.5px ' + monoFamily();
      const order = brain.synapses.map((_, i) => i).sort((a, b) => (focus ? (focus.has(b) ? 1 : 0) - (focus.has(a) ? 1 : 0) : 0));
      for (const i of order) {
        const s = brain.synapses[i], c = curves[i];
        if (!c) continue;
        const inFocus = focus && focus.has(i);
        if (focus && !inFocus) continue; // 초점이 있으면 이어진 선의 세기만
        const label = (s.w > 0 ? '+' : '') + s.w.toFixed(cfg.readOnly ? 2 : 1);
        const tw = ctx.measureText(label).width + 12;
        let spot = null;
        for (const t of TRY) {
          const q = bez(c, t);
          const r = { x: q.x - tw / 2 - 2, y: q.y - 12, w: tw + 4, h: 24, i };
          if (!hitAny(r)) { spot = r; break; }
        }
        if (!spot) {
          if (!inFocus) continue; // 자리가 없으면 생략(마우스를 올리면 보인다)
          const q = bez(c, 0.5);
          spot = { x: q.x - tw / 2 - 2, y: q.y - 12, w: tw + 4, h: 24, i };
        }
        labelRects.push(spot);
        const exc = s.w >= 0;
        const color = exc ? '#5aa9ff' : '#ff5d73';
        const isSel = sel && sel.type === 'syn' && sel.i === i;
        const mx = spot.x + spot.w / 2, my = spot.y + spot.h / 2;
        ctx.fillStyle = isSel ? hexA(color, 0.95) : 'rgba(29,33,40,0.95)';
        roundRect(mx - tw / 2, my - 10, tw, 20, 10); ctx.fill();
        ctx.strokeStyle = hexA(color, 0.8); ctx.lineWidth = 1;
        roundRect(mx - tw / 2, my - 10, tw, 20, 10); ctx.stroke();
        ctx.fillStyle = isSel ? '#06101f' : hexA(color, 1);
        ctx.textAlign = 'center';
        ctx.fillText(label, mx, my + 4.5);
      }
      // 흐르는 신호 점
      for (let k = pulses.length - 1; k >= 0; k--) {
        const pu = pulses[k];
        pu.t += dt / 0.35;
        const s = brain.synapses[pu.i];
        if (!s || pu.t >= 1 || !pos[s.from] || !pos[s.to]) { pulses.splice(k, 1); continue; }
        if (focus && !focus.has(pu.i)) continue;
        const q = bez(curve(pos[s.from], pos[s.to]), pu.t);
        ctx.fillStyle = s.w >= 0 ? '#bfe0ff' : '#ffc2cb';
        ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, Math.PI * 2); ctx.fill();
      }
      if (pulses.length > 600) pulses.splice(0, pulses.length - 600);

      // 끌고 있는 선
      if (drag && drag.kind === 'connect' && pos[drag.from]) {
        const a = pos[drag.from];
        const c = curve(a, { x: drag.x + NR + 4, y: drag.y });
        ctx.strokeStyle = 'rgba(233,238,251,0.7)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        path(c); ctx.stroke();
        ctx.setLineDash([]);
        const target = neuronAt(drag, pos);
        if (target && target !== drag.from && kindOf(target) !== 'sensor') {
          ctx.strokeStyle = '#e9eefb';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(pos[target].x, pos[target].y, NR + 6, 0, Math.PI * 2); ctx.stroke();
        }
      }

      // 되먹임: 기억 뉴런은 바로 전 순간의 히든·출력 값을 받는다(점선)
      for (const id of cfg.sensors) {
        const src = MEM_SRC[id];
        if (!src || !pos[src] || !pos[id]) continue;
        const a = pos[src], b = pos[id];
        const top = Math.max(8, Math.min(a.y, b.y) - 46);
        ctx.strokeStyle = 'rgba(245,159,128,0.55)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y - NR);
        ctx.bezierCurveTo(a.x, top, b.x + 70, top, b.x + NR + 2, b.y - 6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(245,159,128,0.85)';
        ctx.beginPath();
        ctx.moveTo(b.x + NR + 2, b.y - 6); ctx.lineTo(b.x + NR + 11, b.y - 12); ctx.lineTo(b.x + NR + 10, b.y - 2);
        ctx.fill();
        ctx.font = '600 11px ' + fontFamily();
        ctx.textAlign = 'center';
        ctx.fillText('되먹임', (a.x + b.x) / 2 + 20, top + 10);
      }
      // 뉴런
      for (const id in pos) {
        const p = pos[id];
        const g = groupOf(id);
        const color = ID_COLOR[id] || GROUP_COLOR[g];
        const v = live ? live[id] || 0 : 0;
        const vv = Math.min(1, v);
        const isSel = sel && sel.type === 'neuron' && sel.id === id;
        const isHov = hover && hover.type === 'neuron' && hover.id === id;
        if (vv > 0.01) {
          const gr = ctx.createRadialGradient(p.x, p.y, NR * 0.5, p.x, p.y, NR + 18);
          gr.addColorStop(0, hexA(color, 0.45 * vv));
          gr.addColorStop(1, hexA(color, 0));
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(p.x, p.y, NR + 18, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = vv > 0.01 ? mix('#262a32', color, 0.15 + vv * 0.55) : '#262a32';
        ctx.strokeStyle = hexA(color, isSel || isHov ? 1 : 0.8);
        ctx.lineWidth = isSel ? 3 : 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, NR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (isSel) {
          ctx.strokeStyle = hexA(color, 0.4);
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(p.x, p.y, NR + 6, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.textAlign = 'center';
        ctx.fillStyle = vv > 0.5 ? '#16181d' : '#ece8e0';
        if (live) {
          ctx.font = '700 12px ' + monoFamily();
          ctx.fillText(v.toFixed(2), p.x, p.y + 4.5);
        } else {
          ctx.font = '700 13px ' + fontFamily();
          const fshort = brain.fn && brain.fn[id] ? SA.sim.FUNCS[brain.fn[id]].short : '';
          if (fshort) ctx.font = '700 ' + (fshort.length > 3 ? 10 : 12) + 'px ' + fontFamily();
          ctx.fillText(fshort || ID_GLYPH[id] || (g === 'hidden' ? id.toUpperCase() : GLYPH[g]), p.x, p.y + 4.5);
        }
        // 이름: 감각은 왼쪽에, 나머지는 아래에
        ctx.fillStyle = hexA(color, 0.95);
        ctx.font = '700 12.5px ' + fontFamily();
        if (kindOf(id) === 'sensor') { ctx.textAlign = 'right'; ctx.fillText(nameOf(id), p.x - NR - 7, p.y + 4.5); ctx.textAlign = 'center'; }
        else {
          const fnName = brain.fn && brain.fn[id] ? ' · ' + SA.sim.FUNCS[brain.fn[id]].name : '';
          ctx.fillText(nameOf(id) + fnName, p.x, p.y + NR + 16);
          // 바퀴 하나만 돌면 몸이 도는 방향(왼바퀴 → 오른쪽으로 돎 = 시계 방향)
          const turn = { motorL: '↻ 시계 방향 회전', motorR: '↺ 반시계 방향 회전' }[id];
          if (turn) { ctx.font = '600 11px ' + fontFamily(); ctx.fillStyle = hexA(color, 0.7); ctx.fillText(turn, p.x, p.y + NR + 31); }
        }
        // 출력 단자
        if (kindOf(id) !== 'motor') {
          const hp = hover && hover.type === 'port' && hover.id === id;
          ctx.fillStyle = hp ? '#e9eefb' : hexA(color, 0.75);
          ctx.beginPath(); ctx.arc(p.x + NR + 8, p.y, hp ? 6 : 4.2, 0, Math.PI * 2); ctx.fill();
        }
      }
      // 처음 쓰는 사람을 위한 안내
      if (!brain.synapses.length && !drag) {
        const ss = sensorList();
        const a = pos[ss[Math.floor(ss.length / 2)]];
        if (a) {
          const tt = (performance.now() / 1000) % 2.2 / 2.2;
          // 압축 실험은 입력을 출력에 바로 못 이으니 히든 뉴런 쪽을 가리킨다
          const toHidden = cfg.noSkip && brain.hidden.length;
          const c = curve(a, toHidden ? pos[brain.hidden[0].id] : pos[cfg.outputs[0]]);
          const q = bez(c, Math.min(1, tt * 1.15));
          ctx.strokeStyle = 'rgba(233,238,251,0.18)';
          ctx.setLineDash([4, 6]); ctx.lineWidth = 2; path(c); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = 'rgba(233,238,251,0.8)';
          ctx.beginPath(); ctx.arc(q.x, q.y, 5, 0, Math.PI * 2); ctx.fill();
          ctx.font = '700 13px ' + fontFamily();
          ctx.textAlign = 'center';
          ctx.fillText(toHidden ? '입력을 끌어서 히든 뉴런에 놓아 보세요' : cfg.outputs.includes('out') ? '입력을 끌어서 출력에 놓아 보세요' : '센서를 끌어서 바퀴에 놓아 보세요', (SX + MX) / 2, 30);
        }
      }
    }

    function path(c) { ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]); }
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }

    return {
      setConfig, setBrain, getBrain, loadBrain, setFn, draw,
      // 투어(튜토리얼)가 뉴런 위치를 가리킬 때 쓰는 화면 좌표
      neuronRect(id) {
        const p = layout()[id];
        if (!p) return null;
        const r = canvas.getBoundingClientRect();
        const R = (NR + 8) * cssScale;
        return { left: r.left + p.x * cssScale - R, top: r.top + p.y * cssScale - R, width: R * 2, height: R * 2 };
      }, undo, redo, addHidden: () => addHidden(), deleteSelection, setWeight, flipSign, clearAll,
      selectNone() { sel = null; emitSelect(); },
      get selection() { return describe(); },
      canUndo: () => past.length > 0, canRedo: () => future.length > 0,
      nameOf,
    };
  }

  let _font = null, _mono = null;
  function fontFamily() { return _font || (_font = getComputedStyle(document.body).fontFamily); }
  function monoFamily() { return _mono || (_mono = getComputedStyle(document.documentElement).getPropertyValue('--mono').trim() || 'monospace'); }
  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return `rgb(${r},${g},${bl})`;
  }

  SA.brainEditor = { create, SHORT };
})();
