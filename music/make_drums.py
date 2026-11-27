"""배경음에 쓰는 드럼 소리 9개를 처음부터 합성한다(외부 샘플 없음 → 저작권 걱정 없음, 이 저장소의 MIT 라이선스).

  python make_drums.py   → music/drums/*.wav (44.1kHz, 16비트, 모노)

같은 결과가 나오도록 잡음은 고정한 씨앗(seed)으로 만든다.
  kick        킥: 150 → 48Hz로 떨어지는 사인 + 짧은 딸깍
  kick_soft   부드러운 킥: 110 → 50Hz, 딸깍 없음
  snare       스네어: 몸통 음(185·330Hz) + 밝은 잡음
  hat_closed  닫힌 하이햇: 금속성 사각파 6개 + 잡음, 아주 짧게
  hat_closed2 닫힌 하이햇(조금 더 길고 밝게)
  hat_open    열린 하이햇: 길게 울림
  rim         림: 높은 두 음 + 짧은 잡음
  shaker      셰이커: 부드럽게 들어오는 잡음
  crash       심벌: 금속성 울림 + 잡음, 길게
"""
import os
import wave
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'drums')
rng = np.random.default_rng(20261127)
# 808 하이햇처럼 서로 어울리지 않는 주파수의 사각파를 겹치면 금속 소리가 난다
METAL = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0]


def t_of(sec):
    return np.arange(int(SR * sec)) / SR


def noise(sec):
    return rng.uniform(-1, 1, int(SR * sec))


def decay(t, tau):
    return np.exp(-t / tau)


def highpass(x, cut):
    """한 극 고역 통과: 낮은 소리를 깎아 밝게 만든다."""
    rc = 1 / (2 * np.pi * cut); a = rc / (rc + 1 / SR)
    y = np.zeros_like(x)
    for i in range(1, len(x)):
        y[i] = a * (y[i - 1] + x[i] - x[i - 1])
    return y


def lowpass(x, cut):
    a = (1 / SR) / (1 / (2 * np.pi * cut) + 1 / SR)
    y = np.zeros_like(x)
    for i in range(1, len(x)):
        y[i] = y[i - 1] + a * (x[i] - y[i - 1])
    return y


def sweep_sine(t, f0, f1, tau):
    f = f1 + (f0 - f1) * np.exp(-t / tau)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def metal(t, mul=1.0):
    return sum(np.sign(np.sin(2 * np.pi * f * mul * t)) for f in METAL) / len(METAL)


def fade_in(x, sec):
    n = int(SR * sec)
    x[:n] *= np.linspace(0, 1, n)
    return x


def kick():
    t = t_of(0.5)
    body = sweep_sine(t, 150, 48, 0.035) * decay(t, 0.16)
    click = np.zeros_like(t); n = int(SR * 0.004); click[:n] = noise(0.004) * np.linspace(1, 0, n) * 0.5
    return body + click


def kick_soft():
    t = t_of(0.45)
    return lowpass(sweep_sine(t, 110, 50, 0.04) * decay(t, 0.13), 900)


def snare():
    t = t_of(0.35)
    tone = (np.sin(2 * np.pi * 185 * t) * 0.6 + np.sin(2 * np.pi * 330 * t) * 0.35) * decay(t, 0.05)
    sn = highpass(noise(0.35), 1200) * decay(t, 0.09)
    return tone * 0.7 + sn


def hat(sec, tau, bright):
    t = t_of(sec)
    x = highpass(metal(t) * 0.7 + noise(sec) * 0.5, bright) * decay(t, tau)
    return fade_in(x, 0.0008)


def rim():
    t = t_of(0.12)
    tone = (np.sin(2 * np.pi * 1700 * t) + np.sin(2 * np.pi * 820 * t) * 0.6) * decay(t, 0.012)
    return tone + highpass(noise(0.12), 2500) * decay(t, 0.006) * 0.6


def shaker():
    t = t_of(0.18)
    x = highpass(lowpass(noise(0.18), 9000), 4000) * decay(t, 0.045)
    return fade_in(x, 0.012)


def crash():
    t = t_of(2.2)
    x = highpass(metal(t, 1.37) * 0.5 + metal(t, 2.11) * 0.3 + noise(2.2) * 0.6, 3000) * decay(t, 0.55)
    return fade_in(x, 0.002)


SOUNDS = {
    'kick': kick, 'kick_soft': kick_soft, 'snare': snare,
    'hat_closed': lambda: hat(0.12, 0.022, 7000), 'hat_closed2': lambda: hat(0.16, 0.032, 6000),
    'hat_open': lambda: hat(0.7, 0.16, 6000), 'rim': rim, 'shaker': shaker, 'crash': crash,
}


def write(name, x):
    x = x / (np.max(np.abs(x)) or 1) * 0.89  # 가장 큰 곳을 약 -1dB로 맞춘다
    pcm = (x * 32767).astype('<i2')
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in SOUNDS.items():
        write(name, fn())
    return OUT


if __name__ == '__main__':
    print(main(), len(SOUNDS), '개')
