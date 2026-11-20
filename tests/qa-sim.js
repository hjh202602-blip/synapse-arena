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
    const ok = st.need && st.need.test ? testAcc >= st.need.test : r.ok;
    check(ok && allStars(pass(st, { status: ok ? 'success' : 'fail', testAcc }, sol)), `${tag}: 정답 → 성공, 별 3개`);
    const er = sim.evalLogic(st, emptyB());
    check(!er.ok, `${tag}: 빈 뇌로는 못 깸`);
  } else if (st.type === 'train') {
    const run = (lr) => { const b = JSON.parse(JSON.stringify(st.init)); for (let e = 1; e <= (st.maxEpochs || 200); e++) { sim.trainEpoch(st, b, lr); if (sim.evalLogic(st, b).ok) return e; } return null; };
    if (st.goal && st.goal.type === 'epochsAtLeast') {
      check(RATES.every((lr) => run(lr) === null), `${tag}: 어떤 학습률로도 못 배움(한계를 보여 주는 실험)`);
    } else {
      const e = run(st.solution.lr);
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
    // 기억 없이는 못 푼다: 같은 입력인데 목표가 다른 칸이 있다
    const seen = {}; let contra = false;
    for (const q of st.seqs) q.x.forEach((x, i) => { if (q.t[i] == null) return; if (seen[x] !== undefined && seen[x] !== q.t[i]) contra = true; seen[x] = q.t[i]; });
    check(contra, `${tag}: 지금 입력만 봐서는 풀 수 없음(기억이 꼭 필요)`);
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

console.log('■ 데이터 모양');
{
  const ids = ALL.map((s) => s.id);
  check(new Set(ids).size === ids.length, `실험 id가 겹치지 않음 (${ids.length}개)`);
  check(ALL.every((s) => s.hints && s.hints.length === 3 && s.solution && s.goalText && s.brief), '모든 실험에 힌트 3개·정답·목표·설명이 있음');
  check(ALL.every((s) => content.CONCEPTS[s.concept]), '모든 실험의 개념 카드가 있음');
  const chapters = [...new Set(ALL.map((s) => s.chapter))];
  check(chapters.length === content.TRACKS[0].chapters.length && chapters.every((c) => content.TRACKS[0].chapters.some((x) => x.no === c)), `장 목록과 실험이 맞음 (${chapters.length}장)`);
}

console.log(failures ? `\n✗ 실패 ${failures}개` : '\n✓ 모두 통과');
process.exit(failures ? 1 : 0);
