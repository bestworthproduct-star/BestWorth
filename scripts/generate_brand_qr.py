"""Generate Bestworth's branded, scan-safe website QR assets."""

from __future__ import annotations

import argparse
import base64
import html
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.graphics.barcode.qr import QrCodeWidget


BRAND_BLUE = "#060273"
BRAND_RED = "#F20D0D"
WHITE = "#FFFFFF"
INK = "#12122B"
DEFAULT_URL = "https://bestworthproductsltd.ng"
CANVAS_SIZE = 1800
MODULE_SIZE = 36
QUIET_ZONE = 4


def hex_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def qr_matrix(value: str) -> list[list[bool]]:
    widget = QrCodeWidget(value, barLevel="H")
    widget.qr.make()
    return [[bool(cell) for cell in row] for row in widget.qr.modules]


def finder_origins(module_count: int) -> tuple[tuple[int, int], ...]:
    return ((0, 0), (module_count - 7, 0), (0, module_count - 7))


def is_finder_module(row: int, column: int, module_count: int) -> bool:
    return any(
        origin_x <= column < origin_x + 7 and origin_y <= row < origin_y + 7
        for origin_x, origin_y in finder_origins(module_count)
    )


def load_logo(path: Path, target_size: int = 190) -> Image.Image:
    logo = Image.open(path).convert("RGBA")
    alpha_bounds = logo.getchannel("A").getbbox()
    if alpha_bounds:
        logo = logo.crop(alpha_bounds)
    logo.thumbnail((target_size, target_size), Image.Resampling.LANCZOS)
    return logo


