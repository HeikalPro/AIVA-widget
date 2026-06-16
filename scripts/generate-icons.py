"""Generate high-contrast app icons for dark Windows desktops."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SRC_ASSETS = ROOT / "src" / "assets"

BRAND_BLUE = (0, 87, 168)  # #0057A8
LIGHT_BG_TOP = (248, 251, 255)
LIGHT_BG_BOTTOM = (255, 255, 255)


def rounded_rect_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def detect_icon_crop(source: Image.Image) -> tuple[int, int, int, int]:
    """Return bounds for the speech-bubble mark (exclude the wordmark below)."""
    rgba = source.convert("RGBA")
    alpha = rgba.getchannel("A")
    width, height = rgba.size
    pixels = alpha.load()

    blocks: list[tuple[int, int]] = []
    block_start: int | None = None
    for y in range(height):
        row_has_pixels = any(pixels[x, y] > 20 for x in range(width))
        if row_has_pixels and block_start is None:
            block_start = y
        elif not row_has_pixels and block_start is not None:
            blocks.append((block_start, y))
            block_start = None
    if block_start is not None:
        blocks.append((block_start, height))

    if not blocks:
        return (0, 0, width, height)

    icon_top, icon_bottom = blocks[0]
    icon_alpha = alpha.crop((0, icon_top, width, icon_bottom))
    bbox = icon_alpha.getbbox()
    if not bbox:
        return (0, icon_top, width, icon_bottom)

    left, top, right, bottom = bbox
    pad = 6
    return (
        max(0, left - pad),
        max(0, icon_top + top - pad),
        min(width, right + pad),
        min(height, icon_top + bottom + pad),
    )


def recolor_foreground(image: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    r, g, b = color
    for y in range(rgba.height):
        for x in range(rgba.width):
            _, _, _, alpha = pixels[x, y]
            if alpha > 24:
                pixels[x, y] = (r, g, b, alpha)
    return rgba


def make_gradient_background(size: int, radius: int) -> Image.Image:
    gradient = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(gradient)
    for y in range(size):
        t = y / max(size - 1, 1)
        r = int(LIGHT_BG_TOP[0] + (LIGHT_BG_BOTTOM[0] - LIGHT_BG_TOP[0]) * t)
        g = int(LIGHT_BG_TOP[1] + (LIGHT_BG_BOTTOM[1] - LIGHT_BG_TOP[1]) * t)
        b = int(LIGHT_BG_TOP[2] + (LIGHT_BG_BOTTOM[2] - LIGHT_BG_TOP[2]) * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b, 255))

    mask = rounded_rect_mask(size, radius)
    background = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    background.paste(gradient, mask=mask)
    return background


def make_electron_icon(source: Image.Image, size: int = 512) -> Image.Image:
    radius = int(size * 0.22)
    canvas = make_gradient_background(size, radius)

    icon = source.crop(detect_icon_crop(source))
    icon = recolor_foreground(icon, BRAND_BLUE)

    max_icon = int(size * 0.58)
    icon.thumbnail((max_icon, max_icon), Image.Resampling.LANCZOS)

    x = (size - icon.width) // 2
    y = (size - icon.height) // 2
    canvas.alpha_composite(icon, (x, y))

    border = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.rounded_rectangle(
        (1, 1, size - 2, size - 2),
        radius=radius,
        outline=(*BRAND_BLUE, 36),
        width=max(2, size // 128),
    )
    canvas = Image.alpha_composite(canvas, border)
    return canvas


def make_brand_logo(source: Image.Image, size: int = 500) -> Image.Image:
    logo = recolor_foreground(source, BRAND_BLUE)
    logo = logo.resize((size, size), Image.Resampling.LANCZOS)
    return logo


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)
    print(f"wrote {path}")


def main() -> None:
    source_path = PUBLIC / "GoChat247_blue_transparent.png"
    source = Image.open(source_path).convert("RGBA")
    crop = detect_icon_crop(source)
    print(f"icon crop: {crop}")

    electron_icon = make_electron_icon(source)
    brand_logo = make_brand_logo(source)

    targets_electron = [
        PUBLIC / "electron-icon.png",
        SRC_ASSETS / "electron-icon.png",
        ROOT / "dist" / "electron-icon.png",
    ]
    targets_brand = [
        PUBLIC / "GoChat247_blue_transparent.png",
        ROOT / "dist" / "GoChat247_blue_transparent.png",
    ]

    for path in targets_electron:
        save_png(electron_icon, path)

    for path in targets_brand:
        save_png(brand_logo, path)


if __name__ == "__main__":
    main()
