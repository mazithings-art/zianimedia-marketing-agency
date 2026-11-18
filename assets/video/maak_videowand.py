"""Maakt de korte clips voor de videowand onder de hero: klein, verticaal, met geluid."""
import av, pathlib
from fractions import Fraction

# Uit te voeren vanuit assets/video/, net als trim_with_audio.py. De bronbestanden
# (de ruwe klantvideo's) staan niet in de repo: die zijn te groot voor GitHub.
BRON = DOEL = pathlib.Path(__file__).resolve().parent
W, H, FPS, DUUR = 360, 640, 30, 8.0
TB = Fraction(1, FPS)

# (bronbestand, startseconde, naam) - vanaf het begin van de opname, zodat een bezoeker
# de intro van elke video ziet en niet ergens midden in de montage binnenvalt.
JOBS = [
    ('SFtwvid1.mp4',   0.0, 'wall-1'),
    ('FBCvid4.mp4',    0.0, 'wall-2'),
    ('SFktvid2.mp4',   0.0, 'wall-3'),
    ('svvid8.mp4',     0.0, 'wall-4'),
    ('ACCvid51.mp4',   0.0, 'wall-5'),
    ('SFt2wvid17.mp4', 0.0, 'wall-6'),
]


def maak(bron, start, naam):
    src, dst = BRON / bron, DOEL / (naam + '.mp4')
    poster = DOEL / (naam + '-poster.jpg')

    in_c = av.open(str(src))
    v_in = in_c.streams.video[0]
    v_in.thread_type = 'AUTO'
    a_in = in_c.streams.audio[0] if in_c.streams.audio else None
    # bij seek met stream= rekent PyAV in de time_base van die stream, niet in av.time_base
    in_c.seek(int(start / v_in.time_base), stream=v_in, backward=True)

    out_c = av.open(str(dst), mode='w')
    v_out = out_c.add_stream('libx264', rate=FPS)
    v_out.width, v_out.height, v_out.pix_fmt = W, H, 'yuv420p'
    v_out.time_base = TB
    v_out.options = {'crf': '30', 'preset': 'slow', 'movflags': '+faststart', 'profile': 'main'}

    a_out = resampler = None
    if a_in is not None:
        a_out = out_c.add_stream('aac', rate=44100)
        a_out.layout = 'mono'
        a_out.bit_rate = 64000
        resampler = av.AudioResampler(format='fltp', layout='mono', rate=44100)

    v_start = a_start = None
    idx = 0
    for frame in in_c.decode(video=0, audio=(0 if a_in is not None else None)):
        if frame.pts is None:
            continue
        t = float(frame.pts * frame.time_base)
        if t < start:
            continue

        if isinstance(frame, av.VideoFrame):
            if v_start is None:
                v_start = t
                frame.reformat(width=W, height=H, format='rgb24').to_image().save(
                    poster, quality=72, optimize=True, progressive=True)
            if t - v_start > DUUR:
                break
            f2 = frame.reformat(width=W, height=H, format='yuv420p')
            f2.pts, f2.time_base = idx, TB
            idx += 1
            for p in v_out.encode(f2):
                out_c.mux(p)
        elif a_out is not None:
            if a_start is None:
                a_start = t
            if t - a_start > DUUR:
                continue          # geluid verder overslaan, maar beeld blijft doorlopen
            frame.pts = None
            for rf in resampler.resample(frame):
                for p in a_out.encode(rf):
                    out_c.mux(p)

    for p in v_out.encode():
        out_c.mux(p)
    if a_out is not None:
        for p in a_out.encode():
            out_c.mux(p)
    out_c.close(); in_c.close()
    print('%-8s %4d beelden  %6.0f kB  poster %4.0f kB' % (naam, idx, dst.stat().st_size/1024, poster.stat().st_size/1024))


if __name__ == '__main__':
    DOEL.mkdir(parents=True, exist_ok=True)
    for bron, start, naam in JOBS:
        maak(bron, start, naam)
    print('klaar')
