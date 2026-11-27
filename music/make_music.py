"""시냅스 아레나 배경음 세 곡을 LMMS 프로젝트로 쓰고, 설치된 LMMS로 렌더링한다.

  python make_music.py            → music/*.mmp 만들기 + assets/music/*.ogg, *.mp3 렌더링

곡마다 16마디 한 바퀴로 끝이 처음으로 자연스럽게 이어진다. 렌더링은 끝에 한 마디 여유(잔향)가 붙는다.
사이트(js/audio.js)는 그 잔향을 곡 앞부분에 겹쳐 넣어 끊김 없이 되풀이한다.
  lab   연구실의 아침   84 BPM  홈·개념 노트
  think 생각하는 시간   96 BPM  실험(퍼즐·학습)
  arena 아레나          124 BPM 생명체 실험·대결·보스 실험
"""
import os, re, shutil, subprocess, sys
from lmms_gen import TPB, BAR, key, env, osc, reverb, song_xml
import make_drums

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'music')
LMMS = r'C:\Program Files\LMMS\lmms.exe'
BARS = 16
# 드럼은 LMMS 기본 샘플(출처·라이선스 불명) 대신 make_drums.py로 직접 합성한 소리를 쓴다.
# LMMS 1.2는 상대 경로 샘플을 "사용자 샘플 폴더"에서 찾으므로, 렌더링 전에 그곳의 synapse-arena/ 아래로 복사한다.
# (.mmp에는 synapse-arena/kick.wav 같은 상대 경로만 적어서, 내 컴퓨터 경로가 저장소에 들어가지 않게 한다.)
DRUM_DIR = 'synapse-arena'


def user_samples_dir():
    rc = os.path.join(os.path.expanduser('~'), '.lmmsrc.xml')
    work = os.path.join(os.path.expanduser('~'), 'Documents', 'lmms')
    if os.path.exists(rc):
        m = re.search(r'workingdir="([^"]+)"', open(rc, encoding='utf-8', errors='ignore').read())
        if m: work = m.group(1)
    return os.path.join(work, 'samples')


def install_drums():
    src = make_drums.main()
    dst = os.path.join(user_samples_dir(), DRUM_DIR)
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(src):
        if f.endswith('.wav'): shutil.copyfile(os.path.join(src, f), os.path.join(dst, f))


def K(names):
    return [key(n) for n in names.split()]


def at(bar, beat=0.0):
    return int(bar * BAR + beat * TPB)


def line(notes, bar0=0):
    """[(박 위치, 길이(박), '음' 또는 None)] → 음 목록. 박 위치는 bar0부터 센다."""
    out = []
    for b, d, n, *v in notes:
        if n:
            for k in (n.split('+')):
                out.append((at(bar0, b), int(d * TPB), key(k), v[0] if v else 100))
    return out


def drum(pattern, bars, vel=100, start=0, swing=0):
    """16칸 문자열(x = 세게, o = 약하게, . = 쉼)을 bars 마디에 되풀이."""
    out = []
    for bar in range(start, bars):
        for i, c in enumerate(pattern):
            if c == '.':
                continue
            off = swing if i % 2 == 1 else 0
            out.append((bar * BAR + i * 12 + off, 12, 57, vel if c == 'x' else int(vel * 0.55)))
    return out


# ---- 악기 -------------------------------------------------------------------
def pad(name, vol, cut=900):
    return dict(name=name, kind='osc', vol=vol, filter=(0, cut, 0.6),
                osc=osc(vol0=60, wavetype0=2, finel0=-8, finer0=8, vol1=60, wavetype1=2, finel1=8, finer1=-8,
                        vol2=50, wavetype2=1, coarse2=-12),
                env=env(att=0.9, dec=0.8, level=0.8, rel=1.4), fx=[reverb(0.35, 0.75)])


def bell(name, vol):
    return dict(name=name, kind='osc', vol=vol,
                osc=osc(vol0=70, wavetype0=0, vol1=30, wavetype1=0, coarse1=12, vol2=12, wavetype2=1, coarse2=24),
                env=env(att=0.0, dec=0.55, level=0.0, rel=0.4), fx=[reverb(0.35, 0.7)])


def soft_bass(name, vol):
    return dict(name=name, kind='osc', vol=vol, filter=(0, 500, 0.5),
                osc=osc(vol0=80, wavetype0=1, vol1=40, wavetype1=0, coarse1=-12),
                env=env(att=0.02, dec=0.6, level=0.6, rel=0.25))


