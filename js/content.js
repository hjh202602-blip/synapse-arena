/* 시냅스 아레나 — 실험(스테이지), 라이벌 뇌, 연구실 아레나, 개념 노트
 * 좌표는 900×600 아레나 기준. 각도는 라디안(0 = 오른쪽, 화면 아래가 +y).
 */
(function () {
  'use strict';
  const SA = (globalThis.SA = globalThis.SA || {});
  const PI = Math.PI;

  // 짧게 뇌를 적는 도우미: B('eyeL>motorR:1', 'bias>h1:1', ...) — h로 시작하는 id는 히든 뉴런
  function B(...specs) {
    const hidden = [];
    const synapses = [];
    for (const s of specs) {
      const m = /^(\w+)>(\w+):(-?[\d.]+)$/.exec(s);
      if (!m) throw new Error('bad synapse spec ' + s);
      const [, from, to, w] = m;
      for (const id of [from, to]) {
        if (/^h\d+$/.test(id) && !hidden.find((h) => h.id === id)) {
          const n = hidden.length;
          hidden.push({ id, x: 0.5, y: 0.25 + 0.5 * (n % 2) + 0.12 * Math.floor(n / 2) });
        }
      }
      synapses.push({ from, to, w: Number(w) });
    }
    return { hidden, synapses };
  }

  // ---- 실험 ----------------------------------------------------------------
  const ARENA = [
    {
      id: 's1', no: 1, title: '첫 발걸음', concept: 'bias',
      brief: '생명체 "도트"의 뇌는 아직 비어 있다. 바퀴에 신호를 보내 앞에 있는 먹이까지 가 보자.',
      goalText: '먹이 1개 먹기',
      hints: ['상시 뉴런은 언제나 1을 내보낸다.', '값 조절: 상시 → 바퀴 값이 클수록 빨라진다(0.4면 약 10초, 0.8이면 5초, 1이면 4초). 1보다 키워도 더 빨라지지는 않는다. 두 값이 조금만 달라도(1과 0.9) 한쪽으로 휘어서 먹이를 비껴가니 두 값을 똑같이 맞추자.', '상시 → 왼바퀴, 상시 → 오른바퀴. 두 바퀴가 똑같이 돌면 똑바로 간다.'],
      sensors: ['bias'], maxHidden: 0, timeLimit: 15,
      start: { x: 150, y: 300, a: 0 },
      foods: [[620, 300]],
      goal: { type: 'eat', n: 1 },
      stars: [{ type: 'synapses', max: 2 }, { type: 'time', max: 5 }],
    },
    {
      id: 's2', no: 2, title: '빛을 향해', concept: 'cross',
      brief: '먹이는 빛난다. 먹이가 옆에 있으면 몸을 틀어야 한다. 눈과 바퀴를 어떻게 이어야 빛 쪽으로 돌까?',
      goalText: '먹이 3개 먹기 (하나를 먹으면 다음 먹이가 나타난다)',
      hints: ['오른바퀴가 더 빨리 돌면 왼쪽으로 돈다. 먹이가 왼쪽에 있으면 왼눈이 더 밝다.', '값 조절: 엇갈린 눈 → 바퀴 값이 클수록 먹이 쪽으로 빨리 몸을 튼다(0.5면 약 26초, 1이면 19초, 2.5면 13초). 상시는 0.2~0.8이 알맞다. 0이면 먹이가 멀 때 느려지고, 1보다 크면 먹이를 지나쳐 오히려 조금 느려진다.', '왼눈 → 오른바퀴, 오른눈 → 왼바퀴처럼 엇갈려 이어 보자(+2 정도). 먹이가 멀 때를 위해 상시 → 두 바퀴도 조금(+0.4).'],
      sensors: ['bias', 'eyeL', 'eyeR'], maxHidden: 0, timeLimit: 30,
      start: { x: 120, y: 480, a: 0 },
      foodQueue: [[430, 170], [780, 400], [300, 470]],
      goal: { type: 'eat', n: 3 },
      stars: [{ type: 'synapses', max: 4 }, { type: 'time', max: 16 }],
    },
    {
      id: 's3', no: 3, title: '가시밭길', concept: 'reflex',
      brief: '먹이로 가는 길에 가시가 박혀 있다. 닿으면 실험 실패. 더듬이로 가시를 느끼고 피하게 만들자.',
      goalText: '가시에 닿지 않고 먹이 3개 먹기',
      hints: ['왼 더듬이가 느끼면 오른쪽으로 피해야 한다. 오른쪽으로 돌려면 왼바퀴가 더 빨라야 한다.', '값 조절: 더듬이 → 같은 쪽 바퀴는 크다고 좋은 게 아니다. 0.5~1.5가 알맞고, 2 이상이면 너무 세게 꺾여 옆 가시에 부딪힌다. 0이면 못 피한다. 눈은 1 이상, 상시는 0.2 이상이어야 하고, 상시를 0.6~1로 올리면 빨라진다.', '눈은 ‘빛을 향해’ 실험처럼 엇갈리게. 더듬이는 같은 쪽 바퀴에 +1 정도. 상시를 넉넉히(+0.8) 주면 가시 사이를 빨리 빠져나간다.'],
      sensors: ['bias', 'eyeL', 'eyeR', 'feelL', 'feelR'], maxHidden: 0, timeLimit: 40,
      start: { x: 90, y: 296, a: 0 },
      foodQueue: [[810, 300], [800, 80], [110, 90]],
      hazards: [[450, 300, 20], [805, 190, 16], [460, 88, 20], [300, 470, 18], [600, 480, 18], [180, 200, 14], [640, 200, 14]],
      goal: { type: 'eat', n: 3 },
      stars: [{ type: 'synapses', max: 6 }, { type: 'time', max: 20 }],
    },
    {
      id: 's4', no: 4, title: '빛의 표식', concept: 'inhibition',
      brief: '금빛 표식 위에 머무르면 충전된다. 지나쳐 버리면 다시 식는다. 빛에 가까울수록 느려지는 생명체를 만들자.',
      goalText: '표식을 100% 충전하기 (표식 안에서 4초)',
      hints: ['빨간 시냅스(음수)는 신호를 깎는다. 이것이 억제다.', '값 조절: 빨간 선(억제)의 크기가 핵심이다. -1 ~ -1.5 사이에서만 표식 위에 멈춘다. -0.5처럼 약하면 표식을 지나쳐 버리고, -2보다 세면 표식에 닿기 전에 멈춰 선다. 상시는 0.8~1. 상시와 억제의 크기가 비슷해야 빛 앞에서 딱 선다.', '상시 → 두 바퀴(+1)로 달리게 하고, 왼눈 → 왼바퀴, 오른눈 → 오른바퀴를 -1.2쯤으로 이어 보자. 빛이 세질수록 느려진다.'],
      sensors: ['bias', 'eyeL', 'eyeR'], maxHidden: 0, timeLimit: 25,
      start: { x: 150, y: 470, a: -0.3 },
      marks: [[640, 210, 75]],
      goal: { type: 'charge' },
      stars: [{ type: 'synapses', max: 4 }, { type: 'time', max: 12 }],
    },
    {
      id: 's5', no: 5, title: '벽 더듬기', concept: 'whisker',
      brief: '빛은 벽 너머로도 보이지만 몸은 벽을 통과하지 못한다. 수염으로 벽을 느끼고 돌아가자.',
      goalText: '먹이 3개 먹기',
      hints: ['안쪽 바위벽은 미끄럽지 않다. 정면으로 박히면 그 자리에서 버둥거린다.', '값 조절: 수염 → 같은 쪽 바퀴가 2 이상이어야 벽을 돌아간다. 1 이하면 벽 앞에서 버둥거린다. 상시를 0.6~1로 올리면 빨라진다(0이면 45초 가까이 걸린다). 눈 값은 0.5~3 어디든 괜찮다.', '왼 수염 → 왼바퀴, 오른 수염 → 오른바퀴처럼 같은 쪽으로(+2) 이으면 벽 반대쪽으로 돈다. 상시는 +0.8로 넉넉하게.'],
      sensors: ['bias', 'eyeL', 'eyeR', 'whiskL', 'whiskR'], maxHidden: 0, timeLimit: 45,
      start: { x: 110, y: 330, a: 0 },
      foodQueue: [[770, 250], [770, 520], [120, 90]],
      walls: [[420, 110, 34, 380], [600, 0, 30, 170], [230, 430, 30, 170]],
      goal: { type: 'eat', n: 3 },
      stars: [{ type: 'synapses', max: 6 }, { type: 'time', max: 25 }],
    },
    {
      id: 's6', no: 6, title: '미끼', concept: 'hidden',
      brief: '한가운데의 밝은 빛은 먹이가 아니라 가시로 둘러싼 미끼다. "위험하면 빛을 쫓지 마"를 뇌에 넣으려면 중간 단계가 필요하다.',
      goalText: '가시에 닿지 않고 먹이 3개 먹기',
      hints: ['히든 뉴런은 0 아래로 내려가지 않는다. 그래서 "위험하면 닫히는 문" 역할을 할 수 있다.', '값 조절: 문 뉴런으로 들어가는 더듬이 값(-)이 핵심이다. -2 근처가 좋다. -1보다 약하면 문이 덜 닫혀 미끼에 끌려가 찔리고, -3처럼 너무 세면 진짜 먹이 앞에서도 문이 닫혀 멈춰 선다. 상시는 0.4 이상(0.8~1이면 더 빠르다), 더듬이 → 같은 쪽 바퀴는 0.5 이상.', '히든 뉴런 두 개: (왼눈 +1, 두 더듬이 -2) → 오른바퀴 +2, (오른눈 +1, 두 더듬이 -2) → 왼바퀴 +2. 여기에 상시 +0.7, 더듬이 → 같은 쪽 바퀴 +1.'],
      sensors: ['bias', 'eyeL', 'eyeR', 'feelL', 'feelR'], maxHidden: 2, timeLimit: 60,
      start: { x: 100, y: 110, a: 0.1 },
      foodQueue: [[810, 110], [800, 500], [110, 500]],
      decoys: [[450, 300, 0.8]],
      hazards: ringOf(450, 300, 62, 7, 15),
      goal: { type: 'eat', n: 3 },
      stars: [{ type: 'hidden', min: 1 }, { type: 'time', max: 25 }],
    },
    {
      id: 's7', no: 7, title: '아귀', concept: 'adversarial', boss: true,
      brief: '심해의 아귀가 깨어났다. 머리 앞의 빛나는 미끼로 먹잇감을 꾀어낸다. 미끼에 속지 말고 진짜 먹이를 모두 먹어라.',
      goalText: '아귀에게 잡히지 않고 먹이 5개 먹기',
      hints: ['아귀는 가까이 온 생명체를 쫓아온다. 하지만 도트가 더 빠르다. 미끼는 아귀 몸 바로 앞에 있다.', '값 조절: 히든 뉴런 → 바퀴는 1.5 이상(작으면 아귀에게서 못 벗어난다). 상시는 0.6~1: 작으면 느려서 잡히고, 1.5처럼 크면 아귀 쪽으로 돌진한다. 문의 더듬이 값은 -2~-3, 더듬이 → 같은 쪽 바퀴는 1~2(3이면 겁이 너무 많아 오래 걸린다). 수염은 없어도 깨지만 넣으면 10초 넘게 빨라진다.', '‘미끼’ 실험의 "문" 뇌에 수염 → 같은 쪽 바퀴(+1)를 더하고, 상시를 +0.8로 올려 보자. 문은 더듬이 -2~-3.'],
      sensors: ['bias', 'eyeL', 'eyeR', 'feelL', 'feelR', 'whiskL', 'whiskR'], maxHidden: 4, timeLimit: 90,
      start: { x: 90, y: 300, a: 0 },
      foodQueue: [[150, 90], [800, 100], [790, 510], [140, 510], [460, 70]],
      predators: [{ x: 520, y: 320, a: PI, r: 28, patrol: 34, chase: 46, sense: 170, turn: 1.7, lure: 58, lureGain: 1.1,
        path: [[520, 170], [700, 300], [520, 440], [330, 300]] }],
      goal: { type: 'eat', n: 5 },
      stars: [{ type: 'synapses', max: 14 }, { type: 'time', max: 40 }],
    },
  ];

  function ringOf(cx, cy, rad, n, r) {
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 2 * PI + 0.2;
      out.push([Math.round(cx + Math.cos(a) * rad), Math.round(cy + Math.sin(a) * rad), r]);
    }
    return out;
  }

  // ---- 대결 아레나 ------------------------------------------------------------
  const VERSUS_SENSORS = ['bias', 'eyeL', 'eyeR', 'whiskL', 'whiskR'];
  const VERSUS_ARENAS = [
    {
      id: 'vs-field', title: '들판', desc: '벽 없는 넓은 들판. 순수한 먹이 쫓기 대결.',
      sensors: VERSUS_SENSORS, timeLimit: 45, seed: 'field-7',
      starts: [{ x: 150, y: 300, a: 0 }, { x: 750, y: 300, a: PI }],
      foods: [[450, 140], [450, 460], [300, 300], [600, 300]],
      respawn: { min: 2 }, goal: { type: 'versus' },
    },
    {
      id: 'vs-pillars', title: '기둥 숲', desc: '기둥 사이로 먹이가 흩어진다. 수염이 없으면 기둥에 걸린다.',
      sensors: VERSUS_SENSORS, timeLimit: 45, seed: 'pillars-3',
      starts: [{ x: 120, y: 120, a: 0.5 }, { x: 780, y: 480, a: 0.5 - PI }],
      walls: [[260, 200, 40, 200], [600, 200, 40, 200], [420, 60, 60, 60], [420, 480, 60, 60]],
      foods: [[450, 300], [180, 470], [720, 130], [350, 130], [550, 470]],
      respawn: { min: 2 }, goal: { type: 'versus' },
    },
  ];

  // ---- 라이벌 뇌 --------------------------------------------------------------
  const RIVALS = [
    {
      id: 'jelly', name: '해파리', style: '방랑형', level: '쉬움', color: '#8fd3ff',
      desc: '빛에 반응은 하지만 느릿느릿하다. 한쪽으로 살짝 쏠려서 떠다닌다.',
      brain: B('bias>motorL:0.36', 'bias>motorR:0.3', 'eyeL>motorR:0.8', 'eyeR>motorL:0.8', 'whiskL>motorL:1', 'whiskR>motorR:1'),
    },
    {
      id: 'moth', name: '불나방', style: '돌격형', level: '보통', color: '#ffb35c',
      desc: '빛만 보면 전속력으로 돌진한다. 들판에서는 무섭지만 수염이 없어서 기둥에 자주 걸린다.',
      brain: B('eyeL>motorR:3', 'eyeR>motorL:3', 'bias>motorL:0.3', 'bias>motorR:0.3'),
    },
    {
      id: 'pillbug', name: '쥐며느리', style: '신중형', level: '보통', color: '#b9e27a',
      desc: '수염으로 벽을 꼼꼼히 더듬는다. 들판에서는 불나방보다 조금 느리지만 기둥 숲에서는 실수가 적다.',
      brain: B('bias>motorL:0.5', 'bias>motorR:0.5', 'eyeL>motorR:2.5', 'eyeR>motorL:2.5', 'whiskL>motorL:2.5', 'whiskR>motorR:2.5', 'whiskL>motorR:-0.8', 'whiskR>motorL:-0.8'),
    },
    {
      id: 'owl', name: '부엉이', style: '계산형', level: '어려움', color: '#d7a6ff',
      desc: '군더더기 없는 배선. 눈은 강하게 엇갈리고, 수염으로 기둥을 미리 피한다. 이 녀석을 이기는 뇌를 연구실에서 설계해 보자.',
      brain: B('eyeL>motorR:3', 'eyeR>motorL:3', 'bias>motorL:0.3', 'bias>motorR:0.3', 'whiskL>motorL:2', 'whiskR>motorR:2'),
    },
  ];

  // ---- 연구실 아레나 ------------------------------------------------------------
  const LAB_ARENAS = [
    {
      id: 'lab-field', title: '빈 들판', desc: '먹이가 계속 생기는 들판. 마음껏 실험해 보자.',
      sensors: null, timeLimit: 60, seed: 'lab-field',
      start: { x: 150, y: 300, a: 0 }, foods: [[450, 150], [450, 450], [700, 300], [250, 120]],
      respawn: { min: 2 }, goal: { type: 'free' }, hazardMode: 'stun',
    },
    {
      id: 'lab-spikes', title: '가시 들판', desc: '가시가 흩어진 들판. 찔리면 출발점으로 돌아간다.',
      sensors: null, timeLimit: 60, seed: 'lab-spikes',
      start: { x: 90, y: 300, a: 0 }, foods: [[450, 300], [750, 120], [750, 480], [250, 110]],
      hazards: [[300, 230, 18], [300, 380, 18], [560, 160, 20], [560, 440, 20], [700, 300, 16], [450, 80, 14], [450, 520, 14]],
      respawn: { min: 2 }, goal: { type: 'free' }, hazardMode: 'stun',
    },
    {
      id: 'lab-maze', title: '미로 정원', desc: '벽이 많은 정원. 수염 실험용.',
      sensors: null, timeLimit: 60, seed: 'lab-maze',
      start: { x: 80, y: 80, a: 0.6 },
      walls: [[180, 0, 30, 240], [180, 360, 30, 240], [380, 160, 30, 280], [570, 0, 30, 220], [570, 330, 30, 270], [740, 200, 160, 30]],
      foods: [[300, 300], [480, 80], [480, 520], [820, 100], [820, 450]],
      respawn: { min: 2 }, goal: { type: 'free' }, hazardMode: 'stun',
    },
    {
      id: 'lab-abyss', title: '아귀 수조', desc: '아귀와 함께 사는 수조. 잡히면 출발점으로 돌아간다.',
      sensors: null, timeLimit: 60, seed: 'lab-abyss',
      start: { x: 90, y: 300, a: 0 }, foods: [[450, 100], [450, 500], [800, 300], [250, 450]],
      predators: [{ x: 600, y: 300, a: PI, r: 28, patrol: 34, chase: 56, sense: 200, turn: 1.7, lure: 58, lureGain: 1.35,
        path: [[600, 150], [780, 300], [600, 450], [420, 300]] }],
      respawn: { min: 2 }, goal: { type: 'free' }, hazardMode: 'stun',
    },
  ];

  // ---- 개념 노트 ------------------------------------------------------------
  // 각 실험을 깨면 열린다. brain = 뇌과학 쪽 이야기, ai = 인공지능 쪽 이야기
  const CONCEPTS = {
    bias: {
      title: '편향 (Bias)', icon: 'bias', from: 's1',
      line: '입력이 없어도 늘 켜져 있는 신호.',
      brain: '실제 뉴런 중에는 자극이 없어도 스스로 발화하는 것들이 있다(자발 발화). 척수에는 뇌의 명령이 없어도 걷기 리듬을 만들어 내는 회로(중추 패턴 발생기)도 있다.',
      ai: '인공신경망의 모든 뉴런에는 편향(b)이 있다. y = w·x + b에서 b는 "입력이 0이어도 나오는 기본값"이고, 결정 경계를 원점에서 떼어 옮기는 역할을 한다. 상시 뉴런에서 오는 가중치가 바로 편향이다.',
    },
    cross: {
      title: '교차 연결', icon: 'cross', from: 's2',
      line: '왼쪽 감각이 오른쪽 몸을 움직인다.',
      brain: '사람의 왼쪽 대뇌는 몸의 오른쪽을, 오른쪽 대뇌는 왼쪽을 맡는다(대측 지배). 운동 신경 다발 대부분이 숨뇌에서 좌우로 엇갈려 내려가기 때문이다.',
      ai: '발렌티노 브라이텐베르크는 책 『Vehicles』(1984)에서 센서 두 개, 바퀴 두 개짜리 탈것만으로 "공격성", "두려움", "사랑" 같은 행동이 나온다는 것을 보였다. 엇갈려 흥분시키면 빛으로 돌진하는 "공격형"이 된다. 지금 만든 뇌가 그것이다.',
    },
    reflex: {
      title: '반사궁', icon: 'reflex', from: 's3',
      line: '생각하기 전에 몸이 먼저 피한다.',
      brain: '뜨거운 냄비에 손이 닿으면 대뇌가 "뜨겁다"를 알아채기 전에 척수가 먼저 팔 근육에 신호를 보낸다. 감각 뉴런 → 척수 → 운동 뉴런으로 이어진 짧은 길을 반사궁이라고 한다.',
      ai: '입력을 출력에 바로 잇는 것은 "규칙 기반" 제어와 같다. 로봇 청소기의 범퍼 센서가 닿으면 바로 방향을 트는 것처럼, 계산이 짧아서 빠르고 믿을 만하다. 대신 상황이 복잡해지면 규칙끼리 부딪힌다.',
    },
    inhibition: {
      title: '억제 시냅스', icon: 'inhibit', from: 's4',
      line: '신호를 더하는 것만큼 빼는 것도 중요하다.',
      brain: '뇌의 뉴런 중 상당수는 다른 뉴런을 조용하게 만드는 억제성 뉴런이다. 대표적인 억제 전달 물질이 GABA다. 흥분과 억제의 균형이 무너지면 신호가 걷잡을 수 없이 퍼질 수 있는데, 뇌전증 발작이 그 대표적인 예다.',
      ai: '인공신경망에서 억제는 음수 가중치다. 이 실험의 생명체는 빛이 셀수록 바퀴가 느려져서 빛 앞에 멈춘다. 브라이텐베르크는 이것을 "사랑"이라고 불렀다. 같은 뉴런 두 개라도 부호 하나로 성격이 정반대가 된다.',
    },
    whisker: {
      title: '촉각 지도', icon: 'whisker', from: 's5',
      line: '수염 하나마다 뇌의 자리 하나.',
      brain: '쥐는 수염을 앞뒤로 흔들며 주변을 더듬는다. 쥐 대뇌 겉질의 체성감각 영역에는 수염 하나하나에 대응하는 "배럴(barrel)"이라는 뉴런 덩어리가 수염 배열 그대로 늘어서 있다.',
      ai: '여러 감각을 한 뇌에서 합치는 것을 감각 통합(멀티모달)이라고 한다. 지금 생명체의 바퀴는 눈·수염 신호의 가중합을 받는다. 서로 다른 감각이 같은 출력을 두고 경쟁하고, 가중치가 누가 이길지 정한다.',
    },
    hidden: {
      title: '히든 뉴런', icon: 'hidden', from: 's6',
      line: '입력에서 받아 다른 뉴런에게만 넘기는, 밖에서는 안 보이는 중간 뉴런.',
      brain: '감각 뉴런과 운동 뉴런 사이를 잇는 뉴런을 개재뉴런(사이뉴런)이라고 한다. 뉴런이 302개뿐인 꼬마선충도 상당수가 개재뉴런이다. 회피할지 다가갈지 같은 "결정"이 여기서 일어난다.',
      ai: '은닉층이다. 히든 뉴런은 0 아래로 내려가지 않는 비선형(ReLU)이라서 "위험할 때만 빛 신호를 막는 문"처럼 직선 하나로는 못 하는 판단을 할 수 있다. 퍼셉트론 하나로 XOR을 못 풀던 문제를 다층 퍼셉트론이 푼 이유도 같다.',
    },
    adversarial: {
      title: '적대적 예제', icon: 'lure', from: 's7',
      line: '진짜보다 더 진짜 같은 가짜.',
      brain: '실제 아귀는 머리에서 뻗은 낚싯대 끝의 빛나는 미끼(에스카)로 먹이를 꾀어낸다. 미끼의 빛은 그 안에 사는 발광 세균이 만든다. 먹잇감의 뇌가 가진 "빛 = 먹이" 규칙을 거꾸로 이용하는 셈이다.',
      ai: '사람 눈에는 똑같아 보이는데 인공지능은 완전히 틀리게 판단하는 입력을 적대적 예제라고 한다. 판다 사진에 미세한 노이즈를 더했더니 긴팔원숭이로 분류한 실험이 유명하다. 단순한 규칙일수록 이런 미끼에 약하다.',
    },
    connectome: {
      title: '커넥톰', icon: 'connectome', from: 'versus',
      line: '뇌의 모든 연결을 그린 지도.',
      brain: '커넥톰은 뇌의 뉴런과 시냅스를 빠짐없이 그린 배선도다. 꼬마선충(뉴런 302개)이 처음으로 완성됐고, 2024년에는 FlyWire 연구진이 초파리 성체 뇌 전체(뉴런 약 14만 개, 시냅스 약 5천만 개)를 발표했다. 사람 뇌의 뉴런은 약 860억 개다.',
      ai: '이 게임에서 만든 뇌는 작은 커넥톰이다. 배선도만 알면 행동이 정해진다. 그런데 정말 그럴까? 같은 배선이라도 시냅스의 세기, 신경 조절 물질, 몸과 환경에 따라 행동이 달라진다는 것이 실제 커넥톰 연구가 마주한 질문이다.',
    },
  };

  // ===================================================================
  // 1장 뉴런 하나: 진리표 퍼즐 (퍼셉트론과 논리 게이트)
  // ===================================================================
  const LOGIC_BASE = { type: 'logic', chapter: 1, sensors: ['inA', 'inB', 'bias'], outputs: ['out'], maxHidden: 2, fixedHidden: 2 };
  const LOGIC = [
    {
      id: 'L1', title: '따라 하기', concept: 'weight',
      brief: '뉴런은 들어온 신호에 "가중치"를 곱해서 받는다. 출력이 입력 A를 그대로 따라 하게 만들어 보자. 출력은 0.5 이상이면 1, 아래면 0으로 읽는다.',
      goalText: '출력 = A',
      rows: [[0, 0, 0], [0, 1, 0], [1, 0, 1], [1, 1, 1]],
      hints: ['시냅스 하나는 "보내는 뉴런의 값 × 가중치"를 받는 뉴런에게 더해 준다.',
        '값 조절: 가중치가 0.5보다 작으면 A가 1이어도 출력이 0.5를 못 넘는다. 0.5 이상이면 된다. 가중치를 3까지 키워도 출력은 1에서 잘린다.',
        '입력 A → 출력을 +1로 이어 보자.'],
      solution: B('inA>out:1'),
      stars: [{ type: 'synapses', max: 1 }, { type: 'noHidden' }],
    },
    {
      id: 'L2', title: '둘 중 하나라도', concept: 'sum',
      brief: '여러 시냅스가 한 뉴런으로 들어오면 신호가 모두 더해진다(가중합). A나 B 중 하나라도 켜지면 출력이 켜지게 해 보자. 논리 게이트로는 OR이다.',
      goalText: 'A 또는 B (OR)',
      rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]],
      hints: ['출력 뉴런에 들어온 값들은 모두 더해진 뒤 0~1로 잘린다.',
        '값 조절: A와 B의 가중치가 둘 다 0.5 이상이면 하나만 켜져도 0.5를 넘는다. 하나라도 0.5 아래면 그쪽만 켜졌을 때 실패한다.',
        '입력 A → 출력 +1, 입력 B → 출력 +1.'],
      solution: B('inA>out:1', 'inB>out:1'),
      stars: [{ type: 'synapses', max: 2 }, { type: 'noHidden' }],
    },
    {
      id: 'L3', title: '둘 다 켜져야', concept: 'threshold',
      brief: 'A와 B가 모두 켜졌을 때만 출력이 켜지게 해 보자(AND). 하나만 켜졌을 때는 넘지 못하도록 "문턱"을 높여야 한다.',
      goalText: 'A 그리고 B (AND)',
      rows: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]],
      hints: ['상시 뉴런은 언제나 1이다. 상시 → 출력을 음수로 이으면 출력이 넘어야 할 문턱이 높아진다. 이것이 편향(bias)이다.',
        '값 조절: A, B가 +1이면 상시는 -1 근처(-0.6 ~ -1.4)가 알맞다. 0에 가까우면 하나만 켜져도 넘고, -1.5보다 세면 둘 다 켜져도 못 넘는다. 또는 편향 없이 A, B를 0.25~0.49로 작게 해도 된다.',
        '입력 A → 출력 +1, 입력 B → 출력 +1, 상시 → 출력 -1.'],
      solution: B('inA>out:1', 'inB>out:1', 'bias>out:-1'),
      stars: [{ type: 'synapses', max: 3 }, { type: 'noHidden' }],
    },
    {
      id: 'L4', title: '반대로', concept: 'negative',
      brief: 'A가 꺼져 있을 때 켜지고, A가 켜지면 꺼지는 출력을 만들어 보자(NOT). 가중치에 음수를 쓸 차례다.',
      goalText: 'A가 아니다 (NOT A)',
      rows: [[0, 0, 1], [0, 1, 1], [1, 0, 0], [1, 1, 0]],
      hints: ['아무것도 안 켜졌을 때도 출력이 켜져야 한다. 그러려면 언제나 1인 상시 뉴런이 필요하다.',
        '값 조절: 상시 → 출력은 0.5 이상(+1이면 충분). A → 출력은 음수로, 상시 값보다 0.5 이상 더 작게(상시가 +1이면 -0.6 이하).',
        '상시 → 출력 +1, 입력 A → 출력 -1.'],
      solution: B('bias>out:1', 'inA>out:-1'),
      stars: [{ type: 'synapses', max: 2 }, { type: 'noHidden' }],
    },
    {
      id: 'L5', title: '하나만 켜져야', concept: 'xor', boss: true,
      brief: 'A와 B 중 딱 하나만 켜졌을 때 출력이 켜지게 해 보자(XOR). 출력 뉴런 하나로는 어떤 가중치로도 만들 수 없다. 히든 뉴런 두 개를 써야 한다.',
      goalText: 'A와 B가 다를 때 (XOR)',
      rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]],
      hints: ['히든 뉴런은 0 아래로 내려가지 않는다. "A는 켜지고 B는 꺼졌을 때만 1"인 뉴런을 히든 1에, 반대를 히든 2에 만들고 출력에서 더해 보자.',
        '값 조절: 히든 1 = A × (+1) + B × (-1). A·B가 둘 다 켜지면 0이 되어야 하므로 음수 쪽이 양수 쪽만큼 커야 한다(+1 / -1). 히든 뉴런 → 출력은 +1이면 충분하다.',
        'A → 히든 1 +1, B → 히든 1 -1, B → 히든 2 +1, A → 히든 2 -1, 히든 1 → 출력 +1, 히든 2 → 출력 +1.'],
      solution: B('inA>h1:1', 'inB>h1:-1', 'inB>h2:1', 'inA>h2:-1', 'h1>out:1', 'h2>out:1'),
      stars: [{ type: 'synapses', max: 6 }, { type: 'hidden', min: 2 }],
    },
  ].map((st, i) => Object.assign({}, LOGIC_BASE, st, { no: '1-' + (i + 1) }));

  // ===================================================================
  // 2장 몸을 가진 뇌: 아레나 실험
  // ===================================================================
  const ARENA_SOL = {
    s1: B('bias>motorL:1', 'bias>motorR:1'),
    s2: B('eyeL>motorR:2.5', 'eyeR>motorL:2.5', 'bias>motorL:0.4', 'bias>motorR:0.4'),
    s3: B('eyeL>motorR:2', 'eyeR>motorL:2', 'bias>motorL:0.8', 'bias>motorR:0.8', 'feelL>motorL:1', 'feelR>motorR:1'),
    s4: B('bias>motorL:1', 'bias>motorR:1', 'eyeL>motorL:-1.2', 'eyeR>motorR:-1.2'),
    s5: B('eyeL>motorR:2', 'eyeR>motorL:2', 'bias>motorL:0.8', 'bias>motorR:0.8', 'whiskL>motorL:2', 'whiskR>motorR:2'),
    s6: B('eyeL>h1:1', 'feelL>h1:-2', 'feelR>h1:-2', 'eyeR>h2:1', 'feelL>h2:-2', 'feelR>h2:-2',
      'h1>motorR:2', 'h2>motorL:2', 'bias>motorL:0.7', 'bias>motorR:0.7', 'feelL>motorL:1', 'feelR>motorR:1'),
    s7: B('eyeL>h1:1', 'feelL>h1:-2', 'feelR>h1:-2', 'eyeR>h2:1', 'feelL>h2:-2', 'feelR>h2:-2',
      'h1>motorR:3', 'h2>motorL:3', 'bias>motorL:0.8', 'bias>motorR:0.8',
      'feelL>motorL:1', 'feelR>motorR:1', 'whiskL>motorL:1', 'whiskR>motorR:1'),
  };
  ARENA.forEach((st, i) => Object.assign(st, { type: 'arena', chapter: 2, no: '2-' + (i + 1), maxHidden: 2, fixedHidden: 2, solution: ARENA_SOL[st.id] }));

  // ===================================================================
  // 3장 스스로 배우는 뇌: 학습
  // ===================================================================
  const RATES = [0.02, 0.05, 0.1, 0.3, 0.5, 1, 2, 3];
  const single = (a, b, c) => ({ hidden: [], synapses: [{ from: 'inA', to: 'out', w: a }, { from: 'inB', to: 'out', w: b }, { from: 'bias', to: 'out', w: c }] });
  const TRAIN_BASE = { type: 'train', chapter: 3, sensors: ['inA', 'inB', 'bias'], outputs: ['out'], maxHidden: 2, maxEpochs: 200 };
  const TRAIN = [
    {
      id: 'T1', title: '스스로 배우기', concept: 'learning',
      brief: '이번에는 가중치를 직접 고치지 않는다. 뉴런이 틀린 만큼 스스로 가중치를 고친다. "한 번 배우기"를 눌러 OR을 배우는 모습을 지켜보자. 모든 가중치는 0에서 시작한다.',
      goalText: 'OR을 스스로 배우게 하기',
      rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 1]],
      init: single(0, 0, 0),
      hints: ['한 번 배우기 = 진리표 네 줄을 차례로 보여 주고, 줄마다 "목표 - 출력"만큼 틀린 정도(오차)를 재서 가중치를 고치는 것.',
        '값 조절: 학습률이 클수록 한 번에 많이 고친다. 0.02면 8번, 0.1이면 2번 만에 배운다.',
        '학습률 0.1로 두고 "한 번 배우기"를 두 번 누르자.'],
      solution: { lr: 0.1 },
      stars: [{ type: 'epochs', max: 10 }, { type: 'epochs', max: 2 }],
    },
    {
      id: 'T2', title: '학습률', concept: 'rate',
      brief: '이번 뉴런은 엉뚱한 가중치(A -1, B +1.5, 상시 +0.8)에서 시작해서 AND를 배워야 한다. 학습률을 골라 보자. 너무 작으면 느리고, 너무 크면 어떻게 될까?',
      goalText: 'AND를 스스로 배우게 하기',
      rows: [[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]],
      init: single(-1, 1.5, 0.8),
      hints: ['오차 그래프를 보자. 학습률이 알맞으면 오차가 꾸준히 줄어든다.',
        '값 조절: 0.02면 116번, 0.1이면 24번, 0.5면 5번 만에 배운다. 3처럼 너무 크면 한 번에 너무 많이 고쳐서 정답을 계속 지나치고 끝내 못 배운다.',
        '학습률 0.5로 두고 자동 학습을 누르자.'],
      solution: { lr: 0.5 },
      stars: [{ type: 'epochs', max: 30 }, { type: 'epochs', max: 6 }],
    },
    {
      id: 'T3', title: '한 뉴런의 한계', concept: 'limit',
      brief: '뉴런 하나에게 XOR을 가르쳐 보자. 학습률을 바꿔 가며 50번 이상 학습시키고, 오차가 어떻게 되는지 지켜보자. 이 실험은 "실패하는 것"을 확인하면 깬다.',
      goalText: 'XOR을 50번 이상 학습시켜 보기',
      rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]],
      init: single(0, 0, 0),
      goal: { type: 'epochsAtLeast', n: 50 },
      hints: ['‘하나만 켜져야’(XOR) 실험을 떠올려 보자. 그때도 출력 뉴런 하나로는 안 됐다.',
        '값 조절: 학습률을 아무리 바꿔도 오차가 0으로 가지 않는다. 작은 학습률에서는 오차가 0.25 근처에서 멈추고, 큰 학습률에서는 오히려 더 커진다.',
        '학습률 0.1과 1로 각각 자동 학습을 돌려 50번을 채우자.'],
      solution: { lr: 0.1 },
      stars: [{ type: 'rates', min: 2 }, { type: 'rates', min: 3 }],
    },
    {
      id: 'T4', title: '역전파', concept: 'backprop', boss: true,
      brief: '히든 뉴런 두 개를 넣었다. 이제 출력의 오차를 히든 뉴런에게도 거꾸로 나눠 주며 모든 가중치를 고친다. 뉴런 하나로는 못 배운 XOR을 배울 수 있을까?',
      goalText: '히든 뉴런과 함께 XOR을 배우게 하기',
      rows: [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]],
      init: { hidden: [{ id: 'h1', x: 0.5, y: 0.3 }, { id: 'h2', x: 0.5, y: 0.7 }], synapses: [
        { from: 'inA', to: 'h1', w: 0.6 }, { from: 'inB', to: 'h1', w: -0.4 }, { from: 'bias', to: 'h1', w: 0.1 },
        { from: 'inA', to: 'h2', w: -0.5 }, { from: 'inB', to: 'h2', w: 0.7 }, { from: 'bias', to: 'h2', w: 0.1 },
        { from: 'h1', to: 'out', w: 0.5 }, { from: 'h2', to: 'out', w: 0.5 }, { from: 'bias', to: 'out', w: 0 }] },
      hints: ['히든 뉴런이 출력에 크게 이어져 있을수록 오차를 많이 나눠 받는다. 히든 뉴런 값이 0이나 1에 붙어 있으면 그 뉴런은 배우지 않는다.',
        '값 조절: 0.02면 10번, 0.1이면 3번, 0.5면 2번 만에 배운다. 1 이상이면 히든 뉴런이 0이나 1에 붙어 버려서 더는 배우지 못한다.',
        '학습률 0.1로 자동 학습을 누르자.'],
      solution: { lr: 0.1 },
      stars: [{ type: 'epochs', max: 20 }, { type: 'epochs', max: 3 }],
    },
  ].map((st, i) => Object.assign({}, TRAIN_BASE, st, { no: '3-' + (i + 1) }));

  // ===================================================================
  // 사고력 퍼즐 1장: 논리 회로 퍼즐 (조건을 쪼개고 조립하는 연습)
  // ===================================================================
  const ROWS2 = (f) => [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => [a, b].concat(f(a, b)));
  const ROWS3 = (f) => [0, 1, 2, 3, 4, 5, 6, 7].map((n) => { const a = (n >> 2) & 1, b = (n >> 1) & 1, c = n & 1; return [a, b, c].concat(f(a, b, c)); });
  const PUZZLE_BASE = { type: 'logic', track: 'think', chapter: 1, outputs: ['out'], maxHidden: 2, fixedHidden: 2 };
  const PUZZLES = [
    {
      id: 'P1', title: '조건 걸기', concept: 'andnot',
      brief: 'A가 켜졌고, B는 꺼졌을 때만 출력이 켜지게 하자. "그리고"와 "아니다"를 한 뉴런에 담아야 한다.',
      goalText: 'A 그리고 (B가 아님)',
      inputs: ['inA', 'inB'], sensors: ['inA', 'inB', 'bias'],
      rows: ROWS2((a, b) => [a && !b ? 1 : 0]),
      hints: ['켜지게 하는 신호와 끄는 신호를 따로 생각해 보자. 무엇이 출력을 켜고, 무엇이 막아야 할까?',
        '값 조절: A는 +, B는 -로. A와 B가 둘 다 켜졌을 때 합이 0.5 아래가 되려면 B 쪽이 A 쪽만큼은 세야 한다.',
        '입력 A → 출력 +1, 입력 B → 출력 -1.'],
      solution: B('inA>out:1', 'inB>out:-1'),
      stars: [{ type: 'synapses', max: 2 }, { type: 'noHidden' }],
    },
    {
      id: 'P2', title: '같을 때만', concept: 'xnor',
      brief: 'A와 B가 같을 때(둘 다 꺼졌거나 둘 다 켜졌을 때) 출력이 켜지게 하자. 경우를 둘로 나눠서 각각 히든 뉴런에게 맡겨 보자.',
      goalText: 'A와 B가 같다 (XNOR)',
      inputs: ['inA', 'inB'], sensors: ['inA', 'inB', 'bias'],
      rows: ROWS2((a, b) => [a === b ? 1 : 0]),
      hints: ['"같다" = "둘 다 켜짐" 또는 "둘 다 꺼짐". 두 경우를 하나씩 맡는 뉴런을 만들고, 출력에서 OR로 합치자.',
        '값 조절: "둘 다 켜짐"은 A +1, B +1, 상시 -1. "둘 다 꺼짐"은 상시 +1, A -1, B -1. 출력은 두 히든 뉴런을 +1로 더하면 된다.',
        '히든 1 = A +1, B +1, 상시 -1 / 히든 2 = 상시 +1, A -1, B -1 / 히든 1·2 → 출력 +1.'],
      solution: B('inA>h1:1', 'inB>h1:1', 'bias>h1:-1', 'bias>h2:1', 'inA>h2:-1', 'inB>h2:-1', 'h1>out:1', 'h2>out:1'),
      stars: [{ type: 'synapses', max: 8 }, { type: 'hidden', min: 2 }],
    },
    {
      id: 'P3', title: '다수결', concept: 'majority',
      brief: '세 명이 투표한다. A, B, C 중 두 명 이상이 켜지면(찬성하면) 출력이 켜지게 하자.',
      goalText: '셋 중 둘 이상 (다수결)',
      inputs: ['inA', 'inB', 'inC'], sensors: ['inA', 'inB', 'inC', 'bias'],
      rows: ROWS3((a, b, c) => [a + b + c >= 2 ? 1 : 0]),
      hints: ['세 입력을 똑같은 세기로 더하면 "몇 명이 켰는지"가 된다. 문제는 1명일 때와 2명일 때를 가르는 문턱이다.',
        '값 조절: A, B, C를 모두 +1로 두면 1명 = 1, 2명 = 2. 상시를 -1로 하면 1명 = 0(꺼짐), 2명 = 1(켜짐)이 된다. 상시가 -0.5면 1명일 때도 0.5라서 켜져 버린다.',
        'A·B·C → 출력 +1, 상시 → 출력 -1.'],
      solution: B('inA>out:1', 'inB>out:1', 'inC>out:1', 'bias>out:-1'),
      stars: [{ type: 'synapses', max: 4 }, { type: 'noHidden' }],
    },
    {
      id: 'P4', title: '셋 중 하나만', concept: 'exactlyOne',
      brief: 'A, B, C 중 정확히 한 명만 켰을 때 출력이 켜지게 하자. 한 번에 풀기 어려우면 문제를 쪼개자.',
      goalText: '셋 중 정확히 하나',
      inputs: ['inA', 'inB', 'inC'], sensors: ['inA', 'inB', 'inC', 'bias'],
      rows: ROWS3((a, b, c) => [a + b + c === 1 ? 1 : 0]),
      hints: ['"정확히 하나" = "하나 이상" 그리고 "둘 이상은 아님". 두 조건을 히든 뉴런 두 개에 하나씩 맡겨 보자.',
        '값 조절: 히든 1 = A+B+C(하나 이상이면 1). 히든 2 = A+B+C-1(둘 이상이면 1). 출력 = 히든 1 +1, 히든 2 -1. 히든 뉴런은 1에서 잘리기 때문에 셋 다 켜져도 1 - 1 = 0이 된다.',
        'A·B·C → 히든 1 +1 / A·B·C → 히든 2 +1, 상시 → 히든 2 -1 / 히든 1 → 출력 +1, 히든 2 → 출력 -1.'],
      solution: B('inA>h1:1', 'inB>h1:1', 'inC>h1:1', 'inA>h2:1', 'inB>h2:1', 'inC>h2:1', 'bias>h2:-1', 'h1>out:1', 'h2>out:-1'),
      stars: [{ type: 'synapses', max: 9 }, { type: 'hidden', min: 2 }],
    },
    {
      id: 'P5', title: '반가산기', concept: 'adder',
      brief: 'A와 B를 더하는 회로를 만들자. 1 + 1 = 10(이진수)이다. 출력은 그 자리의 합, 출력 2는 다음 자리로 넘기는 올림이다.',
      goalText: '출력 = 합(XOR), 출력 2 = 올림(AND)',
      inputs: ['inA', 'inB'], sensors: ['inA', 'inB', 'bias'], outputs: ['out', 'out2'],
      rows: ROWS2((a, b) => [(a + b) % 2, a && b ? 1 : 0]),
      hints: ['두 출력을 따로따로 생각하자. 합은 "하나만 켜짐", 올림은 "둘 다 켜짐"이다. ‘뉴런 하나’ 장의 XOR과 AND를 떠올려 보자.',
        '값 조절: 올림(출력 2)은 A +1, B +1, 상시 -1. 합(출력)은 히든 1 = A - B, 히든 2 = B - A를 만들어 둘을 더한다. 히든 뉴런은 0 아래로 안 내려가서 A = B일 때 둘 다 0이 된다.',
        'A → 히든 1 +1, B → 히든 1 -1, B → 히든 2 +1, A → 히든 2 -1, 히든 1·2 → 출력 +1 / A·B → 출력 2 +1, 상시 → 출력 2 -1.'],
      solution: B('inA>h1:1', 'inB>h1:-1', 'inB>h2:1', 'inA>h2:-1', 'h1>out:1', 'h2>out:1', 'inA>out2:1', 'inB>out2:1', 'bias>out2:-1'),
      stars: [{ type: 'synapses', max: 9 }, { type: 'hidden', min: 2 }],
    },
    {
      id: 'P6', title: '+1과 -1만으로', concept: 'nand', boss: true,
      brief: 'A와 B가 둘 다 켜졌을 때만 꺼지는 출력(NAND)을 만들자. 단, 별을 모두 받으려면 가중치를 +1과 -1만 써야 한다. 0.5 같은 값을 못 쓰면 어떻게 문턱을 만들까?',
      goalText: 'A 그리고 B가 아니다 (NAND)',
      inputs: ['inA', 'inB'], sensors: ['inA', 'inB', 'bias'],
      rows: ROWS2((a, b) => [a && b ? 0 : 1]),
      hints: ['NAND = NOT(AND). AND를 먼저 히든 뉴런에서 만들고, 출력에서 뒤집어 보자.',
        '값 조절: 히든 1 = A +1, B +1, 상시 -1이면 AND다. 출력 = 상시 +1, 히든 1 -1이면 AND가 켜졌을 때만 0이 된다. 모두 +1·-1만 쓴다.',
        'A·B → 히든 1 +1, 상시 → 히든 1 -1 / 상시 → 출력 +1, 히든 1 → 출력 -1.'],
      solution: B('inA>h1:1', 'inB>h1:1', 'bias>h1:-1', 'bias>out:1', 'h1>out:-1'),
      stars: [{ type: 'unitWeights' }, { type: 'synapses', max: 5 }],
    },
  ].map((st, i) => Object.assign({}, PUZZLE_BASE, st, { no: '1-' + (i + 1) }));

  Object.assign(CONCEPTS, {
    andnot: {
      title: '조건 걸기', line: '켜는 신호와 막는 신호를 함께.',
      brain: '뇌에서는 흥분 신호와 억제 신호가 한 뉴런에 함께 들어온다. 억제가 이기면 흥분이 와도 발화하지 않는다. "~이지만 ~는 아닐 때"라는 조건이 이렇게 만들어진다.',
      ai: '논리로는 A AND (NOT B)다. "로그인했고, 차단당하지 않았으면 들어올 수 있다"처럼 프로그램의 조건문 대부분이 이런 모양이다.',
    },
    xnor: {
      title: '같음 판단', line: '경우를 나눠서 합친다.',
      brain: '어려운 판단을 여러 뉴런이 나눠 맡고, 다음 뉴런이 그 결과를 모으는 방식은 뇌 회로에서 흔하다.',
      ai: '"같다"(XNOR)는 "둘 다 1" OR "둘 다 0"이다. 큰 조건을 작은 경우로 나누고 마지막에 합치는 것은 코딩과 수학에서 가장 많이 쓰는 생각법이다.',
    },
    majority: {
      title: '다수결', line: '세어서 문턱과 비교한다.',
      brain: '뉴런은 여러 입력을 더해 문턱과 비교한다. 많은 입력이 동시에 들어와야 발화하는 것은 뇌가 잡음을 거르는 방법 중 하나다.',
      ai: '여러 모델의 답을 모아 투표로 정하는 것을 앙상블이라고 한다. 모델 하나가 틀려도 다수가 맞으면 맞는 답이 나온다.',
    },
    exactlyOne: {
      title: '문제 쪼개기', line: '"정확히 하나" = "하나 이상" 그리고 "둘 이상은 아님".',
      brain: '뇌는 복잡한 판단을 단계로 나눠 처리한다. 앞 단계 뉴런이 단순한 조건을 판단하고, 뒤 단계 뉴런이 그것을 조합한다.',
      ai: '한 번에 풀기 어려운 문제를 풀 수 있는 작은 문제로 나누는 것을 분할 정복이라고 한다. 신경망의 히든층도 이렇게 중간 조건을 만든다.',
    },
    adder: {
      title: '반가산기', line: '컴퓨터는 이렇게 더한다.',
      brain: '사람의 뇌는 이진수로 더하지 않는다. 대신 수를 대략적인 크기로 느끼는 영역(두정엽)이 따로 있다고 알려져 있다.',
      ai: '컴퓨터의 덧셈은 XOR(그 자리의 합)과 AND(올림)로 만든 반가산기에서 시작한다. 반가산기를 이어 붙이면 몇 자리 수든 더할 수 있다.',
    },
    nand: {
      title: 'NAND 하나면 충분', line: '단순한 부품만으로 무엇이든.',
      brain: '뇌의 뉴런도 종류는 많지 않지만, 연결 방식에 따라 전혀 다른 일을 한다. 부품보다 배선이 중요하다.',
      ai: 'NAND 게이트만 있으면 AND, OR, NOT은 물론 어떤 논리 회로든 만들 수 있다(만능 게이트). 실제 컴퓨터 칩도 NAND 같은 단순한 게이트 수십억 개로 이루어져 있다.',
    },
  });

  // ===================================================================
  // AI 배우기 3장: 보상으로 배우는 뇌 (강화학습: 무엇에 점수를 줄 것인가)
  // ===================================================================
  const SIGMAS = [0.1, 0.3, 0.6, 1];
  const REWARD_BASE = { type: 'reward', track: 'ai', chapter: 3, sensors: ['bias', 'eyeL', 'eyeR'], outputs: ['motorL', 'motorR'], maxHidden: 0, funcs: ['clamp'], children: 6, maxGens: 30 };
  const REWARDS = [
    {
      id: 'R1', title: '칭찬하기', concept: 'reward', tour: 'reward',
      brief: '이번에는 뇌를 직접 잇지 않는다. 생명체가 할 수 있는 일마다 점수를 정해 주면, 생명체가 시행착오로 점수를 많이 받는 뇌를 스스로 찾는다. 먹이 3개를 먹게 하려면 무엇에 점수를 줘야 할까?',
      goalText: '먹이 3개 먹기 (20초)',
      timeLimit: 20, start: { x: 120, y: 300, a: 0 },
      foodQueue: [[420, 300], [700, 200], [700, 430], [300, 480]], goal: { type: 'eat', n: 3 },
      events: ['eat', 'alive'], preset: {},
      hints: ['생명체는 "점수의 합"이 커지는 쪽으로만 바뀐다. 우리가 원하는 일(먹이 먹기)에 점수를 줘야 그 일을 배운다.',
        '값 조절: "시간이 지나면"에만 점수를 주면 가만히 있어도 점수가 똑같이 쌓여서 아무것도 배우지 않는다. 탐험 정도가 0.1이면 너무 조금씩 바뀌어서 처음 먹이를 못 찾는다.',
        '"먹이를 먹으면" +5, 탐험 정도 0.3으로 학습 시작.'],
      solution: { rw: { eat: 5 }, sigma: 0.3 },
      stars: [{ type: 'gens', max: 12 }, { type: 'rules', max: 1 }],
    },
    {
      id: 'R2', title: '조금씩 칭찬하기', concept: 'shaping',
      brief: '이번에는 먹이가 모두 생명체 등 뒤에 있고, 학습 기회도 12세대뿐이다. 먹었을 때만 점수를 주면 우연히 먹기 전까지는 어느 쪽이 좋은지 알 길이 없다. 먹이에 다가가는 과정에도 점수를 줘 보자.',
      goalText: '12세대 안에 먹이 3개를 먹게 하기',
      timeLimit: 25, start: { x: 640, y: 300, a: 0 },
      foodQueue: [[150, 180], [150, 430], [380, 520], [380, 90]], goal: { type: 'eat', n: 3 },
      events: ['eat', 'near', 'alive'], preset: {}, maxGens: 12,
      hints: ['보상이 너무 드물면(희소 보상) 배울 실마리가 없다. 목표로 가는 중간 단계에 작은 점수를 주면 길을 찾기 쉬워진다.',
        '값 조절: "먹이를 먹으면"만 주면 26세대쯤 걸려서 12세대 안에는 못 배운다. "먹이에 가까워지면" +1을 더하면 7세대쯤에 배운다(탐험 0.3). 탐험 0.6이면 더 빠르다.',
        '"먹이를 먹으면" +5, "먹이에 가까워지면" +1, 탐험 정도 0.3.'],
      solution: { rw: { eat: 5, near: 1 }, sigma: 0.3 },
      stars: [{ type: 'gens', max: 8 }, { type: 'rules', max: 2 }],
    },
    {
      id: 'R3', title: '벌점', concept: 'penalty',
      sensors: ['bias', 'eyeL', 'eyeR', 'feelL', 'feelR'],
      brief: '먹이 가는 길에 가시가 있다. 이 실험에서는 가시에 찔려도 시간 손해가 없다. 그러면 생명체는 가시를 신경 쓸 이유가 없다. 가시에 한 번도 찔리지 않고 먹게 하려면?',
      goalText: '가시에 한 번도 찔리지 않고 먹이 3개',
      timeLimit: 25, start: { x: 90, y: 300, a: 0 }, maxHits: 0,
      foodQueue: [[760, 300], [760, 120], [760, 480]],
      hazards: [[430, 300, 26], [760, 210, 16], [760, 390, 16]], goal: { type: 'eat', n: 3 },
      events: ['eat', 'near', 'hit'], preset: { eat: 5, near: 1 },
      hints: ['보상은 음수가 될 수도 있다. 피하게 하고 싶은 일에는 벌점을 줘야 한다. 생명체에게는 더듬이가 있어서 가시를 느낄 수 있다.',
        '값 조절: 벌점이 없으면 가시를 그냥 뚫고 지나가는 게 가장 빠른 길이라 찔린다. "가시에 찔리면" -5를 주면 돌아가는 법을 배운다. -1처럼 약하면 배우는 데 더 오래 걸린다(16세대쯤, -5면 12세대쯤).',
        '"먹이를 먹으면" +5, "먹이에 가까워지면" +1, "가시에 찔리면" -5, 탐험 정도 0.3.'],
      solution: { rw: { eat: 5, near: 1, hit: -5 }, sigma: 0.3 },
      stars: [{ type: 'gens', max: 15 }, { type: 'rules', max: 3 }],
    },
    {
      id: 'R4', title: '점수의 함정', concept: 'hacking', boss: true,
      sensors: ['bias', 'eyeL', 'eyeR', 'whiskL', 'whiskR'],
      brief: '누군가 "많이 돌아다니면 먹이도 많이 찾겠지"라고 생각해서 점수 규칙을 미리 정해 두었다(움직이면 +3, 먹이를 먹으면 +1). 그대로 학습시켜 보고 무엇을 배우는지 지켜본 뒤, 규칙을 고쳐서 진짜 목표를 이루게 하자.',
      goalText: '먹이 3개 먹기 (25초)',
      timeLimit: 25, start: { x: 450, y: 300, a: 0 },
      foodQueue: [[150, 150], [750, 450], [150, 450], [750, 150]], goal: { type: 'eat', n: 3 },
      events: ['eat', 'near', 'move', 'bump'], preset: { move: 3, eat: 1 },
      hints: ['생명체는 우리가 원한 것이 아니라 점수를 준 것을 배운다. 먼저 정해진 규칙 그대로 학습시켜 보자. 점수는 오르는데 먹이는 거의 못 먹는다.',
        '값 조절: "움직이면" +3이 문제다. 빨리 빙빙 도는 것만으로 먹이보다 훨씬 많은 점수를 받는다. "움직이면"을 0으로 내리고, 먹이와 먹이에 가까워지기에 점수를 주자.',
        '"움직이면" 0, "먹이를 먹으면" +5, "먹이에 가까워지면" +1, 탐험 정도 0.3.'],
      solution: { rw: { eat: 5, near: 1 }, sigma: 0.3 },
      stars: [{ type: 'gens', max: 12 }, { type: 'rules', max: 2 }],
    },
  ].map((st, i) => Object.assign({}, REWARD_BASE, st, { no: '3-' + (i + 1) }));

  // 고를 수 있는 활성화 함수: 1장은 기본 함수만(게이트를 직접 만들어 보는 장이라서), 2장부터 함수, 연구실은 게이트·소프트맥스까지
  const FUNCS_BASIC = ['clamp'];
  const FUNCS_ACT = ['clamp', 'relu', 'linear', 'step', 'sigmoid', 'tanh'];
  const FUNCS_ALL = ['clamp', 'relu', 'linear', 'step', 'sigmoid', 'tanh', 'and', 'or', 'not', 'xor', 'softmax'];
  LOGIC.forEach((st) => { st.funcs = FUNCS_BASIC; });
  PUZZLES.forEach((st) => { st.funcs = FUNCS_BASIC; });
  ARENA.forEach((st) => { st.funcs = FUNCS_ACT; });
  TRAIN.forEach((st) => { st.funcs = FUNCS_BASIC; });

  // ===================================================================
  // 6장 점을 나누는 뇌: 분류와 결정 경계 (진리표 대신 평면 위의 점)
  // 한 점 = [x, y, 정답]. 출력이 0.5 이상이면 파랑(1), 아래면 주황(0).
  // ===================================================================
  // 시드 난수로 점을 뽑는다(언제나 같은 데이터). label(x, y)가 null이면 경계 근처라 버린다.
  function points(seed, n, label) {
    const r = SA.sim.makeRng(seed), out = [], cnt = [0, 0];
    for (let guard = 0; out.length < n && guard < 20000; guard++) {
      const x = Math.round((0.05 + 0.9 * r()) * 100) / 100, y = Math.round((0.05 + 0.9 * r()) * 100) / 100;
      const l = label(x, y);
      if (l === null || cnt[l] >= Math.ceil(n / 2)) continue;
      cnt[l]++;
      out.push([x, y, l]);
    }
    return out;
  }
  const withFn = (b, fn) => Object.assign(b, { fn });
  const PLOT_BASE = { type: 'logic', plot: true, inputs: ['inX', 'inY'], sensors: ['inX', 'inY', 'bias'], outputs: ['out'], maxHidden: 2, fixedHidden: 2 };
  const CLASSIFY = [
    {
      id: 'C1', title: '선 하나로 나누기', concept: 'boundary', tour: 'plot',
      brief: '이번에는 진리표 대신 평면 위의 점들이다. 뉴런은 점의 x·y 좌표를 받아서, 0.5 이상이면 파랑, 아래면 주황이라고 답한다. 배경 색은 평면 모든 곳에서 뇌가 내는 답이고, 두 색이 만나는 선이 "결정 경계"다. 오른쪽 파랑과 왼쪽 주황을 나눠 보자.',
      goalText: '모든 점을 맞게 나누기',
      rows: points('C1', 16, (x) => (x < 0.4 ? 0 : x > 0.6 ? 1 : null)),
      hints: ['x 좌표가 클수록 파랑이다. x 좌표 → 출력을 이으면 오른쪽일수록 출력이 커진다.',
        '값 조절: x → 출력 가중치를 키우면 경계가 가팔라지고, 상시(편향)를 음수로 하면 경계가 오른쪽으로 밀린다. 경계는 "x × 가중치 + 편향 = 0.5"인 곳이다. 가중치 2, 편향 -0.5면 경계가 x = 0.5에 선다.',
        'x 좌표 → 출력 +2, 상시 → 출력 -0.5.'],
      solution: B('inX>out:2', 'bias>out:-0.5'),
      stars: [{ type: 'synapses', max: 2 }, { type: 'noHidden' }],
    },
    {
      id: 'C2', title: '비스듬한 선', concept: 'slope',
      brief: '이번에는 경계가 비스듬하다. 오른쪽 위는 파랑, 왼쪽 아래는 주황. x와 y를 함께 써야 한다. 가중치는 선의 기울기를, 편향은 선의 위치를 정한다.',
      goalText: '모든 점을 맞게 나누기',
      rows: points('C2', 18, (x, y) => (x + y < 0.88 ? 0 : x + y > 1.12 ? 1 : null)),
      hints: ['x도 크고 y도 클수록 파랑이다. 둘 다 출력에 이어 보자.',
        '값 조절: x와 y의 가중치가 같으면 경계는 45° 대각선이 된다. 둘 다 +1이면 x + y = 1 근처에서 나누려면 편향이 -0.5여야 한다(1 - 0.5 = 0.5). 한쪽 가중치만 키우면 선이 그쪽으로 기운다.',
        'x 좌표 → 출력 +1, y 좌표 → 출력 +1, 상시 → 출력 -0.5.'],
      solution: B('inX>out:1', 'inY>out:1', 'bias>out:-0.5'),
      stars: [{ type: 'synapses', max: 3 }, { type: 'noHidden' }],
    },
    {
      id: 'C3', title: '가운데 띠', concept: 'shape',
      brief: '파랑이 가운데 세로 띠에만 있고, 주황은 양쪽에 있다. 직선 하나로는 띠를 만들 수 없다. 히든 뉴런 두 개로 선 두 개를 만들어 빼 보자.',
      goalText: '모든 점을 맞게 나누기',
      rows: points('C3', 18, (x) => (x >= 0.42 && x <= 0.58 ? 1 : x <= 0.22 || x >= 0.78 ? 0 : null)),
      hints: ['히든 1 = "x가 띠의 왼쪽 끝보다 크다", 히든 2 = "x가 띠의 오른쪽 끝보다 크다". 출력 = 히든 1 - 히든 2면 둘 사이에서만 켜진다.',
        '값 조절: 히든 1은 x +3, 상시 -0.75(x ≈ 0.42부터 켜짐). 히든 2는 x +3, 상시 -2(x ≈ 0.83에서 다 켜짐). 출력에서는 히든 2를 -2로 세게 빼야 오른쪽 주황이 꺼진다. 활성화 함수를 "계단"으로 바꾸면 경계가 칼같이 선다.',
        'x → 히든 1 +3, 상시 → 히든 1 -0.75, x → 히든 2 +3, 상시 → 히든 2 -2, 히든 1 → 출력 +1, 히든 2 → 출력 -2.'],
      solution: B('inX>h1:3', 'bias>h1:-0.75', 'inX>h2:3', 'bias>h2:-2', 'h1>out:1', 'h2>out:-2'),
      stars: [{ type: 'synapses', max: 6 }, { type: 'hidden', min: 2 }],
    },
    {
      id: 'C4', title: '동그라미 안쪽', concept: 'shapes', boss: true, maxHidden: 4, fixedHidden: 4,
      brief: '파랑은 가운데 동그라미 안에, 주황은 그 바깥 고리에 있다. 히든 뉴런 4개로 위·아래·왼쪽·오른쪽 선을 하나씩 만들고, 네 선이 모두 "안쪽"이라고 할 때만 출력을 켜 보자. 선을 여러 개 합치면 어떤 모양이든 만들 수 있다.',
      goalText: '모든 점을 맞게 나누기',
      rows: points('C4', 20, (x, y) => { const r = Math.hypot(x - 0.5, y - 0.5); return r <= 0.17 ? 1 : r >= 0.32 && r <= 0.45 ? 0 : null; }),
      hints: ['네 히든 뉴런을 "x > 0.3", "x < 0.7", "y > 0.3", "y < 0.7"로 만들자. 네 가지가 다 맞을 때만 켜지는 것은 AND다.',
        '값 조절: 히든 뉴런의 활성화 함수를 "계단"으로 바꾸면 0 아니면 1만 낸다. "x > 0.3"은 x +3, 상시 -0.4. "x < 0.7"은 x -3, 상시 +2.6. 출력은 네 히든 뉴런을 +1씩 더하고 상시 -3(넷 다 켜져야 1).',
        '히든 1~4를 계단 함수로: (x +3, 상시 -0.4) (x -3, 상시 +2.6) (y +3, 상시 -0.4) (y -3, 상시 +2.6) / 히든 1~4 → 출력 +1, 상시 → 출력 -3.'],
      solution: withFn(B('inX>h1:3', 'bias>h1:-0.4', 'inX>h2:-3', 'bias>h2:2.6', 'inY>h3:3', 'bias>h3:-0.4', 'inY>h4:-3', 'bias>h4:2.6',
        'h1>out:1', 'h2>out:1', 'h3>out:1', 'h4>out:1', 'bias>out:-3'), { h1: 'step', h2: 'step', h3: 'step', h4: 'step' }),
      stars: [{ type: 'synapses', max: 13 }, { type: 'hidden', min: 4 }],
    },
    {
      id: 'C5', title: '외우지 말고 이해하기', concept: 'overfit',
      brief: '훈련 데이터 22개 중 2개는 정답이 잘못 적혀 있다(실수로 붙은 꼬리표). 진짜 실력은 처음 보는 "시험 데이터"로 잰다. 훈련 데이터를 100% 맞히려고 잘못된 점까지 억지로 감싸면 어떻게 될까? 목표는 시험 데이터 90% 이상이다.',
      goalText: '시험 데이터 90% 이상 맞히기',
      rows: points('C5', 20, (x, y) => (x + y < 0.9 ? 0 : x + y > 1.1 ? 1 : null)).concat([[0.27, 0.3, 1], [0.75, 0.78, 0]]),
      test: points('C5-test', 20, (x, y) => (x + y < 0.94 ? 0 : x + y > 1.06 ? 1 : null)).concat([[0.22, 0.36, 0], [0.33, 0.24, 0], [0.8, 0.72, 1], [0.7, 0.84, 1]]),
      need: { test: 0.9 },
      hints: ['잘못 적힌 두 점은 반대편 색들 한가운데 혼자 있다. 그 점에 맞추려고 경계를 비틀면, 그 근처의 시험 데이터를 틀린다. 이것을 과적합(외우기)이라고 한다.',
        '값 조절: 훈련 데이터는 2개를 틀려도(약 91%) 괜찮다. 단순한 대각선 하나(‘비스듬한 선’ 실험과 같은 뇌)가 시험 데이터를 가장 잘 맞힌다.',
        'x → 출력 +1, y → 출력 +1, 상시 → 출력 -0.5. 히든 뉴런은 쓰지 않는다.'],
      solution: B('inX>out:1', 'inY>out:1', 'bias>out:-0.5'),
      stars: [{ type: 'testAcc', min: 1 }, { type: 'noHidden' }],
    },
  ].map((st) => Object.assign({}, PLOT_BASE, { funcs: FUNCS_ACT }, st));
  const CLASSIFY_TRAIN = {
    id: 'C6', title: '선을 스스로 찾기', concept: 'gradient', type: 'train', plot: true,
    inputs: ['inX', 'inY'], sensors: ['inX', 'inY', 'bias'], outputs: ['out'], maxHidden: 2, maxEpochs: 200, funcs: FUNCS_BASIC,
    brief: '이번에는 경계를 손으로 긋지 않는다. 엉뚱한 방향의 선에서 시작해서, 틀린 점마다 조금씩 가중치를 고치면 경계가 저절로 돌아가 제자리를 찾는다. 배경 색이 학습할 때마다 어떻게 바뀌는지 지켜보자.',
    goalText: '모든 점을 맞히도록 스스로 배우게 하기',
    rows: points('C6', 20, (x, y) => (y - x < -0.08 ? 0 : y - x > 0.08 ? 1 : null)),
    init: { hidden: [], synapses: [{ from: 'inX', to: 'out', w: 0.6 }, { from: 'inY', to: 'out', w: -0.4 }, { from: 'bias', to: 'out', w: 0.3 }] },
    hints: ['학습 한 번 = 모든 점을 한 번씩 보고, 틀린 만큼 가중치를 고치는 것. 4장에서 진리표로 한 것과 같은 규칙이다.',
      '값 조절: 학습률 0.02면 25번, 0.1이면 7번, 0.3이면 5번 만에 배운다. 1이나 3처럼 크면 경계가 이리저리 크게 흔들리기만 하고 끝내 다 맞히지 못한다.',
      '학습률 0.3으로 자동 학습.'],
    solution: { lr: 0.3 },
    stars: [{ type: 'epochs', max: 40 }, { type: 'epochs', max: 15 }],
  };

  // ===================================================================
  // 7장 그림을 보는 뇌: 합성곱 필터와 풀링 (CNN의 기초)
  // ===================================================================
  const IMG = {
    V1: ['.#....', '.#....', '.#....', '.#....', '.#....', '.#....'],
    V2: ['..#...', '..#...', '..#...', '..#...', '..#...', '..#...'],
    V4: ['....#.', '....#.', '....#.', '....#.', '....#.', '....#.'],
    H1: ['......', '######', '......', '......', '......', '......'],
    H2: ['......', '......', '######', '......', '......', '......'],
    H4: ['......', '......', '......', '......', '######', '......'],
    D: ['#.....', '.#....', '..#...', '...#..', '....#.', '.....#'],
    E: ['...###', '...###', '...###', '...###', '...###', '...###'],
    E2: ['###...', '###...', '###...', '###...', '###...', '###...'],
    F: ['######', '######', '######', '######', '######', '######'],
    X1: ['..#...', '..#...', '..#...', '######', '..#...', '..#...'],
    X2: ['...#..', '######', '...#..', '...#..', '...#..', '...#..'],
  };
  const filt = (w, b) => ({ w, b });
  const VERT = filt([0, 1, 0, 0, 1, 0, 0, 1, 0], -2);
  const HORZ = filt([0, 0, 0, 1, 1, 1, 0, 0, 0], -2);
  const VISION_BASE = { type: 'vision', maxHidden: 0, funcs: FUNCS_BASIC, sensors: [], outputs: [] };
  const VISION = [
    {
      id: 'V1', title: '세로줄 찾기', concept: 'conv', tour: 'vision', mode: 'map',
      brief: '그림을 보는 AI(CNN)는 작은 3×3 "필터" 하나를 그림 위에서 한 칸씩 옮기며 같은 계산을 되풀이한다. 겹친 칸마다 (그림 칸 × 필터 칸)을 더하고 편향을 더한 값이 "특징 맵"의 한 칸이 된다. 세로줄이 있는 자리에서만 특징 맵이 켜지게 필터를 칠해 보자.',
      goalText: '모든 그림에서 특징 맵이 목표와 같게',
      images: [IMG.V1, IMG.V4, IMG.H2, IMG.D], reference: { filters: [filt([-1, 1, -1, -1, 1, -1, -1, 1, -1], -2)] },
      hints: ['필터의 가운데 세로 세 칸에 +1을 칠하면, 세로줄과 겹칠 때 합이 3이 된다. 다른 그림(가로줄, 대각선)은 가운데 세로에 1칸만 걸친다.',
        '값 조절: 합이 3일 때만 켜지려면 편향을 -2로 하자(3 - 2 = 1, 1 - 2 = 음수). 편향이 0이면 대각선·가로줄이 가운데를 한 칸만 지나도 켜져서 틀리고, -3이면 세로줄에서도 꺼진다. -1이나 -2가 알맞다.',
        '필터 가운데 세로 세 칸 +1, 편향 -2.'],
      solution: { filters: [VERT] },
      stars: [{ type: 'cells', max: 3 }, { type: 'unitFilter' }],
    },
    {
      id: 'V2', title: '가로줄 찾기', concept: 'featuremap', mode: 'map',
      brief: '같은 그림이라도 필터를 바꾸면 전혀 다른 것을 찾는다. 이번에는 가로줄이 있는 자리에서만 켜지는 필터를 만들자. 실제 CNN은 이런 필터를 수십~수백 개 함께 쓴다.',
      goalText: '모든 그림에서 특징 맵이 목표와 같게',
      images: [IMG.H1, IMG.H4, IMG.V2, IMG.D], reference: { filters: [filt([-1, -1, -1, 1, 1, 1, -1, -1, -1], -2)] },
      hints: ['세로줄 필터를 옆으로 눕히면 된다.', '값 조절: 가운데 가로 세 칸 +1, 편향 -2.', '필터 가운데 가로 세 칸 +1, 편향 -2.'],
      solution: { filters: [HORZ] },
      stars: [{ type: 'cells', max: 3 }, { type: 'unitFilter' }],
    },
    {
      id: 'V3', title: '어두움에서 밝음으로', concept: 'edge', mode: 'map',
      brief: '이번에는 줄이 아니라 "경계"를 찾는다. 왼쪽이 어둡고 오른쪽이 밝아지는 자리에서만 켜지게 하자. 사람의 눈과 뇌도 가장 먼저 이런 경계를 찾는다.',
      goalText: '모든 그림에서 특징 맵이 목표와 같게',
      images: [IMG.E, IMG.E2, IMG.F, IMG.V2], reference: { filters: [filt([-1, 0, 1, -1, 0, 1, -1, 0, 1], -2)] },
      hints: ['왼쪽이 어둡고 오른쪽이 밝다 = "오른쪽 칸은 더하고, 왼쪽 칸은 뺀다". 모두 밝은 그림에서는 더한 것과 뺀 것이 같아져서 0이 된다.',
        '값 조절: 오른쪽 세로 세 칸 +1, 왼쪽 세로 세 칸 -1이면 경계 위에서 합이 3이 된다. 편향 -2로 합이 3일 때만 켜지게 하자. 가운데 줄은 0으로 둔다.',
        '필터 왼쪽 세로 세 칸 -1, 오른쪽 세로 세 칸 +1, 가운데는 0, 편향 -2.'],
      solution: { filters: [filt([-1, 0, 1, -1, 0, 1, -1, 0, 1], -2)] },
      stars: [{ type: 'cells', max: 6 }, { type: 'unitFilter' }],
    },
    {
      id: 'V4', title: '세로일까 가로일까', concept: 'pooling', boss: true, mode: 'class',
      brief: '이제 그림 전체를 분류한다. 필터 두 개(A, B)로 특징 맵을 만들고, 각 특징 맵에서 가장 큰 값 하나만 뽑는다(최대 풀링). 그 두 값을 출력 뉴런에 이어서, "세로줄만 있는 그림"이면 1, 가로줄이 하나라도 있으면 0이라고 답하게 하자. 이것이 CNN의 전체 흐름이다.',
      goalText: '그림 6장을 모두 맞게 분류하기',
      images: [IMG.V1, IMG.V4, IMG.H1, IMG.H4, IMG.X1, IMG.X2], labels: [1, 1, 0, 0, 0, 0],
      hints: ['필터 A는 세로줄 찾기, 필터 B는 가로줄 찾기로 만들자. 풀링한 값은 "그 특징이 그림 어딘가에 있었나?"라는 뜻이 된다.',
        '값 조절: 출력 = A × (+1) + B × (-1) + 0. 세로만 있으면 1 - 0 = 1, 가로만 있으면 0 - 1 → 0, 둘 다 있으면 1 - 1 = 0.',
        '필터 A = 가운데 세로 +1·편향 -2, 필터 B = 가운데 가로 +1·편향 -2, 출력: A +1, B -1, 편향 0.'],
      solution: { filters: [VERT, HORZ], out: { w: [1, -1], b: 0 } },
      stars: [{ type: 'cells', max: 6 }, { type: 'unitFilter' }],
    },
  ].map((st) => Object.assign({}, VISION_BASE, st));

  Object.assign(CONCEPTS, {
    boundary: {
      title: '결정 경계', line: '뉴런 하나 = 평면 위의 직선 하나.',
      brain: '뇌도 감각 정보를 보고 "이건 먹이, 저건 위험"처럼 범주를 나눈다. 비슷한 자극이 조금씩 변해도 어느 순간 판단이 확 바뀌는 지점(범주 경계)이 있다.',
      ai: '분류 AI는 입력 공간을 영역으로 나눈다. 영역이 바뀌는 곳이 결정 경계다. 뉴런 하나(퍼셉트론)의 결정 경계는 언제나 곧은 직선(입력이 많으면 평면)이다.',
    },
    slope: {
      title: '가중치와 편향의 모양', line: '가중치는 기울기, 편향은 위치.',
      brain: '뉴런의 문턱을 바꾸면 같은 자극에도 반응이 달라진다. 피곤하거나 긴장하면 같은 소리에도 더 쉽게, 혹은 더 어렵게 반응하는 것과 비슷하다.',
      ai: '직선 w₁x + w₂y + b = 0.5에서 w₁:w₂의 비율이 선의 기울기를, b가 선의 위치를 정한다. 학습은 결국 이 선을 데이터에 맞게 돌리고 옮기는 일이다.',
    },
    shape: {
      title: '선을 겹쳐 만든 모양', line: '히든 뉴런마다 선 하나.',
      brain: '시각 피질에서도 단순한 특징(선, 경계)을 보는 뉴런들의 신호가 모여, 다음 단계 뉴런이 더 복잡한 모양을 알아본다.',
      ai: '히든 뉴런 하나하나가 직선 경계를 하나씩 만들고, 출력 뉴런이 그것들을 더하거나 빼서 띠·네모·동그라미 같은 모양을 만든다. 직선 하나로는 못 하는 일을 층이 해낸다.',
    },
    shapes: {
      title: '보편 근사', line: '선이 충분하면 어떤 모양이든.',
      brain: '뇌의 뉴런 수는 엄청나게 많다. 단순한 계산을 하는 뉴런을 아주 많이 모으면 복잡한 판단도 할 수 있다.',
      ai: '히든층이 하나만 있어도 히든 뉴런이 충분히 많으면 원하는 모양을 얼마든지 가깝게 만들 수 있다는 것이 알려져 있다(보편 근사 정리). 동그라미를 네모로 감싼 것이 그 첫걸음이다.',
    },
    overfit: {
      title: '과적합과 일반화', line: '외운 것과 이해한 것은 다르다.',
      brain: '시험 문제를 통째로 외우면 같은 문제는 맞히지만 조금 바뀐 문제는 틀린다. 원리를 이해해야 처음 보는 문제도 푼다.',
      ai: 'AI는 훈련 데이터로 배우고, 처음 보는 시험 데이터로 실력을 잰다. 훈련 데이터의 실수(잡음)까지 맞히려고 너무 복잡해지는 것을 과적합, 처음 보는 데이터도 잘 맞히는 것을 일반화라고 한다.',
    },
    gradient: {
      title: '경사 하강', line: '틀린 쪽으로 조금씩 굴러 내려간다.',
      brain: '뇌는 한 번에 완벽하게 배우지 않는다. 연습할 때마다 조금씩 고쳐 나가면서 실수가 줄어든다.',
      ai: '오차가 줄어드는 방향으로 가중치를 조금씩 옮기는 것을 경사 하강법이라고 한다. 오차를 산이라고 보면 가장 가파르게 내려가는 쪽으로 한 걸음씩 내려가는 셈이다. 거의 모든 신경망이 이 방법으로 배운다.',
    },
    conv: {
      title: '합성곱 필터', line: '작은 필터 하나를 그림 전체에 옮겨 가며.',
      brain: '1959년 휴벨과 비셀은 고양이 시각 피질에서 특정 방향의 선에만 반응하는 뉴런을 찾았다(1981년 노벨상). 각 뉴런은 시야의 작은 부분만 본다.',
      ai: '합성곱 신경망(CNN)은 3×3 같은 작은 필터를 그림의 모든 자리에 똑같이 적용한다(가중치 공유). 그래서 줄이 그림 어디에 있든 같은 필터로 찾을 수 있고, 필요한 가중치 수도 아주 적다.',
    },
    featuremap: {
      title: '특징 맵', line: '필터마다 다른 것을 찾는다.',
      brain: '시각 피질에는 세로선, 가로선, 비스듬한 선에 각각 반응하는 뉴런들이 따로 있다. 같은 장면을 여러 "관점"으로 동시에 본다.',
      ai: '필터 하나가 만든 결과를 특징 맵이라고 한다. CNN은 필터 수십~수백 개로 특징 맵을 여러 장 만들고, 다음 층은 그 특징 맵들을 다시 입력으로 받아 더 복잡한 특징을 찾는다.',
    },
    edge: {
      title: '경계 찾기', line: '밝기가 바뀌는 곳에 정보가 있다.',
      brain: '눈의 망막과 시각 피질의 첫 단계는 밝기가 갑자기 바뀌는 경계에 특히 강하게 반응한다. 그래서 우리는 선 몇 개로 그린 그림만 보고도 무엇인지 안다.',
      ai: '"한쪽은 빼고 한쪽은 더하는" 필터는 경계를 찾는다. 사진 편집의 가장자리 검출도 같은 원리다. 학습한 CNN의 첫 층 필터들도 저절로 이런 경계 필터 모양이 된다.',
    },
    pooling: {
      title: '풀링과 CNN', line: '어디 있었는지보다, 있었는지가 중요할 때.',
      brain: '시각 피질의 더 깊은 단계 뉴런은 대상이 시야의 어디에 있든 반응한다. 위치가 조금 바뀌어도 같은 물건으로 알아보는 힘이다.',
      ai: '최대 풀링은 특징 맵에서 가장 큰 값만 남겨 "이 특징이 어딘가에 있었다"만 전한다. 합성곱 → 풀링 → 분류로 이어지는 구조가 CNN이고, 1998년 손글씨 숫자를 읽은 LeNet, 2012년 사진 1000가지를 분류한 AlexNet이 이 구조였다.',
    },
  });

  // ===================================================================
  // 8장 기억하는 뇌: 되먹임과 순환 신경망(RNN)
  // 입력이 한 칸씩 시간 순서대로 들어온다. 기억 뉴런 = 바로 전 칸의 히든·출력 값.
  // ===================================================================
  const seqs = (xs, f) => xs.map((x) => ({ x, t: f(x) }));
  const delayBy = (k) => (x) => x.map((_, i) => (i >= k ? x[i - k] : 0));
  const latchOn = (x) => { let on = 0; return x.map((v) => (on = on || v)); };
  const twiceInRow = (x) => x.map((v, i) => (i > 0 && v && x[i - 1] ? 1 : 0));
  const parityOf = (x) => { let p = 0; return x.map((v) => (p ^= v)); };
  const SEQ_BASE = { type: 'seq', outputs: ['out'], maxHidden: 0, fixedHidden: 0, funcs: FUNCS_BASIC };
  const MEMORY = [
    {
      id: 'M1', title: '방금 전 기억하기', concept: 'recurrent', tour: 'seq',
      sensors: ['inA', 'mem1', 'bias'], maxHidden: 1, fixedHidden: 1,
      brief: '지금까지의 뇌는 지금 들어온 입력만 보고 답했다. 이번에는 입력이 한 칸씩 시간 순서대로 들어오고, 출력은 "바로 전 칸의 입력"을 말해야 한다. 지금 입력만 봐서는 절대 알 수 없다. 기억 1 뉴런에는 히든 1이 바로 전 칸에 낸 값이 되돌아온다. 이 되먹임이 순환 신경망(RNN)의 핵심이다.',
      goalText: '모든 칸에서 출력 = 바로 전 칸의 입력',
      seqs: seqs([[1, 0, 1, 1, 0, 0, 1], [0, 1, 1, 0, 1, 0, 0], [1, 1, 0, 0, 1, 1, 0]], delayBy(1)),
      hints: ['히든 1에 지금 입력을 담아 두면, 다음 칸에서 기억 1로 돌아온다. 먼저 입력 A → 히든 1을 이어 보자.',
        '값 조절: 히든 1은 입력 A를 그대로(+1) 받으면 된다. 출력은 지금 입력이 아니라 기억 1만 보고 답해야 하니 기억 1 → 출력 +1. 입력 A를 출력에도 이으면 "지금"이 섞여서 틀린다.',
        '입력 A → 히든 1 +1, 기억 1 → 출력 +1.'],
      solution: B('inA>h1:1', 'mem1>out:1'),
      stars: [{ type: 'synapses', max: 2 }, { type: 'unitWeights' }],
    },
    {
      id: 'M2', title: '한 번이라도 켜졌나', concept: 'latch',
      sensors: ['inA', 'memO', 'bias'],
      brief: '입력이 한 번이라도 1이 된 적이 있으면, 그 뒤로는 끝까지 1을 말해야 한다. 이번에는 출력 기억 뉴런이 있다. 출력이 바로 전 칸에 낸 값이 자기 자신에게 되돌아온다. 한 번 켜진 것을 붙잡아 두려면 어떻게 이을까?',
      goalText: '켜진 적이 있으면 끝까지 1',
      seqs: seqs([[0, 0, 1, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1, 0]], latchOn),
      hints: ['출력 = "지금 입력이 1" 또는 "바로 전에 이미 켜져 있었음". OR는 두 선을 더하면 된다.',
        '값 조절: 입력 A → 출력 +1, 출력 기억 → 출력 +1. 한 번 1이 되면 다음 칸에 출력 기억이 1로 돌아와서 계속 켜진다. 출력 기억의 세기가 0.5보다 작으면(예: 0.4) 기억이 0.4 → 0.16 → … 점점 희미해지다 꺼진다.',
        '입력 A → 출력 +1, 출력 기억 → 출력 +1.'],
      solution: B('inA>out:1', 'memO>out:1'),
      stars: [{ type: 'synapses', max: 2 }, { type: 'noHidden' }],
    },
    {
      id: 'M3', title: '두 번 연속', concept: 'sequence',
      sensors: ['inA', 'mem1', 'bias'], maxHidden: 1, fixedHidden: 1,
      brief: '입력이 두 칸 연속으로 1일 때만 출력을 켜자. "지금 1"이고 "바로 전에도 1"이어야 한다. 같은 입력 1이라도 앞에 무엇이 왔는지에 따라 답이 다르다. 1장의 AND에 기억을 더하면 된다.',
      goalText: '두 칸 연속 1일 때만 출력 1',
      seqs: seqs([[1, 1, 0, 1, 0, 1, 1, 1], [0, 1, 0, 1, 1, 0, 1, 0], [1, 0, 1, 0, 0, 1, 1, 0]], twiceInRow),
      hints: ['첫 실험처럼 히든 1에 지금 입력을 담아 두면 다음 칸에 기억 1로 돌아온다. 출력 = 지금 입력 AND 기억 1.',
        '값 조절: AND는 두 선을 +1씩 더하고 상시 -1을 주면 된다. 둘 다 1이면 1 + 1 - 1 = 1, 하나만 1이면 0.',
        '입력 A → 히든 1 +1, 입력 A → 출력 +1, 기억 1 → 출력 +1, 상시 → 출력 -1.'],
      solution: B('inA>h1:1', 'inA>out:1', 'mem1>out:1', 'bias>out:-1'),
      stars: [{ type: 'synapses', max: 4 }, { type: 'unitWeights' }],
    },
    {
      id: 'M4', title: '두 칸 전 기억하기', concept: 'longmem',
      sensors: ['inA', 'mem1', 'mem2', 'bias'], maxHidden: 2, fixedHidden: 2,
      brief: '이번에는 두 칸 전의 입력을 말해야 한다. 그런데 기억은 바로 한 칸 전 것만 돌아온다. 더 오래 기억하려면 기억을 다음 뉴런에게 줄줄이 넘겨야 한다. 히든 1 → 기억 1 → 히든 2 → 기억 2.',
      goalText: '모든 칸에서 출력 = 두 칸 전의 입력',
      seqs: seqs([[1, 0, 0, 1, 1, 0, 1, 0], [0, 1, 1, 0, 0, 1, 0, 0], [1, 1, 0, 1, 0, 0, 0, 1]], delayBy(2)),
      hints: ['히든 1에는 지금 입력을, 히든 2에는 기억 1(= 한 칸 전 입력)을 담자. 그러면 기억 2는 두 칸 전 입력이 된다.',
        '값 조절: 모두 +1로 그대로 넘기면 된다. 세기를 1보다 작게 하면 넘길 때마다 값이 줄어든다(0.8 × 0.8 = 0.64). 넘길 칸이 수십 개면 기억이 거의 사라진다. 아주 긴 기억이 어려운 까닭이고, 그래서 LSTM 같은 구조가 나왔다.',
        '입력 A → 히든 1 +1, 기억 1 → 히든 2 +1, 기억 2 → 출력 +1.'],
      solution: B('inA>h1:1', 'mem1>h2:1', 'mem2>out:1'),
      stars: [{ type: 'synapses', max: 3 }, { type: 'unitWeights' }],
    },
    {
      id: 'M5', title: '홀짝 세기', concept: 'parity', boss: true,
      sensors: ['inA', 'memO', 'bias'], maxHidden: 2, fixedHidden: 2,
      brief: '지금까지 1이 몇 번 들어왔는지 세어서, 홀수 번이면 1, 짝수 번이면 0을 말하자. 숫자를 끝없이 셀 필요는 없다. "지금까지 홀수였나" 하나만 기억하면 된다. 새 1이 들어올 때마다 답이 뒤집힌다.',
      goalText: '지금까지 1이 홀수 번이면 1',
      seqs: seqs([[1, 0, 1, 1, 0, 1, 0], [0, 1, 0, 0, 1, 1, 1], [1, 1, 1, 0, 0, 1, 0]], parityOf),
      hints: ['새 답 = 지금 입력 XOR 출력 기억. 둘 중 하나만 1일 때 1이다. 1장의 XOR처럼 히든 뉴런 두 개를 쓰자.',
        '값 조절: 히든 1 = 입력 A +1, 출력 기억 -1("입력만 1"). 히든 2 = 출력 기억 +1, 입력 A -1("기억만 1"). 출력 = 히든 1 + 히든 2.',
        '입력 A → 히든 1 +1, 출력 기억 → 히든 1 -1, 출력 기억 → 히든 2 +1, 입력 A → 히든 2 -1, 히든 1 → 출력 +1, 히든 2 → 출력 +1.'],
      solution: B('inA>h1:1', 'memO>h1:-1', 'memO>h2:1', 'inA>h2:-1', 'h1>out:1', 'h2>out:1'),
      stars: [{ type: 'synapses', max: 6 }, { type: 'unitWeights' }],
    },
  ].map((st) => Object.assign({}, SEQ_BASE, st));

  // ===================================================================
  // 9장 스스로 묶는 뇌: 비지도 학습과 k-평균
  // 점 = [x, y, 진짜 무리]. 진짜 무리는 채점에만 쓴다. 중심 = [x, y].
  // ===================================================================
  function blobs(seed, specs) {
    const r = SA.sim.makeRng(seed), out = [];
    specs.forEach(([cx, cy, n, sd], g) => {
      for (let i = 0; i < n; i++) {
        let x, y;
        do {
          const u = Math.max(1e-9, r()), v = r(), m = Math.sqrt(-2 * Math.log(u));
          x = cx + sd * m * Math.cos(2 * PI * v); y = cy + sd * m * Math.sin(2 * PI * v);
        } while (x < 0.03 || x > 0.97 || y < 0.03 || y > 0.97 || Math.hypot(x - cx, y - cy) > sd * 2.2);
        out.push([Math.round(x * 100) / 100, Math.round(y * 100) / 100, g]);
      }
    });
    return out;
  }
  // 진짜 무리의 평균(= 가장 잘 묶은 중심)
  const trueMeans = (pts) => [...new Set(pts.map((p) => p[2]))].map((g) => {
    const m = pts.filter((p) => p[2] === g);
    return [m.reduce((s, p) => s + p[0], 0) / m.length, m.reduce((s, p) => s + p[1], 0) / m.length].map((v) => Math.round(v * 1000) / 1000);
  });
  const up2 = (v) => Math.ceil(v * 100) / 100;
  const kInit = (k) => Array.from({ length: k }, (_, i) => [Math.round((0.12 + (0.76 * (i + 0.5)) / k) * 100) / 100, i % 2 ? 0.85 : 0.9]);
  const CLUSTER_BASE = { type: 'cluster', maxHidden: 0, funcs: FUNCS_BASIC, sensors: [], outputs: [], drag: true, stepper: true, goal: 'converged' };
  const CLUSTER = [
    (() => {
      const pts = blobs('K1', [[0.28, 0.68, 12, 0.07], [0.72, 0.32, 12, 0.07]]);
      const best = SA.sim.kmBest(pts);
      return {
        id: 'K1', title: '끼리끼리 묶기', concept: 'unsupervised', tour: 'cluster', stepper: false, goal: 'match',
        brief: '이번 점들에는 색(정답)이 없다. 정답 없이 데이터 속에서 비슷한 것끼리 묶는 것을 비지도 학습이라고 한다. 큰 동그라미 두 개가 "중심"이고, 각 점은 가장 가까운 중심의 색을 받는다. 중심을 끌어서 눈에 보이는 두 무리가 서로 다른 색이 되게 하자.',
        goalText: '두 무리를 서로 다른 색으로 묶기',
        pts, init: [[0.15, 0.15], [0.3, 0.2]], best,
        hints: ['점들이 왼쪽 위와 오른쪽 아래, 두 덩어리로 모여 있다. 중심을 하나씩 각 덩어리로 끌어다 놓자.',
          `값 조절: "거리 합"은 모든 점과 자기 중심 사이 거리(제곱)를 더한 값이다. 중심을 덩어리 한가운데에 둘수록 작아진다. 가장 작게 하면 ${best.toFixed(2)}, 별을 다 받으려면 ${up2(best * 1.15).toFixed(2)} 이하.`,
          '중심 하나는 왼쪽 위 덩어리 한가운데, 다른 하나는 오른쪽 아래 덩어리 한가운데에 놓는다.'],
        solution: { centers: trueMeans(pts) },
        stars: [{ type: 'inertia', max: up2(best * 1.5) }, { type: 'inertia', max: up2(best * 1.15) }],
      };
    })(),
    (() => {
      const pts = blobs('K2', [[0.25, 0.3, 10, 0.06], [0.72, 0.28, 10, 0.06], [0.5, 0.75, 10, 0.06]]);
      const best = SA.sim.kmBest(pts);
      return {
        id: 'K2', title: '평균으로 옮기기', concept: 'kmeans', drag: false,
        brief: '이번에는 중심을 손으로 옮길 수 없다. 대신 "한 걸음" 버튼이 있다. 한 걸음은 두 단계다. ① 묶기: 각 점은 가장 가까운 중심의 색을 받는다. ② 옮기기: 각 중심은 자기 색 점들의 한가운데(평균)로 간다. 중심이 더 움직이지 않을 때까지 되풀이하는 것이 k-평균 알고리즘이다.',
        goalText: '세 무리를 찾고 중심이 멈출 때까지',
        pts, init: [[0.05, 0.1], [0.05, 0.5], [0.05, 0.9]], best,
        hints: ['"한 걸음"을 눌러 보자. 점선 화살표 끝은 다음 걸음에 중심이 갈 자리(자기 색 점들의 평균)다.',
          '값 조절: 중심이 더 움직이지 않으면 상태가 "멈춤"으로 바뀐다. 이 데이터는 3걸음이면 멈춘다. 걸을 때마다 거리 합이 줄어드는 것도 보자.',
          '"한 걸음"을 세 번(또는 "멈출 때까지"를 한 번) 누르고 채점한다.'],
        solution: { centers: null },
        stars: [{ type: 'kmSteps', max: 3 }, { type: 'inertia', max: up2(best * 1.01) }],
      };
    })(),
    (() => {
      const pts = blobs('K3b', [[0.22, 0.3, 10, 0.05], [0.5, 0.22, 10, 0.05], [0.72, 0.75, 10, 0.05]]);
      const best = SA.sim.kmBest(pts);
      const init = [[0.65, 0.85], [0.8, 0.7], [0.36, 0.15]];
      const trap = SA.sim.kmInertia(pts, SA.sim.kmRun(pts, init).centers);
      return {
        id: 'K3', title: '시작이 중요해', concept: 'localmin',
        brief: '이번에도 무리는 셋이다. 그런데 이대로 걸으면 중심 둘이 오른쪽 위 무리 하나를 나눠 갖고, 아래쪽 두 무리는 중심 하나가 같이 맡은 채 멈춰 버린다. k-평균은 시작 자리에 따라 엉뚱한 답에 갇힐 수 있다(지역 최소). 중심은 끌어서 옮길 수 있다. 시작 자리를 고쳐 보자.',
        goalText: '세 무리를 제대로 찾고 중심이 멈출 때까지',
        pts, init, best,
        hints: ['먼저 "멈출 때까지"를 눌러 어디에 갇히는지 보자. 그다음 "처음 자리로"를 누르고 시작 자리를 바꾸자.',
          `값 조절: 갇히면 거리 합이 ${trap.toFixed(2)}에서 더 줄지 않는다. 오른쪽 위에 몰린 중심 하나를 아래쪽 두 무리 중 하나로 옮긴 뒤 걸으면 ${best.toFixed(2)}까지 줄어든다.`,
          '"처음 자리로" → 오른쪽 위 중심 하나를 왼쪽 아래 무리 한가운데로 끌어 놓기 → "멈출 때까지".'],
        solution: { centers: [[0.22, 0.3], [0.8, 0.7], [0.36, 0.15]], fresh: true },
        stars: [{ type: 'inertia', max: up2(best * 1.01) }, { type: 'kmSteps', max: 3 }],
      };
    })(),
    (() => {
      const pts = blobs('K4', [[0.25, 0.27, 9, 0.06], [0.74, 0.25, 9, 0.06], [0.27, 0.74, 9, 0.06], [0.75, 0.76, 9, 0.06]]);
      const best = SA.sim.kmBest(pts);
      const inits = [null].concat([1, 2, 3, 4, 5, 6].map(kInit));
      const elbow = inits.map((c) => (c ? SA.sim.kmInertia(pts, SA.sim.kmRun(pts, c).centers) : null));
      return {
        id: 'K4', title: '몇 무리일까', concept: 'choosek', boss: true, chooseK: true, k0: 2,
        brief: '마지막은 무리가 몇 개인지도 정해야 한다. 중심 수(k)를 1~6 중에 고를 수 있다. k를 바꿔 가며 멈출 때까지 걸으면 "k별 거리 합" 막대가 하나씩 쌓인다. k를 늘리면 거리 합이 크게 줄다가, 어느 순간부터는 거의 줄지 않는다. 그 꺾이는 곳(팔꿈치)이 알맞은 무리 수다.',
        goalText: '알맞은 무리 수로 무리를 찾고 멈출 때까지',
        pts, inits, init: inits[2], best, elbow,
        hints: ['k = 1부터 차례로 바꾸며 "멈출 때까지"를 눌러 보자. 아래에 k별 거리 합 막대가 쌓인다.',
          `값 조절: k = 3이면 거리 합이 ${elbow[3].toFixed(2)}, 4면 ${elbow[4].toFixed(2)}로 확 줄고, 5부터는 거의 그대로다(${elbow[5].toFixed(2)}). k를 무리 수보다 크게 하면 거리 합은 줄어도 무리 하나를 억지로 쪼갠다. 팔꿈치는 k = 4.`,
          'k = 4를 고르고 "멈출 때까지".'],
        solution: { k: 4 },
        stars: [{ type: 'kTried', min: 3 }, { type: 'inertia', max: up2(best * 1.01) }],
      };
    })(),
  ].map((st) => Object.assign({}, CLUSTER_BASE, st));

  // ===================================================================
  // 10장 압축하는 뇌: 오토인코더 (입력 → 작은 코드 → 다시 입력)
  // ===================================================================
  const AE_IN = ['inA', 'inB', 'inC', 'inD'], AE_OUT = ['out', 'out2', 'out3', 'out4'];
  const ONE_HOT = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
  const NOISY = [];
  for (const c of [[1, 1, 0, 0], [0, 0, 1, 1]]) {
    NOISY.push(c.concat(c));
    for (let k = 0; k < 4; k++) { const n = c.slice(); n[k] = 1 - n[k]; NOISY.push(n.concat(c)); }
  }
  // 학습 실험의 처음 뇌: 모든 입력 → 히든 2개 → 모든 출력, 작은 무작위 가중치(언제나 같은 값)
  function aeInit(seed, scale) {
    const r = SA.sim.makeRng(seed), syn = [];
    for (const i of AE_IN.concat(['bias'])) for (const h of ['h1', 'h2']) syn.push({ from: i, to: h, w: +((r() * 2 - 1) * scale).toFixed(2) });
    for (const h of ['h1', 'h2', 'bias']) for (const o of AE_OUT) syn.push({ from: h, to: o, w: +((r() * 2 - 1) * scale).toFixed(2) });
    return { hidden: [{ id: 'h1', x: 0.5, y: 0.3 }, { id: 'h2', x: 0.5, y: 0.7 }], synapses: syn };
  }
  const AE_BASE = { type: 'logic', noSkip: true, latent: true, funcs: FUNCS_BASIC };
  const COMPRESS = [
    {
      id: 'A1', title: '둘을 하나로', concept: 'autoencoder', tour: 'code',
      inputs: ['inA', 'inB'], outputs: ['out', 'out2'], sensors: ['inA', 'inB', 'bias'], maxHidden: 1, fixedHidden: 1,
      brief: '이번 뇌는 입력을 그대로 다시 그려 내야 한다. A가 켜지면 출력 1을, B가 켜지면 출력 2를 켠다. 쉬워 보이지만 조건이 있다. 입력을 출력에 바로 이을 수 없고, 가운데 히든 뉴런 하나(코드)를 꼭 거쳐야 한다. 정보를 작은 코드로 줄이는 쪽을 인코더, 코드에서 다시 살리는 쪽을 디코더라고 한다.',
      goalText: '히든 뉴런 하나를 거쳐 입력을 그대로 살리기',
      rows: [[1, 0, 1, 0], [0, 1, 0, 1]], rowLabels: ['A', 'B'],
      hints: ['코드 하나로 "A냐 B냐"를 적자. 히든 1 = A면 1, B면 0.',
        '값 조절: 인코더는 입력 A → 히든 1 +1 하나면 된다. 디코더: 출력 1 = 히든 1(+1). 출력 2 = "히든 1이 꺼져 있다" = 상시 +1, 히든 1 -1.',
        '입력 A → 히든 1 +1, 히든 1 → 출력 +1, 히든 1 → 출력 2 -1, 상시 → 출력 2 +1.'],
      solution: B('inA>h1:1', 'h1>out:1', 'h1>out2:-1', 'bias>out2:1'),
      stars: [{ type: 'synapses', max: 4 }, { type: 'unitWeights' }],
    },
    {
      id: 'A2', title: '넷을 둘로', concept: 'latent', boss: true,
      inputs: AE_IN, outputs: AE_OUT, sensors: AE_IN.concat(['bias']), maxHidden: 2, fixedHidden: 2,
      brief: '입력 넷 중 하나만 켜진다. 이것을 히든 뉴런 둘(코드 두 칸)로 줄였다가 다시 넷으로 살리자. 코드 두 칸으로 만들 수 있는 조합은 00, 10, 01, 11, 딱 네 가지다. 입력마다 다른 조합을 주면 된다. 아래 "코드 지도"에서 네 입력이 서로 다른 구석에 놓이는지 보자.',
      goalText: '히든 뉴런 둘을 거쳐 네 입력을 모두 살리기',
      rows: ONE_HOT.map((r) => r.concat(r)), rowLabels: ['A', 'B', 'C', 'D'],
      hints: ['A = 00, B = 10, C = 01, D = 11로 정하자. 히든 1은 B나 D일 때, 히든 2는 C나 D일 때 켜진다.',
        '값 조절: 디코더는 코드를 보고 하나만 켠다. 출력 1(A) = 상시 +1, 히든 1 -1, 히든 2 -1. 출력 2(B) = 히든 1 +1, 히든 2 -1. 출력 3(C) = 히든 2 +1, 히든 1 -1. 출력 4(D) = 히든 1 +1, 히든 2 +1, 상시 -1.',
        '인코더: B → 히든 1, D → 히든 1, C → 히든 2, D → 히든 2 (모두 +1). 디코더는 두 번째 힌트 그대로.'],
      solution: B('inB>h1:1', 'inD>h1:1', 'inC>h2:1', 'inD>h2:1', 'bias>out:1', 'h1>out:-1', 'h2>out:-1', 'h1>out2:1', 'h2>out2:-1', 'h2>out3:1', 'h1>out3:-1', 'h1>out4:1', 'h2>out4:1', 'bias>out4:-1'),
      stars: [{ type: 'synapses', max: 14 }, { type: 'unitWeights' }],
    },
    {
      id: 'A3', title: '잡음 지우기', concept: 'denoise',
      inputs: AE_IN, outputs: AE_OUT, sensors: AE_IN.concat(['bias']), maxHidden: 1, fixedHidden: 1,
      brief: '깨끗한 무늬는 1100과 0011 두 가지뿐이다. 그런데 입력에는 한 칸씩 잘못 뒤집힌 잡음이 섞여 들어온다. 히든 뉴런 하나로 "어느 무늬에 더 가까운가"만 코드로 남기고, 디코더가 깨끗한 무늬를 다시 그리게 하자. 작은 코드를 거치면 잡음은 빠져나가지 못한다.',
      goalText: '잡음 섞인 입력에서 깨끗한 무늬 살리기',
      rows: NOISY, rowLabels: NOISY.map((r) => r.slice(0, 4).join('')),
      hints: ['코드 하나 = "앞 두 칸(A, B) 쪽이 더 많이 켜졌나". 앞 두 칸은 +, 뒤 두 칸(C, D)은 -로 더하자.',
        '값 조절: 히든 1 = A +1, B +1, C -1, D -1. 1100 쪽 입력은 1 이상, 0011 쪽 입력은 0 이하가 된다. 디코더: 출력 1·2 = 히든 1(+1). 출력 3·4 = 상시 +1, 히든 1 -1.',
        'A → 히든 1 +1, B → 히든 1 +1, C → 히든 1 -1, D → 히든 1 -1, 히든 1 → 출력 1·2 +1, 히든 1 → 출력 3·4 -1, 상시 → 출력 3·4 +1.'],
      solution: B('inA>h1:1', 'inB>h1:1', 'inC>h1:-1', 'inD>h1:-1', 'h1>out:1', 'h1>out2:1', 'h1>out3:-1', 'h1>out4:-1', 'bias>out3:1', 'bias>out4:1'),
      stars: [{ type: 'synapses', max: 10 }, { type: 'unitWeights' }],
    },
  ].map((st) => Object.assign({}, AE_BASE, st));
  const COMPRESS_TRAIN = {
    id: 'A4', title: '스스로 압축 배우기', concept: 'representation', type: 'train', latent: true,
    inputs: AE_IN, outputs: AE_OUT, sensors: AE_IN.concat(['bias']), maxHidden: 2, maxEpochs: 300, funcs: FUNCS_BASIC,
    brief: '이번에는 넷을 둘로 줄이는 암호를 직접 만들지 않는다. 아무렇게나 이어진 뇌에서 시작해서, 역전파로 "입력을 다시 그려 내기"만 배우게 하자. 아무도 코드를 정해 주지 않았는데, 다 배우고 나면 히든 뉴런 둘이 네 입력에 서로 다른 코드를 붙인다. 코드 지도를 지켜보자.',
    goalText: '스스로 배워 네 입력을 모두 살리기',
    rows: ONE_HOT.map((r) => r.concat(r)), rowLabels: ['A', 'B', 'C', 'D'],
    init: aeInit('ae5', 0.5),
    hints: ['학습률을 고르고 자동 학습을 누르자. 코드 지도에서 네 점이 서로 다른 구석으로 흩어지는 것을 보자.',
      '값 조절: 학습률 0.02면 248번, 0.1이면 45번, 0.3이면 9번, 0.5면 8번 만에 배운다. 1 이상은 너무 커서 끝내 다 맞히지 못한다.',
      '학습률 0.5로 자동 학습.'],
    solution: { lr: 0.5 },
    stars: [{ type: 'epochs', max: 60 }, { type: 'epochs', max: 10 }],
  };

  Object.assign(CONCEPTS, {
    recurrent: {
      title: '되먹임과 RNN', line: '어제의 나를 오늘의 내가 듣는다.',
      brain: '뇌의 회로는 한 방향으로만 흐르지 않는다. 신호가 다시 앞쪽으로 되돌아오는 고리(되먹임)가 아주 많고, 이 고리 덕분에 방금 본 것을 잠깐 붙잡아 둔다(작업 기억).',
      ai: '순환 신경망(RNN)은 히든 뉴런의 값을 다음 순간의 입력으로 함께 넣는다. 그래서 문장, 소리, 센서 값처럼 시간 순서가 있는 데이터를 다룰 수 있다. 칸마다 같은 가중치를 되풀이해서 쓴다.',
    },
    latch: {
      title: '붙잡는 기억', line: '한 번 켜지면 스스로를 켜 둔다.',
      brain: '자기 자신을 다시 흥분시키는 뉴런 무리는 자극이 사라진 뒤에도 계속 발화한다. 전화번호를 잠깐 외워 두는 동안 이마엽(전전두엽)에서 이런 지속 발화가 관찰된다.',
      ai: '출력을 자기 자신에게 되먹이면 한 번 켜진 값을 붙잡는 "기억 소자"가 된다. 컴퓨터 메모리의 기본 회로(래치, 플립플롭)도 같은 원리다. 되먹임 세기가 약하면 기억이 점점 희미해진다.',
    },
    sequence: {
      title: '순서 패턴', line: '같은 1이라도 앞에 무엇이 왔느냐에 따라.',
      brain: '"사과"와 "과사"는 같은 글자인데 뜻이 다르다. 뇌는 소리와 글자를 순서째 받아들이고, 앞에 들은 것에 따라 지금 것을 다르게 해석한다.',
      ai: '시간 순서가 있는 데이터를 시퀀스라고 한다. 시퀀스 모델은 지금 입력과 지금까지의 기억(은닉 상태)을 함께 보고 답한다. 음성 인식, 날씨 예측, 기계의 고장 신호 찾기가 모두 시퀀스 문제다.',
    },
    longmem: {
      title: '긴 기억의 어려움', line: '넘길 때마다 조금씩 흐려진다.',
      brain: '방금 들은 말은 또렷하지만 몇 분 전 말은 흐릿하다. 뇌는 오래 남길 것을 따로 골라 해마를 거쳐 장기 기억으로 옮긴다.',
      ai: '기본 RNN은 기억을 칸마다 넘기면서 값이 점점 작아지거나(기울기 소실) 커져 버려서, 먼 과거를 잘 못 배운다. 1997년 나온 LSTM은 "기억을 그대로 둘지, 지울지"를 정하는 문(게이트)을 달아 이 문제를 풀었다.',
    },
    parity: {
      title: '상태로 세기', line: '전부 기억할 필요는 없다. 필요한 것만.',
      brain: '계단을 오를 때 몇 칸째인지 다 기억하지 않아도 "왼발 차례인지 오른발 차례인지"만 알면 걷는다. 뇌는 필요한 요약만 상태로 들고 다닌다.',
      ai: 'RNN의 은닉 상태는 지금까지의 입력 전체를 요약한 값이다. 홀짝 세기는 상태 하나(지금까지 홀수였나)와 XOR만으로 아무리 긴 입력도 처리한다. 이렇게 "상태 + 규칙"으로 움직이는 기계를 상태 기계라고 한다.',
    },
    unsupervised: {
      title: '비지도 학습', line: '정답 없이 비슷한 것끼리.',
      brain: '아기는 누가 알려 주지 않아도 엄마 목소리와 다른 소리를, 고양이와 개를 따로 묶는다. 많이 보다 보면 비슷한 것끼리 저절로 묶인다.',
      ai: '정답(꼬리표) 없이 데이터의 구조를 찾는 것을 비지도 학습이라고 한다. 비슷한 것끼리 묶는 군집화가 대표적이다. 쇼핑몰이 손님을 비슷한 무리로 나누거나, 사진을 비슷한 것끼리 정리할 때 쓴다.',
    },
    kmeans: {
      title: 'k-평균', line: '묶고, 옮기고, 멈출 때까지.',
      brain: '뇌에도 비슷한 입력에 서로 먼저 반응하려고 경쟁하는 뉴런들이 있다. 가장 잘 맞는 뉴런이 이기고, 이긴 뉴런은 그 입력 쪽으로 조금 더 맞춰진다(경쟁 학습).',
      ai: 'k-평균은 ① 점마다 가장 가까운 중심에 묶고 ② 중심을 자기 점들의 평균으로 옮기기를 되풀이한다. 걸음마다 거리 합이 줄어들고 결국 멈춘다. 중심 하나를 가중치 두 개(x, y)짜리 뉴런으로 보면, 가장 가까운 뉴런만 이기는 경쟁 학습과 같다.',
    },
    localmin: {
      title: '지역 최소', line: '골짜기는 하나가 아니다.',
      brain: '한 번 익힌 습관은 더 좋은 방법이 있어도 잘 바뀌지 않는다. 처음 길을 어떻게 들였느냐가 오래 간다.',
      ai: '학습은 비용(거리 합, 오차)이 줄어드는 쪽으로만 움직이기 때문에, 근처에서 가장 낮은 골짜기에 빠지면 더 깊은 골짜기가 있어도 못 간다. 이것이 지역 최소다. 그래서 시작 자리를 여러 번 바꿔 보거나(k-평균++), 무작위 시작값을 잘 고른다.',
    },
    choosek: {
      title: '팔꿈치 찾기', line: '많이 나눈다고 좋은 게 아니다.',
      brain: '친구들을 "가까운 친구 / 아는 사람"으로 나누는 것과 100가지로 나누는 것 중, 너무 잘게 나눈 분류는 기억하기도 쓰기도 어렵다.',
      ai: '중심 수 k를 늘리면 거리 합은 언제나 줄어든다(점마다 중심을 주면 0). 그래서 거리 합이 크게 줄다가 갑자기 덜 주는 곳, 그래프가 꺾이는 "팔꿈치"를 알맞은 k로 고른다. 모델이 복잡할수록 좋아 보이는 함정은 6장의 과적합과 같은 이야기다.',
    },
    autoencoder: {
      title: '오토인코더', line: '줄였다가, 다시 살린다.',
      brain: '눈에서 뇌로 가는 시신경 섬유는 약 100만 가닥으로, 빛을 받는 시세포(1억 개가 넘는다)보다 훨씬 적다. 눈은 본 것을 그대로 보내지 않고 요약(압축)해서 보낸다.',
      ai: '오토인코더는 입력을 작은 코드로 줄이는 인코더와, 코드에서 입력을 다시 그리는 디코더로 이루어진 신경망이다. 정답 대신 "입력 자기 자신"을 목표로 배우므로 꼬리표가 필요 없다.',
    },
    latent: {
      title: '잠재 공간', line: '코드 지도 위의 자리.',
      brain: '해마의 장소 세포와 격자 세포는 수많은 감각 정보를 "지도 위의 자리"라는 작은 코드로 바꿔 나타낸다.',
      ai: '코드 값들이 놓이는 공간을 잠재 공간이라고 한다. 잘 배운 잠재 공간에서는 비슷한 것끼리 가까이 놓인다. 단어·사진을 숫자 묶음(임베딩)으로 바꾸는 것, 그림 생성 AI가 코드에서 새 그림을 그려 내는 것이 모두 이 생각에서 나왔다.',
    },
    denoise: {
      title: '잡음 지우기', line: '좁은 문으로는 잡음이 못 지나간다.',
      brain: '시끄러운 곳에서도 아는 사람의 말소리는 알아듣는다. 뇌는 귀에 들어온 소리를 그대로 믿지 않고, 아는 패턴에 맞춰 빈 곳을 채우고 잡음을 걸러 낸다.',
      ai: '잡음 섞인 입력에서 깨끗한 원본을 살리도록 배운 것을 디노이징 오토인코더라고 한다. 코드가 작으면 "중요한 무늬"만 담기고 잡음은 담을 자리가 없다. 사진 복원과 그림 생성 AI(확산 모델)도 잡음을 걷어 내는 법을 배운다.',
    },
    representation: {
      title: '표현 학습', line: '아무도 가르치지 않은 코드.',
      brain: '뇌는 경험을 되풀이하면서 무엇을 어떻게 나타낼지(표현)를 스스로 만든다. 처음 보는 얼굴도 금방 익숙해지는 것은 얼굴을 담는 좋은 표현을 이미 배웠기 때문이다.',
      ai: '역전파는 출력만 맞추라고 했을 뿐인데, 히든 뉴런에는 입력을 구별하는 코드가 저절로 생긴다. 쓸모 있는 표현을 스스로 찾는 것을 표현 학습이라고 하고, 요즘 AI의 힘은 대부분 여기서 나온다.',
    },
  });

  // ===================================================================
  // 심화 11장 골짜기를 내려가는 뇌 (4장 심화): 오차 지형과 최적화 방법
  // 가중치 두 개를 가로·세로로 놓으면 오차는 지형이 되고, 학습은 공이 골짜기 바닥으로 굴러가는 일이다.
  // ===================================================================
  const DESC_BASE = { type: 'descent', maxHidden: 0, funcs: FUNCS_BASIC, sensors: [], outputs: [], lrs: [0.01, 0.05, 0.1, 0.2, 0.3, 0.5], opts: ['gd'], betas: [0.9], lr0: 0.01 };
  const DESCENT = [
    {
      id: 'D1', title: '오차 지형', concept: 'landscape', tour: 'descent',
      surface: 'fit', start: [-0.5, 4], min: [2, 1], goalR: 0.15, maxSteps: 100, view: [-1, 4, -1.5, 4.5], axes: ['가중치 w', '편향 b'],
      brief: '뉴런 하나(출력 = w × 입력 + b)가 점 네 개를 지나는 직선을 맞히려 한다. 가중치 w를 가로, 편향 b를 세로에 놓고 모든 자리의 오차를 색으로 칠하면 "오차 지형"이 된다. 어두운 곳일수록 오차가 작다. 학습(경사 하강)은 공을 지금 자리에서 가장 가파르게 내려가는 쪽으로 한 걸음씩 옮기는 일이다. 학습률은 한 걸음의 크기다. 공을 바닥(금색 원)에 멈추게 하자.',
      goalText: '공을 바닥(금색 원)에 멈추게 하기',
      hints: ['학습률이 너무 작으면 공이 아주 천천히 내려가서 100걸음 안에 바닥에 못 닿는다. 너무 크면 골짜기 건너편으로 튀어 나간다.',
        '값 조절: 학습률 0.05면 100걸음 안에 못 닿고, 0.1이면 53걸음, 0.2면 26걸음 만에 멈춘다. 0.3부터는 걸음이 너무 커서 지형 밖으로 튀어 나간다.',
        '학습률 0.2로 "멈출 때까지".'],
      solution: { opt: 'gd', lr: 0.2 },
      stars: [{ type: 'steps', max: 60 }, { type: 'steps', max: 30 }],
    },
    {
      id: 'D2', title: '좁은 골짜기', concept: 'momentum', opts: ['gd', 'momentum'], betas: [0.5, 0.9],
      surface: 'valley', start: [-2.5, 1.6], min: [1, 0.5], goalR: 0.15, maxSteps: 80, view: [-3, 2.5, -1, 2.2], axes: ['가중치 1', '가중치 2'],
      brief: '이번 지형은 한쪽으로 길고 좁은 골짜기다. 두 입력의 크기가 아주 다르면(예: 키는 170, 나이는 15) 이런 지형이 생긴다. 경사 하강은 가파른 벽 사이를 지그재그로 튀기만 하고 바닥 쪽으로는 거의 못 나아간다. 모멘텀은 지난 걸음의 속도를 기억해서 같은 쪽으로 계속 가는 힘(관성)을 더한다. β는 속도를 얼마나 기억할지다.',
      goalText: '80걸음 안에 공을 바닥에 멈추게 하기',
      hints: ['경사 하강으로는 학습률을 어떻게 골라도 80걸음 안에 못 닿는다(0.5는 튀어 나간다). 최적화 방법을 모멘텀으로 바꿔 보자.',
        '값 조절: 모멘텀 β 0.9면 학습률 0.05에서 55걸음, 0.3에서 58걸음. β 0.5에 학습률 0.5면 36걸음 만에 닿는다. β가 크면 관성이 커서 바닥을 지나쳤다가 돌아온다.',
        '모멘텀, β 0.5, 학습률 0.5로 "멈출 때까지".'],
      solution: { opt: 'momentum', beta: 0.5, lr: 0.5 },
      stars: [{ type: 'steps', max: 60 }, { type: 'steps', max: 40 }],
    },
    {
      id: 'D3', title: '작은 웅덩이', concept: 'escape', opts: ['gd', 'momentum'], betas: [0.5, 0.9], dragStart: true,
      surface: 'bumpy', start: [-2.3, -2.1], min: [1.56, 1.37], goalR: 0.2, maxSteps: 120, view: [-3, 3, -3, 3], axes: ['가중치 1', '가중치 2'],
      brief: '이번 지형에는 깊은 바닥(금색 원) 말고도 출발점 가까이에 작은 웅덩이가 있다. 경사 하강은 "지금 발밑에서 내려가는 쪽"만 보기 때문에 웅덩이에 빠지면 거기가 바닥인 줄 알고 멈춘다(지역 최소). 관성으로 웅덩이를 넘어가거나, 출발점을 옮겨 보자. 출발점(흰 동그라미)은 끌어서 옮길 수 있다.',
      goalText: '깊은 바닥(금색 원)에 공을 멈추게 하기',
      hints: ['먼저 경사 하강으로 "멈출 때까지"를 눌러 어디에 갇히는지 보자. 경사 하강은 어떤 학습률로도 작은 웅덩이를 못 벗어난다.',
        '값 조절: 모멘텀 β 0.9에 학습률 0.3이면 52걸음, 0.5면 50걸음 만에 웅덩이를 넘어 깊은 바닥에 닿는다. β 0.5는 관성이 모자라 웅덩이에 남는다. 출발점을 깊은 골짜기 쪽(오른쪽 위)으로 옮기면 경사 하강으로도 된다.',
        '출발점은 그대로 두고 모멘텀, β 0.9, 학습률 0.5로 "멈출 때까지".'],
      solution: { opt: 'momentum', beta: 0.9, lr: 0.5 },
      stars: [{ type: 'steps', max: 70 }, { type: 'startFixed' }],
    },
    {
      id: 'D4', title: '걸음을 따로 맞추기', concept: 'adam', boss: true, opts: ['gd', 'momentum', 'adam'], betas: [0.9],
      surface: 'scales', start: [-1.5, -2.5], min: [1, 2], goalR: 0.15, maxSteps: 80, view: [-2.5, 3.5, -3.5, 3.5], axes: ['가중치 1', '가중치 2'],
      brief: '이번 지형은 가로로는 아주 가파르고 세로로는 거의 평평하다. 학습률 하나로는 둘 다 맞출 수 없다. 크게 하면 가파른 쪽에서 튀어 나가고, 작게 하면 평평한 쪽에서 기어간다. Adam은 가중치마다 지금까지의 기울기 크기를 기억해서 걸음 크기를 따로 맞춘다. 요즘 신경망 학습에서 가장 많이 쓰는 방법이다.',
      goalText: '80걸음 안에 공을 바닥에 멈추게 하기',
      hints: ['경사 하강과 모멘텀은 어떤 학습률로도 80걸음 안에 못 닿는다. 세로 방향 기울기가 너무 작아서다.',
        '값 조절: Adam은 기울기를 그 크기로 나눠서 쓰기 때문에 평평한 쪽에서도 학습률만큼씩 꾸준히 간다. 학습률 0.1이면 63걸음, 0.2면 59걸음, 0.3이면 60걸음, 0.5면 65걸음.',
        'Adam, 학습률 0.2로 "멈출 때까지".'],
      solution: { opt: 'adam', lr: 0.2 },
      stars: [{ type: 'steps', max: 70 }, { type: 'steps', max: 60 }],
    },
  ].map((st) => Object.assign({}, DESC_BASE, st));

  // ===================================================================
  // 심화 12장 가치를 배우는 뇌 (5장 심화): 가치 함수, 할인율, Q러닝, 탐험
  // ===================================================================
  const GRID_BASE = { type: 'grid', maxHidden: 0, funcs: FUNCS_BASIC, sensors: [], outputs: [], gamma: 0.9, target: 'G', maxT: 60 };
  const VALUE = [
    {
      id: 'Q1', title: '가치 퍼뜨리기', concept: 'valuefn', tour: 'grid', mode: 'vi',
      grid: ['S..#....', '.#.#.##.', '.#...#..', '.####.#.', '......#G'], rewards: { G: 10 },
      brief: '5장에서는 행동마다 점수를 줬다. 이번에는 "이 칸에 있으면 앞으로 점수를 얼마나 받을까"를 칸마다 적는다. 이것이 가치다. 가치는 "한 걸음 가서 받는 보상 + 할인율 γ × 도착한 칸의 가치" 중 가장 좋은 것이다(벨만 방정식). 목표(+10)에서부터 한 번 퍼뜨릴 때마다 한 칸씩 가치가 번진다. 출발 칸까지 가치가 닿으면 화살표만 따라가면 된다.',
      goalText: '출발에서 화살표를 따라 목표까지 가기',
      hints: ['"한 번 퍼뜨리기"를 누를 때마다 가치가 목표에서 한 칸씩 멀리 번진다.',
        '값 조절: 출발에서 목표까지 가장 짧은 길은 15걸음이라서 14번 퍼뜨리면 출발 칸 옆까지 가치가 닿고 길이 이어진다. γ가 0.9라서 목표에서 한 칸 멀어질 때마다 가치가 0.9배로 줄어든다.',
        '"한 번 퍼뜨리기"를 14번 누르고 채점한다.'],
      solution: { sweeps: 14 },
      stars: [{ type: 'sweeps', max: 20 }, { type: 'sweeps', max: 14 }],
    },
    {
      id: 'Q2', title: '멀리 볼까 가까이 볼까', concept: 'discount', mode: 'vi', gammas: [0.5, 0.6, 0.7, 0.8, 0.9], gamma0: 0.5,
      grid: ['..........', 'g.S......G', '..........'], rewards: { G: 10, g: 1 },
      brief: '출발 가까이에 작은 보상(+1), 멀리에 큰 보상(+10)이 있다. 할인율 γ는 "나중에 받는 보상을 지금 얼마로 칠까"다. γ가 작으면 눈앞의 작은 보상을, 크면 멀리 있는 큰 보상을 고른다. 화살표가 큰 보상(+10)으로 가게 하자. γ를 바꾸면 가치는 처음부터 다시 퍼뜨린다.',
      goalText: '화살표가 큰 보상(+10)으로 가게 하기',
      hints: ['작은 보상은 2걸음, 큰 보상은 7걸음 떨어져 있다. 큰 보상의 가치는 걸음마다 γ배씩 줄어든다.',
        '값 조절: 출발에서 보면 작은 보상은 1 × γ, 큰 보상은 10 × γ⁶이다. 10 × γ⁶이 더 크려면 γ⁵ > 0.1, 즉 γ가 약 0.63보다 커야 한다. 그래서 0.5, 0.6은 작은 보상으로, 0.7부터는 큰 보상으로 간다. 가치가 출발까지 닿으려면 6번은 퍼뜨려야 한다.',
        'γ 0.7로 바꾸고 "한 번 퍼뜨리기"를 6번 이상 누른 뒤 채점.'],
      solution: { gamma: 0.7, sweeps: 8 },
      stars: [{ type: 'gammaMax', max: 0.7 }, { type: 'sweeps', max: 10 }],
    },
    {
      id: 'Q3', title: '해 보며 배우기', concept: 'qlearning', mode: 'q', alphas: [0.1, 0.5, 1], epss: [0, 0.1, 0.3], alpha0: 0.1, eps0: 0.1, seed: 'Q3',
      grid: ['S..#...', '.#.#.#.', '.#...#.', '...#..G'], rewards: { G: 10 }, stepReward: -1, maxEpisodes: 200, shortest: true, maxT: 80,
      brief: '이번에는 지도를 모른다. 가치를 미리 계산할 수 없으니 직접 돌아다니며 배운다(Q러닝). 칸마다 네 방향의 점수표(Q)를 두고, 한 걸음 갈 때마다 "받은 보상 + γ × 도착한 칸의 가장 좋은 Q" 쪽으로 Q를 조금 고친다. 걸음마다 -1점이라서 오래 헤맬수록 손해다. 가장 짧은 길을 배우게 하자.',
      goalText: '가장 짧은 길(9걸음)로 목표까지 가게 배우기',
      hints: ['"한 판 해 보기"를 눌러 몇 판 돌려 보자. 판이 쌓일수록 칸의 숫자와 화살표가 목표 쪽으로 정리된다.',
        '값 조절: 학습률 α는 한 번에 Q를 얼마나 고칠지다. 이 세상은 같은 행동이 언제나 같은 결과를 내서 α를 크게 해도 괜찮다. α 0.1이면 40판 안팎(38~47판), 0.5면 15판 안팎, 1이면 10판 안팎이 걸린다. 걸음마다 -1점이라 안 가 본 칸(0점)이 더 좋아 보여서 저절로 새 길을 시도한다.',
        'α 1, ε 0.1로 "자동 학습".'],
      solution: { alpha: 1, eps: 0.1 },
      stars: [{ type: 'episodes', max: 50 }, { type: 'episodes', max: 15 }],
    },
    {
      id: 'Q4', title: '작은 보상의 함정', concept: 'explore', mode: 'q', boss: true, alphas: [0.5, 1], epss: [0, 0.1, 0.3, 0.5], alpha0: 0.5, eps0: 0, seed: 'decoy-11',
      grid: ['........', 'g.S....G', '........'], rewards: { G: 10, g: 1 }, maxEpisodes: 300,
      brief: '출발 왼쪽 두 칸에 작은 보상(+1), 오른쪽 다섯 칸에 큰 보상(+10)이 있다. 가장 좋다고 아는 쪽으로만 가면(활용), 처음 찾은 작은 보상에 만족하고 큰 보상은 영영 모른다. ε는 일부러 아무 방향으로나 가 보는 비율(탐험)이다. 큰 보상을 찾아 배우게 하자.',
      goalText: '화살표가 큰 보상(+10)으로 가게 배우기',
      hints: ['ε 0으로 자동 학습을 돌려 보자. 몇 판 만에 작은 보상으로 가는 길만 굳어 버린다.',
        '값 조절: 이 실험에서 ε 0이나 0.1이면 300판을 해도 작은 보상에 머문다. α 0.5에서 ε 0.3이면 31판, ε 0.5면 8판 만에 큰 보상을 찾는다. α 1에서는 ε 0.3이면 13판, 0.5면 8판.',
        'α 0.5, ε 0.5로 "자동 학습".'],
      solution: { alpha: 0.5, eps: 0.5 },
      stars: [{ type: 'episodes', max: 60 }, { type: 'episodes', max: 15 }],
    },
  ].map((st) => Object.assign({}, GRID_BASE, st));

  // ===================================================================
  // 심화 13장 확률로 답하는 뇌 (6장 심화): 소프트맥스, 확신, 여러 갈래 분류, 교차 엔트로피
  // 한 점 = [x, y, 정답 번호]. 출력 뉴런마다 그 번호일 확률, 가장 큰 쪽이 답
  // ===================================================================
  function pointsK(seed, n, k, label) {
    const r = SA.sim.makeRng(seed), out = [], cnt = new Array(k).fill(0);
    for (let guard = 0; out.length < n && guard < 40000; guard++) {
      const x = Math.round((0.05 + 0.9 * r()) * 100) / 100, y = Math.round((0.05 + 0.9 * r()) * 100) / 100;
      const l = label(x, y);
      if (l === null || cnt[l] >= Math.ceil(n / k)) continue;
      cnt[l]++;
      out.push([x, y, l]);
    }
    return out;
  }
  const softFn = (outs) => Object.fromEntries(outs.map((o) => [o, 'softmax']));
  const CLS3 = ['out', 'out2', 'out3'], CLS4 = ['out', 'out2', 'out3', 'out4'];
  const PROB_BASE = { type: 'logic', plot: true, inputs: ['inX', 'inY'], sensors: ['inX', 'inY', 'bias'], maxHidden: 0, fixedHidden: 0, funcs: ['softmax'] };
  const PROB = [
    {
      id: 'SM1', title: '셋으로 나누기', concept: 'softmax', tour: 'classes', classes: 3, outputs: CLS3, fixedFn: softFn(CLS3),
      brief: '이번에는 색이 셋이다. 출력 뉴런도 셋이고, 세 출력은 소프트맥스로 묶여 있다. 소프트맥스는 세 출력의 합이 언제나 1이 되도록 나눠 가지게 해서, 각 출력을 "그 색일 확률"로 읽을 수 있게 한다. 가장 큰 확률의 색이 답이다. 왼쪽 주황, 가운데 파랑, 오른쪽 초록을 나눠 보자.',
      goalText: '모든 점의 색을 맞히기',
      rows: pointsK('SM1', 18, 3, (x) => (x < 0.25 ? 0 : x >= 0.42 && x <= 0.58 ? 1 : x > 0.75 ? 2 : null)),
      hints: ['출력 1(주황)은 x가 작을수록, 출력 3(초록)은 x가 클수록 커지게 하자. 출력 2(파랑)는 아무 선도 없이 0으로 두면, 다른 둘이 작은 가운데에서 이긴다.',
        '값 조절: 출력 1 = x × -3 + 상시 1이면 x = 1/3에서 0이 된다. 출력 3 = x × 3 + 상시 -2면 x = 2/3에서 0이 된다. 그 사이에서는 둘 다 0보다 작아서 출력 2가 가장 크다.',
        'x → 출력 1 -3, 상시 → 출력 1 +1, x → 출력 3 +3, 상시 → 출력 3 -2.'],
      solution: withFn(B('inX>out:-3', 'bias>out:1', 'inX>out3:3', 'bias>out3:-2'), softFn(CLS3)),
      stars: [{ type: 'synapses', max: 4 }, { type: 'noHidden' }],
    },
    {
      id: 'SM2', title: '확신 높이기', concept: 'confidence', classes: 2, outputs: ['out', 'out2'], fixedFn: softFn(['out', 'out2']), need: { confidence: 0.8 },
      brief: '색은 둘이다. 이번에는 맞히는 것만으로는 부족하다. 정답 색의 확률이 평균 80% 이상이어야 한다. 경계선이 같아도 가중치를 크게 하면 두 출력의 차이가 커져서 확률이 한쪽으로 쏠린다(확신이 커진다).',
      goalText: '모두 맞히고 정답 확률 평균 80% 이상',
      rows: pointsK('SM2', 16, 2, (x) => (x < 0.3 ? 0 : x > 0.7 ? 1 : null)),
      hints: ['출력 1은 x가 작을수록, 출력 2는 x가 클수록 커지게 하자. 경계는 x = 0.5.',
        '값 조절: 출력 1 = x × -1 + 0.5, 출력 2 = x × 1 - 0.5면 모두 맞히지만 확률 평균은 약 66%다. 가중치 ±2, 상시 ±1이면 약 79%, 가중치 ±3, 상시 ±1.5로 키우면 같은 경계에서 약 88%가 된다(가중치는 3까지).',
        'x → 출력 1 -3, 상시 → 출력 1 +1.5, x → 출력 2 +3, 상시 → 출력 2 -1.5.'],
      solution: withFn(B('inX>out:-3', 'bias>out:1.5', 'inX>out2:3', 'bias>out2:-1.5'), softFn(['out', 'out2'])),
      stars: [{ type: 'confidence', min: 0.85 }, { type: 'synapses', max: 4 }],
    },
    {
      id: 'SM3', title: '네 귀퉁이', concept: 'multiclass', boss: true, classes: 4, outputs: CLS4, fixedFn: softFn(CLS4),
      brief: '색이 넷이고 점이 네 귀퉁이에 모여 있다(왼쪽 아래 주황, 오른쪽 아래 파랑, 왼쪽 위 초록, 오른쪽 위 보라). 출력 뉴런 넷이 각자 "내 귀퉁이 쪽일수록 커지게" 만들면, 가장 큰 출력이 귀퉁이를 가른다. 히든 뉴런 없이도 된다.',
      goalText: '모든 점의 색을 맞히기',
      rows: pointsK('SM3', 20, 4, (x, y) => (Math.abs(x - 0.5) < 0.12 || Math.abs(y - 0.5) < 0.12 ? null : (x > 0.5 ? 1 : 0) + (y > 0.5 ? 2 : 0))),
      hints: ['오른쪽 귀퉁이 출력은 x를 +로, 왼쪽은 x를 -로 받는다. 위쪽 귀퉁이 출력은 y를 +로, 아래쪽은 y를 -로 받는다.',
        '값 조절: 크기를 모두 3으로 맞추면, 가운데(0.5, 0.5)에서 네 출력이 같아지도록 상시를 맞춰야 한다. 왼쪽 아래는 x -3, y -3, 상시 +3. 오른쪽 위는 x +3, y +3, 상시 -3. 나머지 둘은 상시가 0이다.',
        '출력 1(주황): x -3, y -3, 상시 +3 / 출력 2(파랑): x +3, y -3 / 출력 3(초록): x -3, y +3 / 출력 4(보라): x +3, y +3, 상시 -3.'],
      solution: withFn(B('inX>out:-3', 'inY>out:-3', 'bias>out:3', 'inX>out2:3', 'inY>out2:-3', 'inX>out3:-3', 'inY>out3:3', 'inX>out4:3', 'inY>out4:3', 'bias>out4:-3'), softFn(CLS4)),
      stars: [{ type: 'synapses', max: 10 }, { type: 'noHidden' }],
    },
  ].map((st) => Object.assign({}, PROB_BASE, st));
  const PROB_TRAIN = {
    id: 'SM4', title: '교차 엔트로피로 배우기', concept: 'crossentropy', type: 'train', plot: true, loss: 'ce', classes: 3,
    inputs: ['inX', 'inY'], sensors: ['inX', 'inY', 'bias'], outputs: CLS3, fixedFn: softFn(CLS3), maxHidden: 0, maxEpochs: 200, funcs: ['softmax'],
    brief: '이번에는 세 색을 스스로 나누게 배운다. 오차는 "정답 색의 확률이 얼마나 낮았나"로 잰다. 정답 확률이 1이면 오차 0, 0에 가까울수록 오차가 끝없이 커진다(교차 엔트로피 = -log 정답 확률). 소프트맥스와 함께 쓰면 고치는 양이 "확률 - 정답"으로 아주 간단해진다. 모든 가중치가 0인 뇌에서 시작한다.',
    goalText: '세 색을 모두 맞히도록 스스로 배우게 하기',
    rows: pointsK('SM4', 18, 3, (x, y) => {
      const c = [[0.25, 0.25], [0.75, 0.3], [0.5, 0.8]].map(([a, b]) => Math.hypot(x - a, y - b));
      const k = c.indexOf(Math.min(...c));
      return c[k] < 0.17 ? k : null;
    }),
    init: { hidden: [], synapses: ['inX', 'inY', 'bias'].flatMap((f) => CLS3.map((o) => ({ from: f, to: o, w: 0 }))), fn: softFn(CLS3) },
    hints: ['학습률을 고르고 자동 학습을 누르자. 배경의 세 색 영역이 점들 쪽으로 자리를 잡는다.',
      '값 조절: 학습률 0.02면 22번, 0.05면 8번, 0.1이면 3번, 0.3이면 4번, 0.5면 5번 만에 배운다. 1 이상은 가중치가 한 번에 너무 크게 바뀌어서 끝내 다 맞히지 못한다.',
      '학습률 0.1로 자동 학습.'],
    solution: { lr: 0.1 },
    stars: [{ type: 'epochs', max: 20 }, { type: 'epochs', max: 5 }],
  };

  // ===================================================================
  // 심화 14장 문을 단 기억 (8장 심화): 게이트와 LSTM
  // 입력이 여러 갈래(값, 신호)로 들어오고, 출력은 값 그대로를 맞혀야 한다(허용 오차 0.05)
  // ===================================================================
  const gateSeqs = (xs, f) => xs.map((x) => ({ x, t: f(x) }));
  const held = (useRead) => (x) => { let c = 0; return x.map(([a, b, r]) => { if (b) c = a; return useRead ? (r ? c : 0) : c; }); };
  const GATE_BASE = { type: 'seq', outputs: ['out'], funcs: ['clamp', 'mul'], tol: 0.05, seqInputs: ['inA', 'inB'], maxHidden: 0, fixedHidden: 0 };
  const GATES = [
    {
      id: 'GT1', title: '문 열고 닫기', concept: 'gate', tour: 'gate', inputNames: ['값 A', '문 B'],
      sensors: ['inA', 'inB', 'bias'],
      brief: '이번에는 입력이 두 갈래다. A는 0~1 사이의 값, B는 문(0 = 닫힘, 1 = 열림)이다. 문이 열렸을 때만 A를 그대로 내보내고, 닫혔을 때는 0을 내보내자. 이번 장에서는 "곱(×)" 함수를 쓸 수 있다. 곱 뉴런은 들어온 신호를 모두 곱해서, 문(0 또는 1)과 곱하면 값을 통과시키거나 막는다. 출력은 값 그대로 맞혀야 한다(0.05까지 봐준다).',
      goalText: '문이 열렸을 때만 값 A를 내보내기',
      seqs: gateSeqs([[[0.8, 1], [0.3, 0], [0.5, 1], [1, 1], [0.2, 0], [0.6, 0], [0.4, 1]], [[0.4, 0], [0.9, 1], [0.7, 0], [0.1, 1], [0.6, 1], [0.3, 0], [1, 0]]], (x) => x.map(([a, b]) => (b ? a : 0))),
      hints: ['출력 뉴런을 눌러 활성화 함수를 "곱(×)"으로 바꾸고, 값 A와 문 B를 둘 다 출력에 이어 보자.',
        '값 조절: 곱 뉴런의 출력 = (A × 1) × (B × 1). B가 1이면 A, 0이면 0이다. 기본 함수로도 A + B - 1(상시 -1)로 만들 수 있지만 선이 하나 더 든다.',
        '출력 함수를 곱(×)으로, 값 A → 출력 +1, 문 B → 출력 +1.'],
      solution: withFn(B('inA>out:1', 'inB>out:1'), { out: 'mul' }),
      stars: [{ type: 'synapses', max: 2 }, { type: 'unitWeights' }],
    },
    {
      id: 'GT2', title: '필요할 때만 담기', concept: 'inputgate', inputNames: ['값 A', '저장 B'],
      sensors: ['inA', 'inB', 'mem1', 'bias'], maxHidden: 4, fixedHidden: 4,
      brief: '저장 신호 B가 1일 때 들어온 값 A를 기억해 두고, 다음 저장 신호가 올 때까지 계속 그 값을 내보내자(처음에는 0). 히든 1을 "기억 칸(셀)"으로 쓰자. 셀의 새 값 = (저장 B이면 새 값 A) + (저장 B가 아니면 지난 셀 값). LSTM의 입력 게이트가 하는 일이다.',
      goalText: '마지막으로 저장한 값을 계속 내보내기',
      seqs: gateSeqs([[[0.7, 1], [0.2, 0], [0.9, 0], [0.4, 1], [0.6, 0], [1, 0], [0.3, 0]], [[0.5, 0], [0.8, 1], [0.1, 0], [0.6, 0], [0.2, 1], [0.9, 0], [0.4, 0]], [[1, 1], [0.3, 0], [0.5, 1], [0.7, 0], [0.6, 1], [0.2, 0], [0.8, 0]]], held(false)),
      hints: ['히든 2 = A × B(저장할 때만 새 값), 히든 3 = 기억 1 × (1 - B)(저장 안 할 때만 지난 값), 히든 1 = 히든 2 + 히든 3. 1 - B는 히든 4로 만든다(상시 +1, B -1).',
        '값 조절: 히든 2와 히든 3의 함수는 곱(×)이다. 기억 1에는 히든 1(셀)이 바로 전 칸에 낸 값이 돌아온다. 곱 대신 기본 함수로 히든 2 = A + B - 1, 히든 3 = 기억 1 - B로 만들어도 된다.',
        '히든 2(곱): A +1, B +1 / 히든 4: 상시 +1, B -1 / 히든 3(곱): 기억 1 +1, 히든 4 +1 / 히든 1: 히든 2 +1, 히든 3 +1 / 히든 1 → 출력 +1.'],
      solution: withFn(B('inA>h2:1', 'inB>h2:1', 'bias>h4:1', 'inB>h4:-1', 'mem1>h3:1', 'h4>h3:1', 'h2>h1:1', 'h3>h1:1', 'h1>out:1'), { h2: 'mul', h3: 'mul' }),
      stars: [{ type: 'synapses', max: 9 }, { type: 'unitWeights' }],
    },
    {
      id: 'GT3', title: '지우개 문', concept: 'forgetgate', inputNames: ['값 A', '지우기 B'],
      sensors: ['inA', 'inB', 'mem1', 'bias'], maxHidden: 3, fixedHidden: 3,
      brief: '들어오는 값 A를 계속 더해서 쌓아 두다가, 지우기 신호 B가 오면 쌓인 것을 버리고 그 칸의 A부터 다시 쌓자. 셀의 새 값 = (지우기 B가 아니면 지난 셀 값) + A. 지난 기억에 곱하는 "남길까 지울까" 문이 LSTM의 망각 게이트다. 1997년 처음 나온 LSTM에는 없었고 2000년에 더해졌다.',
      goalText: '지우기 신호 뒤로 값을 다시 쌓기',
      seqs: gateSeqs([[[0.1, 0], [0.2, 0], [0.3, 0], [0.1, 1], [0.2, 0], [0.3, 0], [0.2, 1]], [[0.3, 0], [0.3, 0], [0.1, 1], [0.1, 0], [0.4, 0], [0.2, 1], [0.1, 0]], [[0.2, 1], [0.2, 0], [0.2, 0], [0.3, 0], [0.1, 1], [0.3, 0], [0.3, 0]]],
        (x) => { let c = 0; return x.map(([a, b]) => (c = (b ? 0 : c) + a)); }),
      hints: ['히든 1이 셀이다. 히든 1 = (지난 셀 × 남길까 문) + A. 남길까 문 = 1 - B.',
        '값 조절: 히든 3 = 1 - B(상시 +1, B -1), 히든 2 = 기억 1 × 히든 3(곱). 셀 값이 1을 넘지 않아서 기본 함수로 히든 2 = 기억 1 - B(B가 1이면 0 아래로 잘림)로 만들 수도 있다.',
        '히든 3: 상시 +1, B -1 / 히든 2(곱): 기억 1 +1, 히든 3 +1 / 히든 1: 히든 2 +1, A +1 / 히든 1 → 출력 +1.'],
      solution: withFn(B('bias>h3:1', 'inB>h3:-1', 'mem1>h2:1', 'h3>h2:1', 'h2>h1:1', 'inA>h1:1', 'h1>out:1'), { h2: 'mul' }),
      stars: [{ type: 'synapses', max: 7 }, { type: 'unitWeights' }],
    },
    {
      id: 'GT4', title: 'LSTM 한 칸', concept: 'lstm', boss: true, inputNames: ['값 A', '저장 B', '읽기 C'], seqInputs: ['inA', 'inB', 'inC'],
      sensors: ['inA', 'inB', 'inC', 'mem1', 'bias'], maxHidden: 4, fixedHidden: 4,
      brief: '마지막은 문 셋을 다 쓴다. 저장 B가 오면 값 A를 셀에 담고(입력 게이트), 아니면 지난 셀을 남기고(망각 게이트), 읽기 C가 1일 때만 셀 값을 내보낸다(출력 게이트). 읽지 않을 때는 0이다. 이것이 LSTM 한 칸이 하는 일이다.',
      goalText: '읽기 신호가 올 때만 저장한 값을 내보내기',
      seqs: gateSeqs([[[0.6, 1, 0], [0.2, 0, 0], [0.9, 0, 1], [0.4, 0, 0], [0.3, 1, 0], [0.8, 0, 1], [0.5, 0, 1]], [[0.4, 0, 1], [0.7, 1, 0], [0.1, 0, 0], [0.5, 0, 1], [0.9, 1, 1], [0.2, 0, 0], [0.6, 0, 1]]], held(true)),
      hints: ['두 번째 실험(필요할 때만 담기)의 셀을 그대로 만들고, 출력에만 읽기 문을 단다.',
        '값 조절: 출력 = 히든 1 × 읽기 C. 출력 뉴런의 함수를 곱(×)으로 바꾸고 히든 1과 읽기 C를 잇는다.',
        '히든 2(곱): A, B / 히든 4: 상시 +1, B -1 / 히든 3(곱): 기억 1, 히든 4 / 히든 1: 히든 2, 히든 3 / 출력(곱): 히든 1, 읽기 C. 모두 +1(히든 4의 B만 -1).'],
      solution: withFn(B('inA>h2:1', 'inB>h2:1', 'bias>h4:1', 'inB>h4:-1', 'mem1>h3:1', 'h4>h3:1', 'h2>h1:1', 'h3>h1:1', 'h1>out:1', 'inC>out:1'), { h2: 'mul', h3: 'mul', out: 'mul' }),
      stars: [{ type: 'synapses', max: 10 }, { type: 'unitWeights' }],
    },
  ].map((st) => Object.assign({}, GATE_BASE, st));
  const GATE_POS = { 3: { h1: [0.85, 0.5], h2: [0.5, 0.3], h3: [0.15, 0.18] }, 4: { h1: [0.85, 0.5], h2: [0.3, 0.72], h3: [0.55, 0.28], h4: [0.15, 0.12] } };
  GATES.forEach((st) => {
    const pos = GATE_POS[st.fixedHidden];
    if (!pos) return;
    st.hiddenPos = pos;
    for (const h of st.solution.hidden) if (pos[h.id]) { h.x = pos[h.id][0]; h.y = pos[h.id][1]; }
  });

  Object.assign(CONCEPTS, {
    landscape: {
      title: '오차 지형', line: '학습은 골짜기를 굴러 내려가는 공.',
      brain: '뇌의 시냅스 세기도 경험할 때마다 조금씩 바뀐다. 어떤 바뀜이 더 나은 행동을 만드는지 뇌가 정확히 어떻게 아는지는 아직 다 밝혀지지 않았다.',
      ai: '가중치마다 축을 하나씩 두고 오차를 높이로 놓으면 지형이 된다. 경사 하강은 지금 자리의 기울기를 재서 가장 가파르게 내려가는 쪽으로 학습률만큼 옮기기를 되풀이한다. 실제 신경망은 가중치가 수십억 개라서 수십억 차원의 지형이다.',
    },
    momentum: {
      title: '모멘텀', line: '굴러가던 공은 쉽게 멈추지 않는다.',
      brain: '운동을 배울 때도 매번 처음부터 고치기보다, 잘되던 방향으로 계속 다듬어 간다.',
      ai: '모멘텀은 지난 걸음들의 방향을 평균 내어 "속도"로 기억하고, 그 속도로 나아간다. 지그재그로 튀는 방향은 서로 지워지고, 꾸준한 방향은 쌓여서 좁은 골짜기를 빨리 지난다. β가 클수록 오래 기억한다.',
    },
    escape: {
      title: '웅덩이 벗어나기', line: '발밑만 보면 웅덩이가 바닥처럼 보인다.',
      brain: '익숙한 방법이 "그럭저럭 괜찮으면" 더 좋은 방법을 찾지 않게 된다. 가끔 다른 시도를 해 봐야 더 나은 곳을 찾는다.',
      ai: '경사 하강은 근처의 오목한 곳(지역 최소)에 멈출 수 있다. 관성(모멘텀), 시작값 바꾸기, 학습에 섞인 잡음(미니배치)이 작은 웅덩이를 벗어나게 돕는다. 다만 수많은 차원의 실제 신경망에서는 웅덩이보다 평평한 안장점이 더 큰 문제라고 알려져 있다.',
    },
    adam: {
      title: 'Adam', line: '가중치마다 걸음 크기를 따로.',
      brain: '뇌의 시냅스도 저마다 바뀌는 속도가 다르다. 자주 쓰이는 연결과 드물게 쓰이는 연결은 다르게 조절된다.',
      ai: 'Adam은 가중치마다 기울기의 평균(모멘텀)과 기울기 크기의 평균을 따로 기억해서, 기울기를 그 크기로 나눠 걸음을 정한다. 그래서 가파른 쪽도 평평한 쪽도 비슷한 크기로 나아간다. 2014년에 나와 지금 가장 널리 쓰인다.',
    },
    valuefn: {
      title: '가치 함수', line: '여기 있으면 앞으로 얼마나 좋을까.',
      brain: '원숭이 실험에서 "곧 보상이 온다"는 신호(불빛·소리)를 익히고 나면, 도파민 뉴런은 보상 그 자체보다 그 신호에 먼저 반응한다. 뇌도 "앞으로 좋은 일이 있겠다"는 예측, 곧 가치를 계산한다.',
      ai: '가치는 어떤 상태에서 시작해 앞으로 받을 보상의 합이다. 벨만 방정식은 "지금 가치 = 한 걸음 보상 + γ × 다음 상태의 가치"로 가치를 칸에서 칸으로 이어 준다. 가치를 알면 가장 가치가 높은 쪽으로만 가면 된다.',
    },
    discount: {
      title: '할인율 γ', line: '내일의 10점은 오늘 몇 점일까.',
      brain: '사람과 동물은 나중에 받을 보상을 더 작게 느낀다(시간 할인). 지금 과자 하나와 일주일 뒤 과자 두 개 사이에서 고민하는 것이 그 예다.',
      ai: '할인율 γ(0~1)는 한 걸음 늦게 받는 보상에 곱하는 값이다. γ가 작으면 눈앞의 보상만, 1에 가까우면 먼 미래까지 본다. γ를 1보다 작게 두면 끝없이 이어지는 보상의 합도 유한해진다.',
    },
    qlearning: {
      title: 'Q러닝', line: '지도 없이, 해 보며 배우는 가치.',
      brain: '처음 가는 동네에서도 이리저리 다녀 보며 어느 길이 빠른지 익힌다. 결과가 예상보다 좋으면 그 선택을 더 믿게 된다.',
      ai: 'Q러닝은 상태마다 행동별 점수 Q를 두고, 한 걸음 갈 때마다 "받은 보상 + γ × 다음 상태의 가장 좋은 Q"와의 차이만큼 Q를 고친다. 세상의 규칙을 몰라도 배운다. 2015년 DQN은 이 Q를 신경망으로 바꿔 아타리 게임을 배웠다.',
    },
    softmax: {
      title: '소프트맥스', line: '출력을 확률로 나눠 가지기.',
      brain: '여러 뉴런 무리가 서로 억누르며 경쟁하면, 가장 강한 쪽만 크게 남는다. 뇌가 여러 해석 중 하나를 고를 때 이런 경쟁이 일어난다고 본다.',
      ai: '소프트맥스는 각 출력의 지수(e^값)를 전체 합으로 나눠, 모든 출력이 0~1이고 합이 1이 되게 한다. 그래서 출력을 "각 종류일 확률"로 읽는다. 사진 분류, 다음 단어 고르기 같은 여러 갈래 분류의 마지막 층에 거의 언제나 쓰인다.',
    },
    confidence: {
      title: '확신과 보정', line: '맞히는 것과 얼마나 확신하는가는 다르다.',
      brain: '사람도 맞혔지만 자신 없을 때가 있고, 틀렸는데 확신할 때도 있다. 자기 판단을 얼마나 믿을지 아는 것(메타인지)도 따로 발달한다.',
      ai: '같은 경계라도 가중치를 키우면 확률이 0이나 1 쪽으로 쏠린다. 확신은 높을수록 좋은 게 아니라, 실제로 맞을 확률과 같아야 좋다(보정). 요즘 큰 신경망은 틀릴 때도 지나치게 확신하는 경향이 있다고 알려져 있다.',
    },
    multiclass: {
      title: '여러 갈래 분류', line: '가장 큰 출력이 이긴다.',
      brain: '시각 피질의 깊은 곳에는 얼굴, 장소, 몸 같은 범주에 따로 반응하는 영역들이 있다.',
      ai: '종류마다 출력 뉴런을 하나씩 두고, 가장 큰 출력의 종류를 답으로 한다. 출력이 히든 없이 입력에 바로 이어지면 각 종류의 영역은 직선으로 둘러싸인 볼록한 모양이 된다. 손글씨 숫자 10가지, 사진 1000가지도 같은 방식이다.',
    },
    crossentropy: {
      title: '교차 엔트로피', line: '정답을 얼마나 놀라워했나.',
      brain: '뇌는 예상이 크게 빗나갈 때(놀랄 때) 더 많이 배운다는 연구가 많다. 예측 오차가 학습 신호가 된다.',
      ai: '교차 엔트로피는 -log(정답의 확률)이다. 정답 확률이 1이면 0, 작을수록 크게 벌한다. 소프트맥스와 함께 쓰면 고칠 양이 "확률 - 정답"으로 간단해서, 분류 신경망은 거의 모두 이 오차로 배운다. 섀넌의 정보 이론에서 나온 말이다.',
    },
    gate: {
      title: '게이트', line: '곱하기 하나로 열고 닫는 문.',
      brain: '뇌에는 다른 뉴런의 신호가 통할지 말지를 조절하는 회로가 있다. 시상(thalamus)은 감각 정보를 대뇌로 보낼지 거르는 관문 역할을 한다.',
      ai: '게이트는 0~1 사이의 값을 곱해서 신호를 통과시키거나(1) 막는다(0). LSTM과 GRU 같은 순환 신경망은 이 문들로 무엇을 기억하고 무엇을 내보낼지 스스로 배운다.',
    },
    inputgate: {
      title: '입력 게이트', line: '아무거나 담지 않는다.',
      brain: '하루에 보고 듣는 것 중 아주 일부만 기억에 남는다. 주의를 기울인 것, 중요하다고 느낀 것만 저장된다.',
      ai: '입력 게이트는 새 값을 셀에 얼마나 담을지 정한다. 문이 닫혀 있으면 새 입력이 들어와도 셀은 그대로라서, 필요한 순간의 값만 골라 오래 들고 있을 수 있다.',
    },
    forgetgate: {
      title: '망각 게이트', line: '잘 잊어야 잘 기억한다.',
      brain: '잊는 것도 뇌의 중요한 기능이다. 쓸모없어진 기억을 지워야 새로운 것을 헷갈리지 않고 배운다.',
      ai: '망각 게이트는 지난 셀 값에 곱해서 얼마나 남길지 정한다. 1997년의 첫 LSTM에는 없었는데, 셀 값이 끝없이 쌓이는 문제를 풀려고 2000년에 더해졌다(Gers 외). 지금 LSTM이라고 하면 보통 이것이 있는 형태다.',
    },
    lstm: {
      title: 'LSTM', line: '문 셋이 달린 기억 칸.',
      brain: '작업 기억은 필요한 것을 붙잡아 두고, 방해 자극은 막고, 필요할 때 꺼내 쓴다. 전전두엽과 바닥핵이 이런 "문 여닫기"에 관여한다는 이론이 있다.',
      ai: 'LSTM 한 칸은 셀(기억)과 입력·망각·출력 게이트로 이루어진다. 게이트 값은 보통 시그모이드로 0~1 사이를 내고, 무엇을 담고 지우고 꺼낼지를 학습으로 정한다. 트랜스포머가 나오기 전까지 번역·음성 인식의 중심이었다.',
    },
  });

  // 0장 튜토리얼: 진리표 실험 형식으로 모든 조작을 하나씩 따라 해 본다(투어는 app.js)
  const TUTORIAL = Object.assign({}, LOGIC_BASE, {
    id: 'tut', no: '0-1', chapter: 0, title: '튜토리얼', concept: 'neuron', tour: 'basic', funcs: FUNCS_BASIC,
    brief: '화면 안내를 따라 하나씩 해 보세요. 뉴런을 잇고, 세기를 바꾸고, 진리표로 확인하고, 채점하는 것까지 모든 기능을 배웁니다.',
    goalText: '출력 = A (안내 따라 하기)',
    rows: [[0, 0, 0], [0, 1, 0], [1, 0, 1], [1, 1, 1]],
    hints: ['입력 A를 끌어서 출력 위에 놓으면 선(시냅스)이 생긴다.', '값 조절: 선의 세기가 0.5보다 작으면 A가 1이어도 출력이 0.5를 못 넘는다.', '입력 A → 출력 +1.'],
    solution: B('inA>out:1'),
    stars: [{ type: 'synapses', max: 1 }, { type: 'noHidden' }],
  });

  // 한 갈래로 합치고, 장마다 분류 태그(AI 개념 / 사고력)를 붙인다. 잠금과 이전·다음은 이 순서 그대로 이어진다.
  const ORDER = [
    { list: [TUTORIAL], no: 0, tag: 'AI 개념' },
    { list: LOGIC, no: 1, tag: 'AI 개념' },
    { list: PUZZLES, no: 2, tag: '사고력' },
    { list: ARENA, no: 3, tag: '사고력' },
    { list: TRAIN, no: 4, tag: 'AI 개념' },
    { list: REWARDS, no: 5, tag: 'AI 개념' },
    { list: CLASSIFY.concat([CLASSIFY_TRAIN]), no: 6, tag: 'AI 개념' },
    { list: VISION, no: 7, tag: 'AI 개념' },
    { list: MEMORY, no: 8, tag: 'AI 개념' },
    { list: CLUSTER, no: 9, tag: 'AI 개념' },
    { list: COMPRESS.concat([COMPRESS_TRAIN]), no: 10, tag: 'AI 개념' },
    { list: DESCENT, no: 11, tag: '심화' },
    { list: VALUE, no: 12, tag: '심화' },
    { list: PROB.concat([PROB_TRAIN]), no: 13, tag: '심화' },
    { list: GATES, no: 14, tag: '심화' },
  ];
  const STAGES = [];
  for (const g of ORDER) g.list.forEach((st, k) => {
    Object.assign(st, { track: 'ai', chapter: g.no, tag: g.tag, no: g.no + '-' + (k + 1) });
    st.code = st.no;
    STAGES.push(st);
  });
  const TAGS = ['AI 개념', '사고력', '심화'];
  const TRACKS = [
    {
      id: 'ai', title: 'AI 배우기', route: 'home',
      desc: '인공지능이 어떻게 생각하고 배우는지를 기초부터. 개념을 배우는 실험(AI 개념)과 생각하는 힘을 기르는 퍼즐(사고력)이 번갈아 나온다.',
      chapters: [
        { no: 0, title: '시작하기', tag: 'AI 개념', desc: '처음이라면 여기부터. 화면 안내를 따라 뉴런 잇기, 세기 바꾸기, 진리표, 채점, 힌트까지 모든 조작을 하나씩 해 본다.' },
        { no: 1, title: '뉴런 하나', tag: 'AI 개념', desc: '뉴런은 들어온 신호에 가중치를 곱해 더하고, 문턱을 넘으면 켜진다. 진리표로 퍼셉트론과 논리 게이트를 직접 만든다.' },
        { no: 2, title: '논리 회로 퍼즐', tag: '사고력', desc: '조건 걸기, 같음 판단, 다수결, 셋 중 하나만, 반가산기, +1·-1만으로 만드는 NAND. 문제를 작은 조건으로 나눠 조립한다.' },
        { no: 3, title: '생명체 길찾기', tag: '사고력', desc: '눈·더듬이·수염을 바퀴에 이어 생명체가 먹이를 찾게 한다. 가시와 벽과 아귀를 피하는 규칙을 스스로 설계한다.' },
        { no: 4, title: '스스로 배우는 뇌', tag: 'AI 개념', desc: '이번에는 가중치를 손으로 고치지 않는다. 오차를 보고 스스로 고치는 학습, 학습률, 한 뉴런의 한계, 역전파.' },
        { no: 5, title: '보상으로 배우는 뇌', tag: 'AI 개념', desc: '강화학습. 정답 표 없이 점수만으로 배운다. 무엇에 점수를 줄지 직접 정하고, 생명체가 시행착오로 배우는 것을 지켜본다.' },
        { no: 6, title: '점을 나누는 뇌', tag: 'AI 개념', desc: '분류. 평면 위의 점을 색깔별로 나누는 경계를 뉴런으로 긋는다. 가중치와 편향이 선을 움직이는 법, 선을 겹쳐 모양 만들기, 과적합, 스스로 선을 찾는 학습.' },
        { no: 7, title: '그림을 보는 뇌', tag: 'AI 개념', desc: 'CNN의 기초. 3×3 필터를 직접 칠해 세로줄·가로줄·경계를 찾고, 필터 두 개와 풀링으로 그림을 분류한다.' },
        { no: 8, title: '기억하는 뇌', tag: 'AI 개념', desc: 'RNN의 기초. 뉴런의 값을 다음 순간의 자신에게 되돌려 보내면 뇌가 기억을 갖는다. 방금 전 기억하기, 켜짐 붙잡기, 두 번 연속, 두 칸 전 기억, 홀짝 세기.' },
        { no: 9, title: '스스로 묶는 뇌', tag: 'AI 개념', desc: '비지도 학습. 정답 없이 비슷한 점끼리 묶는다. 중심을 직접 옮겨 보고, k-평균이 "묶기 → 옮기기"를 되풀이해 무리를 찾는 것을 본다. 나쁜 시작과 무리 수 고르기까지.' },
        { no: 10, title: '압축하는 뇌', tag: 'AI 개념', desc: '오토인코더. 정보를 작은 코드로 줄였다가 다시 살린다. 넷을 둘로 줄이는 코드 만들기, 잡음 지우기, 스스로 압축을 배우며 생기는 코드 지도(잠재 공간).' },
        { no: 11, title: '골짜기를 내려가는 뇌', tag: '심화', base: 4, desc: '4장 심화 · 최적화. 가중치 두 개로 그린 오차 지형 위에서 공을 굴린다. 학습률, 좁은 골짜기와 모멘텀, 작은 웅덩이(지역 최소), 걸음을 따로 맞추는 Adam.' },
        { no: 12, title: '가치를 배우는 뇌', tag: '심화', base: 5, desc: '5장 심화 · 가치 기반 강화학습. 칸마다 "앞으로 받을 점수"를 적는 가치 함수와 벨만 방정식, 할인율 γ, 지도 없이 배우는 Q러닝, 작은 보상의 함정과 탐험.' },
        { no: 13, title: '확률로 답하는 뇌', tag: '심화', base: 6, desc: '6장 심화 · 여러 갈래 분류. 소프트맥스로 출력을 확률로 읽고, 가중치로 확신을 키우고, 네 갈래를 나누고, 교차 엔트로피로 스스로 배운다.' },
        { no: 14, title: '문을 단 기억', tag: '심화', base: 8, desc: '8장 심화 · LSTM. 곱(×) 뉴런으로 문(게이트)을 만들어, 필요할 때만 담고(입력), 지울 때 지우고(망각), 필요할 때만 꺼내는(출력) 기억 칸을 조립한다.' },
      ],
    },
  ];
  const CHAPTERS = TRACKS[0].chapters; // 예전 코드와의 호환

  Object.assign(CONCEPTS, {
    neuron: {
      title: '뉴런과 시냅스', line: '점은 뉴런, 선은 시냅스.',
      brain: '뇌는 약 860억 개의 뉴런으로 이루어져 있다. 뉴런은 다른 뉴런에게서 신호를 받아, 충분히 모이면 다음 뉴런에게 신호를 보낸다. 뉴런과 뉴런이 만나는 자리가 시냅스다.',
      ai: '인공 뉴런도 똑같이 생각한다. 여러 입력을 받아 계산하고 값 하나를 내보낸다. 인공지능은 이런 뉴런을 수천~수십억 개 이은 그물(신경망)이다.',
    },
    weight: {
      title: '가중치', line: '시냅스 하나의 세기.',
      brain: '뉴런과 뉴런이 만나는 시냅스는 세기가 제각각이다. 자주 함께 쓰이는 시냅스는 강해지고 안 쓰이면 약해진다(시냅스 가소성). 우리가 무언가를 배우면 뇌 속 시냅스 세기가 바뀐다.',
      ai: '인공 뉴런은 입력 x에 가중치 w를 곱해서 받는다. 가중치가 크면 그 입력을 중요하게, 0이면 무시, 음수면 반대로 받아들인다. 인공지능이 "배운다"는 것은 결국 이 가중치들을 고치는 일이다.',
    },
    sum: {
      title: '가중합', line: '들어온 신호를 모두 더한다.',
      brain: '실제 뉴런 하나에는 수천 개의 시냅스가 붙어 있다. 각 시냅스에서 들어온 작은 전기 변화가 세포체에서 합쳐지고, 그 합이 충분히 크면 뉴런이 발화한다.',
      ai: '인공 뉴런의 계산은 w₁x₁ + w₂x₂ + … 처럼 입력마다 가중치를 곱해 더하는 것이다. 이것을 가중합이라고 한다. 거대한 언어 모델도 이 계산을 수십억 번 되풀이한다.',
    },
    threshold: {
      title: '문턱과 편향', line: '얼마나 모여야 켜질까.',
      brain: '뉴런은 막전위가 문턱(역치, 대략 -55mV 근처)을 넘어야 활동 전위를 쏜다. 문턱보다 조금 모자라면 아무 일도 일어나지 않는다. 그래서 신호가 "모여야" 반응한다.',
      ai: '퍼셉트론(1958년 로젠블랫)은 가중합이 문턱을 넘으면 1, 아니면 0을 낸다. 문턱을 옮기는 값이 편향 b다. 언제나 1인 입력에 붙은 가중치로 생각하면 편향도 가중치 하나일 뿐이다.',
    },
    negative: {
      title: '음수 가중치', line: '켜지면 오히려 끈다.',
      brain: '억제성 시냅스는 받는 뉴런을 발화에서 멀어지게 한다. 흥분과 억제가 함께 있어서 뇌는 "이것이 켜지면 저것은 꺼라" 같은 계산을 한다.',
      ai: '가중치가 음수면 입력이 켜질수록 출력이 작아진다. 편향(+)과 음수 가중치(-) 하나로 NOT 게이트가 된다. AND, OR, NOT만 있으면 어떤 논리 회로든 만들 수 있다.',
    },
    xor: {
      title: '다층 퍼셉트론', line: '직선 하나로는 못 나눈다.',
      brain: '뇌는 뉴런 하나가 아니라 여러 층의 회로로 계산한다. 감각 정보는 여러 단계를 거치며 점점 복잡한 특징(선 → 모양 → 얼굴)으로 바뀐다.',
      ai: '1969년 민스키와 패퍼트는 층이 하나인 퍼셉트론이 XOR을 못 푼다는 것을 보였다. 네 칸을 직선 하나로 나눌 수 없기 때문이다. 히든층을 넣은 다층 퍼셉트론은 XOR을 풀 수 있다. 지금의 딥러닝은 이 층을 아주 깊게 쌓은 것이다.',
    },
    learning: {
      title: '학습', line: '틀린 만큼 고친다.',
      brain: '1949년 헵은 "함께 발화하는 뉴런은 함께 연결된다"고 제안했다. 경험이 시냅스 세기를 바꾸고, 바뀐 시냅스가 다음 행동을 바꾼다. 이것이 뇌가 배우는 기본 방식으로 여겨진다.',
      ai: '델타 규칙: 가중치 변화 = 학습률 × (목표 - 출력) × 입력. 틀린 만큼, 그 입력이 켜져 있었던 만큼 고친다. 맞히면 오차가 0이라 더 고치지 않는다. 데이터를 한 바퀴 다 보는 것을 에포크라고 한다.',
    },
    rate: {
      title: '학습률', line: '한 번에 얼마나 고칠까.',
      brain: '뇌에서는 도파민 같은 신경 조절 물질이 "이번 경험에서 얼마나 크게 배울지"를 조절한다고 알려져 있다. 예상보다 좋은 일이 생기면 도파민이 늘고 그 경험을 더 강하게 배운다.',
      ai: '학습률이 너무 작으면 배우는 데 한참 걸리고, 너무 크면 정답을 계속 지나쳐서 오히려 못 배운다. 실제 AI를 학습시킬 때도 학습률은 가장 먼저 조절하는 값이다.',
    },
    limit: {
      title: '한 뉴런의 한계', line: '아무리 배워도 안 되는 것.',
      brain: '재미있게도 실제 사람 대뇌 겉질 뉴런은 수상돌기에서 복잡한 계산을 해서 뉴런 하나가 XOR 비슷한 일을 한다는 연구(2020년)가 있다. 진짜 뉴런은 인공 뉴런보다 훨씬 복잡하다.',
      ai: '층이 하나인 뉴런은 학습률을 어떻게 바꿔도 XOR을 배우지 못한다. 만들 수 없는 것은 배울 수도 없다. 이 한계가 알려지면서 1970년대 신경망 연구가 한동안 식었다.',
    },
    backprop: {
      title: '역전파', line: '오차를 거꾸로 나눠 준다.',
      brain: '뇌가 역전파를 그대로 쓰는지는 아직 논쟁 중이다. 오차 신호를 거꾸로 정확히 보내는 길이 뇌에서 뚜렷하게 발견되지 않았기 때문이다. 뇌가 비슷한 일을 어떻게 하는지는 지금도 활발한 연구 주제다.',
      ai: '출력의 오차를 그 출력에 이어진 히든 뉴런에게 가중치만큼 나눠 주고, 히든 뉴런도 자기 가중치를 고친다. 1986년 루멜하트, 힌턴, 윌리엄스가 널리 알렸고, 오늘날 거의 모든 신경망이 이 방법으로 학습한다.',
    },
  });

  Object.assign(CONCEPTS, {
    reward: {
      title: '강화학습과 보상', line: '정답 대신 점수로 배운다.',
      brain: '동물은 정답을 듣고 배우지 않는다. 먹이를 찾으면 좋고 다치면 나쁘다는 결과만으로 행동을 바꾼다. 뇌에서는 도파민 뉴런이 "예상보다 좋았다/나빴다"는 신호(보상 예측 오차)를 보내 학습을 이끈다고 알려져 있다.',
      ai: '강화학습은 에이전트(배우는 쪽)가 환경 속에서 행동하고, 그 결과로 받은 보상(점수)의 합이 커지도록 정책(행동 규칙)을 바꾸는 방식이다. 지도학습처럼 정답 표가 없다. 바둑 AI 알파고, 로봇 걷기, 게임 AI가 이 방법으로 배웠다.',
    },
    shaping: {
      title: '보상 쪼개 주기', line: '너무 드문 칭찬은 아무것도 가르치지 못한다.',
      brain: '동물 훈련사는 최종 동작을 바로 기다리지 않는다. 목표에 조금씩 가까워질 때마다 칭찬해서 이끈다(행동 조형). 스키너가 비둘기 실험에서 쓴 방법이다.',
      ai: '보상이 아주 드물면(희소 보상) 에이전트는 우연히 성공하기 전까지 어떤 방향이 좋은지 모른다. 중간 단계마다 작은 보상을 주는 것을 보상 쉐이핑이라고 한다. 다만 중간 보상을 잘못 주면 다음 실험처럼 엉뚱한 것을 배울 수 있다.',
    },
    penalty: {
      title: '벌점', line: '피해야 할 것도 점수로 알려 줘야 한다.',
      brain: '아픔과 두려움도 학습 신호다. 뜨거운 것에 한 번 데면 다시는 만지지 않으려 한다. 뇌에서는 편도체 같은 영역이 위험과 연결된 기억을 강하게 남긴다.',
      ai: '보상은 음수가 될 수도 있다. 에이전트는 "점수의 합"만 보기 때문에, 위험한 행동을 피하게 하려면 그 행동에 벌점을 줘야 한다. 자율주행처럼 안전이 중요한 분야에서는 무엇에 얼마의 벌점을 줄지가 아주 중요하다.',
    },
    hacking: {
      title: '보상 해킹', line: 'AI는 내가 원한 것이 아니라 내가 점수를 준 것을 배운다.',
      brain: '사람도 비슷하다. 시험 점수만 보상하면 이해하지 않고 외우는 쪽으로, 조회수만 보상하면 자극적인 쪽으로 행동이 바뀐다. 측정이 목표가 되면 좋은 측정이 아니게 된다는 말(굿하트의 법칙)이 있다.',
      ai: '2016년 한 보트 경주 게임에서, 경로의 아이템을 먹으면 점수를 주자 AI는 결승선 대신 같은 자리를 빙빙 돌며 아이템만 먹었다. 이렇게 보상의 빈틈을 찾아내는 것을 보상 해킹이라고 하고, AI가 사람의 진짜 의도를 따르게 하는 연구(정렬, alignment)의 핵심 문제다.',
    },
    explore: {
      title: '탐험과 활용', line: '아는 길만 갈까, 새 길을 시도할까.',
      brain: '어린 동물은 많이 돌아다니며 탐험하고, 자라면서 아는 방법을 더 많이 쓴다. 뇌는 확실한 보상과 새로운 가능성 사이에서 끊임없이 저울질한다.',
      ai: '시행착오 학습에서 "탐험 정도"는 뇌를 한 번에 얼마나 크게 바꿔 볼지다. 너무 작으면 새로운 행동을 못 찾아 제자리이고, 너무 크면 좋았던 것까지 망가뜨린다. 강화학습에서는 이것을 탐험-활용 딜레마라고 부른다.',
    },
  });

  // ---- 기본 용어(개념 노트 맨 위, 언제나 열려 있음) -------------------------------
  const GLOSSARY = [
    { term: '뉴런', en: 'neuron', def: '신호를 받아 계산하고 값 하나를 다음으로 보내는 단위. 이 게임의 동그라미.' },
    { term: '시냅스', en: 'synapse', def: '뉴런과 뉴런을 잇는 연결. 이 게임의 선. 신호를 얼마나 세게 전할지(가중치)를 가진다.' },
    { term: '가중치', en: 'weight', def: '시냅스의 세기. 클수록 세게, 0이면 무시, 음수면 반대로 전한다. AI가 배운다는 건 이 값을 고친다는 뜻이다.' },
    { term: '가중합', en: 'weighted sum', def: '들어온 값 × 가중치를 모두 더한 것. 뉴런이 하는 계산의 첫 단계.' },
    { term: '편향', en: 'bias', def: '입력과 상관없이 늘 더해지는 값. 이 게임에서는 언제나 1인 "상시" 뉴런에 붙은 가중치. 켜지기 위한 문턱을 옮긴다.' },
    { term: '활성화 함수', en: 'activation function', def: '가중합을 어떤 값으로 내보낼지 정하는 함수. 0~1 자르기, ReLU, 시그모이드, 계단 등이 있다. ‘생명체 길찾기’ 장부터 뉴런을 클릭해 바꿀 수 있다.' },
    { term: 'ReLU', en: 'rectified linear unit', def: '0보다 작으면 0, 크면 그대로 내보내는 함수. 계산이 빠르고 잘 배워서 요즘 신경망에서 가장 많이 쓴다.' },
    { term: '시그모이드', en: 'sigmoid', def: '어떤 값이든 0과 1 사이의 S자 곡선으로 바꾸는 함수. 확률처럼 읽고 싶을 때 쓴다.' },
    { term: '소프트맥스', en: 'softmax', def: '여러 출력이 값을 나눠 가져서 합이 1이 되게 하는 함수. "고양이일 확률 0.8, 개일 확률 0.2"처럼 분류에 쓴다.' },
    { term: '층', en: 'layer', def: '같은 단계에 있는 뉴런 묶음. 입력층 → 히든층 → 출력층 순서로 신호가 흐른다. 층이 많으면 "깊은" 신경망(딥러닝)이다.' },
    { term: '히든 뉴런', en: 'hidden neuron', def: '입력층과 출력층 사이(히든층)에 있는 뉴런. 밖에서는 값이 보이지 않고, 중간 계산을 맡는다. 이 덕분에 직선 하나로는 못 하는 판단(XOR 등)을 할 수 있다.' },
    { term: '퍼셉트론', en: 'perceptron', def: '가중합이 문턱을 넘으면 1, 아니면 0을 내는 가장 단순한 인공 뉴런(1958년 로젠블랫). 층을 여러 개 쌓으면 다층 퍼셉트론이다.' },
    { term: '논리 게이트', en: 'logic gate', def: '0과 1을 받아 0과 1을 내는 규칙. AND(둘 다 1), OR(하나라도 1), NOT(반대로), XOR(하나만 1). ‘뉴런 하나’와 ‘논리 회로 퍼즐’ 장에서 뉴런으로 직접 만든다.' },
    { term: '학습', en: 'learning / training', def: '틀린 만큼 가중치를 고쳐서 점점 맞게 만드는 과정. 데이터를 한 바퀴 다 보는 것을 에포크(학습 1번)라고 한다.' },
    { term: '오차', en: 'error / loss', def: '목표와 출력의 차이. 학습은 이 값을 줄이는 방향으로 가중치를 고친다.' },
    { term: '학습률', en: 'learning rate', def: '한 번에 가중치를 얼마나 크게 고칠지. 너무 작으면 느리고, 너무 크면 정답을 지나쳐 못 배운다.' },
    { term: '분류', en: 'classification', def: '입력을 정해진 몇 가지 종류 중 하나로 나누는 일. "이 사진은 고양이", "이 메일은 스팸"처럼. 6장에서 점을 파랑·주황으로 나눈다.' },
    { term: '결정 경계', en: 'decision boundary', def: '분류의 답이 바뀌는 경계선. 뉴런 하나의 결정 경계는 직선이고, 히든 뉴런을 쓰면 휘거나 닫힌 모양이 된다.' },
    { term: '훈련 데이터와 시험 데이터', en: 'training set / test set', def: 'AI가 배우는 데 쓰는 데이터와, 배운 뒤 실력을 재는 처음 보는 데이터. 시험 데이터로 재야 진짜 실력을 알 수 있다.' },
    { term: '과적합', en: 'overfitting', def: '훈련 데이터의 잡음까지 외워서, 훈련 데이터는 잘 맞히지만 처음 보는 데이터는 틀리는 것.' },
    { term: '일반화', en: 'generalization', def: '배운 것을 처음 보는 데이터에도 잘 적용하는 능력. AI를 만드는 진짜 목표다.' },
    { term: '경사 하강법', en: 'gradient descent', def: '오차가 줄어드는 방향으로 가중치를 조금씩 옮기는 학습 방법. 학습률은 한 걸음의 크기다.' },
    { term: '합성곱', en: 'convolution', def: '작은 필터를 그림 위에서 한 칸씩 옮기며, 겹친 칸끼리 곱해서 더하는 계산. 같은 필터를 모든 자리에 쓴다(가중치 공유).' },
    { term: '필터', en: 'filter / kernel', def: '합성곱에 쓰는 작은 가중치 격자(예: 3×3). 필터 모양에 따라 세로줄, 가로줄, 경계 같은 서로 다른 특징을 찾는다.' },
    { term: '특징 맵', en: 'feature map', def: '필터 하나를 그림 전체에 적용한 결과. 그 특징이 그림의 어디에 있는지 보여 준다.' },
    { term: '풀링', en: 'pooling', def: '특징 맵을 줄이는 계산. 최대 풀링은 가장 큰 값만 남겨 "이 특징이 어딘가 있었다"를 전한다.' },
    { term: 'CNN', en: 'convolutional neural network', def: '합성곱 → 풀링을 여러 번 쌓고 마지막에 분류하는 신경망. 사진·영상 인식의 기본 구조다.' },
    { term: '순환 신경망', en: 'RNN, recurrent neural network', def: '뉴런의 값을 다음 순간의 입력으로 되돌려 보내는 신경망. 시간 순서가 있는 데이터를 다룬다. 8장에서 기억 뉴런으로 만든다.' },
    { term: '은닉 상태', en: 'hidden state', def: 'RNN이 지금까지 본 입력을 요약해 들고 다니는 값. 이 게임에서는 기억 뉴런으로 되돌아오는 히든 뉴런의 값이다.' },
    { term: '시퀀스', en: 'sequence', def: '순서가 있는 데이터. 문장, 소리, 날마다의 기온처럼 앞뒤 순서에 뜻이 있다.' },
    { term: 'LSTM', en: 'long short-term memory', def: '기억을 남길지 지울지 정하는 문(게이트)을 단 RNN. 기본 RNN보다 훨씬 먼 과거를 기억한다.' },
    { term: '비지도 학습', en: 'unsupervised learning', def: '정답(꼬리표) 없이 데이터 속 구조를 찾는 학습. 군집화와 오토인코더가 대표적이다.' },
    { term: '군집화', en: 'clustering', def: '비슷한 데이터끼리 무리로 묶는 일. 9장에서 점을 묶는다.' },
    { term: 'k-평균', en: 'k-means', def: '중심 k개를 두고 "가장 가까운 중심에 묶기 → 중심을 평균으로 옮기기"를 멈출 때까지 되풀이하는 군집화 방법.' },
    { term: '지역 최소', en: 'local minimum', def: '주변보다는 낮지만 가장 낮지는 않은 골짜기. 학습이 여기에 갇히면 더 좋은 답을 못 찾는다.' },
    { term: '오토인코더', en: 'autoencoder', def: '입력을 작은 코드로 줄였다가(인코더) 다시 살리는(디코더) 신경망. 입력 자기 자신을 목표로 배운다.' },
    { term: '잠재 공간', en: 'latent space', def: '오토인코더의 코드 값들이 놓이는 공간. 잘 배우면 비슷한 입력이 가까운 자리에 놓인다.' },
    { term: '임베딩', en: 'embedding', def: '단어·사진 같은 것을 뜻이 담긴 숫자 묶음(코드)으로 바꾼 것. 비슷한 것은 비슷한 숫자가 된다.' },
    { term: '오차 지형', en: 'loss landscape', def: '가중치들을 축으로, 오차를 높이로 그린 지형. 학습은 이 지형의 낮은 곳을 찾아 내려가는 일이다.' },
    { term: '모멘텀', en: 'momentum', def: '지난 걸음들의 방향을 속도로 기억해서 그쪽으로 계속 나아가는 최적화 방법. 좁은 골짜기를 빨리 지나고 작은 웅덩이를 넘는다.' },
    { term: 'Adam', en: 'adaptive moment estimation', def: '가중치마다 기울기의 평균과 크기를 기억해서 걸음 크기를 따로 맞추는 최적화 방법. 요즘 가장 많이 쓴다.' },
    { term: '가치 함수', en: 'value function', def: '어떤 상태에서 시작해 앞으로 받을 보상의 합(할인된 합). 가치가 높은 쪽으로 가면 좋은 행동이 된다.' },
    { term: '벨만 방정식', en: 'Bellman equation', def: '지금 가치 = 한 걸음 보상 + γ × 다음 상태의 가치. 가치를 상태에서 상태로 이어 주는 식.' },
    { term: '할인율', en: 'discount factor γ', def: '한 걸음 늦게 받는 보상에 곱하는 0~1 사이의 수. 작으면 눈앞의 보상을, 크면 먼 보상까지 본다.' },
    { term: 'Q러닝', en: 'Q-learning', def: '상태마다 행동별 점수 Q를 두고, 직접 해 보며 "보상 + γ × 다음 상태의 가장 좋은 Q" 쪽으로 고쳐 가는 강화학습 방법.' },
    { term: 'ε-탐욕', en: 'ε-greedy', def: 'ε의 확률로는 아무 행동이나 해 보고(탐험), 나머지는 가장 좋다고 아는 행동을 하는(활용) 방법.' },
    { term: '소프트맥스', en: 'softmax', def: '출력들을 0~1 사이, 합이 1인 확률로 바꾸는 함수. 여러 갈래 분류의 마지막 층에 쓴다.' },
    { term: '교차 엔트로피', en: 'cross-entropy', def: '-log(정답의 확률). 정답을 낮은 확률로 말할수록 크게 벌하는 분류용 오차.' },
    { term: '게이트', en: 'gate', def: '0~1 사이 값을 곱해 신호를 통과시키거나 막는 문. LSTM·GRU의 핵심 부품.' },
    { term: '셀 상태', en: 'cell state', def: 'LSTM이 칸에서 칸으로 넘기는 기억 값. 게이트들이 무엇을 담고 지우고 꺼낼지 정한다.' },
    { term: '강화학습', en: 'reinforcement learning', def: '정답 표 없이, 행동한 결과로 받는 보상(점수)이 커지도록 스스로 행동 규칙을 바꾸는 학습. ‘보상으로 배우는 뇌’ 장에서 직접 해 본다.' },
    { term: '에이전트', en: 'agent', def: '강화학습에서 행동하고 배우는 쪽. 이 게임에서는 생명체 "도트"다. 에이전트가 행동하는 세상(아레나)을 환경이라고 한다.' },
    { term: '보상', en: 'reward', def: '행동의 결과로 받는 점수. 좋은 일에는 +, 피해야 할 일에는 -. 사람이 무엇에 몇 점을 줄지 정하는 것을 보상 설계라고 한다.' },
    { term: '정책', en: 'policy', def: '어떤 상황에서 어떻게 행동할지 정하는 규칙. 이 게임에서는 감각을 바퀴에 잇는 가중치들이 곧 정책이다.' },
    { term: '탐험과 활용', en: 'exploration vs exploitation', def: '새로운 행동을 시도해 볼지(탐험), 지금까지 좋았던 행동을 계속할지(활용) 사이의 저울질.' },
    { term: '보상 해킹', en: 'reward hacking', def: 'AI가 사람이 원한 목표 대신 점수 규칙의 빈틈을 찾아 점수만 올리는 것. "점수를 준 것"과 "원하는 것"이 다를 때 생긴다.' },
    { term: '역전파', en: 'backpropagation', def: '출력의 오차를 앞쪽 뉴런들에게 거꾸로 나눠 주며 모든 가중치를 고치는 방법. 거의 모든 신경망이 이렇게 배운다.' },
  ];

  // ---- 관련 논문 ------------------------------------------------------------
  // 개념마다 원전·대표 논문. link는 DOI(학술지 페이지), arXiv, 또는 저자가 공개한 원문.
  // 모든 링크는 DOI·arXiv 메타데이터로 제목이 맞는지 확인했다.
  const PAPERS = {
    mp43: { title: 'A logical calculus of the ideas immanent in nervous activity', who: 'McCulloch & Pitts', year: 1943, link: 'https://doi.org/10.1007/BF02478259', note: '뉴런을 켜짐·꺼짐 두 가지만 내는 논리 소자로 본 최초의 인공 뉴런 모델.' },
    ros58: { title: 'The perceptron: A probabilistic model for information storage and organization in the brain', who: 'Rosenblatt', year: 1958, link: 'https://doi.org/10.1037/h0042519', note: '가중치를 스스로 고치며 배우는 퍼셉트론을 처음 제안한 논문.' },
    rhw86: { title: 'Learning representations by back-propagating errors', who: 'Rumelhart, Hinton & Williams', year: 1986, link: 'https://doi.org/10.1038/323533a0', note: '역전파로 히든 유닛이 스스로 쓸모 있는 표현을 배운다는 것을 보였다. XOR 같은 문제를 푼다.' },
    shannon38: { title: 'A symbolic analysis of relay and switching circuits', who: 'Shannon', year: 1938, link: 'https://doi.org/10.1109/T-AIEE.1938.5057767', note: '논리식(AND·OR·NOT)을 스위치 회로로 바꾸는 법. 디지털 회로 설계의 출발점.' },
    sheffer13: { title: 'A set of five independent postulates for Boolean algebras, with application to logical constants', who: 'Sheffer', year: 1913, link: 'https://doi.org/10.1090/S0002-9947-1913-1500960-1', note: '연산 하나(지금의 NAND)만으로 모든 논리를 나타낼 수 있음을 보였다.' },
    hw59: { title: 'Receptive fields of single neurones in the cat\'s striate cortex', who: 'Hubel & Wiesel', year: 1959, link: 'https://doi.org/10.1113/jphysiol.1959.sp006308', note: '시각 피질 뉴런이 특정 방향의 선에만 반응한다는 발견. 합성곱 필터의 뿌리.' },
    hw62: { title: 'Receptive fields, binocular interaction and functional architecture in the cat\'s visual cortex', who: 'Hubel & Wiesel', year: 1962, link: 'https://doi.org/10.1113/jphysiol.1962.sp006837', note: '단순 세포·복합 세포로 이어지는 시각 처리의 층 구조.' },
    fuku80: { title: 'Neocognitron: A self-organizing neural network model for a mechanism of pattern recognition unaffected by shift in position', who: 'Fukushima', year: 1980, link: 'https://doi.org/10.1007/BF00344251', note: '필터 층과 모으는 층을 번갈아 쌓은 CNN의 원형.' },
    lecun89: { title: 'Backpropagation applied to handwritten zip code recognition', who: 'LeCun et al.', year: 1989, link: 'https://doi.org/10.1162/neco.1989.1.4.541', note: '합성곱 필터를 역전파로 배우게 해서 손글씨 우편번호를 읽었다.' },
    lecun98: { title: 'Gradient-based learning applied to document recognition', who: 'LeCun, Bottou, Bengio & Haffner', year: 1998, link: 'https://doi.org/10.1109/5.726791', note: '합성곱 → 풀링 → 분류로 이어지는 LeNet-5. CNN의 교과서 같은 논문.' },
    alexnet: { title: 'ImageNet classification with deep convolutional neural networks', who: 'Krizhevsky, Sutskever & Hinton', year: 2012, link: 'https://doi.org/10.1145/3065386', note: '깊은 CNN으로 사진 1000가지 분류에서 크게 이기며 딥러닝 붐을 연 AlexNet. 링크는 2017년 학술지에 다시 실린 판.' },
    lettvin59: { title: 'What the frog\'s eye tells the frog\'s brain', who: 'Lettvin, Maturana, McCulloch & Pitts', year: 1959, link: 'https://doi.org/10.1109/JRPROC.1959.287207', note: '개구리 눈의 뉴런이 이미 \'움직이는 작은 점\' 같은 특징을 골라 보낸다는 발견.' },
    marr80: { title: 'Theory of edge detection', who: 'Marr & Hildreth', year: 1980, link: 'https://doi.org/10.1098/rspb.1980.0020', note: '밝기가 바뀌는 곳(경계)을 찾는 계산 이론. 경계 필터의 고전.' },
    hartline56: { title: 'Inhibition in the eye of Limulus', who: 'Hartline, Wagner & Ratliff', year: 1956, link: 'https://doi.org/10.1085/jgp.39.5.651', note: '이웃 뉴런을 억누르는 측면 억제를 투구게 눈에서 측정했다.' },
    eccles54: { title: 'Cholinergic and inhibitory synapses in a pathway from motor-axon collaterals to motoneurones', who: 'Eccles, Fatt & Koketsu', year: 1954, link: 'https://doi.org/10.1113/jphysiol.1954.sp005226', note: '다음 뉴런을 꺼지게 만드는 억제 시냅스를 척수에서 확인했다.' },
    elman90: { title: 'Finding structure in time', who: 'Elman', year: 1990, link: 'https://doi.org/10.1207/s15516709cog1402_1', note: '히든 값을 다음 순간의 입력으로 되돌리는 단순 순환망(Elman 망). 시간 속 XOR도 다룬다.' },
    lstm97: { title: 'Long short-term memory', who: 'Hochreiter & Schmidhuber', year: 1997, link: 'https://doi.org/10.1162/neco.1997.9.8.1735', note: '기억을 남길지 지울지 정하는 문(게이트)으로 긴 기억 문제를 푼 LSTM.' },
    bengio94: { title: 'Learning long-term dependencies with gradient descent is difficult', who: 'Bengio, Simard & Frasconi', year: 1994, link: 'https://doi.org/10.1109/72.279181', note: '기본 RNN이 먼 과거를 배우기 어려운 까닭(기울기 소실)을 밝혔다.' },
    hopfield82: { title: 'Neural networks and physical systems with emergent collective computational abilities', who: 'Hopfield', year: 1982, link: 'https://doi.org/10.1073/pnas.79.8.2554', note: '되먹임으로 이어진 뉴런들이 안정된 상태에 머무르며 기억을 담는 호프필드 망.' },
    fuster71: { title: 'Neuron activity related to short-term memory', who: 'Fuster & Alexander', year: 1971, link: 'https://doi.org/10.1126/science.173.3997.652', note: '자극이 사라진 뒤에도 계속 발화하며 정보를 붙잡는 뉴런을 원숭이 뇌에서 찾았다.' },
    lloyd82: { title: 'Least squares quantization in PCM', who: 'Lloyd', year: 1982, link: 'https://doi.org/10.1109/TIT.1982.1056489', note: '\'묶기 → 평균으로 옮기기\'를 되풀이하는 k-평균 알고리즘의 원전(1957년 보고서).' },
    kpp07: { title: 'k-means++: The advantages of careful seeding', who: 'Arthur & Vassilvitskii', year: 2007, link: 'https://theory.stanford.edu/~sergei/papers/kMeansPP-soda.pdf', note: '시작 자리를 잘 골라서 엉뚱한 답에 갇히는 일을 줄이는 k-평균++.' },
    thorndike53: { title: 'Who belongs in the family?', who: 'Thorndike', year: 1953, link: 'https://doi.org/10.1007/BF02289263', note: '무리 수를 바꿔 가며 흩어짐이 꺾이는 곳을 보는 \'팔꿈치\' 방법의 시작.' },
    rz85: { title: 'Feature discovery by competitive learning', who: 'Rumelhart & Zipser', year: 1985, link: 'https://doi.org/10.1207/s15516709cog0901_5', note: '가장 잘 맞는 뉴런만 이겨서 배우는 경쟁 학습으로 정답 없이 특징을 찾는다.' },
    kohonen82: { title: 'Self-organized formation of topologically correct feature maps', who: 'Kohonen', year: 1982, link: 'https://doi.org/10.1007/BF00337288', note: '비슷한 입력이 이웃한 뉴런에 모이도록 스스로 정리되는 자기조직화 지도.' },
    hs06: { title: 'Reducing the dimensionality of data with neural networks', who: 'Hinton & Salakhutdinov', year: 2006, link: 'https://doi.org/10.1126/science.1127647', note: '깊은 오토인코더로 데이터를 작은 코드로 줄였다가 살려 낸 논문.' },
    vincent08: { title: 'Extracting and composing robust features with denoising autoencoders', who: 'Vincent, Larochelle, Bengio & Manzagol', year: 2008, link: 'https://doi.org/10.1145/1390156.1390294', note: '잡음 섞인 입력에서 원본을 살리게 배우는 디노이징 오토인코더.' },
    vae: { title: 'Auto-Encoding Variational Bayes', who: 'Kingma & Welling', year: 2013, link: 'https://arxiv.org/abs/1312.6114', note: '잠재 공간에서 새 데이터를 뽑아 그려 내는 변분 오토인코더(VAE).' },
    ddpm: { title: 'Denoising Diffusion Probabilistic Models', who: 'Ho, Jain & Abbeel', year: 2020, link: 'https://arxiv.org/abs/2006.11239', note: '잡음을 조금씩 걷어 내며 그림을 그리는 확산 모델. 그림 생성 AI의 바탕.' },
    w2v: { title: 'Efficient estimation of word representations in vector space', who: 'Mikolov, Chen, Corrado & Dean', year: 2013, link: 'https://arxiv.org/abs/1301.3781', note: '단어를 뜻이 담긴 숫자 묶음(임베딩)으로 바꾸는 word2vec.' },
    bcv13: { title: 'Representation learning: A review and new perspectives', who: 'Bengio, Courville & Vincent', year: 2013, link: 'https://arxiv.org/abs/1206.5538', note: '좋은 표현을 스스로 배우는 법을 정리한 리뷰.' },
    okeefe71: { title: 'The hippocampus as a spatial map. Preliminary evidence from unit activity in the freely-moving rat', who: 'O\'Keefe & Dostrovsky', year: 1971, link: 'https://doi.org/10.1016/0006-8993(71)90358-1', note: '쥐가 특정 자리에 있을 때만 발화하는 장소 세포의 발견.' },
    hafting05: { title: 'Microstructure of a spatial map in the entorhinal cortex', who: 'Hafting, Fyhn, Molden, Moser & Moser', year: 2005, link: 'https://doi.org/10.1038/nature03721', note: '공간을 격자 모양 코드로 나타내는 격자 세포의 발견.' },
    sutton18: { title: 'Reinforcement Learning: An Introduction (2nd ed.)', who: 'Sutton & Barto', year: 2018, link: 'http://incompleteideas.net/book/the-book-2nd.html', note: '강화학습의 교과서. 저자들이 전문을 무료로 공개했다.' },
    schultz97: { title: 'A neural substrate of prediction and reward', who: 'Schultz, Dayan & Montague', year: 1997, link: 'https://doi.org/10.1126/science.275.5306.1593', note: '도파민 뉴런이 \'예상보다 좋았나\'를 신호로 보낸다는 발견. 뇌의 보상 학습.' },
    dqn15: { title: 'Human-level control through deep reinforcement learning', who: 'Mnih et al.', year: 2015, link: 'https://doi.org/10.1038/nature14236', note: '화면과 점수만 보고 아타리 게임을 사람 수준으로 배운 DQN.' },
    es17: { title: 'Evolution strategies as a scalable alternative to reinforcement learning', who: 'Salimans, Ho, Chen, Sidor & Sutskever', year: 2017, link: 'https://arxiv.org/abs/1703.03864', note: '가중치를 조금씩 흔든 후보 중 점수가 높은 쪽으로 가는 진화 전략. 5장의 학습 방식과 같은 생각.' },
    amodei16: { title: 'Concrete problems in AI safety', who: 'Amodei et al.', year: 2016, link: 'https://arxiv.org/abs/1606.06565', note: '보상 해킹처럼 AI가 의도와 다르게 점수만 올리는 문제들을 정리했다.' },
    skinner58: { title: 'Reinforcement today', who: 'Skinner', year: 1958, link: 'https://doi.org/10.1037/h0049039', note: '목표 행동에 조금씩 다가갈 때마다 보상하는 \'조형(shaping)\'을 소개했다.' },
    thorndike98: { title: 'Animal intelligence: An experimental study of the associative processes in animals', who: 'Thorndike', year: 1898, link: 'https://doi.org/10.1037/h0092987', note: '결과가 좋으면 늘고 나쁘면 줄어드는 \'효과의 법칙\'. 보상·벌점 학습의 출발점.' },
    szegedy13: { title: 'Intriguing properties of neural networks', who: 'Szegedy et al.', year: 2013, link: 'https://arxiv.org/abs/1312.6199', note: '사람 눈에 안 보이는 작은 변화로 신경망을 속이는 적대적 예제를 처음 보고했다.' },
    goodfellow14: { title: 'Explaining and harnessing adversarial examples', who: 'Goodfellow, Shlens & Szegedy', year: 2014, link: 'https://arxiv.org/abs/1412.6572', note: '적대적 예제가 왜 생기는지 설명하고 막는 방법을 제안했다.' },
    cybenko89: { title: 'Approximation by superpositions of a sigmoidal function', who: 'Cybenko', year: 1989, link: 'https://doi.org/10.1007/BF02551274', note: '히든 층 하나에 뉴런이 충분하면 어떤 모양의 함수도 흉내 낼 수 있다(보편 근사).' },
    hornik89: { title: 'Multilayer feedforward networks are universal approximators', who: 'Hornik, Stinchcombe & White', year: 1989, link: 'https://doi.org/10.1016/0893-6080(89)90020-8', note: '여러 층 신경망이 보편 근사기임을 보인 또 하나의 고전.' },
    fisher36: { title: 'The use of multiple measurements in taxonomic problems', who: 'Fisher', year: 1936, link: 'https://doi.org/10.1111/j.1469-1809.1936.tb02137.x', note: '측정값에 가중치를 곱해 더한 직선으로 붓꽃 종을 나눈 선형 판별 분석.' },
    zhang16: { title: 'Understanding deep learning requires rethinking generalization', who: 'Zhang, Bengio, Hardt, Recht & Vinyals', year: 2016, link: 'https://arxiv.org/abs/1611.03530', note: '신경망은 무작위 꼬리표까지 외울 수 있다. 외우기와 일반화의 차이를 다시 묻는다.' },
    dropout14: { title: 'Dropout: A simple way to prevent neural networks from overfitting', who: 'Srivastava, Hinton, Krizhevsky, Sutskever & Salakhutdinov', year: 2014, link: 'https://jmlr.org/papers/v15/srivastava14a.html', note: '학습 중에 뉴런을 무작위로 꺼서 과적합을 줄이는 드롭아웃.' },
    robbins51: { title: 'A stochastic approximation method', who: 'Robbins & Monro', year: 1951, link: 'https://doi.org/10.1214/aoms/1177729586', note: '조금씩 고쳐 가며 답에 다가가는 확률적 근사. 경사 하강법과 학습률의 수학적 뿌리.' },
    adam14: { title: 'Adam: A method for stochastic optimization', who: 'Kingma & Ba', year: 2014, link: 'https://arxiv.org/abs/1412.6980', note: '가중치마다 걸음 크기(학습률)를 알아서 맞추는 Adam. 지금 가장 널리 쓰인다.' },
    widrow90: { title: '30 years of adaptive neural networks: perceptron, Madaline, and backpropagation', who: 'Widrow & Lehr', year: 1990, link: 'https://doi.org/10.1109/5.58323', note: '델타 규칙(LMS)을 만든 위드로가 퍼셉트론부터 역전파까지 학습 규칙을 정리했다.' },
    white86: { title: 'The structure of the nervous system of the nematode Caenorhabditis elegans', who: 'White, Southgate, Thomson & Brenner', year: 1986, link: 'https://doi.org/10.1098/rstb.1986.0056', note: '예쁜꼬마선충 뉴런 302개의 연결을 모두 그린 최초의 커넥톰.' },
    grillner06: { title: 'Biological pattern generation: The cellular and computational logic of networks in motion', who: 'Grillner', year: 2006, link: 'https://doi.org/10.1016/j.neuron.2006.11.008', note: '뇌의 명령 없이도 걷기·헤엄 리듬을 만드는 중추 패턴 발생기 회로.' },
    walter50: { title: 'An imitation of life', who: 'Walter', year: 1950, link: 'https://doi.org/10.1038/scientificamerican0550-42', note: '빛 센서 두 개와 바퀴로 빛을 찾아가는 로봇 거북. 이 게임 생명체의 할아버지.' },
    kandel70: { title: 'Neuronal mechanisms of habituation and dishabituation of the gill-withdrawal reflex in Aplysia', who: 'Castellucci, Pinsker, Kupfermann & Kandel', year: 1970, link: 'https://doi.org/10.1126/science.167.3926.1745', note: '군소의 아가미 움츠리기 반사를 뉴런 몇 개 수준에서 밝혔다.' },
    woolsey70: { title: 'The structural organization of layer IV in the somatosensory region (SI) of mouse cerebral cortex', who: 'Woolsey & Van der Loos', year: 1970, link: 'https://doi.org/10.1016/0006-8993(70)90079-X', note: '쥐 수염 하나하나가 대뇌 피질의 \'통(barrel)\' 하나씩에 대응하는 촉각 지도.' },
    li18: { title: 'Visualizing the loss landscape of neural nets', who: 'Li, Xu, Taylor, Studer & Goldstein', year: 2018, link: 'https://arxiv.org/abs/1712.09913', note: '실제 신경망의 오차 지형을 그려서, 골짜기가 넓고 매끈할수록 잘 배운다는 것을 보였다.' },
    goodfellow15: { title: 'Qualitatively characterizing neural network optimization problems', who: 'Goodfellow, Vinyals & Saxe', year: 2015, link: 'https://arxiv.org/abs/1412.6544', note: '시작점에서 끝점까지 직선을 따라 오차를 재 보며 학습이 지나는 지형을 살폈다.' },
    polyak64: { title: 'Some methods of speeding up the convergence of iteration methods', who: 'Polyak', year: 1964, link: 'https://doi.org/10.1016/0041-5553(64)90137-5', note: '지난 걸음의 방향을 더해 빨리 내려가는 \'무거운 공(heavy ball)\' 방법. 모멘텀의 원전.' },
    sutskever13: { title: 'On the importance of initialization and momentum in deep learning', who: 'Sutskever, Martens, Dahl & Hinton', year: 2013, link: 'https://proceedings.mlr.press/v28/sutskever13.html', note: '모멘텀과 좋은 시작값만으로도 깊은 신경망을 잘 학습시킬 수 있음을 보였다.' },
    dauphin14: { title: 'Identifying and attacking the saddle point problem in high-dimensional non-convex optimization', who: 'Dauphin et al.', year: 2014, link: 'https://arxiv.org/abs/1406.2572', note: '차원이 아주 많으면 웅덩이보다 안장점이 학습을 더 많이 늦춘다는 것을 밝혔다.' },
    duchi11: { title: 'Adaptive subgradient methods for online learning and stochastic optimization', who: 'Duchi, Hazan & Singer', year: 2011, link: 'https://jmlr.org/papers/v12/duchi11a.html', note: '가중치마다 지금까지의 기울기 크기로 걸음을 나누는 AdaGrad. Adam의 바탕.' },
    bellman52: { title: 'On the theory of dynamic programming', who: 'Bellman', year: 1952, link: 'https://doi.org/10.1073/pnas.38.8.716', note: '큰 문제를 \'지금 한 걸음 + 남은 문제\'로 쪼개는 동적 계획법. 벨만 방정식의 출발점.' },
    samuelson37: { title: 'A note on measurement of utility', who: 'Samuelson', year: 1937, link: 'https://doi.org/10.2307/2967612', note: '미래의 만족을 일정한 비율로 깎아 더하는 할인 효용 모델. 할인율 γ의 경제학 쪽 뿌리.' },
    watkins92: { title: 'Q-learning', who: 'Watkins & Dayan', year: 1992, link: 'https://doi.org/10.1007/BF00992698', note: 'Q러닝이 충분히 탐험하면 가장 좋은 행동 점수로 모인다는 것을 증명했다.' },
    auer02: { title: 'Finite-time analysis of the multiarmed bandit problem', who: 'Auer, Cesa-Bianchi & Fischer', year: 2002, link: 'https://doi.org/10.1023/A:1013689704352', note: '여러 슬롯머신 중 무엇을 당길지(탐험과 활용)를 수학적으로 다룬 고전. ε-탐욕과 UCB를 비교한다.' },
    bridle90: { title: 'Probabilistic interpretation of feedforward classification network outputs, with relationships to statistical pattern recognition', who: 'Bridle', year: 1990, link: 'https://doi.org/10.1007/978-3-642-76153-9_28', note: '출력을 확률로 읽게 하는 \'소프트맥스\'라는 이름과 쓰임을 정리한 논문.' },
    guo17: { title: 'On calibration of modern neural networks', who: 'Guo, Pleiss, Sun & Weinberger', year: 2017, link: 'https://arxiv.org/abs/1706.04599', note: '요즘 신경망은 틀릴 때도 지나치게 확신한다는 것을 보이고, 온도로 확률을 바로잡는 법을 제안했다.' },
    hinton15: { title: 'Distilling the knowledge in a neural network', who: 'Hinton, Vinyals & Dean', year: 2015, link: 'https://arxiv.org/abs/1503.02531', note: '소프트맥스에 온도를 넣어 확률을 부드럽게 만들고, 큰 모델의 지식을 작은 모델에 옮긴다.' },
    shannon48: { title: 'A mathematical theory of communication', who: 'Shannon', year: 1948, link: 'https://doi.org/10.1002/j.1538-7305.1948.tb01338.x', note: '정보의 양과 엔트로피를 정의한 정보 이론의 출발점. 교차 엔트로피라는 말이 여기서 나왔다.' },
    gers00: { title: 'Learning to forget: Continual prediction with LSTM', who: 'Gers, Schmidhuber & Cummins', year: 2000, link: 'https://doi.org/10.1162/089976600300015015', note: 'LSTM에 망각 게이트를 더해, 쌓이기만 하던 셀 기억을 스스로 지울 수 있게 했다.' },
    greff17: { title: 'LSTM: A search space odyssey', who: 'Greff, Srivastava, Koutník, Steunebrink & Schmidhuber', year: 2017, link: 'https://arxiv.org/abs/1503.04069', note: 'LSTM의 게이트를 하나씩 빼 보며 어떤 부품이 중요한지 대규모로 비교했다. 망각 게이트와 출력 쪽이 핵심.' },
    cho14: { title: 'Learning phrase representations using RNN encoder-decoder for statistical machine translation', who: 'Cho et al.', year: 2014, link: 'https://arxiv.org/abs/1406.1078', note: '게이트 두 개로 LSTM을 단순하게 만든 GRU를 처음 내놓은 논문.' },
  };
  const CONCEPT_PAPERS = {
    neuron: ['mp43'],
    weight: ['ros58'],
    sum: ['mp43'],
    threshold: ['ros58', 'mp43'],
    negative: ['eccles54'],
    xor: ['rhw86'],
    andnot: ['shannon38'],
    xnor: ['shannon38'],
    majority: ['mp43', 'shannon38'],
    exactlyOne: ['shannon38'],
    adder: ['shannon38'],
    nand: ['sheffer13'],
    bias: ['grillner06'],
    cross: ['walter50'],
    reflex: ['kandel70'],
    inhibition: ['hartline56'],
    whisker: ['woolsey70'],
    hidden: ['rhw86'],
    adversarial: ['szegedy13', 'goodfellow14'],
    learning: ['widrow90', 'ros58'],
    rate: ['robbins51', 'adam14'],
    limit: ['rhw86'],
    backprop: ['rhw86'],
    reward: ['sutton18', 'schultz97', 'es17', 'dqn15'],
    shaping: ['skinner58'],
    penalty: ['thorndike98'],
    hacking: ['amodei16'],
    boundary: ['fisher36', 'ros58'],
    slope: ['fisher36'],
    shape: ['cybenko89'],
    shapes: ['hornik89', 'cybenko89'],
    overfit: ['zhang16', 'dropout14'],
    gradient: ['robbins51', 'rhw86'],
    conv: ['hw59', 'lecun89'],
    featuremap: ['hw62', 'fuku80'],
    edge: ['marr80', 'lettvin59'],
    pooling: ['lecun98', 'alexnet'],
    recurrent: ['elman90'],
    latch: ['fuster71', 'hopfield82'],
    sequence: ['elman90'],
    longmem: ['bengio94', 'lstm97'],
    parity: ['elman90'],
    unsupervised: ['rz85', 'kohonen82'],
    kmeans: ['lloyd82'],
    localmin: ['kpp07'],
    choosek: ['thorndike53'],
    autoencoder: ['hs06'],
    latent: ['vae', 'okeefe71', 'hafting05'],
    denoise: ['vincent08', 'ddpm'],
    representation: ['bcv13', 'w2v'],
    connectome: ['white86'],
    landscape: ['li18', 'goodfellow15'],
    momentum: ['polyak64', 'sutskever13'],
    escape: ['dauphin14'],
    adam: ['adam14', 'duchi11'],
    valuefn: ['bellman52', 'schultz97'],
    discount: ['samuelson37', 'sutton18'],
    qlearning: ['watkins92', 'dqn15'],
    explore: ['auer02'],
    softmax: ['bridle90'],
    confidence: ['guo17', 'hinton15'],
    multiclass: ['lecun98'],
    crossentropy: ['shannon48'],
    gate: ['lstm97'],
    inputgate: ['lstm97'],
    forgetgate: ['gers00'],
    lstm: ['greff17', 'cho14'],
  };

  SA.content = { PAPERS, CONCEPT_PAPERS, B, TAGS, SIGMAS, REWARD_STAGES: REWARDS, GLOSSARY, FUNCS_ALL, STAGES, TRACKS, CHAPTERS, PUZZLE_STAGES: PUZZLES, RATES, ARENA_STAGES: ARENA, LOGIC_STAGES: LOGIC, TRAIN_STAGES: TRAIN, VERSUS_ARENAS, VERSUS_SENSORS, RIVALS, LAB_ARENAS, CONCEPTS };
})();