def draw_finder(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    blue = hex_rgb(BRAND_BLUE)
    draw.rounded_rectangle((x, y, x + 7 * size, y + 7 * size), radius=size * 1.35, fill=blue)
    draw.rounded_rectangle(
        (x + size, y + size, x + 6 * size, y + 6 * size),
        radius=size,
        fill=WHITE,
    )
    draw.ellipse(
        (x + 2 * size, y + 2 * size, x + 5 * size, y + 5 * size),
        fill=blue,
    )


def render_square(matrix: list[list[bool]], logo: Image.Image) -> Image.Image:
    module_count = len(matrix)
    qr_extent = (module_count + QUIET_ZONE * 2) * MODULE_SIZE
    quiet_origin = (CANVAS_SIZE - qr_extent) // 2
    code_origin = quiet_origin + QUIET_ZONE * MODULE_SIZE

    canvas = Image.new("RGB", (CANVAS_SIZE, CANVAS_SIZE), WHITE)
    draw = ImageDraw.Draw(canvas)

    draw.rounded_rectangle(
        (52, 52, CANVAS_SIZE - 52, CANVAS_SIZE - 52),
        radius=70,
        outline=hex_rgb(BRAND_BLUE),
        width=8,
    )
    draw.line((122, 52, 360, 52), fill=hex_rgb(BRAND_RED), width=14)
    draw.line((CANVAS_SIZE - 52, CANVAS_SIZE - 360, CANVAS_SIZE - 52, CANVAS_SIZE - 122), fill=hex_rgb(BRAND_RED), width=14)

    dot_size = int(MODULE_SIZE * 0.84)
    inset = (MODULE_SIZE - dot_size) // 2
    for row, values in enumerate(matrix):
        for column, dark in enumerate(values):
            if not dark or is_finder_module(row, column, module_count):
                continue
            x = code_origin + column * MODULE_SIZE + inset
            y = code_origin + row * MODULE_SIZE + inset
            draw.rounded_rectangle(
                (x, y, x + dot_size, y + dot_size),
                radius=max(dot_size // 4, 2),
                fill=hex_rgb(BRAND_BLUE),
            )

    for finder_x, finder_y in finder_origins(module_count):
        draw_finder(
            draw,
            code_origin + finder_x * MODULE_SIZE,
            code_origin + finder_y * MODULE_SIZE,
            MODULE_SIZE,
        )

    badge_size = int(MODULE_SIZE * 7.2)
    badge_left = (CANVAS_SIZE - badge_size) // 2
    badge_top = (CANVAS_SIZE - badge_size) // 2

    shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    shadow_draw.rounded_rectangle(
        (badge_left + 8, badge_top + 12, badge_left + badge_size + 8, badge_top + badge_size + 12),
        radius=48,
        fill=(6, 2, 115, 52),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(14))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow_layer)

    badge_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    badge_draw = ImageDraw.Draw(badge_layer)
    badge_draw.rounded_rectangle(
        (badge_left, badge_top, badge_left + badge_size, badge_top + badge_size),
        radius=48,
        fill=WHITE,
        outline=hex_rgb(BRAND_RED),
        width=8,
    )
    logo_x = (CANVAS_SIZE - logo.width) // 2
    logo_y = (CANVAS_SIZE - logo.height) // 2
    badge_layer.alpha_composite(logo, (logo_x, logo_y))
    return Image.alpha_composite(canvas, badge_layer).convert("RGB")


def svg_logo_data(logo: Image.Image) -> str:
    buffer = BytesIO()
    logo.save(buffer, format="PNG", optimize=True)
    return base64.b64encode(buffer.getvalue()).decode("ascii")


def render_svg(matrix: list[list[bool]], logo: Image.Image, value: str) -> str:
    module_count = len(matrix)
    qr_extent = (module_count + QUIET_ZONE * 2) * MODULE_SIZE
    quiet_origin = (CANVAS_SIZE - qr_extent) // 2
    code_origin = quiet_origin + QUIET_ZONE * MODULE_SIZE
    dot_size = int(MODULE_SIZE * 0.84)
    inset = (MODULE_SIZE - dot_size) // 2
    badge_size = int(MODULE_SIZE * 7.2)
    badge_left = (CANVAS_SIZE - badge_size) // 2
    badge_top = (CANVAS_SIZE - badge_size) // 2
    logo_x = (CANVAS_SIZE - logo.width) // 2
    logo_y = (CANVAS_SIZE - logo.height) // 2
    elements: list[str] = []

    for row, values in enumerate(matrix):
        for column, dark in enumerate(values):
            if not dark or is_finder_module(row, column, module_count):
                continue
            x = code_origin + column * MODULE_SIZE + inset
            y = code_origin + row * MODULE_SIZE + inset
            elements.append(
                f'<rect x="{x}" y="{y}" width="{dot_size}" height="{dot_size}" rx="{dot_size // 4}" fill="{BRAND_BLUE}"/>'
            )

    for finder_x, finder_y in finder_origins(module_count):
        x = code_origin + finder_x * MODULE_SIZE
        y = code_origin + finder_y * MODULE_SIZE
        elements.extend([
            f'<rect x="{x}" y="{y}" width="{7 * MODULE_SIZE}" height="{7 * MODULE_SIZE}" rx="{int(MODULE_SIZE * 1.35)}" fill="{BRAND_BLUE}"/>',
            f'<rect x="{x + MODULE_SIZE}" y="{y + MODULE_SIZE}" width="{5 * MODULE_SIZE}" height="{5 * MODULE_SIZE}" rx="{MODULE_SIZE}" fill="{WHITE}"/>',
            f'<circle cx="{x + 3.5 * MODULE_SIZE}" cy="{y + 3.5 * MODULE_SIZE}" r="{1.5 * MODULE_SIZE}" fill="{BRAND_BLUE}"/>',
        ])

    encoded_logo = svg_logo_data(logo)
    title = html.escape(f"Bestworth Products Limited QR code: {value}")
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{CANVAS_SIZE}" height="{CANVAS_SIZE}" viewBox="0 0 {CANVAS_SIZE} {CANVAS_SIZE}" role="img" aria-label="{title}">
  <title>{title}</title>
  <defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="8" dy="12" stdDeviation="14" flood-color="{BRAND_BLUE}" flood-opacity="0.2"/></filter></defs>
  <rect width="{CANVAS_SIZE}" height="{CANVAS_SIZE}" fill="{WHITE}"/>
  <rect x="52" y="52" width="{CANVAS_SIZE - 104}" height="{CANVAS_SIZE - 104}" rx="70" fill="none" stroke="{BRAND_BLUE}" stroke-width="8"/>
  <path d="M122 52H360 M{CANVAS_SIZE - 52} {CANVAS_SIZE - 360}V{CANVAS_SIZE - 122}" stroke="{BRAND_RED}" stroke-width="14"/>
  {''.join(elements)}
  <rect x="{badge_left}" y="{badge_top}" width="{badge_size}" height="{badge_size}" rx="48" fill="{WHITE}" stroke="{BRAND_RED}" stroke-width="8" filter="url(#shadow)"/>
  <image x="{logo_x}" y="{logo_y}" width="{logo.width}" height="{logo.height}" xlink:href="data:image/png;base64,{encoded_logo}"/>
</svg>
'''


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        Path("C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf"),
        Path("C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def render_print_card(square: Image.Image, logo: Image.Image, value: str) -> Image.Image:
    width, height = 1800, 2260
    card = Image.new("RGB", (width, height), WHITE)
    draw = ImageDraw.Draw(card)
    draw.rectangle((0, 0, width, 20), fill=hex_rgb(BRAND_RED))
    draw.rounded_rectangle((70, 70, width - 70, height - 70), radius=54, outline=hex_rgb(BRAND_BLUE), width=6)

    header_logo = logo.copy()
    header_logo.thumbnail((115, 115), Image.Resampling.LANCZOS)
    card.paste(header_logo, ((width - header_logo.width) // 2, 115), header_logo)

    title_font = font(62, bold=True)
    subtitle_font = font(25, bold=True)
    url_font = font(28)
    title = "BESTWORTH PRODUCTS LIMITED"
    subtitle = "SCAN TO VISIT OUR WEBSITE"
    title_box = draw.textbbox((0, 0), title, font=title_font)
    subtitle_box = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    draw.text(((width - (title_box[2] - title_box[0])) / 2, 252), title, fill=hex_rgb(BRAND_BLUE), font=title_font)
    draw.text(((width - (subtitle_box[2] - subtitle_box[0])) / 2, 337), subtitle, fill=hex_rgb(BRAND_RED), font=subtitle_font)

    qr = square.resize((1540, 1540), Image.Resampling.LANCZOS)
    card.paste(qr, (130, 405))

    display_url = value.removeprefix("https://").rstrip("/")
    url_box = draw.textbbox((0, 0), display_url, font=url_font)
    draw.text(((width - (url_box[2] - url_box[0])) / 2, 2040), display_url, fill=hex_rgb(INK), font=url_font)
    draw.rounded_rectangle((650, 2122, 1150, 2134), radius=6, fill=hex_rgb(BRAND_RED))
    return card


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default=DEFAULT_URL, help="Destination encoded in the QR code")
    parser.add_argument(
        "--logo",
        type=Path,
        default=Path("app/public/assets/Favicon Logo.png"),
        help="Transparent Bestworth logo mark",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("app/public/assets/qr"),
        help="Directory for generated assets",
    )
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    matrix = qr_matrix(args.url)
    logo = load_logo(args.logo)
    square = render_square(matrix, logo)
    square.save(args.output_dir / "bestworth-website-qr.png", format="PNG", dpi=(300, 300), optimize=True)
    (args.output_dir / "bestworth-website-qr.svg").write_text(
        render_svg(matrix, logo, args.url), encoding="utf-8"
    )
    print_card = render_print_card(square, logo, args.url)
    print_card.save(args.output_dir / "bestworth-website-qr-print.png", format="PNG", dpi=(300, 300), optimize=True)

    print(f"Encoded: {args.url}")
    print(f"QR matrix: {len(matrix)} x {len(matrix)} modules, error correction H")
    print(f"Created: {args.output_dir.resolve()}")


if __name__ == "__main__":
    main()
