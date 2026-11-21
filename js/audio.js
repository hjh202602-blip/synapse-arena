/* 시냅스 아레나 — 소리
 * 효과음은 Web Audio로 직접 합성한다. 배경음 세 곡은 LMMS로 직접 작곡·렌더링한 파일이다
 * (music/*.mmp가 원본, music/make_music.py로 다시 만든다). 모두 직접 만든 소리라 저작권 걱정이 없다.
 * 곡 파일을 못 불러오면 예전의 합성 배경음으로 대신한다.
 * 브라우저 정책 때문에 첫 클릭/키 입력 뒤에야 소리가 난다.
 */
(function () {
  'use strict';
  const SA = (globalThis.SA = globalThis.SA || {});

  let ctx = null, master = null, bgmBus = null, sfxBus = null, delayIn = null;
  const vol = { master: 0.8, bgm: 0.4, sfx: 0.7, bgmOn: true, spikes: true };
  let bgmTimer = null, nextBeat = 0, beat = 0;
  let spikeTimes = [];
  const rng = SA.sim ? SA.sim.makeRng('bgm') : Math.random;

  function ensure() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    bgmBus = ctx.createGain();
    sfxBus = ctx.createGain();
    bgmBus.connect(master);
    sfxBus.connect(master);
    // 배경음 뜯는 소리에 쓰는 메아리(딜레이)
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    delayIn = ctx.createGain();
    delayIn.connect(delay);
    delay.connect(lp); lp.connect(fb); fb.connect(delay);
    lp.connect(wet); wet.connect(bgmBus);
    applyVolumes();
    return ctx;
  }

  function applyVolumes() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(vol.master, t, 0.03);
    bgmBus.gain.setTargetAtTime(vol.bgmOn ? vol.bgm * 0.55 : 0, t, 0.08);
    sfxBus.gain.setTargetAtTime(vol.sfx, t, 0.03);
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume().then(playScene);
    else playScene();
  }

  // ---- 배경음 곡(LMMS로 만든 16마디 되풀이 곡) ----
  const TRACKS = { lab: 84, think: 96, arena: 124 }; // 곡 이름: BPM
  const TRACK_BARS = 16, TRACK_GAIN = 1.5, FADE = 1.2;
  const EXT = (() => { try { return new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3'; } catch (e) { return 'mp3'; } })();
  const loads = {};
  let scene = 'lab', cur = null, want = 0, useSynth = false;
  // 렌더링한 파일은 끝에 잔향 한 마디가 더 붙어 있다. 그 잔향을 곡 앞에 겹쳐 넣으면 이음매 없이 되풀이된다.
  function foldLoop(buf, sec) {
    const L = Math.round(sec * buf.sampleRate);
    if (buf.length <= L) return buf;
    const out = ctx.createBuffer(buf.numberOfChannels, L, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const s = buf.getChannelData(c), d = out.getChannelData(c);
      d.set(s.subarray(0, L));
      for (let i = L; i < s.length; i++) d[(i - L) % L] += s[i];
    }
    return out;
  }
  function loadTrack(name) {
    if (!loads[name]) {
      loads[name] = fetch(`assets/music/${name}.${EXT}?v=1`)
        .then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => new Promise((ok, no) => ctx.decodeAudioData(b, ok, no)))
        .then((buf) => foldLoop(buf, (TRACK_BARS * 4 * 60) / TRACKS[name]))
        .catch(() => null);
    }
    return loads[name];
  }
  function fadeOut(c) {
    if (!c) return;
    const t = ctx.currentTime;
    c.g.gain.cancelScheduledValues(t);
    c.g.gain.setValueAtTime(c.g.gain.value, t);
    c.g.gain.linearRampToValueAtTime(0, t + FADE);
    c.src.stop(t + FADE + 0.05);
  }
  function stopMusic() { want++; fadeOut(cur); cur = null; stopBgm(); }
  function playScene() {
    if (!ctx || ctx.state !== 'running' || !vol.bgmOn) return;
    if (useSynth) { if (!bgmTimer) startBgm(); return; }
    if (cur && cur.name === scene) return;
    const name = scene, ticket = ++want;
    loadTrack(name).then((buf) => {
      if (ticket !== want || !vol.bgmOn) return; // 그사이 다른 화면으로 갔거나 배경음을 껐다
      if (!buf) { useSynth = true; fadeOut(cur); cur = null; startBgm(); return; }
      fadeOut(cur);
      const t = ctx.currentTime;
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; src.loop = true;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(TRACK_GAIN, t + FADE);
      src.connect(g); g.connect(bgmBus);
      src.start(t);
      cur = { src, g, name };
    });
  }
  function setScene(name) {
    if (!TRACKS[name] || name === scene) return;
    scene = name;
    playScene();
  }

  function tone(freq, dur, o = {}) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + (o.when || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * o.slide), t + dur);
    const peak = o.gain == null ? 0.2 : o.gain;
    const atk = o.attack || 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(o.dest || sfxBus);
    if (o.send) g.connect(delayIn);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, o = {}) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime + (o.when || 0);
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.value = o.freq || 1200;
    const g = ctx.createGain();
    g.gain.value = o.gain == null ? 0.2 : o.gain;
    src.connect(f); f.connect(g); g.connect(o.dest || sfxBus);
    src.start(t);
  }

  // ---- 효과음 ----
  const sfx = {
    click() { tone(1150, 0.05, { type: 'square', gain: 0.03 }); },
    connect() { tone(520, 0.08, { type: 'triangle', gain: 0.09 }); tone(780, 0.12, { type: 'triangle', gain: 0.08, when: 0.06 }); },
    remove() { tone(420, 0.12, { type: 'triangle', gain: 0.07, slide: 0.5 }); },
    run() { tone(330, 0.1, { type: 'triangle', gain: 0.08 }); tone(495, 0.14, { type: 'triangle', gain: 0.08, when: 0.07 }); },
    eat() { tone(660, 0.12, { type: 'triangle', gain: 0.12 }); tone(990, 0.18, { type: 'sine', gain: 0.1, when: 0.07 }); },
    charged() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, { type: 'sine', gain: 0.08, when: i * 0.06 })); },
    hit() { noise(0.25, { freq: 900, gain: 0.32 }); tone(180, 0.35, { type: 'sawtooth', gain: 0.08, slide: 0.4 }); },
    success() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.5, { type: 'triangle', gain: 0.09, when: i * 0.09 })); },
    fail() { [392, 330, 262].forEach((f, i) => tone(f, 0.4, { type: 'triangle', gain: 0.09, when: i * 0.14 })); },
    discover() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.6, { type: 'sine', gain: 0.07, when: 0.5 + i * 0.11, send: true })); },
    // 뉴런이 발화할 때 '틱' — 1초에 너무 많이 나지 않게 제한한다
    spike(pitch) {
      if (!vol.spikes || !ctx) return;
      const now = ctx.currentTime;
      spikeTimes = spikeTimes.filter((t) => now - t < 1);
      if (spikeTimes.length > 16) return;
      spikeTimes.push(now);
      tone(pitch, 0.03, { type: 'sine', gain: 0.035 });
    },
  };

  // ---- 배경음: 느린 화음 + 가끔 뜯는 소리(펜타토닉) ----
  const CHORDS = [
    [110, 164.81, 261.63], // Am
    [87.31, 130.81, 220],  // F
    [130.81, 196, 329.63], // C
    [98, 146.83, 246.94],  // G
  ];
  const SCALE = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5];
  const BEAT = 0.5;

  function pad(chord, t, dur) {
    for (const f of chord) {
      for (const det of [-4, 4]) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        osc.type = 'triangle';
        osc.frequency.value = f;
        osc.detune.value = det;
        lp.type = 'lowpass'; lp.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.03, t + 1.6);
        g.gain.linearRampToValueAtTime(0.024, t + dur - 1.2);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
        osc.connect(lp); lp.connect(g); g.connect(bgmBus);
        osc.start(t); osc.stop(t + dur + 0.8);
      }
    }
  }
  function pluck(f, t) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(g); g.connect(bgmBus); g.connect(delayIn);
    osc.start(t); osc.stop(t + 1);
  }
  function schedule() {
    if (!ctx) return;
    while (nextBeat < ctx.currentTime + 0.6) {
      if (beat % 16 === 0) pad(CHORDS[(beat / 16) % CHORDS.length], nextBeat, 16 * BEAT);
      if (beat % 2 === 1 && rng() < 0.42) pluck(SCALE[Math.floor(rng() * SCALE.length)], nextBeat);
      nextBeat += BEAT;
      beat++;
    }
  }
  function startBgm() {
    if (!ctx || bgmTimer) return;
    nextBeat = ctx.currentTime + 0.1;
    beat = 0;
    schedule();
    bgmTimer = setInterval(schedule, 200);
  }
  function stopBgm() {
    if (bgmTimer) clearInterval(bgmTimer);
    bgmTimer = null;
  }

  function setVolumes(v) {
    Object.assign(vol, v);
    applyVolumes();
    if (ctx && ctx.state === 'running') {
      if (vol.bgmOn) playScene();
      else stopMusic();
    }
  }

  SA.audio = { unlock, setVolumes, setScene, sfx, get volumes() { return Object.assign({}, vol); } };
})();
