"""LMMS 1.2 프로젝트(.mmp)를 만드는 작은 도구.

곡은 make_music.py에 악보(음, 박자)로 적고, 이 모듈이 LMMS 프로젝트 XML로 바꾼다.
만든 .mmp는 LMMS로 그대로 열어 고칠 수 있고, lmms.exe render로 소리 파일이 된다.
한 마디 = 192틱(한 박 = 48틱). 음 번호는 LMMS 기준(57 = A4 = 440Hz, 48 = C4).
"""
from xml.sax.saxutils import quoteattr

TPB = 48           # 한 박의 틱
BAR = TPB * 4      # 한 마디의 틱

NOTE = {'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5, 'F#': 6, 'Gb': 6,
        'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11}


def key(name):
    """'A4' → 57, 'C4' → 48 (LMMS 음 번호)."""
    n, o = name[:-1], int(name[-1])
    return NOTE[n] + 12 * o


def attrs(d):
    return ' '.join('%s=%s' % (k, quoteattr(str(v))) for k, v in d.items())


def env(att=0.0, hold=0.0, dec=0.5, level=1.0, rel=0.1, amt=1):
    """소리 크기 엔벨로프. level = 감쇠 뒤 남는 크기(0~1).
    LMMS의 sustain 값은 거꾸로라서(0이면 그대로 유지, 1이면 0까지 줄어듦) 1 - level을 적는다(렌더링으로 확인함)."""
    sus = round(1 - level, 3)
    d = dict(pdel=0, att=att, hold=hold, dec=dec, sustain=sus, sus=sus, rel=rel, amt=amt,
             lpdel=0, latt=0, lspd=0.1, lshp=0, lamt=0, x100=0, ctlenvamt=0, userwavefile='',
             syncmode=0, lspd_numerator=4, lspd_denominator=4)
    return d


def osc(**o):
    """TripleOscillator 설정. wavetype: 0 사인, 1 삼각, 2 톱니, 3 사각, 4 무그 톱니, 5 지수, 6 잡음."""
    d = {}
    for i in range(3):
        d.update({'vol%d' % i: 0, 'pan%d' % i: 0, 'coarse%d' % i: 0, 'finel%d' % i: 0, 'finer%d' % i: 0,
                  'phoffset%d' % i: 0, 'stphdetun%d' % i: 0, 'wavetype%d' % i: 0, 'userwavefile%d' % i: ''})
    d.update(modalgo1=2, modalgo2=2, modalgo3=2)
    d.update(o)
    return d


def reverb(blend=0.25, tail=0.5, damp=0.25):
    """caps Plate2x2 판 리버브(LMMS 데모 곡과 같은 형식)."""
    return ('<effect autoquit="1" gate="0" autoquit_numerator="4" autoquit_denominator="4" wet="1" '
            'name="ladspaeffect" on="1" syncmode="0"><ladspacontrols ports="4">'
            '<port02 data="0.5"/><port03 data="%s"/><port04 data="%s"/><port05 data="%s"/>'
            '</ladspacontrols><key><attribute name="file" value="caps"/>'
            '<attribute name="plugin" value="Plate2x2"/></key></effect>') % (tail, damp, blend)


def instrument_xml(inst):
    if inst['kind'] == 'sample':
        body = '<instrument name="audiofileprocessor"><audiofileprocessor %s/></instrument>' % attrs(dict(
            src=inst['src'], amp=inst.get('amp', 100), sframe=0, eframe=1, lframe=0, looped=0,
            reversed=0, stutter=0, interp=1))
        elvol = env(amt=0)
    else:
        body = '<instrument name="tripleoscillator"><tripleoscillator %s/></instrument>' % attrs(inst['osc'])
        elvol = inst['env']
    f = inst.get('filter')  # (종류, 차단 주파수, 공명) 종류 0 = 저역 통과
    eld = dict(ftype=f[0] if f else 0, fcut=f[1] if f else 14000, fres=f[2] if f else 0.5, fwet=1 if f else 0)
    fx = inst.get('fx', [])
    return ''.join([
        '<instrumenttrack %s>' % attrs(dict(vol=inst.get('vol', 100), pan=inst.get('pan', 0), pitch=0,
                                             pitchrange=1, basenote=57, usemasterpitch=1, fxch=0)),
        body,
        '<eldata %s><elvol %s/><elcut %s/><elres %s/></eldata>' % (attrs(eld), attrs(elvol), attrs(env(amt=0)), attrs(env(amt=0))),
        '<chordcreator chord="0" chordrange="1" chord-enabled="0"/>',
        '<arpeggiator arp="0" arprange="1" arptime="100" arpgate="100" arpdir="0" arpmode="0" '
        'arptime_numerator="4" arptime_denominator="4" syncmode="0" arp-enabled="0"/>',
        '<midiport inputchannel="0" outputchannel="1" inputcontroller="0" outputcontroller="0" '
        'basevelocity="127" outputprogram="1" fixedinputvelocity="-1" fixedoutputvelocity="-1" '
        'fixedoutputnote="-1" readable="0" writable="0"/>',
        '<fxchain enabled="%d" numofeffects="%d">%s</fxchain>' % (1 if fx else 0, len(fx), ''.join(fx)),
        '</instrumenttrack>',
    ])


def song_xml(title, bpm, bars, tracks, vol=100):
    """tracks: [(악기, [(시작 틱, 길이 틱, 음 번호, 세기), ...]), ...]. 곡 전체를 패턴 하나로 넣는다."""
    out = ['<?xml version="1.0"?>', '<!DOCTYPE lmms-project>',
           '<lmms-project creator="LMMS" version="1.0" type="song" creatorversion="1.2.2">',
           '<head timesig_numerator="4" timesig_denominator="4" bpm="%d" mastervol="%d" masterpitch="0"/>' % (bpm, vol),
           '<song><trackcontainer type="song" visible="1" x="5" y="5" width="600" height="300" minimized="0" maximized="0">']
    for inst, notes in tracks:
        out.append('<track type="0" name=%s muted="0" solo="0">' % quoteattr(inst['name']))
        out.append(instrument_xml(inst))
        out.append('<pattern type="1" name=%s pos="0" len="%d" steps="16" muted="0">' % (quoteattr(inst['name']), bars * BAR))
        for pos, ln, k, v in sorted(notes):
            out.append('<note pos="%d" len="%d" key="%d" vol="%d" pan="0"/>' % (pos, ln, k, v))
        out.append('</pattern></track>')
    out.append('</trackcontainer>')
    out.append('<fxmixer visible="0" x="1" y="400" width="530" height="332" minimized="0" maximized="0">'
               '<fxchannel num="0" name="Master" volume="1" muted="0" soloed="0"><fxchain enabled="0" numofeffects="0"/></fxchannel>'
               '</fxmixer>')
    out.append('<timeline lp0pos="0" lp1pos="%d" lpstate="1"/><controllers/>' % (bars * BAR))
    out.append('<projectnotes visible="0" x="700" y="10" width="640" height="400" minimized="0" maximized="0"><![CDATA[%s]]></projectnotes>' % title)
    out.append('</song></lmms-project>')
    return '\n'.join(out)
