#!/usr/bin/env python3
"""Compose pixel-art pick variants into a single contact sheet for review."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path.home() / "projects/youtrip-trippie-chomp/generated/picks-v2"
OUT = Path.home() / "Downloads/chomp-pixel-picks.png"

FAMILIES = [
    ("Scoreboard frame", "scoreboard-v"),
    ("Trippie victory", "trippie-victory-v"),
    ("World map", "worldmap-v"),
]
N_PER = 4
TILE = 320
PAD = 14
LABEL_H = 28
HEADER_H = 36
BG = (12, 8, 28)
FG = (240, 230, 255)
ACCENT = (255, 62, 200)


def load_font(size: int):
    for path in [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def fit(img: Image.Image, size: int) -> Image.Image:
    img = img.convert("RGBA")
    img.thumbnail((size, size), Image.NEAREST)
    canvas = Image.new("RGBA", (size, size), (24, 16, 48, 255))
    canvas.paste(img, ((size - img.width) // 2, (size - img.height) // 2), img)
    return canvas


def main():
    cols = N_PER
    rows = len(FAMILIES)
    w = PAD + cols * (TILE + PAD)
    h = PAD + rows * (HEADER_H + TILE + LABEL_H + PAD)
    sheet = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(sheet)
    f_label = load_font(16)
    f_header = load_font(20)

    y = PAD
    for fam_label, prefix in FAMILIES:
        draw.text((PAD, y), fam_label.upper(), fill=ACCENT, font=f_header)
        y += HEADER_H
        for i in range(1, N_PER + 1):
            p = ROOT / f"{prefix}{i}.png"
            x = PAD + (i - 1) * (TILE + PAD)
            if p.exists():
                tile = fit(Image.open(p), TILE)
                sheet.paste(tile, (x, y), tile)
                draw.text((x + 4, y + TILE + 4), f"v{i}", fill=FG, font=f_label)
            else:
                draw.rectangle([x, y, x + TILE, y + TILE], outline=(80, 60, 120), width=2)
                draw.text((x + 8, y + TILE // 2), f"v{i} missing", fill=(180, 120, 180), font=f_label)
        y += TILE + LABEL_H + PAD

    sheet.save(OUT)
    print(f"Saved: {OUT}")


if __name__ == "__main__":
    main()
