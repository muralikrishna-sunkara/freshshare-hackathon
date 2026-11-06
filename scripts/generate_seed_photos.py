#!/usr/bin/env python3
"""Generate the illustrated demo photos referenced by data/seed.json.

Usage:  python3 scripts/generate_seed_photos.py   (needs Pillow: pip install pillow)

Writes 1200x900 JPEGs to data/seed-photos/. They are flat illustrations, not real
photos, and carry a small "DEMO" tag so nobody mistakes them for user content.
For the live pitch you can replace any file with your own photo of the same name
(same 4:3 shape works best); seed.ts converts whatever is there to WebP.
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H, S = 1200, 900, 2  # draw at 2x, downsample for anti-aliasing
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "seed-photos")


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/Library/Fonts/Arial Bold.ttf", "C:/Windows/Fonts/arialbd.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def canvas(top, bottom):
    img = Image.new("RGB", (W * S, H * S), top)
    d = ImageDraw.Draw(img)
    for y in range(H * S):
        t = y / (H * S)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (W * S, y)], fill=c)
    # table surface
    d.rectangle([0, int(H * S * 0.68), W * S, H * S], fill=tuple(max(0, v - 28) for v in bottom))
    return img, d


def shadow(img, box, radius=40, offset=(0, 30), opacity=90):
    sh = Image.new("L", img.size, 0)
    ImageDraw.Draw(sh).ellipse([box[0] + offset[0], box[1] + offset[1], box[2] + offset[0], box[3] + offset[1]], fill=opacity)
    sh = sh.filter(ImageFilter.GaussianBlur(radius))
    img.paste((40, 40, 30), mask=sh)


def finish(img, name, label):
    img = img.resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(img)
    f = font(30)
    tag = f"DEMO · {label}"
    tw = d.textlength(tag, font=f)
    d.rounded_rectangle([24, 24, 24 + tw + 36, 24 + 54], radius=27, fill=(31, 42, 30))
    d.text((24 + 18, 24 + 10), tag, font=f, fill=(247, 245, 238))
    os.makedirs(OUT, exist_ok=True)
    img.save(os.path.join(OUT, name), "JPEG", quality=86, optimize=True)
    print("wrote", name)


def P(*v):  # scale helper
    return [int(x * S) for x in v]


def lasagne():
    img, d = canvas((246, 226, 200), (233, 205, 170))
    shadow(img, P(230, 430, 970, 760))
    d.rounded_rectangle(P(220, 360, 980, 720), radius=40 * S, fill=(245, 245, 240), outline=(200, 200, 195), width=6 * S)
    d.rounded_rectangle(P(260, 390, 940, 690), radius=24 * S, fill=(196, 92, 46))
    layers = [(232, 196, 120), (176, 60, 36), (240, 214, 150), (160, 54, 30), (236, 190, 110)]
    for i, c in enumerate(layers):
        y = 420 + i * 52
        d.rounded_rectangle(P(280, y, 920, y + 40), radius=14 * S, fill=c)
    random.seed(1)
    for _ in range(40):
        x, y = random.randint(290, 900), random.randint(400, 670)
        d.ellipse(P(x, y, x + 18, y + 12), fill=(250, 236, 180))
    for x, y in [(380, 400), (600, 420), (800, 405)]:
        d.ellipse(P(x, y, x + 40, y + 22), fill=(76, 140, 60))
    finish(img, "lasagne.jpg", "Vegetable lasagne")


def apples(name="apples.jpg", label="Apples from our tree", colors=((200, 40, 40), (215, 70, 40), (170, 30, 35))):
    img, d = canvas((232, 240, 222), (210, 222, 196))
    shadow(img, P(250, 520, 950, 780))
    d.pieslice(P(240, 300, 960, 900), 0, 180, fill=(160, 110, 60))
    for i in range(7):
        x = 270 + i * 95
        d.line(P(x, 600, x + 60, 840), fill=(130, 85, 45), width=6 * S)
    pos = [(330, 430), (470, 400), (610, 420), (750, 440), (400, 520), (560, 510), (700, 525)]
    for i, (x, y) in enumerate(pos):
        c = colors[i % len(colors)]
        d.ellipse(P(x, y, x + 150, y + 140), fill=c)
        d.ellipse(P(x + 30, y + 22, x + 70, y + 52), fill=tuple(min(255, v + 60) for v in c))
        d.line(P(x + 75, y + 10, x + 82, y - 18), fill=(90, 60, 30), width=7 * S)
        d.ellipse(P(x + 84, y - 30, x + 124, y - 8), fill=(80, 150, 60))
    d.pieslice(P(240, 560, 960, 900), 0, 180, fill=(176, 122, 68))
    finish(img, name, label)


def sourdough(name="sourdough.jpg", label="Half a sourdough loaf", rolls=False):
    img, d = canvas((243, 234, 218), (226, 212, 188))
    shadow(img, P(220, 470, 980, 760))
    d.rounded_rectangle(P(180, 560, 1020, 720), radius=30 * S, fill=(170, 120, 70))
    for x in range(200, 1000, 60):
        d.line(P(x, 570, x, 710), fill=(150, 104, 58), width=3 * S)
    if rolls:
        for x, y in [(260, 420), (480, 400), (700, 420), (370, 470), (590, 470)]:
            d.ellipse(P(x, y, x + 230, y + 150), fill=(205, 140, 70))
            d.arc(P(x + 40, y + 30, x + 190, y + 120), 200, 340, fill=(240, 205, 150), width=8 * S)
    else:
        d.chord(P(260, 330, 900, 700), 180, 360, fill=(190, 120, 60))
        d.rectangle(P(258, 512, 902, 600), fill=(190, 120, 60))
        d.ellipse(P(820, 340, 960, 600), fill=(246, 230, 196), outline=(190, 120, 60), width=14 * S)
        for i in range(3):
            d.arc(P(340 + i * 140, 380, 480 + i * 140, 470), 200, 330, fill=(235, 196, 140), width=10 * S)
    finish(img, name, label)


def dal():
    img, d = canvas((250, 238, 214), (236, 214, 178))
    shadow(img, P(250, 470, 950, 780))
    d.ellipse(P(220, 380, 980, 560), fill=(30, 90, 120))
    d.chord(P(220, 260, 980, 760), 0, 180, fill=(30, 90, 120))
    d.ellipse(P(250, 395, 950, 545), fill=(240, 240, 232))
    d.chord(P(560, 395, 950, 545), 270, 90, fill=(226, 170, 40))
    d.ellipse(P(560, 395, 950, 545), fill=(226, 170, 40))
    random.seed(3)
    for _ in range(90):
        x, y = random.randint(300, 560), random.randint(415, 525)
        d.ellipse(P(x, y, x + 14, y + 7), fill=(255, 255, 250))
    for x, y in [(700, 430), (780, 470), (640, 480)]:
        d.ellipse(P(x, y, x + 26, y + 16), fill=(70, 140, 60))
    finish(img, "dal.jpg", "Dal and rice")


def yoghurt():
    img, d = canvas((232, 238, 246), (208, 218, 232))
    for i in range(4):
        x = 230 + i * 190
        shadow(img, P(x, 600, x + 160, 720), radius=20)
        d.polygon(P(x, 380, x + 160, 380, x + 140, 700, x + 20, 700), fill=(250, 250, 248))
        d.rectangle(P(x - 6, 360, x + 166, 392), fill=(70, 120, 190))
        d.rectangle(P(x + 20, 470, x + 140, 560), fill=(230, 120, 140))
    finish(img, "yoghurt.jpg", "Yoghurt 4-pack")


def veg():
    img, d = canvas((236, 242, 226), (214, 226, 200))
    shadow(img, P(200, 560, 1000, 760))
    for i in range(4):
        x = 250 + i * 90
        d.polygon(P(x, 430, x + 70, 430, x + 35, 760), fill=(236, 130, 40))
        for k in range(3):
            d.line(P(x + 20, 500 + k * 70, x + 50, 500 + k * 70), fill=(200, 100, 30), width=4 * S)
        for a in (-25, 0, 25):
            r = math.radians(a - 90)
            d.line(P(x + 35, 430, x + 35 + 80 * math.cos(r), 430 + 80 * math.sin(r)), fill=(70, 140, 50), width=10 * S)
    for i in range(3):
        y = 470 + i * 90
        d.rounded_rectangle(P(640, y, 1000, y + 70), radius=35 * S, fill=(60, 120, 50))
        d.line(P(680, y + 25, 960, y + 25), fill=(120, 170, 90), width=5 * S)
        d.rectangle(P(985, y + 22, 1015, y + 48), fill=(150, 170, 80))
    finish(img, "veg.jpg", "Carrots and courgettes")


def pasta():
    img, d = canvas((244, 236, 222), (228, 214, 190))
    shadow(img, P(240, 600, 980, 760))
    d.rounded_rectangle(P(240, 300, 600, 720), radius=16 * S, fill=(30, 80, 160))
    d.rounded_rectangle(P(280, 400, 560, 620), radius=12 * S, fill=(250, 236, 190))
    for i in range(6):
        x = 300 + i * 42
        d.rounded_rectangle(P(x, 430, x + 22, 590), radius=10 * S, fill=(232, 196, 110))
    d.rounded_rectangle(P(680, 390, 940, 720), radius=40 * S, fill=(190, 40, 30))
    d.rounded_rectangle(P(700, 340, 920, 400), radius=10 * S, fill=(220, 190, 60))
    d.rectangle(P(700, 500, 920, 620), fill=(250, 240, 220))
    d.ellipse(P(770, 520, 850, 600), fill=(210, 50, 40))
    finish(img, "pasta.jpg", "Pasta and tomato sauce")


def bananas():
    img, d = canvas((248, 240, 210), (232, 220, 176))
    shadow(img, P(260, 540, 940, 760))
    def crescent(cx, cy, r, thick, a0, a1, fill):
        pts = []
        for k in range(41):
            a = math.radians(a0 + (a1 - a0) * k / 40)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
        for k in range(40, -1, -1):
            a = math.radians(a0 + (a1 - a0) * k / 40)
            w = thick * math.sin(math.pi * k / 40) + 8
            pts.append((cx + (r - w) * math.cos(a), cy + (r - w) * math.sin(a)))
        d.polygon([(x * S, y * S) for x, y in pts], fill=fill)
    for i, c in enumerate([(232, 190, 40), (244, 206, 60), (238, 198, 50), (248, 214, 72)]):
        crescent(600, 120 + i * 45, 420, 95, 40, 140, c)
    random.seed(5)
    for _ in range(40):
        x, y = random.randint(380, 820), random.randint(430, 560)
        d.ellipse(P(x, y, x + 12, y + 9), fill=(120, 80, 30))
    finish(img, "bananas.jpg", "Bananas, a bit spotty")


def soup():
    img, d = canvas((240, 232, 222), (222, 208, 190))
    shadow(img, P(280, 480, 920, 760))
    d.chord(P(280, 300, 920, 760), 0, 180, fill=(120, 120, 128))
    d.ellipse(P(280, 420, 920, 580), fill=(150, 150, 158))
    d.ellipse(P(310, 435, 890, 565), fill=(214, 120, 50))
    d.rectangle(P(240, 470, 290, 500), fill=(90, 90, 98))
    d.rectangle(P(910, 470, 960, 500), fill=(90, 90, 98))
    finish(img, "soup.jpg", "Pumpkin soup")


def cheese():
    img, d = canvas((246, 240, 220), (230, 220, 190))
    shadow(img, P(260, 560, 940, 760))
    d.polygon(P(260, 700, 940, 700, 940, 470, 260, 600), fill=(246, 200, 70))
    d.polygon(P(260, 600, 940, 470, 860, 420, 260, 560), fill=(252, 220, 110))
    for x, y, r in [(400, 620, 30), (600, 600, 40), (800, 580, 26), (700, 650, 20)]:
        d.ellipse(P(x - r, y - r, x + r, y + r), fill=(222, 170, 50))
    finish(img, "cheese.jpg", "Gouda, half a block")


def fridge(name, label, stocked):
    img, d = canvas((226, 234, 238), (200, 212, 218))
    shadow(img, P(400, 640, 800, 800))
    d.rounded_rectangle(P(400, 160, 800, 780), radius=30 * S, fill=(240, 244, 246), outline=(160, 170, 176), width=6 * S)
    d.line(P(400, 360, 800, 360), fill=(160, 170, 176), width=6 * S)
    d.rounded_rectangle(P(740, 220, 760, 320), radius=8 * S, fill=(150, 160, 166))
    d.rounded_rectangle(P(740, 400, 760, 560), radius=8 * S, fill=(150, 160, 166))
    d.rounded_rectangle(P(440, 200, 700, 260), radius=12 * S, fill=(107, 159, 94))
    f = font(28 * S)
    d.text(P(462, 212), "SHARE ME", font=f, fill=(255, 255, 255))
    if stocked:
        for x, y, c in [(450, 420, (220, 60, 50)), (540, 430, (240, 200, 50)), (620, 415, (236, 130, 40)),
                        (460, 560, (60, 120, 50)), (560, 570, (190, 120, 60)), (650, 560, (250, 250, 248))]:
            d.rounded_rectangle(P(x, y, x + 70, y + 90), radius=14 * S, fill=c)
    finish(img, name, label)


if __name__ == "__main__":
    lasagne(); apples(); sourdough(); dal(); yoghurt(); veg(); pasta()
    bananas(); sourdough("bread-rolls.jpg", "Bread rolls", rolls=True); soup(); cheese()
    apples("pears.jpg", "Pears", colors=((170, 190, 60), (190, 200, 80), (150, 170, 50)))
    fridge("fridge-parish-hall.jpg", "Community fridge", True)
    fridge("fridge-student-cafe.jpg", "Community fridge", False)
