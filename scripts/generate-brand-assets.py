#!/usr/bin/env python3
"""Generate deterministic atajo icon and social assets.

Requires Pillow. The generated files are committed, so this script is not part
of the application runtime or deployment build.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"

WARM_WHITE = (250, 249, 246)
WHITE = (255, 255, 255)
INK = (21, 21, 21)
MUTED_INK = (94, 91, 99)
BLUE = (39, 93, 255)
CORAL = (255, 107, 74)

LEFT_MARK = [
    (6, 58),
    (27.6, 9.9),
    (30.5, 6),
    (44.3, 6),
    (50.1, 10.2),
    (54.2, 23),
    (35, 33.3),
    (25.7, 55.6),
    (22, 58),
]
RIGHT_MARK = [(35, 33.3), (54.2, 22.9), (74, 58), (58, 58), (52.7, 54.8)]

FONT_REGULAR = Path("/System/Library/Fonts/HelveticaNeue.ttc")
FONT_BOLD = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
FONT_MONO = Path("/System/Library/Fonts/Menlo.ttc")


def font(path: Path, size: int, fallback: Path = FONT_REGULAR) -> ImageFont.FreeTypeFont:
    selected = path if path.exists() else fallback
    return ImageFont.truetype(str(selected), size=size)


def scaled(points: list[tuple[float, float]], x: float, y: float, scale: float):
    return [(x + px * scale, y + py * scale) for px, py in points]


def draw_mark(
    draw: ImageDraw.ImageDraw,
    x: float,
    y: float,
    width: float,
    left: tuple[int, int, int] = BLUE,
    right: tuple[int, int, int] = INK,
) -> None:
    scale = width / 80
    draw.polygon(scaled(LEFT_MARK, x, y, scale), fill=left)
    draw.polygon(scaled(RIGHT_MARK, x, y, scale), fill=right)


def icon_canvas(mark_ratio: float = 0.72) -> Image.Image:
    size = 1024
    image = Image.new("RGB", (size, size), WARM_WHITE)
    draw = ImageDraw.Draw(image)
    mark_width = size * mark_ratio
    mark_height = mark_width * 64 / 80
    draw_mark(draw, (size - mark_width) / 2, (size - mark_height) / 2, mark_width)
    return image


def write_icons() -> None:
    icon = icon_canvas()
    maskable = icon_canvas(mark_ratio=0.64)
    resample = Image.Resampling.LANCZOS

    for name, size in [
        ("apple-touch-icon.png", 180),
        ("icon-192.png", 192),
        ("icon-512.png", 512),
        ("logo192.png", 192),
        ("logo512.png", 512),
    ]:
        icon.resize((size, size), resample).save(PUBLIC / name, optimize=True)

    maskable.resize((512, 512), resample).save(
        PUBLIC / "icon-maskable-512.png", optimize=True
    )

    icon.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64)],
    )


def radial(x: float, y: float, cx: float, cy: float, radius: float) -> float:
    distance = math.hypot(x - cx, y - cy)
    return max(0.0, 1.0 - distance / radius) ** 1.7


def add_dither_field(image: Image.Image) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    bayer = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
    blobs = (
        (900, 215, 410, BLUE),
        (1080, 420, 380, CORAL),
        (785, 585, 310, BLUE),
        (1160, 70, 250, CORAL),
    )

    for row, y in enumerate(range(0, image.height, 6)):
        for column, x in enumerate(range(0, image.width, 6)):
            weights = [radial(x, y, cx, cy, radius) for cx, cy, radius, _ in blobs]
            strength = max(weights)
            threshold = (bayer[row % 4][column % 4] + 0.5) / 16
            if strength <= threshold * 0.82 or x < 520:
                continue
            total = sum(weights) or 1
            color = tuple(
                int(sum(weight * blob[3][channel] for weight, blob in zip(weights, blobs)) / total)
                for channel in range(3)
            )
            radius = 0.7 + strength * 1.45
            draw.ellipse(
                (x - radius, y - radius, x + radius, y + radius),
                fill=(*color, int(55 + strength * 155)),
            )


def write_og_image() -> None:
    image = Image.new("RGB", (1200, 630), WARM_WHITE)

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((650, -180, 1320, 490), fill=(*BLUE, 74))
    glow_draw.ellipse((760, 200, 1350, 810), fill=(*CORAL, 62))
    glow_draw.ellipse((560, 390, 1010, 820), fill=(*BLUE, 48))
    glow_draw.ellipse((1000, -170, 1380, 250), fill=(*CORAL, 58))
    glow = glow.filter(ImageFilter.GaussianBlur(100))
    image = Image.alpha_composite(image.convert("RGBA"), glow).convert("RGB")
    add_dither_field(image)

    draw = ImageDraw.Draw(image)
    draw.rectangle((48, 48, 1152, 582), outline=(221, 218, 211), width=1)
    draw.line((48, 112, 1152, 112), fill=(221, 218, 211), width=1)
    draw.text(
        (76, 72),
        "DAVOSDO / LINK INFRASTRUCTURE",
        fill=MUTED_INK,
        font=font(FONT_MONO, 15),
    )
    draw.text((1032, 72), "01—06", fill=MUTED_INK, font=font(FONT_MONO, 15))

    draw_mark(draw, 88, 188, 138)
    draw.text((226, 172), "atajo", fill=INK, font=font(FONT_REGULAR, 104))
    draw.text((232, 283), "by davosdo", fill=MUTED_INK, font=font(FONT_BOLD, 22))

    draw.text((88, 380), "La ruta corta.", fill=INK, font=font(FONT_BOLD, 46))
    draw.text(
        (89, 441),
        "Enlaces breves. Señales claras.",
        fill=MUTED_INK,
        font=font(FONT_REGULAR, 25),
    )
    draw.text(
        (88, 535),
        "links.davosdo.dev",
        fill=BLUE,
        font=font(FONT_MONO, 17),
    )
    image.save(PUBLIC / "og-image.png", optimize=True)


if __name__ == "__main__":
    write_icons()
    write_og_image()
    print("Generated atajo brand assets in public/")