def flute(name, vol):
    return dict(name=name, kind='osc', vol=vol, filter=(0, 2600, 0.5),
                osc=osc(vol0=70, wavetype0=1, vol1=25, wavetype1=0, coarse1=12, finel1=4, finer1=4),
                env=env(att=0.08, dec=0.5, level=0.75, rel=0.35), fx=[reverb(0.4, 0.75)])


def epiano(name, vol):
    return dict(name=name, kind='osc', vol=vol, filter=(0, 3000, 0.5),
                osc=osc(vol0=70, wavetype0=1, vol1=35, wavetype1=0, coarse1=12, vol2=10, wavetype2=0, coarse2=19),
                env=env(att=0.0, dec=0.9, level=0.25, rel=0.3), fx=[reverb(0.3, 0.6)])


def pluck_bass(name, vol, cut=650):
    return dict(name=name, kind='osc', vol=vol, filter=(0, cut, 0.7),
                osc=osc(vol0=70, wavetype0=2, vol1=60, wavetype1=3, coarse1=-12),
                env=env(att=0.0, dec=0.35, level=0.45, rel=0.12))


def pluck(name, vol):
    return dict(name=name, kind='osc', vol=vol, filter=(0, 3500, 0.6),
                osc=osc(vol0=60, wavetype0=3, vol1=50, wavetype1=1, coarse1=12, finel1=6, finer1=6),
                env=env(att=0.0, dec=0.3, level=0.0, rel=0.25), fx=[reverb(0.3, 0.6)])


def lead(name, vol):
    return dict(name=name, kind='osc', vol=vol, filter=(0, 4200, 0.6),
                osc=osc(vol0=55, wavetype0=2, finel0=-10, finer0=10, vol1=55, wavetype1=2, finel1=10, finer1=-10,
                        vol2=35, wavetype2=3, coarse2=-12),
                env=env(att=0.02, dec=0.4, level=0.7, rel=0.2), fx=[reverb(0.25, 0.55)])


def sample(name, src, vol):
    return dict(name=name, kind='sample', src=DRUM_DIR + '/' + src, vol=vol)


# ---- 1. 연구실의 아침 (C장조, 84 BPM) ----------------------------------------
def song_lab():
    chords = [('F3 A3 C4 E4', 'F2'), ('G3 B3 D4 E4', 'G2'), ('E3 G3 B3 D4', 'E2'), ('A3 C4 E4 G4', 'A2'),
              ('D3 F3 A3 C4', 'D2'), ('G3 C4 D4 F4', 'G2'), ('C3 E3 G3 B3', 'C2'), ('A3 C4 E4 G4', 'A2')]
    padn, bass, arp = [], [], []
    for i, (ch, root) in enumerate(chords):
        b0 = i * 2
        ks = K(ch)
        for k in ks:
            padn.append((at(b0), 2 * BAR - 12, k, 70))
        r = key(root)
        bass += [(at(b0), 3 * TPB, r, 95), (at(b0, 3), TPB, r + 7, 70), (at(b0 + 1), 2 * TPB, r + 12, 80), (at(b0 + 1, 2), 2 * TPB, r + 7, 75)]
        # 반짝이는 펼침화음: 화음 음을 한 옥타브 위에서 8분음표로, 군데군데 쉰다
        order = [0, 2, 1, 3, 2, 0, 3, 1, 0, 2, 3, 2, 1, None, 3, None]
        for j, o in enumerate(order):
            if o is None:
                continue
            arp.append((at(b0, j * 0.5), TPB, ks[o] + 12, 78 if j % 4 == 0 else 58))
    # 9~16마디에만 나오는 가락(피리)
    mel = line([
        (0, 1.5, 'A5'), (1.5, 0.5, 'G5'), (2, 2, 'E5'), (4, 1, 'D5'), (5, 1, 'E5'), (6, 2, 'G5'),
        (8, 1.5, 'E5'), (9.5, 0.5, 'D5'), (10, 2, 'B4'), (12, 1, 'C5'), (13, 1, 'D5'), (14, 2, 'E5'),
        (16, 1.5, 'F5'), (17.5, 0.5, 'E5'), (18, 2, 'D5'), (20, 1, 'C5'), (21, 1, 'D5'), (22, 2, 'G5'),
        (24, 3, 'E5'), (27, 1, 'D5'), (28, 2, 'C5'), (30, 2, None),
    ], bar0=8)
    shaker = drum('..o...o...o...o.', BARS, vel=70, start=4)
    return dict(title='연구실의 아침', bpm=84, vol=62, tracks=[
        (pad('패드', 34), padn), (soft_bass('베이스', 46), bass), (bell('종소리 펼침화음', 30), arp),
        (flute('피리 가락', 34), mel), (sample('셰이커', 'shaker.wav', 30), shaker)])


