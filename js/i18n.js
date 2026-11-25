/* 시냅스 아레나 — 언어
 * 사용자가 있는 곳(시간대)과 브라우저 언어로 언어를 고르고, 화면에 나오는 한국어 문장을
 * 직접 써 둔 번역(js/lang/en.js, ja.js)으로 바꾼다. 기계 번역은 쓰지 않는다.
 * 고르는 순서: ① 사용자가 직접 고른 언어 ② 시간대가 한국·일본이면 그 나라 말 ③ 브라우저 언어(한국어·일본어·영어) ④ 영어
 * 원문은 한국어다. 사전은 tools/build_i18n.py가 tools/i18n/*.txt(직접 쓴 번역)에서 만든다.
 */
(function () {
  'use strict';
  const SA = (globalThis.SA = globalThis.SA || {});
  // 사전 파일도 이 스크립트와 같은 캐시 버전(?v=)으로 불러온다
  const ASSET_V = (typeof document !== 'undefined' && document.currentScript && (/[?&]v=(\w+)/.exec(document.currentScript.src) || [])[1]) || '1';
  const LANGS = { ko: '한국어', en: 'English', ja: '日本語' };
  const KEY = 'synapse-arena:lang';
  const ZONE_LANG = { 'Asia/Seoul': 'ko', 'Asia/Pyongyang': 'ko', 'Asia/Tokyo': 'ja' };

  function detect() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* 저장소를 못 쓰면 자동으로 고른다 */ }
    if (saved && LANGS[saved]) return { lang: saved, why: 'saved' };
    let zone = '';
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* 시간대를 모르면 건너뛴다 */ }
    if (ZONE_LANG[zone]) return { lang: ZONE_LANG[zone], why: 'zone', zone };
    const langs = (globalThis.navigator && (navigator.languages || [navigator.language])) || [];
    for (const l of langs) {
      const k = String(l || '').toLowerCase().slice(0, 2);
      if (LANGS[k]) return { lang: k, why: 'browser', zone };
    }
    return { lang: 'en', why: 'default', zone };
  }

  // 사전 키: 문장의 FNV-1a 32비트 해시(tools/build_i18n.py와 같은 계산)
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }

  const HANGUL = /[가-힣]/;
  const found = typeof document !== 'undefined' ? detect() : { lang: 'ko', why: 'node' };
  const lang = found.lang;
  const cache = new Map();
  const missing = new Set();
  let patterns = null;

  // 틀 문장({0}, {1}… 자리가 있는 문장)을 정규식으로 바꿔 둔다
  function buildPatterns() {
    patterns = (SA.i18nPatterns || []).map(([h, ko]) => {
      const parts = ko.split(/\{(\d+)\}/);
      let src = '^', order = [];
      parts.forEach((p, i) => {
        // 자리에는 빈 값도 들어올 수 있다(예: "깬 실험{0}"에서 {0}이 비는 경우)
        if (i % 2) { src += '([\\s\\S]*?)'; order.push(+p); return; }
        let lit = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 자리 바로 옆의 띄어쓰기는 자리가 비면 화면에서 사라지므로 없어도 맞게 한다
        if (i + 1 < parts.length) lit = lit.replace(/ $/, ' ?');
        if (i > 0) lit = lit.replace(/^ /, ' ?');
        src += lit;
      });
      return { h, re: new RegExp(src + '$'), order, fixed: ko.replace(/\{\d+\}/g, '').length };
    }).sort((a, b) => b.fixed - a.fixed);
  }

  function exact(t) {
    const hit = (SA.i18nDict || {})[hash(t)];
    return hit == null ? null : hit;
  }
  // 앞뒤에 붙은 기호(★ · # ▶ 등)를 떼어 낸다
  const WRAP = /^([\s★☆▶◀·•#:\-–—]*)([\s\S]*?)([\s·•:]*)$/;
  // 사전에서 찾는 순서: 문장 그대로 → 앞뒤 기호를 뗀 문장 → 틀 문장 → " · "로 이은 조각마다 → 문장마다 → 낱말 묶음마다
  function translateCore(t, depth) {
    depth = depth || 0;
    let r = exact(t);
    if (r != null) return r;
    const w = WRAP.exec(t);
    if (w && (w[1] || w[3]) && w[2] && HANGUL.test(w[2])) {
      const inner = translateCore(w[2], depth + 1);
      if (inner != null) return w[1] + inner + w[3];
    }
    r = byPattern(t);
    if (r != null) return r;
    if (depth < 4 && t.includes(' · ')) {
      const parts = t.split(' · ').map((p) => {
        if (!HANGUL.test(p)) return p;
        const a = translateCore(p, depth + 1);
        if (a != null) return a;
        const b = translateCore('· ' + p, depth + 1);
        return b == null ? null : b.replace(/^·\s*/, '');
      });
      if (parts.every((p) => p != null)) return parts.join(' · ');
    }
    if (depth < 4) {
      // 코드에서 이어 붙인 여러 문장: 앞에서부터 사전에 있는 문장을 찾아 나머지를 이어서 바꾼다
      for (let i = t.indexOf('. '); i > 0; i = t.indexOf('. ', i + 1)) {
        const a = exact(t.slice(0, i + 1)) || byPattern(t.slice(0, i + 1));
        if (a == null) continue;
        const b = translateCore(t.slice(i + 2), depth + 1);
        if (b != null) return a + ' ' + b;
      }
    }
    // 마지막으로 한국어 낱말 묶음을 하나씩: 모두 찾았을 때만 쓴다(반쪽 번역을 막는다)
    let all = true;
    const out = t.replace(/[가-힣][가-힣 ]*[가-힣]|[가-힣]/g, (x) => {
      const hit = exact(x);
      if (hit == null) all = false;
      return hit == null ? x : hit;
    });
    return all ? out : null;
  }
  function byPattern(t) {
    const dict = SA.i18nDict || {};
    if (!patterns) buildPatterns();
    for (const p of patterns) {
      const m = p.re.exec(t);
      if (!m) continue;
      const tpl = dict[p.h];
      if (tpl == null) continue;
      const vals = [];
      p.order.forEach((k, i) => { vals[k] = m[i + 1]; });
      return tpl.replace(/\{(\d+)\}/g, (_, k) => { const v = vals[+k]; return v == null ? '' : HANGUL.test(v) ? T(v) : v; });
    }
    return null;
  }

  // 한국어 문장 하나를 지금 언어로. 사전에 없으면 원문을 그대로 돌려준다.
  function T(s) {
    if (lang === 'ko' || s == null) return s;
    s = String(s);
    if (!HANGUL.test(s)) return s;
    if (cache.has(s)) return cache.get(s);
    const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0];
    // 공백(줄바꿈·들여쓰기)은 한 칸으로 모아서 찾는다(사전도 같은 방식으로 만든다)
    const core = s.trim().replace(/\s+/g, ' ');
    let out = translateCore(core);
    if (out == null) { missing.add(core); out = core; }
    const res = lead + out + tail;
    if (cache.size > 6000) cache.clear();
    cache.set(s, res);
    return res;
  }

  // ---- 화면 글자 바꾸기: 새로 그려지는 글(텍스트 노드·title·placeholder·aria-label)을 지켜보며 바꾼다 ----
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };
  function fixText(node) {
    const v = node.nodeValue;
    if (!v || !HANGUL.test(v)) return;
    const p = node.parentNode;
    if (p && (SKIP[p.nodeName] || (p.closest && p.closest('[data-no-i18n]')))) return;
    const t = T(v);
    if (t !== v) node.nodeValue = t;
  }
  function fixEl(el) {
    if (SKIP[el.nodeName] || el.closest('[data-no-i18n]')) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && HANGUL.test(v)) { const t = T(v); if (t !== v) el.setAttribute(a, t); }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (SKIP[root.nodeName] || root.hasAttribute('data-no-i18n')) return; fixEl(root); }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) fixText(n); else fixEl(n); }
  }
  function start() {
    if (lang === 'ko') return;
    walk(document.body);
    if (document.title && HANGUL.test(document.title)) document.title = T(document.title);
    const mo = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixEl(m.target);
        else m.addedNodes.forEach(walk);
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // ---- 캔버스 글자: fillText·strokeText·measureText에 들어가는 한국어를 바꾼다 ----
  if (lang !== 'ko' && typeof CanvasRenderingContext2D !== 'undefined') {
    const P = CanvasRenderingContext2D.prototype;
    for (const f of ['fillText', 'strokeText', 'measureText']) {
      const orig = P[f];
      P[f] = function (text, ...rest) { return orig.call(this, typeof text === 'string' && HANGUL.test(text) ? T(text) : text, ...rest); };
    }
  }

  function setLang(l) {
    if (!LANGS[l]) return;
    try { localStorage.setItem(KEY, l); } catch (e) { /* 저장 못 하면 이번만 바뀐다 */ }
    location.reload();
  }
  function auto() {
    try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
    location.reload();
  }

  SA.i18n = { lang, why: found.why, zone: found.zone, LANGS, T, hash, setLang, auto, missing, start };

  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    if (lang !== 'ko') {
      // 고른 언어의 사전을 다른 스크립트보다 먼저 불러온다(문서를 읽는 중이라 순서대로 실행된다)
      document.write('<script src="js/lang/' + lang + '.js?v=' + ASSET_V + '"><\/script>');
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})();
