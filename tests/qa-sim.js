// 시냅스 아레나 — 헤드리스 QA
// 실행: node tests/qa-sim.js
// 1) 모든 실험이 모범 답안 뇌로 풀리는지  2) 빈 뇌·쉬운 꼼수로는 안 풀리는지
// 3) 별 조건을 모범 답안이 달성하는지     4) 결정론(같은 입력 → 같은 결과)
// 5) 대결 모드에서 라이벌끼리 겨뤄 난이도 순서가 맞는지
// 6) 0~10장 모든 실험이 "정답 보기" 답으로 별 3개, 빈 답으로는 실패하는지  7) 힌트에 적은 수치가 맞는지
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'js', 'sim.js'));
require(path.join(__dirname, '..', 'js', 'content.js'));
const { sim, content } = globalThis.SA;
const { B, ARENA_STAGES, LOGIC_STAGES, TRAIN_STAGES, RIVALS, VERSUS_ARENAS, LAB_ARENAS, RATES } = content;
const STAGES = ARENA_STAGES;

// 모범 답안 = 게임의 "정답 보기"와 같은 뇌
const SOLUTIONS = Object.fromEntries(ARENA_STAGES.map((st) => [st.id, st.solution]));

// 이 뇌들로는 풀리면 안 된다(실험이 너무 쉬워지는 꼼수 확인)
const CHEATS = {
  empty: B(),
  forward: B('bias>motorL:1', 'bias>motorR:1'),
  aggressor: B('eyeL>motorR:1.5', 'eyeR>motorL:1.5', 'bias>motorL:0.4', 'bias>motorR:0.4'),
  coward: B('eyeL>motorR:1.5', 'eyeR>motorL:1.5', 'bias>motorL:0.4', 'bias>motorR:0.4', 'feelL>motorL:2', 'feelR>motorR:2'),
};
const MUST_FAIL = {
  s2: ['empty', 'forward'],
  s3: ['empty', 'forward', 'aggressor'],
  s4: ['empty', 'forward'],
  s5: ['empty', 'forward', 'aggressor'],
  s6: ['empty', 'aggressor', 'coward'],
  s7: ['empty', 'aggressor', 'coward'],
};

let failures = 0;
function check(ok, msg) {
  console.log((ok ? '  ok   ' : '  FAIL ') + msg);
  if (!ok) failures++;
}
const fmt = (w) => `${w.status}${w.reason ? '(' + w.reason + ')' : ''} t=${w.t.toFixed(2)}s 먹이=${w.creatures[0].eaten}`;

console.log('■ 실험 풀이');
for (const st of STAGES) {
  const sol = SOLUTIONS[st.id];
  // 실험이 허락한 센서·숨은 뉴런 수를 지키는지
  const usesOnly = sol.synapses.every((s) => !sim.SENSOR_IDS.includes(s.from) || st.sensors.includes(s.from));
  check(usesOnly && sol.hidden.length <= st.maxHidden, `${st.id} 모범 답안이 허락된 센서·숨은 뉴런만 씀`);
  const w = sim.runHeadless(st, [sol]);
  check(w.status === 'success', `${st.id} ${st.title}: 모범 답안 → ${fmt(w)}`);
  const stars = sim.evalStars(st, w, sol);
  check(stars.every(Boolean), `${st.id} 모범 답안 별 ${stars.filter(Boolean).length}/3 (${(st.stars || []).map(sim.condText).join(', ')})`);
  for (const name of MUST_FAIL[st.id] || []) {
    const cw = sim.runHeadless(st, [CHEATS[name]]);
    check(cw.status !== 'success', `${st.id} 꼼수 "${name}"로는 못 깸 → ${fmt(cw)}`);
  }
}

console.log('■ 모범 답안 주변도 풀리는지 (가중치 ±0.2 흔들기)');
for (const st of STAGES) {
  const sol = SOLUTIONS[st.id];
  // 좌우 짝(왼눈→오른바퀴 / 오른눈→왼바퀴)은 함께 흔든다. 사람이 만드는 뇌는 보통 좌우 대칭이라서.
  const mirror = sim.mirrorBrain(sol).synapses;
  const groups = [];
  sol.synapses.forEach((syn, idx) => {
    if (groups.some((g) => g.includes(idx))) return;
    const m = mirror[idx];
    const j = sol.synapses.findIndex((t, k) => k !== idx && t.from === m.from && t.to === m.to);
    groups.push(j >= 0 ? [idx, j] : [idx]);
  });
  let ok = 0, n = 0;
  for (const g of groups) {
    for (const d of [-0.2, 0.2]) {
      const b = JSON.parse(JSON.stringify(sol));
      for (const idx of g) b.synapses[idx].w = +(b.synapses[idx].w + d).toFixed(2);
      n++;
      if (sim.runHeadless(st, [b]).status === 'success') ok++;
    }
  }
  check(ok / n >= 0.75, `${st.id} 흔든 뇌 ${ok}/${n} 성공`);
}

