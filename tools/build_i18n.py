"""직접 쓴 번역으로 언어 사전(js/lang/en.js, ja.js)을 만든다.

번역 원본: tools/i18n/<언어>.json  = { "한국어 원문": "번역", ... }  (사람이 읽고 고치는 파일)
새 번역 받기: tools/i18n/<언어>-NN.txt  = "번호<TAB>번역" 줄들. 번호는 tools/i18n_units.json의 순서다.
  python tools/build_i18n.py   → txt를 json에 합치고, js/lang/<언어>.js를 만든다. 빠진 문장 수를 알려 준다.
"""
import glob, json, os, re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
LANGS = ['en', 'ja']
PH = re.compile(r'\{\d+\}')


def fnv(s):
    h = 0x811c9dc5
    b = s.encode('utf-16-le')
    for i in range(0, len(b), 2):
        h ^= b[i] | (b[i + 1] << 8)
        h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h


def main():
    units = json.load(open(os.path.join(ROOT, 'tools', 'i18n_units.json'), encoding='utf-8'))
    kos = [u['ko'] for u in units]
    os.makedirs(os.path.join(ROOT, 'js', 'lang'), exist_ok=True)
    for lang in LANGS:
        jp = os.path.join(ROOT, 'tools', 'i18n', lang + '.json')
        tr = json.load(open(jp, encoding='utf-8')) if os.path.exists(jp) else {}
        for txt in sorted(glob.glob(os.path.join(ROOT, 'tools', 'i18n', lang + '-*.txt'))):
            for line in open(txt, encoding='utf-8'):
                line = line.rstrip('\n')
                if not line.strip() or line.startswith('#'):
                    continue
                m = re.match(r'^(\d{4})[\t|](.*)$', line)
                if not m:
                    print('  읽을 수 없는 줄', txt, line[:60]); continue
                i, text = int(m.group(1)), m.group(2)
                ko = kos[i]
                text = text.replace('\\n', '\n')
                if sorted(PH.findall(ko)) != sorted(PH.findall(text)):
                    print('  자리표시 다름', lang, i, ko[:40], '→', text[:40])
                tr[ko] = text
        json.dump(tr, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=False)
        sp = lambda k: ' '.join(k.split())
        d = {fnv(sp(k)): v for k, v in tr.items()}
        pats = [[fnv(sp(k)), sp(k)] for k in tr if PH.search(k)]
        js = ('/* 자동으로 만든 파일: tools/build_i18n.py. 고치려면 tools/i18n/%s.json을 고친다 */\n'
              'globalThis.SA = globalThis.SA || {};\n'
              'SA.i18nDict = %s;\nSA.i18nPatterns = %s;\n') % (lang, json.dumps(d, ensure_ascii=False, separators=(',', ':')),
                                                              json.dumps(pats, ensure_ascii=False, separators=(',', ':')))
        open(os.path.join(ROOT, 'js', 'lang', lang + '.js'), 'w', encoding='utf-8', newline='\n').write(js)
        have = {' '.join(k.split()) for k in tr}
        miss = [k for k in kos if ' '.join(k.split()) not in have]
        print(lang, '번역', len(tr), '/ 전체', len(kos), '빠짐', len(miss), '틀', len(pats))


if __name__ == '__main__':
    main()
