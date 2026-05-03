"""
Post-process generated raw assets to spec dimensions.

Backgrounds: 1024x1024 PNG (Gemini square output) → 480x720 WebP (2:3 portrait)
  Strategy: extend top with sampled sky color to reach 2:3, then resize.

Share images: 1024x1024 PNG (Gemini square output) → 1080x1920 PNG (9:16 IG Story)
  Strategy: resize to 1080x1080, composite onto 1080x1920 dark navy canvas centered.
"""

from PIL import Image
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
GENERATED = REPO / "generated"
ASSETS = REPO / "public" / "assets"

DESTINATIONS = ["sg-airport", "jp-tokyo", "th-bangkok", "lounge", "kr-seoul", "my-kl", "au-sydney", "space"]

# Per-destination dark navy fallback for the IG Story padding (matches the bg sky tone).
SHARE_BG_COLOR = {
    "sg-airport": (12, 14, 32),
    "jp-tokyo":   (24, 18, 48),
    "th-bangkok": (32, 22, 36),
    "lounge":     (32, 22, 12),
    "kr-seoul":   (16, 14, 40),
    "my-kl":      (12, 28, 36),
    "au-sydney":  (10, 16, 36),
    "space":      (4, 4, 16),
}


def sample_top_color(im: Image.Image) -> tuple[int, int, int]:
    """Average the top 8 pixel rows to get a representative sky color."""
    top = im.crop((0, 0, im.width, 8))
    px = list(top.getdata())
    n = len(px)
    r = sum(p[0] for p in px) // n
    g = sum(p[1] for p in px) // n
    b = sum(p[2] for p in px) // n
    return (r, g, b)


def process_bg(name: str) -> None:
    src = GENERATED / f"raw-bg-{name}.png"
    if not src.exists():
        print(f"  SKIP bg-{name}: source missing")
        return
    im = Image.open(src).convert("RGB")

    if name == "space":
        # Space bg: scale up to fill 480×720 fully, center-crop horizontally.
        # 1024×1024 → scale to 720 height = 720×720 → crop center to 480×720.
        scaled = im.resize((720, 720), Image.LANCZOS)
        left = (720 - 480) // 2
        final = scaled.crop((left, 0, left + 480, 720))
    else:
        sky = sample_top_color(im)
        pad = im.height // 2
        canvas = Image.new("RGB", (im.width, im.height + pad), sky)
        canvas.paste(im, (0, pad))
        final = canvas.resize((480, 720), Image.LANCZOS)

    out = ASSETS / f"bg-{name}.webp"
    final.save(out, "WEBP", quality=85, method=6)
    print(f"  wrote {out.relative_to(REPO)} ({out.stat().st_size // 1024} KB)")


def process_share(name: str) -> None:
    src = GENERATED / f"raw-share-{name}.png"
    if not src.exists():
        print(f"  SKIP share-{name}: source missing")
        return
    im = Image.open(src).convert("RGB")

    # Resize hero to 1080x1080 first.
    hero = im.resize((1080, 1080), Image.LANCZOS)

    # 1080x1920 IG Story canvas, dark navy fill matching destination sky tone.
    canvas = Image.new("RGB", (1080, 1920), SHARE_BG_COLOR.get(name, (24, 22, 56)))
    # Centre vertically: (1920 - 1080) / 2 = 420
    canvas.paste(hero, (0, 420))

    out = ASSETS / f"share-{name}.png"
    canvas.save(out, "PNG", optimize=True)
    print(f"  wrote {out.relative_to(REPO)} ({out.stat().st_size // 1024} KB)")


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    print("Backgrounds:")
    for d in DESTINATIONS:
        process_bg(d)
    print("Share images:")
    for d in DESTINATIONS:
        process_share(d)


if __name__ == "__main__":
    main()
