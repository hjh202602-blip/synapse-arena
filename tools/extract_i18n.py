"""화면에 나올 수 있는 한국어 문장을 소스에서 모두 뽑는다(번역 사전 만들기·빠진 번역 검사용).

  python tools/extract_i18n.py            → tools/i18n_units.json (번역할 문장 목록)
  python tools/extract_i18n.py --check    → js/lang/*.js 사전에 빠진 문장을 보여 준다

문자열('…', "…")은 통째로 한 문장이다. 템플릿 문자열(`…${x}…`)은 HTML 태그로 나눈 뒤,
태그 없이 이어진 조각마다 ${…} 자리를 {0}, {1}…로 바꾼 "틀"이 된다(런타임에서 정규식으로 맞춘다).
"""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FILES = ['js/sim.js', 'js/content.js', 'js/audio.js', 'js/arena-view.js', 'js/brain-editor.js', 'js/app.js']
HANGUL = re.compile(r'[가-힣]')
REGEX_PREV = set('(,=:[!&|?{};+-*%<>~^')


def scan(src):
    """JS 소스에서 (종류, 내용) 목록을 돌려준다. 종류: 'str' 또는 'tpl'(템플릿: 조각 목록)."""
    out, i, n = [], 0, len(src)
    last = ''  # 공백이 아닌 마지막 토큰 문자(정규식 판별용)
    lastword = ''

    def read_template(i):
        # src[i] == '`' 다음부터. 돌려주는 값: (조각 목록, 끝 위치). 조각은 문자열 또는 None(= ${…} 자리)
        parts, buf = [], []
        i += 1
        while i < n:
            c = src[i]
            if c == '\\':
                buf.append(src[i:i + 2]); i += 2; continue
            if c == '`':
                parts.append(''.join(buf)); return parts, i + 1
            if c == '$' and i + 1 < n and src[i + 1] == '{':
                parts.append(''.join(buf)); buf = []
                parts.append(None)
                i = skip_expr(i + 2)
                continue
            buf.append(c); i += 1
        return parts, i

    def skip_expr(i):
        # ${ 안의 식을 건너뛴다. 안의 문자열·템플릿도 따로 뽑는다.
        depth = 1
        while i < n and depth:
            c = src[i]
            if c in '\'"':
                j, s = read_str(i); out.append(('str', s)); i = j; continue
            if c == '`':
                parts, j = read_template(i); out.append(('tpl', parts)); i = j; continue
            if c == '{': depth += 1
            elif c == '}': depth -= 1
            i += 1
        return i

    def read_str(i):
        q, buf = src[i], []
        i += 1
        while i < n and src[i] != q:
            if src[i] == '\\':
                nx = src[i + 1]
                buf.append({'n': '\n', 't': '\t'}.get(nx, nx)); i += 2; continue
            buf.append(src[i]); i += 1
        return i + 1, ''.join(buf)

    while i < n:
        c = src[i]
        if c == '/' and src[i + 1:i + 2] == '/':
            i = src.find('\n', i); i = n if i < 0 else i; continue
        if c == '/' and src[i + 1:i + 2] == '*':
            i = src.find('*/', i + 2) + 2; continue
        if c in '\'"':
            i, s = read_str(i); out.append(('str', s)); last = 'a'; continue
        if c == '`':
            parts, i = read_template(i); out.append(('tpl', parts)); last = 'a'; continue
        if c == '/' and (last in REGEX_PREV or last == '' or lastword in ('return', 'typeof', 'case')):
            # 정규식 리터럴 건너뛰기
            i += 1; cls = False
            while i < n:
                if src[i] == '\\': i += 2; continue
                if src[i] == '[': cls = True
                elif src[i] == ']': cls = False
                elif src[i] == '/' and not cls: break
                i += 1
            i += 1
            while i < n and src[i].isalpha(): i += 1
            last = 'a'; continue
        if not c.isspace():
            if c.isalnum() or c in '_$':
                j = i
                while j < n and (src[j].isalnum() or src[j] in '_$'): j += 1
                lastword = src[i:j]; last = 'a'; i = j; continue
            last = c; lastword = ''
        i += 1
    return out


TAG = re.compile(r'</?[a-zA-Z!][^<>]*>')


ATTR = re.compile(r'\b(?:title|placeholder|aria-label|alt)="([^"]*)"')


def renum(r):
    """자리표시 번호를 나오는 순서대로 0부터 다시 매긴다."""
    m = {}
    def f(mo):
        o = int(mo.group(1))
        if o not in m: m[o] = len(m)
        return '{%d}' % m[o]
    return re.sub(r'\{(\d+)\}', f, r)


def units_from(kind, val):
    """문자열은 그대로, 템플릿은 ${…} 자리를 {0}, {1}…로 바꾼 한 줄로 만든 뒤
    HTML 태그로 나눈다. 태그 속 title·placeholder·aria-label·alt 값도 따로 뽑는다."""
    if kind == 'str':
        text = val
    else:
        k, buf = 0, []
        for p in val:
            if p is None:
                buf.append('{%d}' % k); k += 1
            else:
                buf.append(p)
        text = ''.join(buf)
    res = []
    for tag in TAG.findall(text):
        for a in ATTR.findall(tag):
            a = a.strip()
            if HANGUL.search(a): res.append(renum(a))
    for seg in TAG.split(text):
        seg = seg.strip()
        if HANGUL.search(seg): res.append(renum(seg))
    return res


def html_units():
    s = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    s = re.sub(r'<script[\s\S]*?</script>', '', s)
    res = []
    for seg in TAG.split(s):
        seg = seg.strip()
        if HANGUL.search(seg): res.append(seg)
    for a in re.findall(r'(?:title|placeholder|aria-label|content)="([^"]*)"', s):
        if HANGUL.search(a): res.append(a.strip())
    return res


def collect():
    seen, order = {}, []
    for f in FILES:
        src = open(os.path.join(ROOT, f), encoding='utf-8').read()
        for kind, val in scan(src):
            for u in units_from(kind, val):
                u = ' '.join(u.split())
                if u not in seen:
                    seen[u] = f; order.append(u)
    for u in html_units():
        u = ' '.join(u.split())
        if u not in seen:
            seen[u] = 'index.html'; order.append(u)
    return [{'ko': u, 'src': seen[u]} for u in order]


if __name__ == '__main__':
    units = collect()
    if '--check' in sys.argv:
        import subprocess
        for lang in ('en', 'ja'):
            p = os.path.join(ROOT, 'js', 'lang', lang + '.js')
            if not os.path.exists(p):
                print(lang, '사전 없음'); continue
            keys = json.loads(subprocess.run(['node', '-e', "globalThis.SA={};require(process.argv[1]);process.stdout.write(JSON.stringify(Object.keys(SA.i18nDict||{})))", p],
                                             capture_output=True, text=True, encoding='utf-8').stdout)
            sys.path.insert(0, os.path.join(ROOT, 'tools'))
            from build_i18n import fnv
            have = set(keys)
            miss = [u['ko'] for u in units if fnv(u['ko']) not in have]
            print(lang, '전체', len(units), '빠짐', len(miss))
            for m in miss[:40]: print('   ', m[:90])
    else:
        json.dump(units, open(os.path.join(ROOT, 'tools', 'i18n_units.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
        by = {}
        for u in units: by[u['src']] = by.get(u['src'], 0) + 1
        print(len(units), by)
