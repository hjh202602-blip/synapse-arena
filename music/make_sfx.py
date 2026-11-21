"""시냅스 아레나 효과음을 LMMS 프로젝트 하나(sfx.mmp)로 쓰고, 설치된 LMMS로 렌더링한다.

  python make_sfx.py   → music/sfx.mmp + assets/sfx/sfx.ogg, sfx.mp3

효과음 11개를 1초짜리 칸에 차례로 놓은 "효과음 묶음(스프라이트)" 한 파일이다.
240 BPM이라 한 마디 = 1초, 한 틱 ≈ 5.2ms. 효과음 하나는 3마디(3초) 칸을 쓴다.
사이트(js/audio.js)는 SLOTS 순서대로 3초씩 잘라 앞뒤 조용한 부분을 다듬어 쓴다.
"""
import os, subprocess
from lmms_gen import TPB, BAR, key, env, osc, reverb, song_xml

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'sfx')
LMMS = r'C:\Program Files\LMMS\lmms.exe'
BPM = 240
MS = BPM * TPB / 60000  # 1ms = 몇 틱
SLOT = 3 * BAR          # 효과음 한 칸 = 3초(잔향이 다음 칸에 번지지 않게)

# 이 순서가 곧 파일 안의 칸 순서다(js/audio.js의 SFX_SLOTS와 같아야 한다)
SLOTS = ['click', 'connect', 'remove', 'run', 'eat', 'charged', 'hit', 'success', 'fail', 'discover', 'spike']


def t(ms):
    return int(round(ms * MS))


# ---- 악기 -------------------------------------------------------------------
def inst(name, vol, o, e, filt=None, fx=None):
    d = dict(name=name, kind='osc', vol=vol, osc=o, env=e)
    if filt:
        d['filter'] = filt
    if fx:
        d['fx'] = fx
    return d


TICK = inst('딸깍', 60, osc(vol0=80, wavetype0=3, vol1=40, wavetype1=0, coarse1=12), env(dec=0.09, level=0, rel=0.02), (0, 5000, 0.5))
CHIME = inst('딩동', 70, osc(vol0=80, wavetype0=1, vol1=30, wavetype1=0, coarse1=12), env(dec=0.16, level=0, rel=0.05))
GLASS = inst('유리 종', 65, osc(vol0=70, wavetype0=0, vol1=30, wavetype1=0, coarse1=12, vol2=15, wavetype2=1, coarse2=19),
             env(dec=0.45, level=0, rel=0.3), fx=[reverb(0.25, 0.4)])
BRIGHT = inst('밝은 종', 70, osc(vol0=70, wavetype0=1, vol1=35, wavetype1=0, coarse1=12, vol2=12, wavetype2=3, coarse2=24),
              env(dec=0.5, level=0, rel=0.25), (0, 6000, 0.5), [reverb(0.22, 0.4)])
SOFT = inst('부드러운 종', 70, osc(vol0=80, wavetype0=1, vol1=25, wavetype1=0, coarse1=-12),
            env(dec=0.45, level=0, rel=0.2), (0, 2500, 0.5))
NOISE = inst('잡음', 80, osc(vol0=100, wavetype0=6), env(dec=0.22, level=0, rel=0.05), (0, 900, 0.5))
BUZZ = inst('지지직', 55, osc(vol0=70, wavetype0=2, vol1=50, wavetype1=3, coarse1=-12), env(dec=0.3, level=0, rel=0.08), (0, 1200, 0.6))
PING = inst('톡', 60, osc(vol0=100, wavetype0=0), env(att=0.001, dec=0.08, level=0, rel=0.02))


def notes(start, seq, step_ms, dur_ms, vel=100):
    """음 이름 목록을 step_ms 간격으로 차례로 놓는다."""
    out = []
    for i, n in enumerate(seq.split()):
        out.append((start + t(i * step_ms), max(1, t(dur_ms)), key(n), vel))
    return out


def build():
    tr = {}  # 악기 이름 → (악기, 음 목록)
    def put(instr, ns):
        tr.setdefault(instr['name'], (instr, []))[1].extend(ns)
    for i, name in enumerate(SLOTS):
        s = i * SLOT
        if name == 'click':      put(TICK, notes(s, 'D6', 0, 45))                       # 짧은 딸깍
        elif name == 'connect':  put(CHIME, notes(s, 'C5 G5', 60, 110))                 # 선이 이어짐: 위로 5도
        elif name == 'remove':   put(CHIME, notes(s, 'A4 E4 A3', 35, 70, 85))           # 선이 끊김: 아래로 떨어짐
        elif name == 'run':      put(CHIME, notes(s, 'E4 B4', 70, 130))                 # 실행
        elif name == 'eat':      put(GLASS, notes(s, 'E5 B5', 70, 160))                 # 먹이: 반짝
        elif name == 'charged':  put(GLASS, notes(s, 'C5 E5 G5 C6', 60, 300, 80))       # 충전 완료
        elif name == 'hit':                                                             # 찔림: 잡음 + 낮게 떨어지는 소리
            put(NOISE, notes(s, 'A4', 0, 230))
            put(BUZZ, notes(s, 'F3 C3 F2', 70, 120, 90))
        elif name == 'success':  put(BRIGHT, notes(s, 'C5 E5 G5 C6 E6', 90, 420, 85))   # 성공: 올라가는 장조
        elif name == 'fail':     put(SOFT, notes(s, 'G4 E4 C4', 140, 380, 90))          # 실패: 내려가는 세 음
        elif name == 'discover': put(GLASS, notes(s, 'G5 B5 D6 G6', 110, 550, 80))      # 새 개념 발견
        elif name == 'spike':    put(PING, notes(s, 'A5', 0, 30))                       # 뉴런 발화 '틱'(사이트에서 음 높이를 바꿔 씀)
    bars = len(SLOTS) * 3
    return song_xml('시냅스 아레나 효과음', BPM, bars, list(tr.values()), vol=70)


def main():
    os.makedirs(OUT, exist_ok=True)
    mmp = os.path.join(HERE, 'sfx.mmp')
    with open(mmp, 'w', encoding='utf-8', newline='\n') as f:
        f.write(build())
    for fmt, br in (('ogg', '96'), ('mp3', '112')):
        subprocess.run([LMMS, 'render', mmp, '-f', fmt, '-b', br, '-o', os.path.join(OUT, 'sfx.' + fmt)], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print('효과음', len(SLOTS), '개')


if __name__ == '__main__':
    main()
