/* 시냅스 아레나 — 배경
 * 페이지 뒤에서 점과 선이 천천히 떠다닌다. 마우스가 가까이 오면 점이 살짝 비켜나고 가는 선으로 이어진다.
 * 과하지 않게: 점은 적게, 색은 옅게, 힘은 약하게. 모션 줄이기 설정이면 멈춰 있는다.
 */
(function () {
  'use strict';
  const cv = document.getElementById('bgCanvas');
  if (!cv) return;
  const g = cv.getContext('2d');
  const reduce = globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const LINK = 130;      // 점끼리 선을 긋는 거리
  const REACH = 150;     // 마우스가 영향을 주는 거리
  let W = 0, H = 0, dpr = 1, pts = [];
  let mouse = { x: -9999, y: -9999, on: false };
  let colors = { dot: 'rgba(46,94,158,0.35)', line: '46,94,158', cursor: '169,118,14' };
  let colorTimer = 0;

  function readColors() {
    const dark = document.documentElement.dataset.theme === 'dark';
    colors = dark
      ? { dot: 'rgba(127,167,220,0.32)', line: '127,167,220', cursor: '210,160,58', lineA: 0.16 }
      : { dot: 'rgba(46,94,158,0.28)', line: '46,94,158', cursor: '169,118,14', lineA: 0.12 };
  }
  function resize() {
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const want = Math.max(28, Math.min(80, Math.round((W * H) / 24000)));
    while (pts.length < want) pts.push(spawn());
    pts.length = want;
  }
  function spawn() {
    const a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 10; // 초당 픽셀
    return { x: Math.random() * W, y: Math.random() * H, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ox: 0, oy: 0, r: 1.3 + Math.random() * 1.2 };
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if ((colorTimer -= dt) <= 0) { readColors(); colorTimer = 0.5; }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    for (const p of pts) {
      if (!reduce) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
        if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
      }
      // 마우스 근처에서는 살짝 밀려난다(ox, oy는 원래 자리에서 벗어난 정도. 서서히 돌아온다)
      let tx = 0, ty = 0;
      if (mouse.on) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < REACH && d > 0.01) { const f = (1 - d / REACH) * 22; tx = (dx / d) * f; ty = (dy / d) * f; }
      }
      p.ox += (tx - p.ox) * Math.min(1, dt * 4);
      p.oy += (ty - p.oy) * Math.min(1, dt * 4);
    }
    // 점끼리 선
    g.lineWidth = 1;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], ax = a.x + a.ox, ay = a.y + a.oy;
      for (let j = i + 1; j < pts.length; j++) {
        const b = pts[j], bx = b.x + b.ox, by = b.y + b.oy;
        const d = Math.hypot(ax - bx, ay - by);
        if (d < LINK) {
          g.strokeStyle = `rgba(${colors.line},${((1 - d / LINK) * colors.lineA).toFixed(3)})`;
          g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        }
      }
    }
    // 마우스와 가까운 점을 잇는 선
    if (mouse.on) {
      for (const p of pts) {
        const px = p.x + p.ox, py = p.y + p.oy, d = Math.hypot(px - mouse.x, py - mouse.y);
        if (d < REACH) {
          g.strokeStyle = `rgba(${colors.cursor},${((1 - d / REACH) * 0.28).toFixed(3)})`;
          g.beginPath(); g.moveTo(mouse.x, mouse.y); g.lineTo(px, py); g.stroke();
        }
      }
    }
    g.fillStyle = colors.dot;
    for (const p of pts) { g.beginPath(); g.arc(p.x + p.ox, p.y + p.oy, p.r, 0, 6.283); g.fill(); }
    if (!document.hidden) requestAnimationFrame(frame);
  }

  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = e.pointerType === 'mouse'; }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.on = false; });
  addEventListener('blur', () => { mouse.on = false; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = performance.now(); requestAnimationFrame(frame); } });
  readColors();
  resize();
  requestAnimationFrame(frame);
})();
