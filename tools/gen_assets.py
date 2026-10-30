#!/usr/bin/env python3
"""Gera TODOS os recursos graficos e sonoros do ABYSSAL (arte original, sem terceiros).

Uso:  python3 tools/gen_assets.py
Requer: Pillow e numpy.
Saida: www/assets/sprites/*.png, www/assets/sprites/manifest.json, www/assets/audio/*.wav,
       android/app/src/main/res/mipmap-*/ic_launcher*.png
"""
import json
import math
import os
import random
import wave

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPR = os.path.join(ROOT, "www", "assets", "sprites")
AUD = os.path.join(ROOT, "www", "assets", "audio")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
os.makedirs(SPR, exist_ok=True)
os.makedirs(AUD, exist_ok=True)


def hx(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


OUTLINE = hx("#0b1226")
manifest = {}


def new(w, h):
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


def outline(img, color=OUTLINE):
    """Contorno escuro de 1px ao redor da silhueta."""
    a = np.array(img)
    alpha = a[:, :, 3] > 0
    pad = np.pad(alpha, 1)
    near = (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
    edge = near & ~alpha
    a[edge] = color
    return Image.fromarray(a)


def shade(img, light, dark):
    """Aplica luz no topo/esquerda e sombra embaixo/direita (somente em pixels de mesma cor-base)."""
    a = np.array(img)
    alpha = a[:, :, 3] > 0
    pad = np.pad(alpha, 1)
    top_empty = ~pad[:-2, 1:-1]
    bot_empty = ~pad[2:, 1:-1]
    a2 = a.copy()
    m = alpha & top_empty
    a2[m] = light
    m = alpha & bot_empty
    a2[m] = dark
    return Image.fromarray(a2)


def sheet(frames, cols=None):
    """Junta quadros (mesmo tamanho) em uma grade."""
    cols = cols or len(frames)
    rows = math.ceil(len(frames) / cols)
    w, h = frames[0].size
    out = new(w * cols, h * rows)
    for i, f in enumerate(frames):
        out.paste(f, ((i % cols) * w, (i // cols) * h))
    return out, cols, rows


def save(name, frames, cols=None):
    out, c, r = sheet(frames, cols)
    out.save(os.path.join(SPR, name + ".png"))
    manifest[name] = {"w": frames[0].size[0], "h": frames[0].size[1], "cols": c, "rows": r}


def shear(img, k):
    """Desloca colunas verticalmente: k>0 levanta o nariz (direita)."""
    w, h = img.size
    out = new(w, h)
    cx = (w - 1) / 2
    for x in range(w):
        dy = -round(k * (x - cx) / cx)
        col = img.crop((x, 0, x + 1, h))
        out.paste(col, (x, dy), col)
    return out


# ---------------------------------------------------------------- SUBMARINO
def make_sub(prop, tilt):
    W, H = 32, 22
    im = new(W, H)
    d = ImageDraw.Draw(im)
    Y, YL, YD = hx("#f5c518"), hx("#ffe780"), hx("#c98f00")
    # torre + periscopio
    d.rectangle((12, 4, 19, 9), fill=Y)
    d.rectangle((16, 1, 16, 4), fill=hx("#9aa8b8"))
    d.rectangle((16, 1, 19, 1), fill=hx("#9aa8b8"))
    # casco
    d.ellipse((2, 7, 29, 19), fill=Y)
    # nadadeira traseira
    d.polygon([(2, 9), (0, 5), (5, 8)], fill=YD)
    d.polygon([(2, 17), (0, 20), (5, 17)], fill=YD)
    im = shade(im, YL, YD)
    d = ImageDraw.Draw(im)
    # faixa e vigias
    d.line((6, 13, 12, 13), fill=hx("#e0a800"))
    d.ellipse((7, 11, 9, 13), fill=hx("#3fc7e6"))
    d.ellipse((11, 11, 13, 13), fill=hx("#3fc7e6"))
    # cupula frontal
    d.ellipse((19, 9, 26, 15), fill=hx("#7defff"))
    d.point((21, 10), fill=hx("#ffffff"))
    d.point((22, 10), fill=hx("#d9fbff"))
    d.rectangle((19, 14, 26, 15), fill=hx("#2aa3c4"))
    # farol
    d.rectangle((28, 14, 29, 16), fill=hx("#fff7b0"))
    # helice
    grey = hx("#c3ced9")
    lens = [7, 5, 2, 5][prop]
    top = 13 - lens // 2
    d.line((1, top, 1, top + lens), fill=grey)
    d.point((2, 13), fill=hx("#7a8794"))
    im = outline(im)
    if tilt:
        im = shear(im, tilt)
    return im


sub_frames = []
for tilt in (0, 2, -2):
    for p in range(4):
        sub_frames.append(make_sub(p, tilt))
save("sub", sub_frames, cols=4)


# ---------------------------------------------------------------- CRISTAIS
def crystal_base(kind):
    if kind == 0:   # pequeno - ciano
        base, light, dark = hx("#3fd9ff"), hx("#bff6ff"), hx("#1580b8")
        im = new(12, 16)
        d = ImageDraw.Draw(im)
        d.polygon([(6, 1), (10, 6), (9, 14), (2, 14), (1, 6)], fill=base)
        d.polygon([(6, 1), (1, 6), (2, 14), (5, 14)], fill=light)
        d.polygon([(7, 4), (10, 6), (9, 14), (7, 14)], fill=dark)
    elif kind == 1:  # medio - verde-agua, aglomerado
        base, light, dark = hx("#3dffc0"), hx("#c4ffee"), hx("#12a07c")
        im = new(20, 18)
        d = ImageDraw.Draw(im)
        d.polygon([(4, 6), (7, 10), (6, 16), (1, 16), (0, 10)], fill=base)
        d.polygon([(15, 5), (19, 10), (19, 16), (13, 16), (12, 9)], fill=base)
        d.polygon([(10, 0), (14, 6), (13, 16), (6, 16), (6, 6)], fill=base)
        d.polygon([(10, 0), (6, 6), (6, 16), (9, 16)], fill=light)
        d.polygon([(12, 4), (14, 6), (13, 16), (11, 16)], fill=dark)
        d.polygon([(4, 6), (0, 10), (1, 16), (3, 16)], fill=light)
        d.polygon([(17, 7), (19, 10), (19, 16), (16, 16)], fill=dark)
    else:            # grande - ciano/branco
        base, light, dark = hx("#6fe9ff"), hx("#ffffff"), hx("#1d86c9")
        im = new(26, 30)
        d = ImageDraw.Draw(im)
        d.polygon([(13, 0), (20, 8), (19, 28), (7, 28), (5, 8)], fill=base)
        d.polygon([(13, 0), (5, 8), (7, 28), (12, 28)], fill=light)
        d.polygon([(16, 5), (20, 8), (19, 28), (15, 28)], fill=dark)
        d.polygon([(3, 16), (6, 20), (5, 28), (0, 28), (0, 21)], fill=base)
        d.polygon([(22, 14), (25, 19), (25, 28), (20, 28), (19, 19)], fill=dark)
        d.polygon([(22, 14), (19, 19), (20, 28), (22, 28)], fill=base)
    return outline(im)


for k, name in enumerate(["crystal_s", "crystal_m", "crystal_l"]):
    base = crystal_base(k)
    w, h = base.size
    frames = []
    spots = [(0.35, 0.3), (0.55, 0.5), (0.4, 0.7), (0.6, 0.35)]
    for f in range(4):
        fr = base.copy()
        a = np.array(fr).astype(int)
        mask = a[:, :, 3] > 0
        boost = [0, 25, 50, 25][f]
        a[mask, :3] = np.clip(a[mask, :3] + boost, 0, 255)
        fr = Image.fromarray(a.astype("uint8"))
        d = ImageDraw.Draw(fr)
        sx, sy = int(spots[f][0] * w), int(spots[f][1] * h)
        d.point((sx, sy), fill=(255, 255, 255, 255))
        if f in (1, 2):
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= sx + dx < w and 0 <= sy + dy < h and fr.getpixel((sx + dx, sy + dy))[3] > 0:
                    d.point((sx + dx, sy + dy), fill=(230, 255, 255, 255))
        frames.append(fr)
    save(name, frames)


# ---------------------------------------------------------------- PATRULHEIRO (peixe-lanterna)
def make_fish(f):
    W, H = 30, 20
    im = new(W, H)
    d = ImageDraw.Draw(im)
    R, RL, RD = hx("#e8503a"), hx("#ff9a6b"), hx("#962a2e")
    wag = [0, 1, 0, -1][f]
    # cauda
    d.polygon([(6, 11), (0, 6 + wag), (0, 16 + wag), (6, 13)], fill=RD)
    # corpo
    d.ellipse((4, 6, 25, 17), fill=R)
    # dorsal
    d.polygon([(10, 7), (14, 2), (18, 7)], fill=RD)
    im = shade(im, RL, RD)
    d = ImageDraw.Draw(im)
    # barriga
    d.line((8, 15, 20, 15), fill=hx("#ffb68a"))
    # olho
    d.ellipse((19, 9, 22, 12), fill=hx("#ffffff"))
    d.point((21, 11), fill=hx("#0b1226"))
    d.point((22, 11), fill=hx("#0b1226"))
    # boca com dentes
    d.line((22, 14, 25, 14), fill=hx("#0b1226"))
    d.point((23, 13), fill=hx("#ffffff"))
    d.point((25, 13), fill=hx("#ffffff"))
    # isca
    bob = [0, -1, 0, 1][f]
    d.line((22, 7, 23, 3), fill=hx("#7a2a2a"))
    d.line((23, 3, 27, 2 + bob), fill=hx("#7a2a2a"))
    d.ellipse((26, 0 + bob + 1, 28, 2 + bob + 1), fill=hx("#fff27a"))
    d.point((27, 1 + bob + 1), fill=hx("#ffffff"))
    return outline(im)


save("patroller", [make_fish(f) for f in range(4)])


# ---------------------------------------------------------------- CACADORA (medusa)
def make_jelly(f):
    W, H = 24, 30
    im = new(W, H)
    d = ImageDraw.Draw(im)
    P, PL, PD = hx("#a45de8"), hx("#d9a6ff"), hx("#5b1f9e")
    pulse = [0, 1, 2, 1][f]
    top = 1 + (1 if pulse == 2 else 0)
    bot = 15 - (1 if pulse == 0 else 0) + (1 if pulse == 2 else 0)
    d.pieslice((1, top, 22, top + (bot - top) * 2), 180, 360, fill=P)
    d.rectangle((1, bot - 1, 22, bot), fill=P)
    im = shade(im, PL, PD)
    d = ImageDraw.Draw(im)
    # saia ondulada
    for x in range(1, 23):
        if (x + f) % 4 < 2:
            d.point((x, bot + 1), fill=PD)
    # manchas luminosas
    for (x, y) in ((7, 6), (12, 4), (16, 7), (11, 9)):
        d.point((x, y + (1 if pulse == 2 else 0)), fill=hx("#ff8bd1"))
    # olhos
    d.point((8, 11), fill=hx("#0b1226"))
    d.point((15, 11), fill=hx("#0b1226"))
    # tentaculos
    for i, x in enumerate((4, 8, 12, 16, 19)):
        length = 11 + (i % 2) * 2
        for y in range(length):
            dx = round(math.sin((y + f * 2 + i * 1.5) * 0.9) * 1.4)
            d.point((x + dx, bot + 2 + y), fill=PL if y % 3 == 0 else P)
    return outline(im)


save("hunter", [make_jelly(f) for f in range(4)])


# ---------------------------------------------------------------- PLANTAS
def make_kelp(h, frame, seed, color):
    W = 16
    im = new(W, h)
    d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    G, GL, GD = color
    x0 = W // 2
    for y in range(h):
        t = (h - y) / h
        sway = math.sin(t * 5 + frame * math.pi) * (1.0 + 2.5 * (1 - (y / h)))
        x = x0 + round(sway)
        d.point((x, y), fill=G)
        d.point((x + 1, y), fill=G)
        if y % 9 == 4 and y < h - 6:
            side = 1 if (y // 9) % 2 == 0 else -1
            for k in range(1, 4):
                d.point((x + side * (k + 1), y - k // 2), fill=GL if k == 3 else G)
    # ponta luminosa
    ty = 1
    tsway = round(math.sin(5 + frame * math.pi) * 1.0)
    d.point((x0 + tsway, ty), fill=hx("#9affe6"))
    return outline(im)


GREEN = (hx("#1f8a68"), hx("#49c9a0"), hx("#10503f"))
TEAL = (hx("#1d6f94"), hx("#4fb4d6"), hx("#0e3f5c"))
save("kelp_tall", [make_kelp(52, f, 1, GREEN) for f in range(2)])
save("kelp_short", [make_kelp(30, f, 2, TEAL) for f in range(2)])


def make_coral(frame):
    W, H = 22, 18
    im = new(W, H)
    d = ImageDraw.Draw(im)
    C, CL, CD = hx("#d9547c"), hx("#ff9db8"), hx("#7e2244")
    for i, x in enumerate((4, 8, 11, 15, 18)):
        top = 2 + (i * 5) % 7
        sway = round(math.sin(frame * math.pi + i) * 0.6)
        d.line((x, H - 1, x + sway, top), fill=C, width=2)
        d.point((x + sway, top - 1), fill=hx("#ffd1e0"))
    d.rectangle((2, H - 3, 20, H - 1), fill=CD)
    return outline(im)


save("coral", [make_coral(f) for f in range(2)])


# ---------------------------------------------------------------- ESTACAO
def make_station(f):
    W, H = 184, 108
    im = new(W, H)
    d = ImageDraw.Draw(im)
    M, ML, MD = hx("#5b7a99"), hx("#9ab8d4"), hx("#2c4160")
    # base/plataforma
    d.rectangle((6, H - 14, W - 8, H - 1), fill=MD)
    d.rectangle((6, H - 14, W - 8, H - 12), fill=ML)
    for x in range(14, W - 14, 18):
        d.rectangle((x, H - 10, x + 8, H - 4), fill=hx("#1a2840"))
    # pernas
    d.rectangle((26, H - 40, 34, H - 14), fill=MD)
    d.rectangle((120, H - 40, 128, H - 14), fill=MD)
    # modulo principal (cupula)
    d.ellipse((14, 14, 146, H - 24), fill=M)
    d.rectangle((14, 58, 146, H - 24), fill=M)
    # segundo modulo
    d.rounded_rectangle((120, 44, 176, H - 22), radius=8, fill=MD)
    # antena
    d.line((62, 14, 62, 0), fill=ML)
    d.rectangle((60, 0, 64, 2), fill=hx("#ff4a4a") if f == 0 else hx("#6a2020"))
    # janelas acesas
    for x in range(26, 130, 18):
        d.rectangle((x, 36, x + 10, 46), fill=hx("#ffe58a") if (x // 18 + f) % 3 else hx("#b89a3d"))
    for x in range(28, 112, 20):
        d.rectangle((x, 62, x + 12, 70), fill=hx("#7defff"))
    # baia de atracacao (neon ciano)
    d.rectangle((126, 58, 170, H - 30), fill=hx("#0a1830"))
    d.rectangle((126, 58, 170, 60), fill=hx("#4fe3ff"))
    d.rectangle((126, H - 32, 170, H - 30), fill=hx("#4fe3ff"))
    d.rectangle((126, 58, 128, H - 30), fill=hx("#4fe3ff"))
    for i in range(4):
        c = hx("#3dffc0") if (i + f) % 2 == 0 else hx("#117a5c")
        d.rectangle((172, 62 + i * 8, 174, 65 + i * 8), fill=c)
    # reforcos
    for x in (40, 80, 110):
        d.line((x, 50, x, H - 26), fill=MD)
    d.arc((14, 14, 146, 90), 200, 340, fill=ML, width=2)
    return outline(im)


save("station", [make_station(f) for f in range(2)])


# ---------------------------------------------------------------- ICONES 12x12
def icon_shield(full):
    im = new(12, 12)
    d = ImageDraw.Draw(im)
    pts = [(1, 1), (10, 1), (10, 6), (5, 11), (1, 6)]
    pts = [(1, 1), (10, 1), (10, 6), (6, 10), (5, 10), (1, 6)]
    if full:
        d.polygon(pts, fill=hx("#f5c518"))
        d.line((2, 2, 9, 2), fill=hx("#ffe780"))
        d.line((5, 3, 5, 8), fill=hx("#c98f00"))
        d.line((6, 3, 6, 8), fill=hx("#c98f00"))
    else:
        d.polygon(pts, fill=hx("#2a3550"))
        d.point((5, 5), fill=hx("#ff6a5a"))
        d.point((6, 6), fill=hx("#ff6a5a"))
        d.point((5, 6), fill=hx("#ff6a5a"))
        d.point((6, 5), fill=hx("#ff6a5a"))
    return outline(im)


def icon_o2():
    im = new(12, 12)
    d = ImageDraw.Draw(im)
    d.ellipse((1, 4, 8, 11), fill=hx("#7defff"))
    d.ellipse((6, 1, 9, 4), fill=hx("#bff6ff"))
    d.ellipse((9, 6, 10, 7), fill=hx("#bff6ff"))
    d.point((3, 6), fill=hx("#ffffff"))
    d.point((4, 6), fill=hx("#ffffff"))
    return outline(im)


def icon_crystal():
    im = new(12, 12)
    d = ImageDraw.Draw(im)
    d.polygon([(6, 0), (10, 4), (9, 10), (3, 10), (2, 4)], fill=hx("#3fd9ff"))
    d.polygon([(6, 0), (2, 4), (3, 10), (5, 10)], fill=hx("#bff6ff"))
    d.polygon([(7, 3), (10, 4), (9, 10), (7, 10)], fill=hx("#1580b8"))
    return outline(im)


def icon_lamp(on):
    im = new(12, 12)
    d = ImageDraw.Draw(im)
    if on:
        d.ellipse((1, 3, 6, 8), fill=hx("#fff27a"))
        d.polygon([(6, 3), (11, 0), (11, 11), (6, 8)], fill=hx("#fff9b8"))
    else:
        d.ellipse((1, 3, 6, 8), fill=hx("#5b6a80"))
        d.polygon([(6, 3), (11, 0), (11, 11), (6, 8)], fill=hx("#2a3550"))
        d.line((1, 11, 11, 0), fill=hx("#ff6a5a"))
    return outline(im)


def icon_arrow():
    im = new(12, 12)
    d = ImageDraw.Draw(im)
    d.polygon([(11, 6), (5, 1), (5, 4), (0, 4), (0, 8), (5, 8), (5, 11)], fill=hx("#ffd84a"))
    return outline(im)


def icon_speaker(muted):
    im = new(12, 12)
    d = ImageDraw.Draw(im)
    d.polygon([(1, 4), (4, 4), (7, 1), (7, 10), (4, 7), (1, 7)], fill=hx("#bff6ff"))
    if muted:
        d.line((8, 3, 11, 9), fill=hx("#ff6a5a"))
        d.line((11, 3, 8, 9), fill=hx("#ff6a5a"))
    else:
        d.arc((6, 3, 11, 9), 290, 70, fill=hx("#bff6ff"))
    return outline(im)


save("icons", [icon_shield(True), icon_shield(False), icon_o2(), icon_crystal(), icon_lamp(True),
               icon_lamp(False), icon_arrow(), icon_speaker(False), icon_speaker(True)])


# ---------------------------------------------------------------- TEXTURAS DE ROCHA / METAL (64x64 repetiveis)
def tile_noise(size, cells, seed):
    rng = np.random.RandomState(seed)
    g = rng.rand(cells, cells)
    # interpolacao bilinear com wrap
    xs = np.linspace(0, cells, size, endpoint=False)
    x0 = xs.astype(int) % cells
    x1 = (x0 + 1) % cells
    fx = xs - np.floor(xs)
    fx = fx * fx * (3 - 2 * fx)
    out = np.zeros((size, size))
    for j in range(size):
        for i in range(size):
            a = g[x0[j], x0[i]] * (1 - fx[i]) + g[x0[j], x1[i]] * fx[i]
            b = g[x1[j], x0[i]] * (1 - fx[i]) + g[x1[j], x1[i]] * fx[i]
            out[j, i] = a * (1 - fx[j]) + b * fx[j]
    return out


def rock_texture():
    n = 0.6 * tile_noise(64, 4, 1) + 0.3 * tile_noise(64, 8, 2) + 0.1 * tile_noise(64, 16, 3)
    pal = [hx("#1a2f4d"), hx("#20395a"), hx("#274466"), hx("#2f5074")]
    im = new(64, 64)
    px = im.load()
    for y in range(64):
        for x in range(64):
            v = n[y, x]
            idx = 0 if v < 0.38 else 1 if v < 0.5 else 2 if v < 0.62 else 3
            px[x, y] = pal[idx]
    rnd = random.Random(7)
    for _ in range(70):   # pontos de textura
        x, y = rnd.randrange(64), rnd.randrange(64)
        px[x, y] = hx("#12223b")
    for _ in range(40):
        x, y = rnd.randrange(64), rnd.randrange(64)
        px[x, y] = hx("#3a6489")
    return im


def metal_texture():
    im = new(64, 64)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 63, 63), fill=hx("#3b4d63"))
    for gy in range(0, 64, 16):
        for gx in range(0, 64, 16):
            d.rectangle((gx, gy, gx + 15, gy + 15), outline=hx("#27364a"))
            d.line((gx + 1, gy + 1, gx + 14, gy + 1), fill=hx("#52687f"))
            for (rx, ry) in ((gx + 3, gy + 3), (gx + 12, gy + 3), (gx + 3, gy + 12), (gx + 12, gy + 12)):
                d.point((rx, ry), fill=hx("#8fa6bd"))
    rnd = random.Random(11)
    for _ in range(90):   # ferrugem/limo
        x, y = rnd.randrange(64), rnd.randrange(64)
        d.point((x, y), fill=hx("#2e6b5f") if rnd.random() < .5 else hx("#6b4a33"))
    return im


rock_texture().save(os.path.join(SPR, "rock.png"))
metal_texture().save(os.path.join(SPR, "metal.png"))
manifest["rock"] = {"w": 64, "h": 64, "cols": 1, "rows": 1}
manifest["metal"] = {"w": 64, "h": 64, "cols": 1, "rows": 1}

with open(os.path.join(SPR, "manifest.json"), "w") as f:
    json.dump(manifest, f, indent=1)


# ---------------------------------------------------------------- ICONE DO APLICATIVO
def app_icon(size, foreground_only=False):
    S = 128
    bg = new(S, S)
    d = ImageDraw.Draw(bg)
    if not foreground_only:
        for y in range(S):
            t = y / S
            c = (int(10 + 20 * (1 - t)), int(30 + 70 * (1 - t)), int(60 + 110 * (1 - t)), 255)
            d.line((0, y, S, y), fill=c)
        rnd = random.Random(3)
        for _ in range(26):
            x, y = rnd.randrange(S), rnd.randrange(S)
            d.point((x, y), fill=(160, 230, 255, 255))
    sp = Image.open(os.path.join(SPR, "sub.png")).crop((0, 0, 32, 22))
    cr = Image.open(os.path.join(SPR, "crystal_l.png")).crop((0, 0, 26, 30))
    comp = new(S, S)
    cr2 = cr.resize((26 * 2, 30 * 2), Image.NEAREST)
    sp2 = sp.resize((32 * 2, 22 * 2), Image.NEAREST)
    comp.paste(cr2, (64 - 26, 22), cr2)
    comp.paste(sp2, (64 - 32 + 6, 62), sp2)
    if foreground_only:
        out = comp
    else:
        out = bg.copy()
        out.alpha_composite(comp)
    return out.resize((size, size), Image.NEAREST)


dens = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
for name, px in dens.items():
    p = os.path.join(RES, "mipmap-" + name)
    os.makedirs(p, exist_ok=True)
    app_icon(px).convert("RGBA").save(os.path.join(p, "ic_launcher.png"))
fg = os.path.join(RES, "drawable-nodpi")
os.makedirs(fg, exist_ok=True)
# icone adaptativo: 108dp -> 432px; arte dentro da zona segura (66%)
fgimg = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
art = app_icon(288, foreground_only=True)
fgimg.alpha_composite(art, (72, 72))
fgimg.save(os.path.join(fg, "ic_launcher_foreground.png"))
app_icon(512).save(os.path.join(ROOT, "tools", "icon_512.png"))


# ---------------------------------------------------------------- AUDIO
SR = 22050


def write_wav(name, data):
    data = np.clip(data, -1, 1)
    pcm = (data * 32767).astype("<i2")
    with wave.open(os.path.join(AUD, name + ".wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def tt(dur):
    return np.arange(int(SR * dur)) / SR


def env(n, a=0.005, r=0.1):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] = np.minimum(e[-nr:], np.linspace(1, 0, nr))
    return e


def tone(freq, dur, kind="sine", vol=0.5, decay=4.0):
    t = tt(dur)
    ph = 2 * np.pi * freq * t
    if kind == "sine":
        w = np.sin(ph)
    elif kind == "tri":
        w = 2 / np.pi * np.arcsin(np.sin(ph))
    elif kind == "sq":
        w = np.sign(np.sin(ph)) * 0.6
    else:
        w = np.sin(ph)
    return w * np.exp(-decay * t) * env(len(t), 0.003, 0.03) * vol


rng = np.random.RandomState(5)

# ambiente: 12s repetivel (frequencias com numero inteiro de ciclos)
D = 12.0
t = tt(D)
amb = 0.20 * np.sin(2 * np.pi * (55 * D // D) * t) * (0.6 + 0.4 * np.sin(2 * np.pi * t / D))
amb += 0.14 * np.sin(2 * np.pi * (82.5 * D // D) * t + 1) * (0.5 + 0.5 * np.sin(2 * np.pi * 2 * t / D + 2))
noise = rng.randn(len(t))
k = 400
ker = np.ones(k) / k
low = np.convolve(np.concatenate([noise[-k:], noise, noise[:k]]), ker, mode="same")[k:-k]
amb += 0.9 * low * (0.5 + 0.5 * np.sin(2 * np.pi * 3 * t / D))
# eco de sonar suave (dentro do ciclo)
ping = np.zeros_like(t)
for start in (2.0, 8.5):
    i0 = int(start * SR)
    seg = tone(1320, 1.4, "sine", 0.10, 3.2)
    ping[i0:i0 + len(seg)] += seg
amb += ping
amb = amb / np.max(np.abs(amb)) * 0.55
write_wav("ambient", amb)

# coleta de cristal
c = np.concatenate([tone(880, 0.09, "tri", 0.5, 8), tone(1320, 0.09, "tri", 0.5, 8), tone(1760, 0.22, "tri", 0.5, 6)])
write_wav("crystal", c)

# dano
n = int(SR * 0.4)
tn = tt(0.4)
hit = rng.randn(n) * np.exp(-9 * tn) * 0.6 + np.sin(2 * np.pi * (180 - 120 * tn) * tn) * np.exp(-6 * tn) * 0.7
write_wav("hit", hit)

# oxigenio baixo (dois bips)
b = tone(740, 0.14, "sq", 0.35, 5)
gap = np.zeros(int(SR * 0.08))
write_wav("lowo2", np.concatenate([b, gap, b]))

# extracao concluida (arpejo ascendente)
notes = [523, 659, 784, 1047, 1319]
write_wav("extract", np.concatenate([tone(f, 0.16, "tri", 0.5, 3) for f in notes[:-1]] + [tone(notes[-1], 0.7, "tri", 0.5, 2.2)]))

# derrota (descendente)
notes = [392, 330, 262, 196]
write_wav("lose", np.concatenate([tone(f, 0.28, "sine", 0.55, 2.5) for f in notes[:-1]] + [tone(notes[-1], 0.9, "sine", 0.55, 2.2)]))

# interface
write_wav("click", tone(660, 0.07, "sq", 0.25, 12))
write_wav("light", np.concatenate([tone(520, 0.05, "sq", 0.2, 10), tone(780, 0.07, "sq", 0.2, 10)]))
# alerta (criatura percebeu o submarino)
ta = tt(0.3)
al = np.sin(2 * np.pi * (300 + 600 * ta) * ta) * np.exp(-3 * ta) * 0.35
write_wav("alert", al)

print("Assets gerados em", SPR, "e", AUD)
