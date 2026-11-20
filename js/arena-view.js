/* 시냅스 아레나 — 아레나 그리기
 * 모든 것을 점과 선으로 그린다. 논리 좌표 900×600을 캔버스 크기에 맞춰 늘린다.
 */
(function () {
  'use strict';
  const SA = (globalThis.SA = globalThis.SA || {});
  const { W, H, P } = SA.sim;
  const TAU = Math.PI * 2;

  const COLORS = {
    bg: '#1a1e25', grid: 'rgba(210,205,195,0.08)',
    wall: '#2a2f38', wallLine: '#4b5261',
    food: '#ffd166', gold: '#f4c95d', danger: '#ff5fa2', wallSense: '#5ee6d0',
    creature: ['#e9eefb', '#ffb35c'],
    versus: ['#5aa9ff', '#ffb35c'],
  };

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    const fx = [];
    let scale = 1, ox = 0, oy = 0;

    // 캔버스가 어떤 비율이든 900×600 아레나를 가운데에 꽉 차게 넣는다(남는 곳은 테두리 밖)
    function fit() {
      const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
      const cw = canvas.clientWidth || W;
      const ch = canvas.clientHeight || (cw * H) / W;
      const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      scale = Math.min(pw / W, ph / H);
      ox = (pw - W * scale) / 2;
      oy = (ph - H * scale) / 2;
    }

    function addEvents(events, world) {
      for (const e of events) {
        if (e.type === 'eat') burst(e.x, e.y, COLORS.food, 14, 1);
        else if (e.type === 'hit') burst(e.x, e.y, COLORS.danger, 18, 1.4);
        else if (e.type === 'charged') burst(e.x, e.y, COLORS.gold, 26, 1.6);
      }
      if (fx.length > 400) fx.splice(0, fx.length - 400);
      return world;
    }
    function burst(x, y, color, n, power) {
      fx.push({ ring: true, x, y, r: 6, life: 0.6, max: 0.6, color });
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.random() * 0.4;
        const sp = (60 + Math.random() * 90) * power;
        fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, max: 0.8, color });
      }
    }

    function draw(world, opt = {}) {
      fit();
      const t = opt.time || performance.now() / 1000;
      const dt = opt.dt || 1 / 60;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#15181e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, ox, oy);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(120,120,130,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);
      // 점 격자
      ctx.fillStyle = COLORS.grid;
      for (let x = 15; x < W; x += 30) for (let y = 15; y < H; y += 30) ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);

      for (const r of world.walls) drawWall(r);
      for (const m of world.marks) drawMark(m, t);
      for (const h of world.hazards) drawHazard(h, t);
      for (const d of world.decoys) drawLight(d.x, d.y, t, true);
      for (const f of world.foods) drawLight(f.x, f.y, t, false, f.born > 0 ? world.t - f.born : null);
      if (opt.showStart) for (const c of world.creatures) drawStart(c);
      for (const p of world.predators) drawPredator(p, t, opt.sense);
      world.creatures.forEach((c, i) => {
        const color = opt.versus ? COLORS.versus[i] : COLORS.creature[i];
        if (opt.trail !== false) drawTrail(c, color);
        drawCreature(world, c, color, t, opt.sense);
      });
      // 효과
      for (let i = fx.length - 1; i >= 0; i--) {
        const p = fx[i];
        p.life -= dt;
        if (p.life <= 0) { fx.splice(i, 1); continue; }
        const a = p.life / p.max;
        if (p.ring) {
          p.r += 140 * dt;
          ctx.strokeStyle = hexA(p.color, a * 0.8);
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
        } else {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94;
          ctx.fillStyle = hexA(p.color, a);
          ctx.fillRect(p.x - 1.6, p.y - 1.6, 3.2, 3.2);
        }
      }
      if (opt.banner) drawBanner(opt.banner);
    }

    function drawWall(r) {
      ctx.fillStyle = COLORS.wall;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.save();
      ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
      ctx.strokeStyle = 'rgba(130,130,140,0.3)';
      ctx.lineWidth = 1;
      for (let k = -r.h; k < r.w; k += 10) { ctx.beginPath(); ctx.moveTo(r.x + k, r.y + r.h); ctx.lineTo(r.x + k + r.h, r.y); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = COLORS.wallLine;
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.setLineDash([]);
    }

    function drawLight(x, y, t, decoy, age) {
      const pulse = 1 + 0.12 * Math.sin(t * (decoy ? 9 : 3) + x);
      const grow = age == null ? 1 : Math.min(1, age * 3);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 44 * pulse * grow);
      g.addColorStop(0, decoy ? 'rgba(255,240,200,0.6)' : 'rgba(255,209,102,0.55)');
      g.addColorStop(1, 'rgba(255,209,102,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 44 * pulse * grow, 0, TAU); ctx.fill();
      ctx.fillStyle = decoy ? '#fff3d6' : COLORS.food;
      ctx.beginPath(); ctx.arc(x, y, 8.5 * grow, 0, TAU); ctx.fill();
      if (!decoy) {
        // 먹이: 점 네 개로 된 작은 고리
        ctx.fillStyle = 'rgba(255,209,102,0.85)';
        for (let k = 0; k < 4; k++) { const a = t * 1.5 + (k * TAU) / 4; ctx.fillRect(x + Math.cos(a) * 15 - 1.6, y + Math.sin(a) * 15 - 1.6, 3.2, 3.2); }
      }
    }

    function drawMark(m, t) {
      const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
      g.addColorStop(0, m.done ? 'rgba(244,201,93,0.45)' : 'rgba(244,201,93,0.16)');
      g.addColorStop(1, 'rgba(244,201,93,0.02)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(244,201,93,0.65)';
      ctx.setLineDash([2, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, t * 0.3, t * 0.3 + TAU); ctx.stroke();
      ctx.setLineDash([]);
      if (m.charge > 0) {
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r - 6, -Math.PI / 2, -Math.PI / 2 + TAU * m.charge); ctx.stroke();
        ctx.lineCap = 'butt';
      }
      // 가운데 별 모양 표식
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 4;
        ctx.beginPath(); ctx.moveTo(m.x - Math.cos(a) * 9, m.y - Math.sin(a) * 9); ctx.lineTo(m.x + Math.cos(a) * 9, m.y + Math.sin(a) * 9); ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.font = '700 12px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.fillText(Math.round(m.charge * 100) + '%', m.x, m.y + m.r + 16);
    }

    function drawHazard(h, t) {
      const n = 10;
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 2.2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + t * 0.25;
        ctx.beginPath();
        ctx.moveTo(h.x + Math.cos(a) * h.r * 0.35, h.y + Math.sin(a) * h.r * 0.35);
        ctx.lineTo(h.x + Math.cos(a) * h.r, h.y + Math.sin(a) * h.r);
        ctx.stroke();
        ctx.fillStyle = COLORS.danger;
        ctx.fillRect(h.x + Math.cos(a) * h.r - 2, h.y + Math.sin(a) * h.r - 2, 4, 4);
      }
      ctx.fillStyle = 'rgba(255,95,162,0.9)';
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * 0.28, 0, TAU); ctx.fill();
    }

    function drawStart(c) {
      ctx.strokeStyle = 'rgba(233,238,251,0.35)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(c.sx, c.sy, P.BODY_R + 8, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawPredator(p, t, sense) {
      if (sense) {
        ctx.strokeStyle = 'rgba(255,95,162,0.22)';
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.sense, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      const ca = Math.cos(p.a), sa = Math.sin(p.a);
      const chase = p.mode === 'chase';
      // 꼬리: 몸 뒤로 뻗은 선 세 가닥
      ctx.strokeStyle = chase ? 'rgba(255,143,191,0.6)' : 'rgba(200,140,255,0.55)';
      ctx.lineWidth = 1.6;
      for (const off of [-0.45, 0, 0.45]) {
        const a = p.a + Math.PI + off + 0.15 * Math.sin(t * 5 + off * 3);
        ctx.beginPath();
        ctx.moveTo(p.x + Math.cos(a) * p.r * 0.9, p.y + Math.sin(a) * p.r * 0.9);
        ctx.lineTo(p.x + Math.cos(a) * p.r * 1.7, p.y + Math.sin(a) * p.r * 1.7);
        ctx.stroke();
      }
      // 몸: 점으로 된 원
      ctx.fillStyle = chase ? 'rgba(255,95,162,0.14)' : 'rgba(200,140,255,0.12)';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      ctx.fillStyle = chase ? '#ff8fbf' : '#c88cff';
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * TAU;
        const rr = p.r * (1 + 0.05 * Math.sin(t * 4 + k));
        ctx.fillRect(p.x + Math.cos(a) * rr - 1.8, p.y + Math.sin(a) * rr - 1.8, 3.6, 3.6);
      }
      // 입: 지그재그 이빨
      ctx.strokeStyle = chase ? '#ff5fa2' : '#9d7be0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const open = chase ? 0.55 + 0.25 * Math.sin(t * 10) : 0.35;
      for (let k = 0; k <= 8; k++) {
        const a = p.a - open + (k / 8) * open * 2;
        const rr = k % 2 ? p.r * 0.62 : p.r * 0.95;
        const x = p.x + Math.cos(a) * rr, y = p.y + Math.sin(a) * rr;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
      // 점박이 눈
      const ex = p.x + ca * p.r * 0.2 - sa * p.r * 0.45, ey = p.y + sa * p.r * 0.2 + ca * p.r * 0.45;
      ctx.fillStyle = chase ? '#ff5fa2' : '#e9eefb';
      ctx.beginPath(); ctx.arc(ex, ey, 3.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(233,238,251,0.6)';
      for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; ctx.fillRect(ex + Math.cos(a) * 6 - 0.8, ey + Math.sin(a) * 6 - 0.8, 1.6, 1.6); }
      // 낚싯대 + 미끼
      const lp = SA.sim.lurePos(p);
      const hx = p.x + ca * p.r * 0.2 + sa * p.r * 1.2, hy = p.y + sa * p.r * 0.2 - ca * p.r * 1.2;
      ctx.strokeStyle = 'rgba(200,180,255,0.7)';
      ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(p.x + sa * p.r * 0.7, p.y - ca * p.r * 0.7); ctx.quadraticCurveTo(hx, hy, lp.x, lp.y); ctx.stroke();
      drawLight(lp.x, lp.y, t, true);
    }

    function drawTrail(c, color) {
      const tr = c.trail;
      const n = tr.length / 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * 0.35;
        ctx.fillStyle = hexA(color, a);
        ctx.fillRect(tr[k * 2] - 1.6, tr[k * 2 + 1] - 1.6, 3.2, 3.2);
      }
    }

    function drawCreature(world, c, color, t, sense) {
      const R = P.BODY_R;
      const inp = c.inputs || {};
      const allow = world.allow;
      if (c.stun > 0 && Math.floor(t * 12) % 2 === 0) return;
      const ca = Math.cos(c.a), sa = Math.sin(c.a);
      // 눈의 시야: 왼눈(주황)·오른눈(노랑)을 늘 보여 준다. 지금 보고 있는 빛이 셀수록 진해진다.
      if (allow.has('eyeL')) {
        drawEyeField(c, -1, inp.eyeL || 0, '#ffa94d', '왼눈', sense);
        drawEyeField(c, 1, inp.eyeR || 0, '#ffe066', '오른눈', sense);
      }
      // 감각 범위
      if (sense) {
        if (allow.has('feelL')) {
          ctx.strokeStyle = 'rgba(255,95,162,0.25)';
          ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.arc(c.x, c.y, R + P.R_DANGER, 0, TAU); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // 수염
      if (allow.has('whiskL')) {
        for (const [s, id] of [[-1, 'whiskL'], [1, 'whiskR']]) {
          const a = c.a + s * P.WHISK_ANG;
          const v = inp[id] || 0;
          const len = sense ? P.WHISK_LEN : P.WHISK_LEN * 0.55;
          ctx.strokeStyle = hexA(COLORS.wallSense, 0.25 + v * 0.75);
          ctx.lineWidth = 1 + v * 1.5;
          ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a) * R, c.y + Math.sin(a) * R); ctx.lineTo(c.x + Math.cos(a) * len, c.y + Math.sin(a) * len); ctx.stroke();
        }
      }
      // 더듬이
      if (allow.has('feelL')) {
        for (const [s, id] of [[-1, 'feelL'], [1, 'feelR']]) {
          const a = c.a + s * P.FEEL_ANG;
          const v = inp[id] || 0;
          const x1 = c.x + Math.cos(a) * R, y1 = c.y + Math.sin(a) * R;
          const x2 = c.x + Math.cos(a - s * 0.3) * (R + 14), y2 = c.y + Math.sin(a - s * 0.3) * (R + 14);
          ctx.strokeStyle = hexA(COLORS.danger, 0.4 + v * 0.6);
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          ctx.fillStyle = hexA(COLORS.danger, 0.5 + v * 0.5);
          ctx.beginPath(); ctx.arc(x2, y2, 2 + v * 2.5, 0, TAU); ctx.fill();
        }
      }
      // 몸
      ctx.fillStyle = '#1a1e25';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, TAU); ctx.fill(); ctx.stroke();
      // 바퀴 (속도만큼 밝게)
      for (const [s, v] of [[-1, c.vl || 0], [1, c.vr || 0]]) {
        const wx = c.x - sa * s * (R - 1), wy = c.y + ca * s * (R - 1);
        ctx.strokeStyle = hexA('#7ee081', 0.35 + v * 0.65);
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(wx - ca * 7, wy - sa * 7); ctx.lineTo(wx + ca * 7, wy + sa * 7); ctx.stroke();
      }
      // 코(앞)
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(c.x + ca * (R + 6), c.y + sa * (R + 6));
      ctx.lineTo(c.x + ca * (R - 3) - sa * 4, c.y + sa * (R - 3) + ca * 4);
      ctx.lineTo(c.x + ca * (R - 3) + sa * 4, c.y + sa * (R - 3) - ca * 4);
      ctx.closePath(); ctx.fill();
      // 눈
      if (allow.has('eyeL')) {
        for (const [s, id] of [[-1, 'eyeL'], [1, 'eyeR']]) {
          const a = c.a + s * P.EYE_ANG;
          const v = inp[id] || 0;
          const ex = c.x + Math.cos(a) * (R - 4), ey = c.y + Math.sin(a) * (R - 4);
          ctx.fillStyle = hexA('#ffd166', 0.3 + v * 0.7);
          ctx.beginPath(); ctx.arc(ex, ey, 2.4 + v * 2, 0, TAU); ctx.fill();
        }
      }
      // 가운데 뉴런 점
      ctx.fillStyle = hexA(color, 0.9);
      ctx.beginPath(); ctx.arc(c.x - ca * 2, c.y - sa * 2, 2.5, 0, TAU); ctx.fill();
    }

    // 눈 하나의 시야. 민감도가 절반이 되는 각도(EYE_HALF) 안쪽을 부채꼴로, 멀수록 흐리게 그린다.
    const EYE_HALF = 1.14; // ((1+cos)/2)^2 = 0.5 이 되는 각도
    function drawEyeField(c, side, v, hex, label, sense) {
      const axis = c.a + side * P.EYE_ANG;
      const len = sense ? 320 : 230;
      const strength = (sense ? 0.16 : 0.09) + v * 0.32;
      ctx.save();
      const g = ctx.createRadialGradient(c.x, c.y, P.BODY_R, c.x, c.y, len);
      g.addColorStop(0, hexA(hex, strength));
      g.addColorStop(1, hexA(hex, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.arc(c.x, c.y, len, axis - EYE_HALF, axis + EYE_HALF); ctx.closePath(); ctx.fill();
      // 가운데 축(가장 잘 보는 방향)
      ctx.strokeStyle = hexA(hex, 0.25 + v * 0.6);
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + Math.cos(axis) * len * 0.75, c.y + Math.sin(axis) * len * 0.75); ctx.stroke();
      ctx.setLineDash([]);
      // 이름과 지금 값
      const lx = c.x + Math.cos(axis) * 70, ly = c.y + Math.sin(axis) * 70;
      ctx.font = '700 12px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.fillStyle = hexA(hex, 0.6 + v * 0.4);
      ctx.fillText(sense ? `${label} ${v.toFixed(2)}` : label, lx, ly);
      ctx.restore();
    }

    function wedge(x, y, a, half, len, fill) {
      ctx.fillStyle = fill;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, len, a - half, a + half); ctx.closePath(); ctx.fill();
    }

    function drawBanner(text) {
      ctx.fillStyle = 'rgba(10,14,25,0.6)';
      ctx.fillRect(0, H / 2 - 40, W, 80);
      ctx.fillStyle = '#e9eefb';
      ctx.font = '800 30px ' + getComputedStyle(document.body).fontFamily;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, W / 2, H / 2);
      ctx.textBaseline = 'alphabetic';
    }

    return { draw, addEvents, fit, clearFx() { fx.length = 0; } };
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
  }

  SA.arenaView = { create, hexA, COLORS };
})();