console.log('■ 결정론');
for (const st of STAGES) {
  const a = sim.runHeadless(st, [SOLUTIONS[st.id]]);
  const b = sim.runHeadless(st, [SOLUTIONS[st.id]]);
  const c0 = a.creatures[0], c1 = b.creatures[0];
  check(a.t === b.t && c0.x === c1.x && c0.y === c1.y, `${st.id} 두 번 돌려도 같은 결과`);
}

console.log('■ 대결 (2라운드, 자리 바꿔 합산)');
function match(arena, brainA, brainB) {
  const r1 = sim.runHeadless(arena, [brainA, brainB]);
  const r2 = sim.runHeadless(arena, [brainB, brainA]);
  const a = r1.creatures[0].eaten + r2.creatures[1].eaten;
  const b = r1.creatures[1].eaten + r2.creatures[0].eaten;
  for (const w of [r1, r2]) for (const c of w.creatures) if (!Number.isFinite(c.x + c.y)) throw new Error('NaN position');
  return [a, b];
}
for (const arena of VERSUS_ARENAS) {
  const solo = RIVALS.map((r) => sim.runHeadless(Object.assign({}, arena), [r.brain, B()]).creatures[0].eaten);
  console.log(`  [${arena.title}] 혼자 먹은 수: ` + RIVALS.map((r, i) => `${r.name} ${solo[i]}`).join(' · '));
  const table = [];
  for (let i = 0; i < RIVALS.length; i++) {
    for (let j = i + 1; j < RIVALS.length; j++) {
      const [a, b] = match(arena, RIVALS[i].brain, RIVALS[j].brain);
      table.push(`${RIVALS[i].name} ${a}:${b} ${RIVALS[j].name}`);
    }
  }
  console.log('   ' + table.join(' | '));
  const [m1, m2] = match(arena, RIVALS[3].brain, sim.mirrorBrain(RIVALS[3].brain));
  console.log(`   거울: 부엉이 ${m1}:${m2} 거울 부엉이`);
}
const byId = Object.fromEntries(RIVALS.map((r) => [r.id, r.brain]));
for (const a of VERSUS_ARENAS) {
  // 불나방은 수염이 없어서 기둥 숲에서는 약하다(일부러 그렇게 만든 성격). 들판에서만 해파리를 이기면 된다.
  const pairs = [['owl', 'jelly'], ['owl', 'pillbug'], ['pillbug', 'jelly']];
  if (a.id === 'vs-field') pairs.push(['moth', 'jelly']);
  for (const [hi, lo] of pairs) {
    const [x, y] = match(a, byId[hi], byId[lo]);
    check(x > y, `[${a.title}] ${hi} 가 ${lo} 를 이김 (${x}:${y})`);
  }
  const [o, m] = match(a, byId.owl, byId.moth);
  check(o >= m, `[${a.title}] owl 이 moth 에게 지지 않음 (${o}:${m})`);
}
const owlBeatsMoth = VERSUS_ARENAS.some((a) => { const [o, m] = match(a, byId.owl, byId.moth); return o > m; });
check(owlBeatsMoth, '부엉이가 불나방을 적어도 한 아레나에서 이김');

console.log('■ 연구실 아레나');
for (const arena of LAB_ARENAS) {
  const w = sim.runHeadless(arena, [SOLUTIONS.s7]);
  check(w.status === 'done' && Number.isFinite(w.creatures[0].x), `${arena.title}: 60초 완주, 먹이 ${w.creatures[0].eaten}, 찔림/잡힘 ${w.creatures[0].hits}`);
}

console.log('■ 뇌 안전성 (이상한 입력)');
const weird = { hidden: [{ id: 'h1', x: 0.5, y: 0.5 }], synapses: [
  { from: 'h1', to: 'h1', w: 3 }, { from: 'nope', to: 'motorL', w: 1 }, { from: 'bias', to: 'eyeL', w: 1 },
  { from: 'bias', to: 'motorL', w: 'abc' }, { from: 'bias', to: 'motorR', w: 1e9 }] };
const ww = sim.runHeadless(ARENA_STAGES[0], [weird]);
check(Number.isFinite(ww.creatures[0].x), '자기 연결·없는 뉴런·문자 가중치·거대한 가중치에도 멀쩡함');

