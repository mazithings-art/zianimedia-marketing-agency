import av
import sys

def trim(src, dst, duration=10.0, width=720, height=1280):
    in_c = av.open(src)
    v_in = in_c.streams.video[0]
    a_in = in_c.streams.audio[0] if in_c.streams.audio else None

    out_c = av.open(dst, mode='w')

    v_out = out_c.add_stream('libx264', rate=v_in.average_rate)
    v_out.width = width
    v_out.height = height
    v_out.pix_fmt = 'yuv420p'
    v_out.options = {'crf': '23', 'preset': 'medium', 'movflags': '+faststart'}

    a_out = None
    resampler = None
    if a_in is not None:
        a_out = out_c.add_stream('aac', rate=44100)
        a_out.layout = 'stereo'
        resampler = av.AudioResampler(format='fltp', layout='stereo', rate=44100)

    start_dts = None
    for frame in in_c.decode(video=0, audio=(0 if a_in is not None else None)):
        t = float(frame.pts * frame.time_base) if frame.pts is not None else None
        if t is None:
            continue
        if start_dts is None:
            start_dts = t
        rel = t - start_dts
        if rel > duration:
            break
        if isinstance(frame, av.VideoFrame):
            frame2 = frame.reformat(width=width, height=height, format='yuv420p')
            for packet in v_out.encode(frame2):
                out_c.mux(packet)
        elif isinstance(frame, av.AudioFrame):
            frame.pts = None
            for rframe in resampler.resample(frame):
                for packet in a_out.encode(rframe):
                    out_c.mux(packet)

    for packet in v_out.encode():
        out_c.mux(packet)
    if a_out is not None:
        for packet in a_out.encode():
            out_c.mux(packet)

    out_c.close()
    in_c.close()

if __name__ == '__main__':
    jobs = [
        ('SFtwvid1.mp4', 'case-1.mp4'),
        ('ACCvid51.mp4', 'case-2.mp4'),
        ('SFktvid2.mp4', 'case-3.mp4'),
    ]
    for src, dst in jobs:
        print('trimming', src, '->', dst)
        trim(src, dst)
    print('done')