# ---- 2. 생각하는 시간 (D단조, 96 BPM) ----------------------------------------
def song_think():
    chords = [('D3 F3 A3 C4 E4', 'D2'), ('Bb2 D3 F3 A3', 'Bb1'), ('G2 Bb2 D3 F3', 'G1'), ('A2 D3 E3 G3', 'A1'),
              ('D3 F3 A3 C4', 'D2'), ('Bb2 D3 F3 A3', 'Bb1'), ('G2 Bb2 D3 F3', 'G1'), ('A2 C#3 E3 G3', 'A1')]
    ep, bass = [], []
    for i, (ch, root) in enumerate(chords):
        for half in range(2):
            b0 = i * 2 + half
            ks = K(ch)
            for k in ks:
                ep.append((at(b0), int(1.5 * TPB), k + 12, 72))
                ep.append((at(b0, 1.5), int(1.0 * TPB), k + 12, 52))
                if half == 1:
                    ep.append((at(b0, 3), int(0.75 * TPB), k + 12, 45))
            r = key(root)
            bass += [(at(b0), int(0.75 * TPB), r, 100), (at(b0, 1.5), int(0.5 * TPB), r + 12, 70),
                     (at(b0, 2.5), int(0.5 * TPB), r, 80), (at(b0, 3), int(0.5 * TPB), r + 7, 75)]
    # 생각이 떠오르는 듯한 짧은 가락: D 단조 5음계, 5마디부터
    mel = line([
        (0, 0.5, 'A4'), (0.5, 0.5, 'C5'), (1, 1, 'D5'), (2.5, 0.5, 'F5'), (3, 1, 'E5'),
        (4, 0.5, 'D5'), (4.5, 0.5, 'C5'), (5, 1.5, 'A4'), (7, 1, None),
        (8, 0.5, 'G4'), (8.5, 0.5, 'A4'), (9, 1, 'C5'), (10.5, 0.5, 'D5'), (11, 1, 'C5'),
        (12, 0.5, 'A4'), (12.5, 0.5, 'G4'), (13, 2, 'A4'), (15, 1, None),
        (16, 0.5, 'A4'), (16.5, 0.5, 'C5'), (17, 1, 'D5'), (18.5, 0.5, 'F5'), (19, 1, 'G5'),
        (20, 0.5, 'F5'), (20.5, 0.5, 'E5'), (21, 1.5, 'D5'), (23, 1, None),
        (24, 0.5, 'C5'), (24.5, 0.5, 'D5'), (25, 1, 'E5'), (26, 1, 'A4'), (27, 1, 'C#5'),
        (28, 3, 'D5'), (31, 1, None),
        (32, 0.5, 'D5'), (32.5, 0.5, 'F5'), (33, 1, 'A5'), (34.5, 0.5, 'G5'), (35, 1, 'F5'),
        (36, 0.5, 'E5'), (36.5, 0.5, 'D5'), (37, 1.5, 'C5'), (39, 1, None),
        (40, 0.5, 'Bb4'), (40.5, 0.5, 'C5'), (41, 1, 'D5'), (42.5, 0.5, 'F5'), (43, 1, 'E5'),
        (44, 1, 'D5'), (45, 1, 'C#5'), (46, 2, 'A4'),
    ], bar0=4)
    kick = drum('x.......x.o.....', BARS, vel=90)
    rim = drum('....x.......x...', BARS, vel=70)
    hat = drum('xoxoxoxoxoxoxoxo', BARS, vel=45, swing=3)
    return dict(title='생각하는 시간', bpm=96, vol=58, tracks=[
        (epiano('전자 피아노', 40), ep), (pluck_bass('베이스', 48), bass), (pluck('가락', 34), mel),
        (sample('킥', 'kick_soft.wav', 70), kick), (sample('림', 'rim.wav', 42), rim),
        (sample('하이햇', 'hat_closed.wav', 30), hat)])