console.log('■ 1장 진리표 실험');
for (const st of LOGIC_STAGES) {
  const r = sim.evalLogic(st, st.solution);
  check(r.ok, `${st.id} ${st.title}: 정답 뇌가 모든 줄을 맞힘`);
  const stars = sim.evalStars(st, { status: r.ok ? 'success' : 'fail' }, st.solution);
  check(stars.every(Boolean), `${st.id} 정답 뇌 별 ${stars.filter(Boolean).length}/3`);
  check(!sim.evalLogic(st, B()).ok, `${st.id} 빈 뇌로는 못 깸`);
}
// XOR은 출력 뉴런 하나로는 어떤 가중치로도 안 된다(무작위 2만 번 시도)
{
  const xor = LOGIC_STAGES.find((s) => s.id === 'L5');
  const rng = sim.makeRng('xor');
  let found = false;
  for (let i = 0; i < 20000 && !found; i++) {
    const b = B(`inA>out:${(rng() * 6 - 3).toFixed(2)}`, `inB>out:${(rng() * 6 - 3).toFixed(2)}`, `bias>out:${(rng() * 6 - 3).toFixed(2)}`);
    found = sim.evalLogic(xor, b).ok;
  }
  check(!found, 'L5 XOR은 숨은 뉴런 없이 풀리지 않음');
}

console.log('■ 3장 학습 실험');
function trainRun(st, lr, max = 200) {
  const b = JSON.parse(JSON.stringify(st.init));
  for (let e = 1; e <= max; e++) { sim.trainEpoch(st, b, lr); if (sim.evalLogic(st, b).ok) return e; }
  return null;
}
for (const st of TRAIN_STAGES) {
  const e = trainRun(st, st.solution.lr);
  if (st.goal && st.goal.type === 'epochsAtLeast') {
    check(RATES.every((lr) => trainRun(st, lr) === null), `${st.id} ${st.title}: 어떤 학습률로도 200번 안에 못 배움`);
  } else {
    check(e !== null, `${st.id} ${st.title}: 추천 학습률 ${st.solution.lr}로 ${e}번 만에 배움`);
    const stars = sim.evalStars(st, { status: 'success', epochs: e, rates: 1 }, st.init);
    check(stars.every(Boolean), `${st.id} 추천 학습률이면 별 3개 (${(st.stars || []).map(sim.condText).join(', ')})`);
  }
}
check(trainRun(TRAIN_STAGES[1], 3) === null, 'T2 학습률 3은 너무 커서 못 배움(힌트와 일치)');

// ===================================================================
// 모든 장: "정답 보기"와 같은 답으로 풀리고 별 3개를 받는지, 빈 답으로는 안 풀리는지
// ===================================================================
const ALL = content.STAGES;
const pass = (cfg, wl, brain) => sim.evalStars(cfg, wl, brain);
const allStars = (arr) => arr.every(Boolean);
const emptyB = () => ({ hidden: [], synapses: [] });
const fixedIds = (st) => Array.from({ length: st.fixedHidden || 0 }, (_, i) => 'h' + (i + 1));
const usesAllowed = (st, b) => b.synapses.every((x) => (!sim.SENSOR_IDS.includes(x.from) || (st.sensors || []).includes(x.from)) && (st.outputs || []).concat((b.hidden || []).map((h) => h.id)).includes(x.to))
  && (b.hidden || []).length <= (st.maxHidden || 0);
const noSkipOk = (st, b) => !st.noSkip || b.synapses.every((x) => !(st.inputs || []).includes(x.from) || /^h\d+$/.test(x.to));

