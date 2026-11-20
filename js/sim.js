/* 시냅스 아레나 — 시뮬레이션 엔진
 * 화면(DOM)과 상관없는 순수 로직이다. 브라우저와 Node(테스트) 양쪽에서 돌아간다.
 * 같은 뇌 + 같은 실험이면 결과가 언제나 같다(결정론). 무작위가 필요한 곳은 시드 난수만 쓴다.
 */
(function () {
  'use strict';
  const SA = (globalThis.SA = globalThis.SA || {});

  // ---- 세계 상수 -------------------------------------------------------
  // 튜닝 가능한 상수(테스트에서 바꿔 볼 수 있게 객체로 묶었다)
  const P = {
    BODY_R: 13,
    MAX_SPEED: 110,     // 바퀴 출력 1일 때 초당 이동 거리(px)
    TURN_GAIN: 4.2,     // 바퀴 출력 차이 1당 초당 회전(rad) ≈ 최고 속도 / 바퀴 간격
    EYE_ANG: 0.8,       // 눈이 바라보는 방향(정면에서 좌우로)
    EYE_POW: 2,         // 눈의 방향 민감도(클수록 옆을 덜 본다)
    FEEL_ANG: 0.9,      // 더듬이 방향
    WHISK_ANG: 0.5,     // 수염 방향
    WHISK_LEN: 95,      // 수염 길이(몸 중심에서)
    FOOD_R: 9,
    EAT_R: 28,          // 입이 닿는 거리(몸 중심 ~ 먹이 중심)
    R_LIGHT: 250,       // 빛이 절반으로 약해지는 거리
    R_DANGER: 70,       // 위험 신호가 절반으로 약해지는 거리(가시 표면에서)
    FEEL_LEN: 1e9,      // 더듬이가 닿는 최대 거리(지금은 제한 없음)
    CHARGE_RATE: 0.25,  // 표식 위에서 초당 충전량
    CHARGE_DECAY: 0.2,  // 표식 밖에서 초당 방전량
    MARK_GAIN: 1.6,     // 표식의 밝기
    MARK_R_LIGHT: 80,   // 표식 빛이 절반으로 약해지는 거리(가까이서 확 밝아진다)
  };
  const W = 900, H = 600;
  const DT = 1 / 60;

  const SENSORS = [
    { id: 'bias',   name: '상시',     group: 'bias',   desc: '언제나 1로 켜져 있는 뉴런. 아무것도 보지 않아도 신호를 보낸다.' },
    { id: 'eyeL',   name: '왼눈',     group: 'eye',    desc: '왼쪽 앞의 빛(먹이·표식·미끼)이 가깝고 밝을수록 1에 가까워진다.' },
    { id: 'eyeR',   name: '오른눈',   group: 'eye',    desc: '오른쪽 앞의 빛이 가깝고 밝을수록 1에 가까워진다.' },
    { id: 'feelL',  name: '왼 더듬이', group: 'danger', desc: '왼쪽 가까이에 가시나 포식자가 있으면 커진다. 멀리는 못 느낀다.' },
    { id: 'feelR',  name: '오른 더듬이', group: 'danger', desc: '오른쪽 가까이에 가시나 포식자가 있으면 커진다.' },
    { id: 'whiskL', name: '왼 수염',   group: 'wall',   desc: '왼쪽 앞에 벽이 가까울수록 커진다. 수염 길이 밖은 0.' },
    { id: 'whiskR', name: '오른 수염', group: 'wall',   desc: '오른쪽 앞에 벽이 가까울수록 커진다.' },
    { id: 'inA',    name: '입력 A',   group: 'input',  desc: '진리표의 A 칸. 0(꺼짐) 아니면 1(켜짐).' },
    { id: 'inB',    name: '입력 B',   group: 'input',  desc: '진리표의 B 칸. 0(꺼짐) 아니면 1(켜짐).' },
    { id: 'inC',    name: '입력 C',   group: 'input',  desc: '진리표의 C 칸. 0(꺼짐) 아니면 1(켜짐).' },
  ];
  const MOTORS = [
    { id: 'motorL', name: '왼바퀴', desc: '값이 클수록 왼쪽 바퀴가 빨리 돈다. 왼쪽이 더 빠르면 오른쪽으로 돈다.' },
    { id: 'motorR', name: '오른바퀴', desc: '값이 클수록 오른쪽 바퀴가 빨리 돈다. 오른쪽이 더 빠르면 왼쪽으로 돈다.' },
    { id: 'out', name: '출력', desc: '뇌의 답. 0.5 이상이면 1(켜짐), 0.5 아래면 0(꺼짐)으로 읽는다.' },
    { id: 'out2', name: '출력 2', desc: '두 번째 답. 읽는 법은 출력과 같다.' },
  ];
  const SENSOR_IDS = SENSORS.map((s) => s.id);
  const MAX_SYNAPSE_W = 3;
  // 바퀴 뉴런은 1을 넘을 수 있다. 실제 속도는 두 바퀴의 비율을 지킨 채 최고 속도(1)에 맞춘다.
  const MOTOR_MAX = 3;

  // ---- 작은 도구들 -----------------------------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }
  // 문자열 시드로 만드는 난수(mulberry32)
  function makeRng(seed) {
    let h = 1779033703 ^ String(seed).length;
    for (const ch of String(seed)) {
      h = Math.imul(h ^ ch.charCodeAt(0), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- 뇌 ---------------------------------------------------------------
  // brain = { hidden: [{id, x, y}], synapses: [{from, to, w}], fn: {뉴런 id: 함수 이름} }
  // 함수를 정하지 않은 뉴런은 기본값: 들어온 신호의 합을 0~1로 자른다(바퀴는 0~3).
  // 활성화 함수와 논리 게이트. kind: 'act' = 합에 함수를 씌움, 'gate' = 들어온 신호마다 켜짐(≥0.5)을 봄
  const FUNCS = {
    clamp:   { name: '0~1 자르기', short: '',     kind: 'act',  desc: '기본 함수. 들어온 합이 0보다 작으면 0, 1보다 크면 1로 자른다.' },
    relu:    { name: 'ReLU',       short: 'ReLU', kind: 'act',  desc: '0보다 작으면 0, 크면 그대로 보낸다(최대 10). 요즘 신경망에서 가장 많이 쓰는 함수다.' },
    linear:  { name: '선형',        short: '선형',  kind: 'act',  desc: '합을 그대로 보낸다(-10~10). 선형 뉴런만 여러 층 쌓으면 결국 층 하나와 같아진다.' },
    step:    { name: '계단',        short: '계단',  kind: 'act',  desc: '합이 0.5 이상이면 1, 아니면 0. 1958년 처음 퍼셉트론이 쓴 함수다.' },
    sigmoid: { name: '시그모이드',   short: 'σ',    kind: 'act',  desc: '어떤 합이든 0~1 사이의 부드러운 S자 곡선으로 바꾼다. 합이 0이면 0.5다.' },
    tanh:    { name: 'tanh',       short: 'tanh', kind: 'act',  desc: '-1~1 사이의 S자 곡선. 시그모이드와 비슷하지만 음수도 낼 수 있다.' },
    and:     { name: 'AND 게이트',  short: 'AND',  kind: 'gate', desc: '들어온 신호(보낸 값 × 가중치)가 모두 0.5 이상이면 1, 아니면 0.' },
    or:      { name: 'OR 게이트',   short: 'OR',   kind: 'gate', desc: '들어온 신호 중 하나라도 0.5 이상이면 1.' },
    not:     { name: 'NOT 게이트',  short: 'NOT',  kind: 'gate', desc: '들어온 신호가 하나도 0.5 이상이 아니면 1. 신호가 켜지면 0.' },
    xor:     { name: 'XOR 게이트',  short: 'XOR',  kind: 'gate', desc: '0.5 이상인 신호가 홀수 개면 1.' },
    softmax: { name: '소프트맥스',   short: 'soft', kind: 'group', desc: '소프트맥스로 정한 뉴런끼리 값을 나눠 가져서 합이 1이 된다(확률처럼). 바퀴 두 개에 쓰면 속도를 나눠 가진다.' },
  };
  const FUNC_IDS = Object.keys(FUNCS);
  function applyFn(fn, sum, list, act, isMotor) {
    switch (fn) {
      case 'relu': return sum < 0 ? 0 : sum > 10 ? 10 : sum;
      case 'linear': return sum < -10 ? -10 : sum > 10 ? 10 : sum;
      case 'step': return sum >= 0.5 ? 1 : 0;
      case 'sigmoid': return 1 / (1 + Math.exp(-sum));
      case 'tanh': return Math.tanh(sum);
      case 'and': case 'or': case 'not': case 'xor': {
        let on = 0;
        for (let k = 0; k < list.length; k++) if (act[list[k][0]] * list[k][1] >= 0.5) on++;
        if (fn === 'and') return list.length && on === list.length ? 1 : 0;
        if (fn === 'or') return on > 0 ? 1 : 0;
        if (fn === 'not') return on === 0 ? 1 : 0;
        return on % 2;
      }
      default: { const hi = isMotor ? MOTOR_MAX : 1; return sum < 0 ? 0 : sum > hi ? hi : sum; }
    }
  }
  function compileBrain(brain) {
    const hidden = (brain && brain.hidden ? brain.hidden : []).map((h) => h.id);
    const outs = hidden.concat(['motorL', 'motorR', 'out', 'out2']);
    const fnMap = Object.create(null);
    for (const id of outs) { const f = brain && brain.fn && brain.fn[id]; fnMap[id] = FUNCS[f] ? f : 'clamp'; }
    const soft = outs.filter((id) => fnMap[id] === 'softmax');
    const act = Object.create(null);
    for (const id of SENSOR_IDS) act[id] = 0;
    for (const id of outs) act[id] = 0;
    const inc = Object.create(null);
    for (const id of outs) inc[id] = [];
    const sources = new Set(SENSOR_IDS.concat(hidden));
    for (const s of (brain && brain.synapses) || []) {
      if (!sources.has(s.from) || !inc[s.to] || s.from === s.to) continue;
      const w = clamp(Number(s.w) || 0, -MAX_SYNAPSE_W, MAX_SYNAPSE_W);
      inc[s.to].push([s.from, w]);
    }
    const next = Object.create(null);
    const sums = Object.create(null);
    return {
      act,
      step(inputs) {
        for (const id of SENSOR_IDS) act[id] = inputs[id] || 0;
        // 4번 되풀이해서 층이 여러 겹이어도 한 틱 안에 신호가 끝까지 닿게 한다
        for (let it = 0; it < 4; it++) {
          for (const id of outs) {
            let sum = 0;
            const list = inc[id];
            for (let k = 0; k < list.length; k++) sum += act[list[k][0]] * list[k][1];
            sums[id] = sum;
            next[id] = fnMap[id] === 'softmax' ? 0 : applyFn(fnMap[id], sum, list, act, id === 'motorL' || id === 'motorR');
          }
          if (soft.length) {
            let m = -Infinity;
            for (const id of soft) m = Math.max(m, sums[id]);
            let z = 0;
            for (const id of soft) z += Math.exp(sums[id] - m);
            for (const id of soft) next[id] = Math.exp(sums[id] - m) / z;
          }
          for (const id of outs) act[id] = next[id];
        }
      },
    };
  }

  // 좌우를 뒤집은 뇌(거울 속의 나)
  function mirrorBrain(brain) {
    const swap = (id) => {
      if (/L$/.test(id) && (SENSOR_IDS.includes(id) || id === 'motorL')) return id.slice(0, -1) + 'R';
      if (/R$/.test(id) && (SENSOR_IDS.includes(id) || id === 'motorR')) return id.slice(0, -1) + 'L';
      return id;
    };
    return {
      hidden: (brain.hidden || []).map((h) => ({ id: h.id, x: h.x, y: 1 - h.y })),
      synapses: (brain.synapses || []).map((s) => ({ from: swap(s.from), to: swap(s.to), w: s.w })),
      fn: Object.fromEntries(Object.entries(brain.fn || {}).map(([k, v]) => [swap(k), v])),
    };
  }

  // ---- 세계 만들기 --------------------------------------------------------
  function createWorld(cfg, brains) {
    const w = {
      cfg, t: 0, steps: 0, status: 'running', reason: '', winner: null,
      rng: makeRng(cfg.seed || cfg.id || 'seed'),
      allow: new Set(cfg.sensors || SENSOR_IDS),
      lightR: cfg.lightR || P.R_LIGHT,
      walls: (cfg.walls || []).map(([x, y, ww, hh]) => ({ x, y, w: ww, h: hh })),
      hazards: (cfg.hazards || []).map(([x, y, r]) => ({ x, y, r })),
      marks: (cfg.marks || []).map(([x, y, r]) => ({ x, y, r, charge: 0, done: false })),
      decoys: (cfg.decoys || []).map(([x, y, g]) => ({ x, y, g: g || 1.4 })),
      foods: [],
      foodQueue: (cfg.foodQueue || []).map((p) => p.slice()),
      foodTotal: 0,
      predators: (cfg.predators || []).map((p) => Object.assign({}, p, { x0: p.x, y0: p.y, a: p.a || 0, a0: p.a || 0, wp: 0, mode: 'patrol' })),
      creatures: [],
      events: [],
    };
    for (const f of cfg.foods || []) addFood(w, f[0], f[1]);
    if (!w.foods.length && w.foodQueue.length) spawnQueued(w);
    const starts = cfg.starts || [cfg.start];
    brains.forEach((b, i) => {
      const s = starts[i % starts.length];
      w.creatures.push({
        i, x: s.x, y: s.y, a: s.a, sx: s.x, sy: s.y, sa: s.a,
        brain: compileBrain(b), inputs: {}, vl: 0, vr: 0, eaten: 0, dist: 0, hits: 0, stun: 0, trail: [],
      });
    });
    return w;
  }

  function addFood(w, x, y) {
    w.foods.push({ x, y, born: w.t });
    w.foodTotal++;
  }
  function spawnQueued(w) {
    const p = w.foodQueue.shift();
    if (p) addFood(w, p[0], p[1]);
  }
  // 대결·연구실용: 먹이가 줄면 점대칭 위치에 한 쌍씩 새로 생긴다(공평하게)
  function spawnPair(w) {
    const margin = 50;
    for (let tries = 0; tries < 40; tries++) {
      const x = margin + w.rng() * (W - 2 * margin);
      const y = margin + w.rng() * (H - 2 * margin);
      const mx = W - x, my = H - y;
      if (Math.hypot(x - mx, y - my) < 80) continue;
      if (!spotFree(w, x, y) || !spotFree(w, mx, my)) continue;
      addFood(w, x, y);
      addFood(w, mx, my);
      return true;
    }
    return false;
  }
  function spotFree(w, x, y) {
    for (const r of w.walls) if (circleRectDist(x, y, r) < 28) return false;
    for (const h of w.hazards) if (Math.hypot(x - h.x, y - h.y) < h.r + 40) return false;
    for (const c of w.creatures) if (Math.hypot(x - c.x, y - c.y) < 90) return false;
    for (const f of w.foods) if (Math.hypot(x - f.x, y - f.y) < 60) return false;
    return true;
  }

  // ---- 감각 ---------------------------------------------------------------
  function lurePos(p) { return { x: p.x + Math.cos(p.a) * p.lure, y: p.y + Math.sin(p.a) * p.lure }; }

  function lightSources(w) {
    const L = [];
    const R = w.lightR;
    for (const f of w.foods) L.push(f.x, f.y, 1, R);
    for (const m of w.marks) if (!m.done) L.push(m.x, m.y, P.MARK_GAIN, P.MARK_R_LIGHT);
    for (const d of w.decoys) L.push(d.x, d.y, d.g, R);
    for (const p of w.predators) { const lp = lurePos(p); L.push(lp.x, lp.y, p.lureGain || 1.35, R); }
    return L;
  }
  function dangerSources(w) {
    const D = [];
    for (const h of w.hazards) D.push(h.x, h.y, h.r);
    for (const p of w.predators) D.push(p.x, p.y, p.r);
    return D;
  }

  function eyeValue(w, c, axis, L) {
    let best = 0;
    for (let k = 0; k < L.length; k += 4) {
      const dx = L[k] - c.x, dy = L[k + 1] - c.y;
      const d = Math.hypot(dx, dy) / L[k + 3];
      const dir = Math.pow((1 + Math.cos(angDiff(Math.atan2(dy, dx), axis))) / 2, P.EYE_POW);
      const v = (L[k + 2] * dir) / (1 + d * d);
      if (v > best) best = v;
    }
    return best > 1 ? 1 : best;
  }
  function feelValue(c, axis, D) {
    let best = 0;
    for (let k = 0; k < D.length; k += 3) {
      const dx = D[k] - c.x, dy = D[k + 1] - c.y;
      const d = Math.max(0, Math.hypot(dx, dy) - D[k + 2] - P.BODY_R);
      const dir = (1 + Math.cos(angDiff(Math.atan2(dy, dx), axis))) / 2;
      if (d >= P.FEEL_LEN) continue;
      // 가까울수록 세지고, 더듬이 길이(FEEL_LEN) 밖은 0
      const q = d / P.R_DANGER, qe = P.FEEL_LEN / P.R_DANGER;
      const tail = 1 / (1 + qe * qe);
      const v = (dir * (1 / (1 + q * q) - tail)) / (1 - tail);
      if (v > best) best = v;
    }
    return best > 1 ? 1 : best;
  }
  function rayRect(x, y, dx, dy, r) {
    let tmin = -Infinity, tmax = Infinity;
    if (Math.abs(dx) < 1e-9) { if (x < r.x || x > r.x + r.w) return null; }
    else {
      let t1 = (r.x - x) / dx, t2 = (r.x + r.w - x) / dx;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    }
    if (Math.abs(dy) < 1e-9) { if (y < r.y || y > r.y + r.h) return null; }
    else {
      let t1 = (r.y - y) / dy, t2 = (r.y + r.h - y) / dy;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    }
    if (tmax < Math.max(tmin, 0)) return null;
    return tmin >= 0 ? tmin : 0;
  }
  function rayDist(w, x, y, ang, maxLen) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let t = maxLen;
    if (dx > 1e-9) t = Math.min(t, (W - x) / dx); else if (dx < -1e-9) t = Math.min(t, -x / dx);
    if (dy > 1e-9) t = Math.min(t, (H - y) / dy); else if (dy < -1e-9) t = Math.min(t, -y / dy);
    for (const r of w.walls) {
      const hit = rayRect(x, y, dx, dy, r);
      if (hit !== null && hit < t) t = hit;
    }
    return Math.max(0, t);
  }
  function whiskValue(w, c, axis) {
    const d = rayDist(w, c.x, c.y, axis, P.WHISK_LEN);
    return clamp(1 - (d - P.BODY_R) / (P.WHISK_LEN - P.BODY_R), 0, 1);
  }

  function sense(w, c) {
    const inp = c.inputs;
    const L = lightSources(w), D = dangerSources(w);
    inp.bias = 1;
    inp.eyeL = eyeValue(w, c, c.a - P.EYE_ANG, L);
    inp.eyeR = eyeValue(w, c, c.a + P.EYE_ANG, L);
    inp.feelL = feelValue(c, c.a - P.FEEL_ANG, D);
    inp.feelR = feelValue(c, c.a + P.FEEL_ANG, D);
    inp.whiskL = whiskValue(w, c, c.a - P.WHISK_ANG);
    inp.whiskR = whiskValue(w, c, c.a + P.WHISK_ANG);
    for (const id of SENSOR_IDS) if (!w.allow.has(id)) inp[id] = 0;
    return inp;
  }

  // ---- 충돌 ---------------------------------------------------------------
  function circleRectDist(x, y, r) {
    const cx = clamp(x, r.x, r.x + r.w), cy = clamp(y, r.y, r.y + r.h);
    return Math.hypot(x - cx, y - cy);
  }
  // 벽 밖으로 밀어내고, 부딪힌 면의 바깥쪽 방향(법선)을 합쳐서 돌려준다
  const _n = { x: 0, y: 0, hit: false };
  function pushOut(o, rad, w) {
    _n.x = 0; _n.y = 0; _n.hit = false; _n.edge = false;
    for (const r of w.walls) {
      const cx = clamp(o.x, r.x, r.x + r.w), cy = clamp(o.y, r.y, r.y + r.h);
      const dx = o.x - cx, dy = o.y - cy;
      const d = Math.hypot(dx, dy);
      if (d >= rad) continue;
      _n.hit = true;
      if (d > 1e-6) { o.x = cx + (dx / d) * rad; o.y = cy + (dy / d) * rad; _n.x += dx / d; _n.y += dy / d; }
      else {
        // 중심이 벽 안에 들어간 경우: 가장 가까운 면으로 밀어낸다
        const left = o.x - r.x, right = r.x + r.w - o.x, top = o.y - r.y, bottom = r.y + r.h - o.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) { o.x = r.x - rad; _n.x -= 1; } else if (m === right) { o.x = r.x + r.w + rad; _n.x += 1; }
        else if (m === top) { o.y = r.y - rad; _n.y -= 1; } else { o.y = r.y + r.h + rad; _n.y += 1; }
      }
    }
    // 바깥 수조 벽(유리)은 미끄럽다: 법선은 이것만 모은다. 안쪽 바위벽은 미끄러지지 않는다.
    let ex = 0, ey = 0;
    if (o.x < rad) { o.x = rad; ex += 1; } else if (o.x > W - rad) { o.x = W - rad; ex -= 1; }
    if (o.y < rad) { o.y = rad; ey += 1; } else if (o.y > H - rad) { o.y = H - rad; ey -= 1; }
    if (ex || ey) { _n.hit = true; _n.edge = true; _n.ex = ex; _n.ey = ey; }
    return _n;
  }
  // 벽에 박히면 몸이 벽을 따라 미끄러지도록 머리 방향을 벽과 나란하게 돌린다
  function slideAlong(c, n) {
    const len = Math.hypot(n.x, n.y);
    if (len < 1e-9) return;
    const nx = n.x / len, ny = n.y / len;
    const dx = Math.cos(c.a), dy = Math.sin(c.a);
    const dot = dx * nx + dy * ny;
    if (dot >= 0) return;
    let tx = dx - dot * nx, ty = dy - dot * ny;
    if (Math.hypot(tx, ty) < 1e-3) { tx = -ny; ty = nx; }
    c.a = Math.atan2(ty, tx);
  }

  // ---- 포식자(아귀) ----------------------------------------------------------
  function movePredator(w, p) {
    let target = null, best = Infinity;
    for (const c of w.creatures) {
      if (c.stun > 0) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < best) { best = d; target = c; }
    }
    let tx, ty, speed;
    if (target && best < p.sense) { p.mode = 'chase'; tx = target.x; ty = target.y; speed = p.chase; }
    else {
      p.mode = 'patrol';
      const wp = p.path[p.wp];
      tx = wp[0]; ty = wp[1]; speed = p.patrol;
      if (Math.hypot(tx - p.x, ty - p.y) < 14) p.wp = (p.wp + 1) % p.path.length;
    }
    const want = Math.atan2(ty - p.y, tx - p.x);
    const maxTurn = p.turn * DT;
    p.a += clamp(angDiff(want, p.a), -maxTurn, maxTurn);
    p.x += Math.cos(p.a) * speed * DT;
    p.y += Math.sin(p.a) * speed * DT;
    pushOut(p, p.r, w);
  }

  // ---- 한 틱 -----------------------------------------------------------------
  function hit(w, c, kind) {
    const mode = w.cfg.hazardMode || 'fail';
    w.events.push({ type: 'hit', kind, x: c.x, y: c.y, i: c.i });
    if (mode === 'fail') {
      finish(w, 'fail', kind === 'predator' ? '아귀에게 잡아먹혔어요' : '가시에 찔렸어요');
      return;
    }
    if (mode === 'count') {
      // 보상 실험용: 찔린 횟수만 세고 그 자리에서 계속 간다(시간 손해가 없어서 벌점이 없으면 가시를 신경 쓰지 않는다)
      c.hits++;
      c.hitCool = 0.8;
      return;
    }
    // 'stun': 출발점으로 돌아가 1초 동안 멈춘다
    c.hits++;
    c.x = c.sx; c.y = c.sy; c.a = c.sa; c.stun = 1;
    c.trail.length = 0;
    if (kind === 'predator') for (const p of w.predators) { p.x = p.x0; p.y = p.y0; p.a = p.a0; p.wp = 0; }
  }

  function step(w) {
    if (w.status !== 'running') return;
    w.t += DT;
    w.steps++;
    for (const p of w.predators) movePredator(w, p);
    for (const c of w.creatures) {
      sense(w, c);
      c.brain.step(c.inputs);
      if (c.stun > 0) { c.stun -= DT; continue; }
      let vl = Math.max(0, c.brain.act.motorL), vr = Math.max(0, c.brain.act.motorR); // 바퀴는 뒤로 돌지 않는다
      const top = vl > vr ? vl : vr;
      if (top > 1) { vl /= top; vr /= top; }
      c.vl = vl; c.vr = vr;
      const v = ((vl + vr) / 2) * P.MAX_SPEED;
      c.a += (vl - vr) * P.TURN_GAIN * DT;
      if (c.a > Math.PI) c.a -= 2 * Math.PI; else if (c.a < -Math.PI) c.a += 2 * Math.PI;
      const ox = c.x, oy = c.y;
      c.x += Math.cos(c.a) * v * DT;
      c.y += Math.sin(c.a) * v * DT;
      const n = pushOut(c, P.BODY_R, w);
      if (n.hit) c.bump = (c.bump || 0) + 1;
      if (n.edge) slideAlong(c, { x: n.ex, y: n.ey });
      c.dist += Math.hypot(c.x - ox, c.y - oy);
      if (w.steps % 5 === 0) { c.trail.push(c.x, c.y); if (c.trail.length > 240) c.trail.splice(0, 2); }

      for (let k = w.foods.length - 1; k >= 0; k--) {
        const f = w.foods[k];
        if (Math.hypot(f.x - c.x, f.y - c.y) < P.EAT_R) {
          w.foods.splice(k, 1);
          c.eaten++;
          w.events.push({ type: 'eat', x: f.x, y: f.y, i: c.i });
          if (w.foodQueue.length) spawnQueued(w);
          else if (w.cfg.respawn && w.foods.length <= (w.cfg.respawn.min || 2)) spawnPair(w);
        }
      }
      for (const m of w.marks) {
        if (m.done) continue;
        const inside = Math.hypot(m.x - c.x, m.y - c.y) < m.r;
        m.charge = clamp(m.charge + (inside ? P.CHARGE_RATE : -P.CHARGE_DECAY) * DT, 0, 1);
        if (m.charge >= 1) { m.done = true; w.events.push({ type: 'charged', x: m.x, y: m.y, i: c.i }); }
      }
      if (c.hitCool > 0) c.hitCool -= DT;
      else for (const h of w.hazards) {
        if (Math.hypot(h.x - c.x, h.y - c.y) < h.r + P.BODY_R * 0.8) { hit(w, c, 'hazard'); break; }
      }
      if (w.status !== 'running') return;
      for (const p of w.predators) {
        if (Math.hypot(p.x - c.x, p.y - c.y) < p.r + P.BODY_R * 0.8) { hit(w, c, 'predator'); break; }
      }
      if (w.status !== 'running') return;
    }
    checkGoal(w);
  }

  function finish(w, status, reason) {
    if (w.status !== 'running') return;
    w.status = status;
    w.reason = reason || '';
    w.events.push({ type: 'finish', status });
  }

  function checkGoal(w) {
    const g = w.cfg.goal || { type: 'free' };
    const c = w.creatures[0];
    if (g.type === 'eat' && c.eaten >= g.n) return finish(w, 'success');
    if (g.type === 'charge' && w.marks.length && w.marks.every((m) => m.done)) return finish(w, 'success');
    if (w.t >= w.cfg.timeLimit - 1e-9) {
      if (g.type === 'versus') {
        const [a, b] = w.creatures;
        w.winner = a.eaten > b.eaten ? 0 : b.eaten > a.eaten ? 1 : -1;
        return finish(w, 'done');
      }
      if (g.type === 'free') return finish(w, 'done');
      return finish(w, 'fail', '시간이 다 됐어요');
    }
  }

  // 화면 없이 끝까지 돌려 본다(테스트·대결 미리 계산용)
  function runHeadless(cfg, brains, maxSeconds) {
    const w = createWorld(cfg, brains);
    const limit = Math.ceil((maxSeconds || cfg.timeLimit + 1) / DT);
    for (let i = 0; i < limit && w.status === 'running'; i++) { step(w); w.events.length = 0; }
    return w;
  }

  // ---- 강화학습: 사람이 정한 보상으로 시행착오 학습 --------------------------------
  // 보상 = Σ (사건 점수 × 사건 횟수). 사건은 아래 6가지. 점수는 실험 화면에서 사람이 정한다.
  const REWARD_EVENTS = {
    eat:   { name: '먹이를 먹으면',      unit: '1개마다',   desc: '먹이를 하나 먹을 때마다.' },
    near:  { name: '먹이에 가까워지면',  unit: '100px마다', desc: '가장 가까운 먹이와의 거리가 100px 줄어들 때마다.' },
    hit:   { name: '가시에 찔리면',      unit: '1번마다',   desc: '가시에 닿아 출발점으로 돌아갈 때마다.' },
    move:  { name: '움직이면',          unit: '100px마다', desc: '어느 쪽으로든 100px 움직일 때마다.' },
    bump:  { name: '벽에 부딪히면',      unit: '1번마다',   desc: '벽이나 수조 가장자리에 새로 닿을 때마다.' },
    alive: { name: '시간이 지나면',      unit: '1초마다',   desc: '1초가 지날 때마다(그냥 살아 있기만 해도).' },
  };
  // 학습하는 뇌의 모양: 쓸 수 있는 감각 → 두 바퀴, 모두 잇는다. theta는 그 가중치들.
  function rlPairs(sensors) {
    const out = [];
    for (const sId of sensors) for (const m of ['motorL', 'motorR']) out.push([sId, m]);
    return out;
  }
  function rlBrain(sensors, theta) {
    return { hidden: [], synapses: rlPairs(sensors).map(([from, to], k) => ({ from, to, w: Math.round((theta[k] || 0) * 100) / 100 })) };
  }
  function nearestFoodDist(w, c) {
    let best = null;
    for (const f of w.foods) { const d = Math.hypot(f.x - c.x, f.y - c.y); if (best === null || d < best) best = d; }
    return best;
  }
  // 한 판 돌려서 사건 횟수와 보상을 센다. objective=true면 진짜 목표(먹이 n개)로 끝낸다.
  function runEpisode(cfg, brain, rw, objective) {
    const ecfg = Object.assign({}, cfg, { hazardMode: 'count', goal: objective ? cfg.goal : { type: 'free' } });
    const w = createWorld(ecfg, [brain]);
    const c = w.creatures[0];
    let near = 0, bumps = 0, lastBump = 0, touching = false, prevD = nearestFoodDist(w, c), prevEat = 0;
    const limit = Math.ceil(cfg.timeLimit / DT);
    for (let i = 0; i < limit && w.status === 'running'; i++) {
      step(w);
      w.events.length = 0;
      const d = nearestFoodDist(w, c);
      if (c.eaten !== prevEat || c.stun > 0) { prevD = d; prevEat = c.eaten; }
      else if (d !== null && prevD !== null) { if (d < prevD) near += prevD - d; prevD = d; }
      const b = c.bump || 0, now = b > lastBump;
      if (now && !touching) bumps++;
      touching = now; lastBump = b;
    }
    const stats = { eat: c.eaten, near: near / 100, hit: c.hits, move: c.dist / 100, bump: bumps, alive: w.t };
    let reward = 0;
    for (const k in rw) reward += (rw[k] || 0) * (stats[k] || 0);
    return { reward, stats, world: w };
  }
  function objectiveOk(cfg, ep) {
    return ep.world.status === 'success' && (cfg.maxHits == null || ep.stats.hit <= cfg.maxHits);
  }
  // 시행착오 1세대: 지금 뇌를 조금씩 흔든 후보 K개를 시험해서, 보상이 더 큰 것이 있으면 바꾼다.
  function rlInit(cfg) {
    const n = rlPairs(cfg.sensors).length;
    return { theta: new Array(n).fill(0), bestR: null, gen: 0, history: [], seed: cfg.id };
  }
  // 후보 하나를 출발 방향 두 개로 시험해 평균 보상을 낸다(한 번의 운에 덜 휘둘리게)
  function rlScore(cfg, theta, rw) {
    const brain = rlBrain(cfg.sensors, theta);
    let sum = 0;
    for (const da of [-0.25, 0.25]) {
      const c2 = Object.assign({}, cfg, { start: Object.assign({}, cfg.start, { a: cfg.start.a + da }) });
      sum += runEpisode(c2, brain, rw).reward;
    }
    return sum / 2;
  }
  function rlGeneration(cfg, st, rw, sigma) {
    const K = cfg.children || 6;
    if (st.bestR === null) st.bestR = rlScore(cfg, st.theta, rw);
    const rng = makeRng(st.seed + ':' + st.gen + ':' + sigma);
    let bestR = st.bestR, bestT = st.theta, improved = false;
    for (let k = 0; k < K; k++) {
      const cand = st.theta.map((v) => {
        const u = Math.max(1e-9, rng()), v2 = rng();
        const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v2);
        return clamp(v + sigma * z, -MAX_SYNAPSE_W, MAX_SYNAPSE_W);
      });
      const r = rlScore(cfg, cand, rw);
      if (r > bestR + 1e-9) { bestR = r; bestT = cand; improved = true; }
    }
    st.theta = bestT; st.bestR = bestR; st.gen++;
    st.history.push(bestR);
    return improved;
  }

  // 별 조건 계산: [성공, 조건2, 조건3]
  function evalStars(stage, world, brain) {
    const ok = world.status === 'success';
    const res = [ok];
    for (const cond of stage.stars || []) res.push(ok && checkCond(cond, world, brain));
    return res;
  }
  // 실제로 "거쳐 간" 히든 뉴런 수: 들어오는 선과 나가는 선이 모두 있는 것만 센다
  function usedHidden(brain) {
    const syn = brain.synapses || [];
    return (brain.hidden || []).filter((h) => syn.some((s) => s.to === h.id) && syn.some((s) => s.from === h.id)).length;
  }
  function checkCond(cond, world, brain) {
    const syn = (brain.synapses || []).length, hid = usedHidden(brain);
    if (cond.type === 'synapses') return syn <= cond.max;
    if (cond.type === 'time') return world.t <= cond.max + 1e-9;
    if (cond.type === 'hidden') return hid >= cond.min;
    if (cond.type === 'noHidden') return hid === 0;
    if (cond.type === 'epochs') return world.epochs <= cond.max;
    if (cond.type === 'epochsAtLeast') return world.epochs >= cond.min;
    if (cond.type === 'rates') return (world.rates || 0) >= cond.min;
    if (cond.type === 'unitWeights') return (brain.synapses || []).every((s) => Math.abs(Math.abs(s.w) - 1) < 1e-9);
    if (cond.type === 'gens') return world.gens <= cond.max;
    if (cond.type === 'rules') return (world.rules || 0) <= cond.max;
    return false;
  }
  function condText(cond) {
    if (cond.type === 'synapses') return `시냅스 ${cond.max}개 이하`;
    if (cond.type === 'time') return `${cond.max}초 안에`;
    if (cond.type === 'hidden') return `히든 뉴런 ${cond.min}개 이상 거치기`;
    if (cond.type === 'noHidden') return '히든 뉴런 없이';
    if (cond.type === 'epochs') return `${cond.max}번 안에 배우기`;
    if (cond.type === 'epochsAtLeast') return `${cond.min}번 이상 학습시켜 보기`;
    if (cond.type === 'rates') return `학습률을 ${cond.min}가지 이상 써 보기`;
    if (cond.type === 'unitWeights') return '가중치는 +1과 -1만 쓰기';
    if (cond.type === 'gens') return `${cond.max}세대 안에 배우기`;
    if (cond.type === 'rules') return `점수 규칙 ${cond.max}개 이하로`;
    return '';
  }

  // ---- 진리표(논리 실험) ----------------------------------------------------
  // rows: [[A, B, 목표], ...]. 출력 0.5 이상이면 1로 읽는다.
  // 한 줄 = [입력들..., 목표들...]. 입력은 cfg.inputs(기본 A, B), 목표는 cfg.outputs(기본 출력 하나) 순서.
  function evalRow(brain, row, cfg) {
    const ins = (cfg && cfg.inputs) || ['inA', 'inB'];
    const outs = (cfg && cfg.outputs) || ['out'];
    const rt = typeof brain.step === 'function' ? brain : compileBrain(brain);
    const inp = { bias: 1 };
    ins.forEach((id, k) => { inp[id] = row[k]; });
    rt.step(inp);
    const ys = outs.map((id) => rt.act[id]);
    const ok = ys.every((y, k) => (y >= 0.5 ? 1 : 0) === row[ins.length + k]);
    return { y: ys[0], ys, ok, act: Object.assign({}, rt.act) };
  }
  function evalLogic(cfg, brain) {
    const rows = cfg.rows.map((r) => Object.assign({ row: r }, evalRow(brain, r, cfg)));
    return { rows, ok: rows.every((r) => r.ok) };
  }

  // ---- 학습(스스로 배우는 뉴런) ------------------------------------------------
  // 오차 = 목표 - 출력. 각 시냅스는 "학습률 × 오차 × 그 시냅스로 들어온 신호"만큼 바뀐다(델타 규칙).
  // 히든 뉴런이 있으면 오차를 거꾸로 나눠 보낸다(역전파). 활성 함수는 0~1 자르기라서
  // 0과 1 사이에 있을 때만 기울기가 1이다.
  function trainEpoch(cfg, brain, lr) {
    const hidden = (brain.hidden || []).map((h) => h.id);
    let loss = 0;
    for (const row of cfg.rows) {
      const inp = { bias: 1, inA: row[0], inB: row[1] };
      // 앞으로 계산
      const act = Object.assign({}, inp);
      const sumOf = (id) => brain.synapses.filter((s) => s.to === id).reduce((a, s) => a + (act[s.from] || 0) * s.w, 0);
      const pre = {};
      for (const h of hidden) { pre[h] = sumOf(h); act[h] = clamp(pre[h], 0, 1); }
      pre.out = sumOf('out');
      act.out = clamp(pre.out, 0, 1);
      const err = row[2] - act.out;
      loss += err * err;
      // 뒤로: 출력의 오차를 히든 뉴런에 나눠 준다(출력은 잘려도 학습 신호는 흘려 보낸다)
      const delta = { out: err };
      for (const h of hidden) {
        const back = brain.synapses.filter((s) => s.from === h && s.to === 'out').reduce((a, s) => a + s.w * err, 0);
        delta[h] = pre[h] > 0 && pre[h] < 1 ? back : 0;
      }
      for (const s of brain.synapses) {
        const d = delta[s.to];
        if (d) s.w = clamp(s.w + lr * d * (act[s.from] || 0), -MAX_SYNAPSE_W, MAX_SYNAPSE_W);
      }
    }
    return loss / cfg.rows.length;
  }
  function lossOf(cfg, brain) {
    return cfg.rows.reduce((a, r) => { const e = r[2] - evalRow(brain, r, cfg).y; return a + e * e; }, 0) / cfg.rows.length;
  }

  SA.sim = {
    P, W, H, DT, MAX_SYNAPSE_W, MOTOR_MAX, FUNCS, FUNC_IDS,
    SENSORS, MOTORS, SENSOR_IDS,
    clamp, angDiff, makeRng,
    compileBrain, mirrorBrain, createWorld, step, runHeadless, lurePos,
    evalStars, condText, checkCond, usedHidden,
    evalRow, evalLogic, trainEpoch, lossOf,
    REWARD_EVENTS, rlPairs, rlBrain, runEpisode, objectiveOk, rlInit, rlGeneration,
  };
})();