# ---- 3. 아레나 (E단조, 124 BPM) ---------------------------------------------
def song_arena():
    chords = [('E3 G3 B3', 'E1'), ('C3 E3 G3', 'C2'), ('D3 F#3 A3', 'D2'), ('B2 D3 F#3', 'B1'),
              ('E3 G3 B3', 'E1'), ('C3 E3 G3', 'C2'), ('A2 C3 E3', 'A1'), ('B2 D#3 F#3', 'B1')]
    padn, bass, arp = [], [], []
    for i, (ch, root) in enumerate(chords):
        b0 = i * 2
        ks = K(ch)
        for k in ks:
            padn.append((at(b0), 2 * BAR - 6, k + 12, 60))
        r = key(root)
        for bar in (b0, b0 + 1):
            for j in range(8):
                k = r + (12 if j in (3, 6) else 0)
                bass.append((at(bar, j * 0.5), int(0.4 * TPB), k, 100 if j % 2 == 0 else 78))
            if bar >= 4:  # 5마디부터 16분음표 펼침화음
                seq = [0, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1, 0, 1]
                for j, o in enumerate(seq):
                    arp.append((at(bar, j * 0.25), int(0.2 * TPB), ks[o] + 24, 70 if j % 4 == 0 else 48))
    mel = line([
        (0, 1, 'B4'), (1, 0.5, 'E5'), (1.5, 0.5, 'F#5'), (2, 1.5, 'G5'), (3.5, 0.5, 'F#5'), (4, 1, 'E5'), (5, 1, 'D5'), (6, 2, 'E5'),
        (8, 1, 'G5'), (9, 0.5, 'F#5'), (9.5, 0.5, 'E5'), (10, 1.5, 'D5'), (11.5, 0.5, 'C5'), (12, 1, 'D5'), (13, 1, 'E5'), (14, 2, 'A4'),
        (16, 1, 'B4'), (17, 0.5, 'E5'), (17.5, 0.5, 'F#5'), (18, 1.5, 'G5'), (19.5, 0.5, 'A5'), (20, 1, 'B5'), (21, 1, 'A5'), (22, 2, 'G5'),
        (24, 1, 'E5'), (25, 1, 'G5'), (26, 1, 'F#5'), (27, 1, 'E5'), (28, 2, 'D#5'), (30, 2, 'F#5'),
    ], bar0=8)
    kick = drum('x...x...x...x...', BARS, vel=100)
    snare = drum('....x.......x...', BARS, vel=85)
    hat = drum('.x.x.x.x.x.x.x.x', BARS, vel=55)
    ohat = drum('..............x.', BARS, vel=50)
    crash = [(at(0), 96, 57, 70), (at(8), 96, 57, 80)]
    fill = [(at(15, 3 + j * 0.25), 12, 57, 50 + j * 12) for j in range(4)]
    return dict(title='아레나', bpm=124, vol=46, tracks=[
        (pad('패드', 22, cut=1400), padn), (pluck_bass('베이스', 52, cut=900), bass), (pluck('펼침화음', 26), arp),
        (lead('가락', 34), mel), (sample('킥', 'kick.wav', 78), kick), (sample('스네어', 'snare.wav', 52), snare + fill),
        (sample('하이햇', 'hat_closed2.wav', 34), hat), (sample('열린 하이햇', 'hat_open.wav', 26), ohat),
        (sample('심벌', 'crash.wav', 30), crash)])


SONGS = {'lab': song_lab, 'think': song_think, 'arena': song_arena}


def main(names):
    os.makedirs(OUT, exist_ok=True)
    install_drums()
    for name in names:
        s = SONGS[name]()
        mmp = os.path.join(HERE, name + '.mmp')
        with open(mmp, 'w', encoding='utf-8', newline='\n') as f:
            f.write(song_xml(s['title'], s['bpm'], BARS, s['tracks'], vol=s['vol']))
        for fmt, br in (('ogg', '112'), ('mp3', '128')):
            dst = os.path.join(OUT, '%s.%s' % (name, fmt))
            subprocess.run([LMMS, 'render', mmp, '-f', fmt, '-b', br, '-o', dst], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(name, s['bpm'], 'BPM', round(BARS * 4 * 60 / s['bpm'], 2), '초 한 바퀴')


if __name__ == '__main__':
    main(sys.argv[1:] or list(SONGS))