console.log('■ 모든 장의 실험 (정답 보기 = 별 3개, 빈 답 = 실패)');
for (const st of ALL) {
  const tag = `${st.code} ${st.title}`;
  if (st.type === 'logic') {
    const sol = st.solution;
    check(usesAllowed(st, sol) && noSkipOk(st, sol), `${tag}: 정답 뇌가 허락된 입력·출력·히든 뉴런만 씀`);
    const r = sim.evalLogic(st, sol);
    let testAcc = null;
    if (st.test) { const t = sim.evalLogic({ rows: st.test, inputs: st.inputs, outputs: st.outputs }, sol); testAcc = t.rows.filter((x) => x.ok).length / st.test.length; }
    const confidence = st.classes ? r.rows.reduce((a, x) => a + x.p, 0) / r.rows.length : null;
    const n = (st.inputs || ['inA', 'inB']).length;
    const recallOf = (rr) => { const pos = rr.rows.filter((x) => x.row[n] === 1); return pos.filter((x) => x.ok).length / pos.length; };
    const accOf = (rr) => rr.rows.filter((x) => x.ok).length / rr.rows.length;
    const codeOk = (b) => !(st.need && st.need.code != null) || new Set(b.synapses.filter((x) => (st.inputs || []).includes(x.from) && /^h\d+$/.test(x.to)).map((x) => x.to)).size <= st.need.code;
    const ok = st.need && st.need.recall != null ? recallOf(r) >= st.need.recall && accOf(r) >= st.need.acc
      : st.need && st.need.test ? testAcc >= st.need.test : r.ok && codeOk(sol) && (!(st.need && st.need.confidence) || confidence >= st.need.confidence);
    check(ok && allStars(pass(st, { status: ok ? 'success' : 'fail', testAcc, confidence }, sol)), `${tag}: 정답 → 성공, 별 3개${confidence != null ? ` (정답 확률 평균 ${Math.round(confidence * 100)}%)` : ''}`);
    const er = sim.evalLogic(st, emptyB());
    if (st.need && st.need.recall != null) check(recallOf(er) < st.need.recall, `${tag}: 빈 뇌는 정확도 ${Math.round(accOf(er) * 100)}%지만 재현율 ${Math.round(recallOf(er) * 100)}%라 못 깸`);
    else check(!er.ok, `${tag}: 빈 뇌로는 못 깸`);
  } else if (st.type === 'train') {
    const run = (lr, ii) => { const b = JSON.parse(JSON.stringify(st.inits ? st.inits[ii || 0].brain : st.init)); for (let e = 1; e <= (st.maxEpochs || 200); e++) { sim.trainEpoch(st, b, lr); if (sim.evalLogic(st, b).ok) return e; } return null; };
    if (st.inits) check(RATES.every((lr) => run(lr, 0) === null), `${tag}: 시작 가중치 "${st.inits[0].label}"로는 어떤 학습률로도 못 배움`);
    if (st.goal && st.goal.type === 'epochsAtLeast') {
      check(RATES.every((lr) => run(lr) === null), `${tag}: 어떤 학습률로도 못 배움(한계를 보여 주는 실험)`);
    } else {
      const e = run(st.solution.lr, st.solution.init);
      check(e !== null && allStars(pass(st, { status: 'success', epochs: e, rates: 1 }, st.init)), `${tag}: 학습률 ${st.solution.lr} → ${e}번 만에 배움, 별 3개`);
    }
  } else if (st.type === 'vision') {
    const d = JSON.parse(JSON.stringify(st.solution));
    const r = sim.evalVision(st, d);
    check(r.ok && allStars(pass(st, Object.assign({ status: 'success' }, sim.visionStats(d)), emptyB())), `${tag}: 정답 필터 → 성공, 별 3개`);
    const n = st.mode === 'class' ? 2 : 1;
    const blank = { filters: Array.from({ length: n }, () => ({ w: [0, 0, 0, 0, 0, 0, 0, 0, 0], b: 0 })), out: { w: new Array(n).fill(0), b: 0 } };
    check(!sim.evalVision(st, blank).ok, `${tag}: 빈 필터로는 못 깸`);
  } else if (st.type === 'seq') {
    const sol = st.solution;
    check(usesAllowed(st, sol), `${tag}: 정답 뇌가 허락된 입력·히든 뉴런만 씀`);
    const r = sim.evalSeq(st, sol);
    check(r.ok && allStars(pass(st, { status: 'success' }, sol)), `${tag}: 정답 → 성공, 별 3개`);
    check(!sim.evalSeq(st, emptyB()).ok, `${tag}: 빈 뇌로는 못 깸`);
    // 기억 뉴런이 있는 실험은 기억 없이는 못 푼다: 같은 입력인데 목표가 다른 칸이 있다
    if (st.sensors.some((id) => sim.MEM_SRC[id])) {
      const seen = {}; let contra = false;
      for (const q of st.seqs) q.x.forEach((x, i) => { if (q.t[i] == null) return; const k = JSON.stringify(x); if (seen[k] !== undefined && Math.abs(seen[k] - q.t[i]) > (st.tol || 0)) contra = true; seen[k] = q.t[i]; });
      check(contra, `${tag}: 지금 입력만 봐서는 풀 수 없음(기억이 꼭 필요)`);
    }
  } else if (st.type === 'cluster') {
    const sol = st.solution;
    let cs, steps = 0, kTried = 1;
    if (st.chooseK) { const r = sim.kmRun(st.pts, st.inits[sol.k]); cs = r.centers; steps = r.steps; kTried = 6; }
    else if (sol.centers && !sol.fresh) cs = sol.centers;
    else { const r = sim.kmRun(st.pts, sol.centers || st.init); cs = r.centers; steps = r.steps; }
    const ok = sim.kmMatches(st.pts, cs) && (st.goal !== 'converged' || sim.kmConverged(st.pts, cs));
    check(ok && allStars(pass(st, { status: ok ? 'success' : 'fail', inertia: sim.kmInertia(st.pts, cs), steps, kTried }, emptyB())), `${tag}: 정답 → 성공, 별 3개 (거리 합 ${sim.kmInertia(st.pts, cs).toFixed(3)})`);
    const start = st.chooseK ? st.inits[st.k0] : st.init;
    check(!sim.kmMatches(st.pts, start), `${tag}: 처음 자리 그대로는 못 깸`);
  } else if (st.type === 'descent') {
    const r = sim.descRun(st, st.solution);
    check(r.ok && allStars(pass(st, { status: 'success', steps: r.steps, startMoved: false, opt: st.solution.opt }, emptyB())), `${tag}: 정답 설정 → ${r.steps}걸음 만에 바닥, 별 3개`);
    check(!sim.descArrived(st, sim.descInit(st.start)), `${tag}: 출발점은 바닥이 아님`);
  } else if (st.type === 'grid') {
    const g = sim.gridOf(st), sol = st.solution;
    let res;
    if (st.mode === 'vi') {
      const gamma = sol.gamma != null ? sol.gamma : st.gamma;
      let V = new Array(g.N).fill(0);
      for (let n = 0; n < sol.sweeps; n++) V = sim.valueSweep(st, g, V, gamma);
      const pth = sim.greedyPath(st, g, (i) => sim.vActionValues(st, g, V, gamma, i));
      res = { ok: !pth.stuck && g.cell[pth.end] === st.target, sweeps: sol.sweeps, gamma };
    } else {
      const Q = Array.from({ length: g.N }, () => [0, 0, 0, 0]), rng = sim.makeRng(st.seed);
      const short = sim.gridShortest(st, g, st.target);
      let e = 0, ok = false;
      while (!ok && e < st.maxEpisodes) {
        sim.qEpisode(st, g, Q, { alpha: sol.alpha, eps: sol.eps, gamma: st.gamma }, rng); e++;
        const pth = sim.greedyPath(st, g, (i) => Q[i]);
        ok = !pth.stuck && g.cell[pth.end] === st.target && (!st.shortest || pth.path.length - 1 === short);
      }
      res = { ok, episodes: e, gamma: st.gamma };
    }
    check(res.ok && allStars(pass(st, Object.assign({ status: 'success' }, res), emptyB())), `${tag}: 정답 설정 → 목표까지 길이 이어짐, 별 3개 (${st.mode === 'vi' ? res.sweeps + '번 퍼뜨림' : res.episodes + '판'})`);
  } else if (st.type === 'reward') {
    // 강화학습: 정답 점수 규칙으로 maxGens 안에 목표를 배우는지 (시간이 걸려서 앞의 두 실험만 돌린다)
    if (!['R1', 'R2'].includes(st.id)) continue;
    const state = sim.rlInit(st);
    let gens = null;
    for (let g = 0; g < st.maxGens; g++) {
      sim.rlGeneration(st, state, st.solution.rw, st.solution.sigma);
      const ep = sim.runEpisode(st, sim.rlBuild(st, state.theta), st.solution.rw, true);
      if (sim.objectiveOk(st, ep)) { gens = state.gen; break; }
    }
    check(gens !== null, `${tag}: 정답 점수 규칙으로 ${gens}세대 만에 배움`);
  }
}

