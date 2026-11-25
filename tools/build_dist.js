// 배포용 사본(dist/)을 만든다: 게임에 필요한 파일만 모으고, JS·CSS는 압축·난독화한다.
// 원본 폴더는 건드리지 않는다. 테스트·도구·LMMS 원본·README는 넣지 않는다.
//
//   node tools/build_dist.js <terser·clean-css가 설치된 node_modules 폴더>
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const MODS = process.argv[2];
if (!MODS) { console.error('사용법: node tools/build_dist.js <node_modules 폴더>'); process.exit(1); }
const { minify } = require(path.join(MODS, 'terser'));
const CleanCSS = require(path.join(MODS, 'clean-css'));

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const a = path.join(src, e.name), b = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT);

  // HTML: 주석만 지운다
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  fs.writeFileSync(path.join(OUT, 'index.html'), html);

  // CSS
  const css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
  const cssOut = new CleanCSS({ level: 1 }).minify(css);
  if (cssOut.errors.length) throw new Error(cssOut.errors.join('\n'));
  fs.mkdirSync(path.join(OUT, 'css'));
  fs.writeFileSync(path.join(OUT, 'css', 'style.css'), cssOut.styles);

  // JS: 지역 이름을 짧게 바꾸고(mangle) 주석·공백을 지운다. 파일끼리 주고받는 SA.* 속성 이름은 그대로 둔다.
  let before = 0, after = 0;
  for (const dir of ['js', path.join('js', 'lang')]) {
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((x) => x.endsWith('.js'))) {
      const src = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
      const res = await minify(src, { compress: { passes: 2 }, mangle: true, format: { comments: false, ascii_only: false } });
      fs.writeFileSync(path.join(OUT, dir, f), res.code);
      before += Buffer.byteLength(src); after += Buffer.byteLength(res.code);
    }
  }

  // 소리 파일
  copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));

  // 보안 헤더: 이 사이트의 파일만 실행하고(CSP), 다른 사이트 안에 끼워 넣지 못하게 한다.
  // index.html 안에 직접 적은 스크립트(테마 깜빡임 막기)는 내용의 해시로 허락한다.
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
  const csp = [
    "default-src 'self'", `script-src 'self' ${inline.join(' ')}`.trim(), "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:", "media-src 'self' blob:", "connect-src 'self'", "font-src 'self'",
    "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
  ].join('; ');
  // 캐시 설정: HTML은 늘 새로 받고, ?v=로 버전을 붙인 파일은 오래 둔다(Cloudflare Pages의 _headers)
  fs.writeFileSync(path.join(OUT, '_headers'), [
    '/*', `  Content-Security-Policy: ${csp}`, '  X-Content-Type-Options: nosniff', '  X-Frame-Options: DENY',
    '  Referrer-Policy: strict-origin-when-cross-origin', '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    '  Cross-Origin-Opener-Policy: same-origin',
    '/', '  Cache-Control: no-cache', '/index.html', '  Cache-Control: no-cache',
    '/js/*', '  Cache-Control: public, max-age=86400', '/css/*', '  Cache-Control: public, max-age=86400',
    '/assets/*', '  Cache-Control: public, max-age=604800', '',
  ].join('\n'));

  console.log(`JS ${Math.round(before / 1024)}KB → ${Math.round(after / 1024)}KB, CSS ${Math.round(css.length / 1024)}KB → ${Math.round(cssOut.styles.length / 1024)}KB`);
})().catch((e) => { console.error(e); process.exit(1); });
