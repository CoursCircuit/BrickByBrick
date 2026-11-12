"""Crop the word bricks and package the score frames for the app using Pillow."""

from pathlib import Path
import sys

from PIL import Image

source = Path(sys.argv[1])
assets = Path(__file__).resolve().parents[1] / "assets"

for team in ("jade", "ambre"):
    word = Image.open(source / f"word-{team}.png").convert("RGBA")
    word.crop(word.getbbox()).save(assets / f"word-{team}.webp", quality=90, method=6)
    width, height = Image.open(source / f"wall-{team}-00.png").size
    atlas = Image.new("RGBA", (4 * width, 4 * height))
    for score in range(13):
        frame = Image.open(source / f"wall-{team}-{score:02}.png").convert("RGBA")
        atlas.paste(frame, ((score % 4) * width, (score // 4) * height))
    atlas.save(assets / "walls" / f"{team}.webp", quality=89, method=6)