console.log('■ 8~10장 힌트에 적은 말이 맞는지');
{
  const M2 = ALL.find((s) => s.id === 'M2');
  check(!sim.evalSeq(M2, B('inA>out:1', 'memO>out:0.4')).ok, 'M2 출력 기억 세기 0.4면 기억이 희미해져 실패');
  const M1 = ALL.find((s) => s.id === 'M1');
  check(!sim.evalSeq(M1, B('inA>h1:1', 'mem1>out:1', 'inA>out:1')).ok, 'M1 입력 A를 출력에도 이으면 실패');
  const M5 = ALL.find((s) => s.id === 'M5');
  const rng = sim.makeRng('m5-qa');
  let found = false;
  for (let i = 0; i < 20000 && !found; i++) { const w = () => (rng() * 6 - 3).toFixed(1); found = sim.evalSeq(M5, B(`inA>out:${w()}`, `memO>out:${w()}`, `bias>out:${w()}`)).ok; }
  check(!found, 'M5 홀짝 세기는 히든 뉴런 없이 풀리지 않음');
  const K3 = ALL.find((s) => s.id === 'K3');
  const trap = sim.kmRun(K3.pts, K3.init);
  check(!sim.kmMatches(K3.pts, trap.centers) && sim.kmConverged(K3.pts, trap.centers), 'K3 처음 자리로 걸으면 엉뚱한 답에 갇혀 멈춤(지역 최소)');
  const K2 = ALL.find((s) => s.id === 'K2');
  check(sim.kmRun(K2.pts, K2.init).steps === 3, 'K2 처음 자리에서 3걸음 만에 멈춤(힌트와 일치)');
  const K4 = ALL.find((s) => s.id === 'K4');
  check([1, 2, 3, 5, 6].every((k) => !sim.kmMatches(K4.pts, sim.kmRun(K4.pts, K4.inits[k]).centers)), 'K4 k = 4가 아니면 못 깸');
  const A4 = ALL.find((s) => s.id === 'A4');
  const exp = { 0.02: 248, 0.1: 45, 0.3: 9, 0.5: 8 };
  const runA4 = (lr) => { const b = JSON.parse(JSON.stringify(A4.init)); for (let e = 1; e <= A4.maxEpochs; e++) { sim.trainEpoch(A4, b, lr); if (sim.evalLogic(A4, b).ok) return e; } return null; };
  check(Object.entries(exp).every(([lr, n]) => runA4(+lr) === n) && [1, 2, 3].every((lr) => runA4(lr) === null), 'A4 학습률별 학습 횟수가 힌트와 같음');
  const A2 = ALL.find((s) => s.id === 'A2');
  check(A2.solution.synapses.every((x) => !A2.inputs.includes(x.from) || /^h/.test(x.to)), 'A2 정답이 입력→출력 직접 연결을 쓰지 않음');
  const C6 = ALL.find((s) => s.id === 'C6');
  const runC6 = (lr) => { const b = JSON.parse(JSON.stringify(C6.init)); for (let e = 1; e <= C6.maxEpochs; e++) { sim.trainEpoch(C6, b, lr); if (sim.evalLogic(C6, b).ok) return e; } return null; };
  check(runC6(0.02) === 25 && runC6(0.1) === 7 && runC6(0.3) === 5 && runC6(1) === null && runC6(3) === null, 'C6 학습률별 학습 횟수가 힌트와 같음(여러 출력 학습으로 바꾼 뒤에도)');
}

console.log('■ 심화 장 힌트에 적은 말이 맞는지');
{
  const S = (id) => ALL.find((x) => x.id === id);
  const steps = (id, o, start) => { const r = sim.descRun(S(id), o, start); return r.ok ? r.steps : r.diverged ? 'X' : null; };
  check(steps('D1', { opt: 'gd', lr: 0.05 }) === null && steps('D1', { opt: 'gd', lr: 0.1 }) === 53 && steps('D1', { opt: 'gd', lr: 0.2 }) === 26 && steps('D1', { opt: 'gd', lr: 0.3 }) === 'X', 'D1 학습률 0.05 못 닿음 · 0.1은 53걸음 · 0.2는 26걸음 · 0.3은 튀어 나감');
  check(S('D2').lrs.every((lr) => steps('D2', { opt: 'gd', lr }) !== 'ok' && typeof steps('D2', { opt: 'gd', lr }) !== 'number') && steps('D2', { opt: 'momentum', beta: 0.9, lr: 0.05 }) === 55 && steps('D2', { opt: 'momentum', beta: 0.9, lr: 0.3 }) === 58 && steps('D2', { opt: 'momentum', beta: 0.5, lr: 0.5 }) === 36, 'D2 경사 하강은 못 닿고, 모멘텀 β0.9는 55·58걸음, β0.5·0.5는 36걸음');
  check(S('D3').lrs.every((lr) => typeof steps('D3', { opt: 'gd', lr }) !== 'number') && steps('D3', { opt: 'momentum', beta: 0.9, lr: 0.3 }) === 52 && steps('D3', { opt: 'momentum', beta: 0.9, lr: 0.5 }) === 50 && S('D3').lrs.every((lr) => typeof steps('D3', { opt: 'momentum', beta: 0.5, lr }) !== 'number') && typeof steps('D3', { opt: 'gd', lr: 0.2 }, [2.5, 2.5]) === 'number', 'D3 경사 하강·β0.5는 웅덩이에 갇히고, β0.9는 52·50걸음, 출발점을 옮기면 경사 하강도 됨');
  check(S('D4').lrs.every((lr) => typeof steps('D4', { opt: 'gd', lr }) !== 'number' && typeof steps('D4', { opt: 'momentum', beta: 0.9, lr }) !== 'number') && [[0.1, 63], [0.2, 59], [0.3, 60], [0.5, 65]].every(([lr, n]) => steps('D4', { opt: 'adam', lr }) === n), 'D4 경사 하강·모멘텀은 못 닿고 Adam은 63·59·60·65걸음');
  const viEnd = (id, gamma, sweeps) => { const st = S(id), g = sim.gridOf(st); let V = new Array(g.N).fill(0); for (let n = 0; n < sweeps; n++) V = sim.valueSweep(st, g, V, gamma); const pth = sim.greedyPath(st, g, (i) => sim.vActionValues(st, g, V, gamma, i)); return pth.stuck ? null : g.cell[pth.end]; };
  check(viEnd('Q1', 0.9, 13) === null && viEnd('Q1', 0.9, 14) === 'G', 'Q1 14번 퍼뜨려야 길이 이어짐');
  check(viEnd('Q2', 0.5, 30) === 'g' && viEnd('Q2', 0.6, 30) === 'g' && viEnd('Q2', 0.7, 6) === 'G' && viEnd('Q2', 0.7, 5) === 'g', 'Q2 γ 0.6 이하는 작은 보상, 0.7은 6번 퍼뜨리면 큰 보상');
  const qEp = (id, alpha, eps) => { const st = S(id), g = sim.gridOf(st), Q = Array.from({ length: g.N }, () => [0, 0, 0, 0]), rng = sim.makeRng(st.seed), short = sim.gridShortest(st, g, st.target);
    for (let e = 1; e <= st.maxEpisodes; e++) { sim.qEpisode(st, g, Q, { alpha, eps, gamma: st.gamma }, rng); const pth = sim.greedyPath(st, g, (i) => Q[i]); if (!pth.stuck && g.cell[pth.end] === st.target && (!st.shortest || pth.path.length - 1 === short)) return e; } return null; };
  check([0, 0.1, 0.3].every((e) => { const n = qEp('Q3', 0.1, e); return n >= 38 && n <= 47; }) && [0, 0.1, 0.3].every((e) => qEp('Q3', 1, e) <= 12), 'Q3 α 0.1은 38~47판, α 1은 12판 안');
  check(qEp('Q4', 0.5, 0) === null && qEp('Q4', 0.5, 0.1) === null && qEp('Q4', 0.5, 0.3) === 31 && qEp('Q4', 0.5, 0.5) === 8 && qEp('Q4', 1, 0.3) === 13 && qEp('Q4', 1, 0.5) === 8, 'Q4 ε 0·0.1은 작은 보상에 머물고, ε 0.3·0.5는 31·8판(α 0.5), 13·8판(α 1)');
  const conf = (w, b) => { const st = S('SM2'), br = Object.assign(B(`inX>out:${-w}`, `bias>out:${b}`, `inX>out2:${w}`, `bias>out2:${-b}`), { fn: st.fixedFn }); const r = sim.evalLogic(st, br); return r.ok ? Math.round((r.rows.reduce((a, x) => a + x.p, 0) / r.rows.length) * 100) : null; };
  check(conf(1, 0.5) === 66 && conf(2, 1) === 79 && conf(3, 1.5) === 88, 'SM2 가중치 ±1은 66%, ±2는 79%, ±3은 88%');
  const ce = (lr) => { const st = S('SM4'), b = JSON.parse(JSON.stringify(st.init)); for (let e = 1; e <= st.maxEpochs; e++) { sim.trainEpoch(st, b, lr); if (sim.evalLogic(st, b).ok) return e; } return null; };
  check(ce(0.02) === 22 && ce(0.05) === 8 && ce(0.1) === 3 && ce(0.3) === 4 && ce(0.5) === 5 && ce(1) === null && ce(3) === null, 'SM4 학습률별 학습 횟수가 힌트와 같음');
  const L = (id, b) => sim.evalSeq(S(id), b).ok;
  check(L('GT1', B('inA>out:1', 'inB>out:1', 'bias>out:-1')) && !L('GT1', B('inA>out:1')), 'GT1 기본 함수로 A + B - 1도 되고, 값만 이으면 실패');
  check(L('GT2', B('inA>h2:1', 'inB>h2:1', 'bias>h2:-1', 'mem1>h3:1', 'inB>h3:-1', 'h2>h1:1', 'h3>h1:1', 'h1>out:1')), 'GT2 곱 없이 기본 함수로도 풀림(힌트와 일치)');
  check(L('GT3', B('mem1>h2:1', 'inB>h2:-1', 'h2>h1:1', 'inA>h1:1', 'h1>out:1')), 'GT3 기억 1 - B 방법도 풀림(힌트와 일치)');
  check(!L('GT4', Object.assign(B('inA>h2:1', 'inB>h2:1', 'bias>h4:1', 'inB>h4:-1', 'mem1>h3:1', 'h4>h3:1', 'h2>h1:1', 'h3>h1:1', 'h1>out:1'), { fn: { h2: 'mul', h3: 'mul' } })), 'GT4 읽기 문이 없으면 실패');
}

console.log('■ 도전 문제와 15장 힌트에 적은 말이 맞는지');
{
  const S = (id) => ALL.find((x) => x.id === id);
  const accOn = (st, b, rows) => { const r = sim.evalLogic(Object.assign({}, st, { rows: rows || st.rows }), b); return r.rows.filter((x) => x.ok).length / r.rows.length; };
  check(!sim.evalLogic(S('L6'), B('inA>h1:1', 'inB>h1:1', 'inC>h1:1', 'bias>h1:-1', 'bias>h2:1', 'inA>h2:-1', 'inB>h2:-1', 'inC>h2:-1', 'h1>out:1', 'h2>out:1')).ok, 'L6 셋 다 켜짐의 문턱이 -1이면 실패');
  check(!sim.evalLogic(S('P7'), B('inA>out:1', 'inB>out:1', 'inC>out:-1', 'inD>out:-1')).ok, 'P7 2의 자리에도 1을 주면 실패');
  check(accOn(S('C7'), B('inX>h1:3', 'inY>h1:-3', 'inY>h2:3', 'inX>h2:-3', 'h1>out:1', 'h2>out:1')) < 1, 'C7 대각선 두 개(히든 2개)로는 다 못 맞힘');
  const V5 = S('V5'), plus = (b) => sim.evalVision(V5, { filters: [{ w: [0, 1, 0, 1, 1, 1, 0, 1, 0], b }] }).ok;
  check(plus(-4) && plus(-3) && !plus(-2), 'V5 + 필터는 편향 -4·-3이면 되고 -2면 실패');
  const A5 = S('A5');
  check(new Set(B('inA>h1:1', 'inB>h2:1').synapses.map((x) => x.to)).size === 2 && A5.need.code === 1, 'A5 코드 한 칸 조건이 있음');
  const F1 = S('F1'), rr = (b) => { const r = sim.evalLogic(F1, b).rows, pos = r.filter((x) => x.row[2] === 1); return [r.filter((x) => x.ok).length / r.length, pos.filter((x) => x.ok).length / pos.length]; };
  check(rr(B())[0] === 0.88 && rr(B())[1] === 0 && rr(F1.solution)[0] === 0.92 && rr(F1.solution)[1] === 1 && F1.rows.length === 25, 'F1 빈 뇌는 정확도 88%·재현율 0%, 정답은 92%·100%');
  const F2 = S('F2');
  check(accOn(F2, B('inY>out:2', 'bias>out:-0.5')) === 1 && accOn(F2, B('inY>out:2', 'bias>out:-0.5'), F2.test) < 0.9 && accOn(F2, B('inX>out:1', 'inY>out:1', 'bias>out:-0.5'), F2.test) < 0.9, 'F2 배경(y)이나 대각선은 훈련은 맞히고 시험은 90% 미만');
  const F3 = S('F3');
  check(accOn(F3, B('inX>out:2', 'bias>out:-0.3')) === 1 && accOn(F3, B('inX>out:2', 'bias>out:-0.3'), F3.test) < 1 && Math.max(...F3.test.filter((x) => !x[2]).map((x) => x[0])) <= 0.47 && Math.min(...F3.test.filter((x) => x[2]).map((x) => x[0])) >= 0.53, 'F3 경계 0.4는 민 점에 속고, 민 점은 0.47·0.53 안쪽');
  const F4 = S('F4'), tr = (lr) => { const b = JSON.parse(JSON.stringify(F4.inits[1].brain)); for (let e = 1; e <= 200; e++) { sim.trainEpoch(F4, b, lr); if (sim.evalLogic(F4, b).ok) return e; } return null; };
  check(tr(0.1) === 3 && tr(0.5) === 2, 'F4 조금씩 다르게: 0.1이면 3번, 0.5면 2번');
}

console.log('■ 태그와 검색 데이터');
{
  check(ALL.every((st) => Array.isArray(st.tags) && st.tags.length >= 2), '모든 문제에 태그가 2개 이상');
  check(ALL.filter((st) => st.extra).every((st) => st.tag === '심화' && st.tags.includes('도전 문제')), '도전 문제는 "심화"로 분류되고 "도전 문제" 태그가 붙음');
  check(content.STAGE_TAGS.length === new Set(ALL.flatMap((st) => st.tags)).size, '태그 목록이 문제의 태그와 같음');
}

console.log('■ 데이터 모양');
{
  const ids = ALL.map((s) => s.id);
  check(new Set(ids).size === ids.length, `실험 id가 겹치지 않음 (${ids.length}개)`);
  check(ALL.every((s) => s.hints && s.hints.length === 3 && s.solution && s.goalText && s.brief), '모든 실험에 힌트 3개·정답·목표·설명이 있음');
  check(ALL.every((s) => content.CONCEPTS[s.concept]), '모든 실험의 개념 카드가 있음');
  const { PAPERS, CONCEPT_PAPERS } = content;
  check(ALL.every((s) => (CONCEPT_PAPERS[s.concept] || []).length > 0), '모든 실험의 개념에 관련 논문이 있음');
  const keys = Object.values(CONCEPT_PAPERS).flat();
  check(keys.every((k) => PAPERS[k] && /^https?:\/\//.test(PAPERS[k].link) && PAPERS[k].title && PAPERS[k].year), `논문 ${Object.keys(PAPERS).length}편 모두 제목·연도·링크가 있음`);
  const chapters = [...new Set(ALL.map((s) => s.chapter))];
  check(chapters.length === content.TRACKS[0].chapters.length && chapters.every((c) => content.TRACKS[0].chapters.some((x) => x.no === c)), `장 목록과 실험이 맞음 (${chapters.length}장)`);
}

console.log(failures ? `\n✗ 실패 ${failures}개` : '\n✓ 모두 통과');
process.exit(failures ? 1 : 0);
