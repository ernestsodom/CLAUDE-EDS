#!/usr/bin/env python3
"""
Professional 13-slide PDF presentation for a padel court sales company.
Chilean company based in Alicante, Spain — European expansion plan 2026-2028.
"""

import os
import io
import math
import random
import img2pdf
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ── Dimensions ──────────────────────────────────────────────────────────────
W, H = 1920, 1080

# ── Color palette ────────────────────────────────────────────────────────────
BG_DARK = (8, 12, 20)
BG_MID  = (14, 20, 35)
GREEN   = (0, 220, 130)
GOLD    = (255, 200, 0)
WHITE   = (255, 255, 255)
LIGHT   = (180, 190, 210)
MUTED   = (100, 110, 130)
CARD    = (20, 28, 45)
RED     = (220, 60, 60)
BLUE    = (60, 130, 220)

# ── Font paths ───────────────────────────────────────────────────────────────
FONT_BOLD    = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
FONT_REG     = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
FONT_BOLDITA = "/usr/share/fonts/truetype/liberation/LiberationSans-BoldItalic.ttf"

def load_font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()

# ── Helper: draw_text ────────────────────────────────────────────────────────
def draw_text(draw, x, y, text, font, color, anchor='la'):
    draw.text((x, y), text, font=font, fill=color, anchor=anchor)

# ── Helper: rounded_rect ─────────────────────────────────────────────────────
def rounded_rect(img, x0, y0, x1, y1, radius, fill, outline=None, outline_width=3):
    draw = ImageDraw.Draw(img)
    r = min(radius, (x1 - x0) // 2, (y1 - y0) // 2)
    # Main body
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    # Corners
    draw.ellipse([x0, y0, x0 + 2*r, y0 + 2*r], fill=fill)
    draw.ellipse([x1 - 2*r, y0, x1, y0 + 2*r], fill=fill)
    draw.ellipse([x0, y1 - 2*r, x0 + 2*r, y1], fill=fill)
    draw.ellipse([x1 - 2*r, y1 - 2*r, x1, y1], fill=fill)
    if outline:
        draw.arc([x0, y0, x0 + 2*r, y0 + 2*r], 180, 270, fill=outline, width=outline_width)
        draw.arc([x1 - 2*r, y0, x1, y0 + 2*r], 270, 0, fill=outline, width=outline_width)
        draw.arc([x0, y1 - 2*r, x0 + 2*r, y1], 90, 180, fill=outline, width=outline_width)
        draw.arc([x1 - 2*r, y1 - 2*r, x1, y1], 0, 90, fill=outline, width=outline_width)
        draw.line([x0 + r, y0, x1 - r, y0], fill=outline, width=outline_width)
        draw.line([x0 + r, y1, x1 - r, y1], fill=outline, width=outline_width)
        draw.line([x0, y0 + r, x0, y1 - r], fill=outline, width=outline_width)
        draw.line([x1, y0 + r, x1, y1 - r], fill=outline, width=outline_width)

# ── Helper: progress_bar ─────────────────────────────────────────────────────
def progress_bar(draw, x, y, w, h, pct, color, label="", font=None):
    # Track
    draw.rectangle([x, y, x + w, y + h], fill=(30, 40, 60))
    # Fill
    fill_w = int(w * pct / 100)
    if fill_w > 0:
        draw.rectangle([x, y, x + fill_w, y + h], fill=color)
    # Label
    if label and font:
        draw.text((x + w + 14, y + h // 2), label, font=font, fill=LIGHT, anchor='lm')

# ── Helper: horiz_bar (vertical bar chart) ────────────────────────────────────
def horiz_bar(img, x, y, w, h, items, max_val):
    """Vertical bar chart: items = list of (label, value, color)."""
    draw = ImageDraw.Draw(img)
    n = len(items)
    if n == 0:
        return
    gap = 18
    bar_w = (w - gap * (n - 1)) // n
    font_sm = load_font(FONT_BOLD, 20)
    font_val = load_font(FONT_BOLD, 24)
    for i, (label, val, color) in enumerate(items):
        bx = x + i * (bar_w + gap)
        bar_h = int(h * val / max_val)
        by = y + h - bar_h
        # Bar shadow
        draw.rectangle([bx + 4, by + 4, bx + bar_w + 4, y + h + 4], fill=(0, 0, 0, 80))
        # Bar
        draw.rectangle([bx, by, bx + bar_w, y + h], fill=color)
        # Highlight top strip
        draw.rectangle([bx, by, bx + bar_w, by + 5], fill=tuple(min(255, c + 60) for c in color))
        # Value above bar
        val_str = f"{val:,}".replace(',', '.')
        draw.text((bx + bar_w // 2, by - 10), val_str, font=font_val, fill=WHITE, anchor='mb')
        # Label below
        words = label.split()
        line1 = words[0] if words else label
        line2 = ' '.join(words[1:]) if len(words) > 1 else ''
        draw.text((bx + bar_w // 2, y + h + 16), line1, font=font_sm, fill=LIGHT, anchor='mt')
        if line2:
            draw.text((bx + bar_w // 2, y + h + 38), line2, font=font_sm, fill=MUTED, anchor='mt')

# ── Helper: dark_bg ───────────────────────────────────────────────────────────
def dark_bg(W, H, color1=BG_DARK, color2=BG_MID):
    """Gradient background + subtle dot grid + noise."""
    img = Image.new('RGB', (W, H), color1)
    draw = ImageDraw.Draw(img)
    # Gradient top-to-bottom
    for row in range(H):
        t = row / H
        r = int(color1[0] + (color2[0] - color1[0]) * t)
        g = int(color1[1] + (color2[1] - color1[1]) * t)
        b = int(color1[2] + (color2[2] - color1[2]) * t)
        draw.line([(0, row), (W, row)], fill=(r, g, b))
    # Subtle dot grid
    rng = random.Random(42)
    for gx in range(0, W, 60):
        for gy in range(0, H, 60):
            alpha = rng.randint(8, 22)
            draw.ellipse([gx - 1, gy - 1, gx + 1, gy + 1], fill=(alpha, alpha + 5, alpha + 15))
    # Light noise overlay
    noise = Image.new('RGB', (W, H))
    npix = noise.load()
    for nx in range(0, W, 4):
        for ny in range(0, H, 4):
            v = rng.randint(0, 12)
            npix[nx, ny] = (v, v, v)
    img = Image.blend(img, noise, 0.04)
    return img

# ── Helper: court_bg ─────────────────────────────────────────────────────────
def court_bg(W, H):
    """Top-down padel court with perspective, grass, lines, net, vignette."""
    img = Image.new('RGB', (W, H), (5, 10, 18))
    draw = ImageDraw.Draw(img)
    rng = random.Random(7)

    # Court trapezoid: wider at bottom (perspective)
    cx = W // 2
    top_w, bot_w = 900, 1400
    top_y, bot_y = 60, H - 60
    top_l, top_r = cx - top_w // 2, cx + top_w // 2
    bot_l, bot_r = cx - bot_w // 2, cx + bot_w // 2
    court_poly = [(top_l, top_y), (top_r, top_y), (bot_r, bot_y), (bot_l, bot_y)]

    # Fill court with artificial grass green noise
    court_mask = Image.new('L', (W, H), 0)
    court_mask_draw = ImageDraw.Draw(court_mask)
    court_mask_draw.polygon(court_poly, fill=255)

    grass = Image.new('RGB', (W, H), (18, 90, 38))
    gpix = grass.load()
    for gx in range(W):
        for gy in range(H):
            noise_v = rng.randint(-14, 14)
            base_g = 85 + int(20 * (gy / H))
            gpix[gx, gy] = (
                max(0, min(255, 14 + noise_v // 2)),
                max(0, min(255, base_g + noise_v)),
                max(0, min(255, 32 + noise_v // 3))
            )

    img = Image.composite(grass, img, court_mask)
    draw = ImageDraw.Draw(img)

    # Court boundary lines (white)
    lw = 5
    draw.polygon(court_poly, outline=(220, 230, 220), fill=None)
    draw.line([(top_l, top_y), (top_r, top_y)], fill=WHITE, width=lw)
    draw.line([(top_r, top_y), (bot_r, bot_y)], fill=WHITE, width=lw)
    draw.line([(bot_r, bot_y), (bot_l, bot_y)], fill=WHITE, width=lw)
    draw.line([(bot_l, bot_y), (top_l, top_y)], fill=WHITE, width=lw)

    # Center line (horizontal)
    mid_y = (top_y + bot_y) // 2
    mid_l = top_l + (bot_l - top_l) * (mid_y - top_y) // (bot_y - top_y)
    mid_r = top_r + (bot_r - top_r) * (mid_y - top_y) // (bot_y - top_y)
    draw.line([(mid_l, mid_y), (mid_r, mid_y)], fill=WHITE, width=lw)

    # Net (thicker line at center)
    draw.line([(mid_l, mid_y), (mid_r, mid_y)], fill=(230, 230, 230), width=10)
    # Net posts
    draw.rectangle([mid_l - 8, mid_y - 18, mid_l + 8, mid_y + 18], fill=(180, 180, 180))
    draw.rectangle([mid_r - 8, mid_y - 18, mid_r + 8, mid_y + 18], fill=(180, 180, 180))

    # Service boxes: vertical center line top half + bottom half
    # Top half vertical center
    top_cx_top = (top_l + top_r) // 2
    top_cx_mid = (mid_l + mid_r) // 2
    draw.line([(top_cx_top, top_y), (top_cx_mid, mid_y)], fill=WHITE, width=lw)
    # Bottom half vertical center
    draw.line([(top_cx_mid, mid_y), (cx, bot_y)], fill=WHITE, width=lw)

    # Service lines (at 1/3 and 2/3 of each half)
    def interp_x(y_val):
        t = (y_val - top_y) / (bot_y - top_y)
        lx = top_l + (bot_l - top_l) * t
        rx = top_r + (bot_r - top_r) * t
        return int(lx), int(rx)

    sv1_y = top_y + (mid_y - top_y) * 2 // 3
    sv2_y = mid_y + (bot_y - mid_y) // 3
    for sy in [sv1_y, sv2_y]:
        slx, srx = interp_x(sy)
        draw.line([(slx, sy), (srx, sy)], fill=WHITE, width=lw - 1)

    # Radial vignette
    vig = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    vdraw = ImageDraw.Draw(vig)
    steps = 32
    max_margin = min(W, H) // 2 - 2
    for step in range(steps):
        t = step / steps
        alpha = int(200 * (t ** 1.5))
        margin = int(step * max_margin / steps)
        if W - margin > margin and H - margin > margin:
            vdraw.rectangle([margin, margin, W - margin, H - margin],
                            outline=(0, 0, 0, alpha), width=2)
    img = Image.alpha_composite(img.convert('RGBA'), vig).convert('RGB')
    return img

# ── Badge helper ──────────────────────────────────────────────────────────────
def draw_badge(img, draw, x, y, text, bg=GREEN, fg=BG_DARK, font_size=22):
    font = load_font(FONT_BOLD, font_size)
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    pad_x, pad_y = 22, 10
    rx0, ry0 = x, y
    rx1, ry1 = x + tw + 2 * pad_x, y + (bbox[3] - bbox[1]) + 2 * pad_y
    rounded_rect(img, rx0, ry0, rx1, ry1, 20, bg)
    draw.text((rx0 + pad_x, ry0 + pad_y), text, font=font, fill=fg)
    return ry1

# ── Slide 1: COVER ────────────────────────────────────────────────────────────
def slide_01():
    img = court_bg(W, H)
    draw = ImageDraw.Draw(img)

    # Heavy dark gradient overlay bottom-to-top
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    for row in range(H):
        t = (H - row) / H  # 0 at bottom, 1 at top
        alpha = int(210 * (1 - t ** 1.4))
        odraw.line([(0, row), (W, row)], fill=(5, 8, 16, alpha))
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
    draw = ImageDraw.Draw(img)

    # Green stripe at very top
    draw.rectangle([0, 0, W, 8], fill=GREEN)

    # Gold pill badge top-left
    font_badge = load_font(FONT_BOLD, 22)
    badge_text = "CONFIDENCIAL  ·  ALICANTE 2026"
    bbox = draw.textbbox((0, 0), badge_text, font=font_badge)
    bw = bbox[2] - bbox[0] + 44
    bh = bbox[3] - bbox[1] + 20
    rounded_rect(img, 60, 36, 60 + bw, 36 + bh, 24, GOLD)
    draw = ImageDraw.Draw(img)
    draw.text((60 + 22, 36 + 10), badge_text, font=font_badge, fill=BG_DARK)

    # Main title
    f_huge = load_font(FONT_BOLD, 110)
    f_huge2 = load_font(FONT_BOLD, 118)
    f_med  = load_font(FONT_BOLD, 54)
    f_tag  = load_font(FONT_REG, 30)

    tx = 80
    draw.text((tx, 140), "PLAN COMERCIAL", font=f_huge, fill=WHITE)
    draw.text((tx, 265), "PÁDEL EUROPA", font=f_huge2, fill=GREEN)
    draw.text((tx, 400), "2026 – 2028", font=f_med, fill=GOLD)
    draw.text((tx, 476), "Empresa chilena de canchas premium  ·  Expansión Europea", font=f_tag, fill=LIGHT)

    # Bottom stats bar
    bar_h = 120
    draw.rectangle([0, H - bar_h, W, H], fill=CARD)
    draw.line([0, H - bar_h, W, H - bar_h], fill=GREEN, width=3)

    stats = [
        ("35 MILLONES", "jugadores"),
        ("77.300 canchas", "globales"),
        ("15% crecimiento", "anual"),
        ("USD 225M", "mercado 2032"),
    ]
    f_stat_v = load_font(FONT_BOLD, 36)
    f_stat_l = load_font(FONT_REG, 22)
    col_w = W // 4
    for i, (val, lbl) in enumerate(stats):
        cx_s = i * col_w + col_w // 2
        cy_s = H - bar_h + bar_h // 2
        draw.text((cx_s, cy_s - 18), val, font=f_stat_v, fill=WHITE, anchor='mm')
        draw.text((cx_s, cy_s + 22), lbl, font=f_stat_l, fill=LIGHT, anchor='mm')
        if i < 3:
            draw.line([i * col_w + col_w, H - bar_h + 20, i * col_w + col_w, H - 20], fill=MUTED, width=1)

    return img

# ── Slide 2: EL MERCADO ───────────────────────────────────────────────────────
def slide_02():
    img = dark_bg(W, H)
    draw = ImageDraw.Draw(img)

    # Top accent
    draw.rectangle([0, 0, W, 6], fill=GREEN)
    draw_badge(img, draw, 60, 30, "LA OPORTUNIDAD", GREEN, BG_DARK, 22)
    draw = ImageDraw.Draw(img)

    f_title  = load_font(FONT_BOLD, 70)
    f_sub    = load_font(FONT_BOLD, 70)
    f_bignum = load_font(FONT_BOLD, 64)
    f_label  = load_font(FONT_BOLD, 24)
    f_sub2   = load_font(FONT_REG, 22)

    draw.text((60, 88), "El deporte de ", font=f_title, fill=WHITE)
    w1 = draw.textlength("El deporte de ", font=f_title)
    draw.text((60 + w1, 88), "MAYOR CRECIMIENTO", font=f_sub, fill=GREEN)
    w2 = draw.textlength("MAYOR CRECIMIENTO", font=f_sub)
    draw.text((60 + w1 + w2, 88), " en Europa", font=f_title, fill=WHITE)

    # 4 metric boxes
    metrics = [
        ("77.300", "Canchas globales", "+15.2% vs año anterior", GREEN),
        ("35M", "Jugadores activos", "+42% en membresías 2025", GOLD),
        ("225M USD", "Mercado proyectado 2032", "CAGR 7.5%", (60, 160, 255)),
        ("24.600", "Clubes en el mundo", "+4.775 nuevos en 2025", (200, 100, 255)),
    ]
    box_y = 195
    box_h = 210
    box_w = (W - 120 - 60) // 4
    gap = 20
    for i, (num, lbl, sub, color) in enumerate(metrics):
        bx = 60 + i * (box_w + gap)
        rounded_rect(img, bx, box_y, bx + box_w, box_y + box_h, 14, CARD)
        draw = ImageDraw.Draw(img)
        draw.rectangle([bx, box_y, bx + box_w, box_y + 5], fill=color)
        draw.text((bx + box_w // 2, box_y + 55), num, font=f_bignum, fill=WHITE, anchor='mm')
        draw.text((bx + box_w // 2, box_y + 120), lbl, font=f_label, fill=LIGHT, anchor='mm')
        draw.text((bx + box_w // 2, box_y + 155), sub, font=f_sub2, fill=color, anchor='mm')

    # Bar chart
    f_chart_title = load_font(FONT_BOLD, 32)
    draw.text((W // 2, 440), "CANCHAS EN EUROPA", font=f_chart_title, fill=LIGHT, anchor='mt')
    draw.line([200, 470, W - 200, 470], fill=MUTED, width=1)

    bars_data = [
        ("España", 17300, GREEN),
        ("Italia", 10220, GOLD),
        ("Suecia", 4220, (60, 160, 255)),
        ("Francia", 4000, (200, 100, 255)),
        ("Países\nBajos", 3570, (255, 120, 60)),
        ("Alemania", 875, RED),
    ]
    chart_x, chart_y = 200, 490
    chart_w, chart_h = W - 400, 460
    n = len(bars_data)
    gap_b = 24
    bar_bw = (chart_w - gap_b * (n - 1)) // n
    f_sm  = load_font(FONT_BOLD, 22)
    f_val = load_font(FONT_BOLD, 26)
    max_val = 18000
    for i, (label, val, color) in enumerate(bars_data):
        bx = chart_x + i * (bar_bw + gap_b)
        bar_h_px = int(chart_h * val / max_val)
        by = chart_y + chart_h - bar_h_px
        # Gradient-like bar
        for row_b in range(bar_h_px):
            t_b = row_b / bar_h_px
            r_b = int(color[0] * (0.6 + 0.4 * (1 - t_b)))
            g_b = int(color[1] * (0.6 + 0.4 * (1 - t_b)))
            b_b = int(color[2] * (0.6 + 0.4 * (1 - t_b)))
            draw.line([(bx, by + row_b), (bx + bar_bw, by + row_b)], fill=(r_b, g_b, b_b))
        # Top glow
        draw.rectangle([bx, by, bx + bar_bw, by + 4],
                       fill=tuple(min(255, c + 80) for c in color))
        # Value
        draw.text((bx + bar_bw // 2, by - 12),
                  f"{val:,}".replace(',', '.'), font=f_val, fill=WHITE, anchor='mb')
        # Label
        lines = label.split('\n')
        for li, line in enumerate(lines):
            draw.text((bx + bar_bw // 2, chart_y + chart_h + 18 + li * 26),
                      line, font=f_sm, fill=LIGHT, anchor='mt')

    return img

# ── Slide 3: ANÁLISIS COMPETITIVO ────────────────────────────────────────────
def slide_03():
    img = dark_bg(W, H)
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, W, 6], fill=GREEN)
    draw_badge(img, draw, 60, 30, "ANÁLISIS COMPETITIVO", GREEN, BG_DARK, 22)
    draw = ImageDraw.Draw(img)

    f_title = load_font(FONT_BOLD, 68)
    draw.text((60, 88), "Quiénes son y cómo ", font=f_title, fill=WHITE)
    w1 = draw.textlength("Quiénes son y cómo ", font=f_title)
    draw.text((60 + w1, 88), "superarlos", font=f_title, fill=GREEN)

    headers = ["EMPRESA", "PRECIO BASE", "GARANTÍA", "FINANCIAMIENTO", "ENTREGA", "PUNTO DÉBIL"]
    col_widths = [380, 230, 170, 230, 170, 280]
    col_x = [60]
    for cw in col_widths[:-1]:
        col_x.append(col_x[-1] + cw + 10)

    rows_data = [
        ("Portico Sport (España)",             "€15K–€25K",   "10 años ✓", "Sí ✓",       "6–10 sem",  "Precio alto",        False),
        ("VerdePadel (España)",                "€15K–€22K",   "No pública","No visible ✗","6–8 sem",   "Sin leasing",        False),
        ("Padel Courts Deluxe (Alicante)",     "€12K–€20K",   "No pública","No visible ✗","4–8 sem",   "Misma ciudad",       False),
        ("Global Padel Court (España)",        "€14K–€22K",   "No pública","No visible ✗","6–10 sem",  "Sin postventa",      False),
        ("Youngpadel (China)",                 "€8K–€14K ✓",  "Limitada ✗","No ✗",        "12–20 sem ✗","Calidad incierta",  False),
        ("NUESTRA EMPRESA (Chile·Alicante)",   "€13K–€22K",   "10 años ✓", "LEASING ✓",  "4–6 sem ✓", "N/A — VENTAJA",     True),
    ]

    f_hdr  = load_font(FONT_BOLD, 20)
    f_row  = load_font(FONT_REG, 20)
    f_rowb = load_font(FONT_BOLD, 21)

    row_y = 185
    row_h = 78
    hdr_h = 44

    # Header row
    draw.rectangle([60, row_y, W - 60, row_y + hdr_h], fill=(30, 40, 60))
    for ci, hdr in enumerate(headers):
        draw.text((col_x[ci] + 12, row_y + hdr_h // 2), hdr, font=f_hdr, fill=GREEN, anchor='lm')

    row_y += hdr_h + 4

    for rdata in rows_data:
        cells = rdata[:6]
        highlight = rdata[6]
        bg_color = (28, 40, 62) if not highlight else (30, 50, 25)
        border_color = GOLD if highlight else None

        rounded_rect(img, 60, row_y, W - 60, row_y + row_h - 4, 8, bg_color,
                     outline=border_color, outline_width=3)
        draw = ImageDraw.Draw(img)

        for ci, cell in enumerate(cells):
            font = f_rowb if highlight else f_row
            if '✓' in cell and not highlight:
                color = GREEN
            elif '✗' in cell:
                color = RED
            elif highlight:
                color = GOLD if ci == 0 else WHITE
            else:
                color = LIGHT
            draw.text((col_x[ci] + 12, row_y + row_h // 2), cell, font=font, fill=color, anchor='lm')

        row_y += row_h + 2

    return img

# ── Slide 4: SEGMENTOS DE CLIENTES ───────────────────────────────────────────
def slide_04():
    img = dark_bg(W, H)
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, W, 6], fill=GREEN)
    draw_badge(img, draw, 60, 30, "SEGMENTACIÓN DE MERCADO", GREEN, BG_DARK, 22)
    draw = ImageDraw.Draw(img)

    f_title = load_font(FONT_BOLD, 68)
    draw.text((60, 88), "7 tipos de cliente con ", font=f_title, fill=WHITE)
    w1 = draw.textlength("7 tipos de cliente con ", font=f_title)
    draw.text((60 + w1, 88), "potencial real", font=f_title, fill=GREEN)

    cards = [
        ("OPERADORES DE CLUBES",       "€60K–€250K",  "3–12 canchas, ROI en 3 años. Máximo volumen.", GREEN),
        ("HOTELES Y RESORTS",          "€30K–€80K",   "Pádel ya es amenity estándar 4/5 estrellas.",   GOLD),
        ("PROMOTORAS INMOBILIARIAS",   "€80K–€300K",  "Pádel revaloriza el inmueble +30%.",            (60, 160, 255)),
        ("MUNICIPIOS",                 "€30K–€120K",  "Fondos EU disponibles. Francia, Polonia, Portugal.", (200, 100, 255)),
        ("GIMNASIOS Y FITNESS",        "€40K–€100K",  "Cadenas añaden pádel para retener socios.",     (255, 120, 60)),
        ("FRANQUICIAS DE PÁDEL",       "€200K–€1M",   "Cadenas en expansión, proveedor de volumen.",   (0, 200, 255)),
        ("RENOVACIÓN DE PARQUE",       "€6K–€15K/ccha","27.500 canchas 2012–2016 al límite.",          RED),
    ]

    f_card_title = load_font(FONT_BOLD, 26)
    f_card_price = load_font(FONT_BOLD, 30)
    f_card_desc  = load_font(FONT_REG, 20)

    card_w = (W - 120 - 60) // 4
    card_h = 220
    gap = 20
    start_y = 185

    for i, (title, price, desc, color) in enumerate(cards):
        row = i // 4
        col = i % 4
        if row == 1:
            # 3 cards centered
            total_3 = 3 * card_w + 2 * gap
            offset_x = (W - total_3) // 2
            cx_c = offset_x + col * (card_w + gap)
        else:
            cx_c = 60 + col * (card_w + gap)
        cy_c = start_y + row * (card_h + gap)

        rounded_rect(img, cx_c, cy_c, cx_c + card_w, cy_c + card_h, 12, CARD)
        draw = ImageDraw.Draw(img)
        draw.rectangle([cx_c, cy_c, cx_c + card_w, cy_c + 5], fill=color)

        draw.text((cx_c + 18, cy_c + 28), title, font=f_card_title, fill=WHITE)
        draw.text((cx_c + 18, cy_c + 70), price, font=f_card_price, fill=color)

        # Wrap description
        words = desc.split()
        lines = []
        cur = []
        f_tmp = f_card_desc
        max_w = card_w - 36
        for word in words:
            test = ' '.join(cur + [word])
            if draw.textlength(test, font=f_tmp) > max_w and cur:
                lines.append(' '.join(cur))
                cur = [word]
            else:
                cur.append(word)
        if cur:
            lines.append(' '.join(cur))
        for li, line in enumerate(lines[:3]):
            draw.text((cx_c + 18, cy_c + 118 + li * 28), line, font=f_card_desc, fill=LIGHT)

    return img

# ── Country slide helper ──────────────────────────────────────────────────────
def slide_country(flag, name, rank, kpi1, kpi2,
                  bars, clients, insight, insight_color,
                  left_colors=((10, 18, 50), (5, 10, 30))):
    img = dark_bg(W, H)
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, W, 6], fill=GREEN)

    left_w = int(W * 0.38)

    # Left panel gradient
    for row in range(H):
        t = row / H
        c1, c2 = left_colors
        r = int(c1[0] + (c2[0] - c1[0]) * t)
        g = int(c1[1] + (c2[1] - c1[1]) * t)
        b = int(c1[2] + (c2[2] - c1[2]) * t)
        draw.line([(0, row), (left_w, row)], fill=(r, g, b))

    # Separator line
    draw.line([(left_w, 0), (left_w, H)], fill=GREEN, width=3)

    # Flag emoji (large)
    f_flag = load_font(FONT_BOLD, 110)
    f_name = load_font(FONT_BOLD, 78)
    f_rank = load_font(FONT_BOLD, 26)
    f_kpi  = load_font(FONT_BOLD, 58)
    f_kpi_l = load_font(FONT_REG, 24)

    draw.text((left_w // 2, 110), flag, font=f_flag, fill=WHITE, anchor='mm')
    draw.text((left_w // 2, 220), name, font=f_name, fill=WHITE, anchor='mm')

    # Rank badge
    bbox_r = draw.textbbox((0, 0), rank, font=f_rank)
    rw = bbox_r[2] - bbox_r[0] + 36
    rh = bbox_r[3] - bbox_r[1] + 16
    rx = left_w // 2 - rw // 2
    rounded_rect(img, rx, 295, rx + rw, 295 + rh, 18, GREEN)
    draw = ImageDraw.Draw(img)
    draw.text((left_w // 2, 295 + rh // 2), rank, font=f_rank, fill=BG_DARK, anchor='mm')

    # KPIs
    draw.text((left_w // 2, 400), kpi1, font=f_kpi, fill=WHITE, anchor='mm')
    draw.text((left_w // 2, 460), "habitantes", font=f_kpi_l, fill=MUTED, anchor='mm')
    draw.line([left_w // 4, 490, left_w * 3 // 4, 490], fill=MUTED, width=1)
    draw.text((left_w // 2, 530), kpi2, font=f_kpi, fill=GREEN, anchor='mm')
    draw.text((left_w // 2, 590), "canchas actuales", font=f_kpi_l, fill=MUTED, anchor='mm')

    # Right panel
    rx_start = left_w + 40
    rx_end   = W - 40
    panel_w  = rx_end - rx_start

    f_sec  = load_font(FONT_BOLD, 28)
    f_bar_l = load_font(FONT_REG, 22)
    f_cli  = load_font(FONT_REG, 22)
    f_ins  = load_font(FONT_BOLDITA, 23)

    # Progress bars
    draw.text((rx_start, 30), "INDICADORES", font=f_sec, fill=LIGHT)
    bar_x = rx_start
    bar_w_val = panel_w - 200
    for bi, (bar_lbl, pct) in enumerate(bars):
        by = 75 + bi * 72
        draw.text((bar_x, by), bar_lbl, font=f_bar_l, fill=LIGHT)
        draw.text((bar_x + panel_w - 60, by + 26), f"{pct}%", font=f_bar_l, fill=insight_color)
        progress_bar(draw, bar_x, by + 28, bar_w_val, 22, pct, insight_color)

    # Target clients
    draw.text((rx_start, 300), "CLIENTES OBJETIVO", font=f_sec, fill=LIGHT)
    draw.line([rx_start, 334, rx_end, 334], fill=MUTED, width=1)
    for ci, client in enumerate(clients):
        cy = 350 + ci * 55
        draw.ellipse([rx_start, cy + 4, rx_start + 18, cy + 22], fill=insight_color)
        draw.text((rx_start + 30, cy + 4), client, font=f_cli, fill=LIGHT)

    # Insight box
    ins_y = 590
    rounded_rect(img, rx_start, ins_y, rx_end, ins_y + 150, 12,
                 tuple(max(0, c - 5) for c in CARD))
    draw = ImageDraw.Draw(img)
    draw.rectangle([rx_start, ins_y, rx_start + 6, ins_y + 150], fill=insight_color)

    # Wrap insight text
    words = insight.split()
    lines = []
    cur = []
    max_ins_w = panel_w - 60
    for word in words:
        test = ' '.join(cur + [word])
        if draw.textlength(test, font=f_ins) > max_ins_w and cur:
            lines.append(' '.join(cur))
            cur = [word]
        else:
            cur.append(word)
    if cur:
        lines.append(' '.join(cur))
    for li, line in enumerate(lines[:3]):
        draw.text((rx_start + 24, ins_y + 28 + li * 38), line, font=f_ins, fill=WHITE)

    # Small flag label at bottom left
    f_sm = load_font(FONT_REG, 18)
    draw.text((left_w // 2, H - 30), "MERCADO PRIORITARIO · PÁDEL EUROPA 2026",
              font=f_sm, fill=MUTED, anchor='mm')

    return img

# ── Slide 10: PLAN DE ACCIÓN ─────────────────────────────────────────────────
def slide_10():
    img = dark_bg(W, H)
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, W, 6], fill=GREEN)
    draw_badge(img, draw, 60, 30, "PLAN DE ACCIÓN", GREEN, BG_DARK, 22)
    draw = ImageDraw.Draw(img)

    f_title = load_font(FONT_BOLD, 68)
    draw.text((60, 88), "15 acciones en ", font=f_title, fill=WHITE)
    w1 = draw.textlength("15 acciones en ", font=f_title)
    draw.text((60 + w1, 88), "3 fases de ejecución", font=f_title, fill=GREEN)

    phases = [
        ("FASE 1", "Meses 0–3", GREEN,
         ["Demo park Alicante (outdoor + panorámica)",
          "Certificación FIP obligatoria",
          "Catálogo técnico 4 idiomas",
          "Alta en Europages y portales B2B",
          "Agente comercial Alemania + Francia"]),
        ("FASE 2", "Meses 3–6", GOLD,
         ["ISPO Munich y MIPIM Cannes",
          "Campaña LinkedIn B2B Europa",
          "Financiamiento / leasing propio",
          "Cancha Piloto en 2 mercados",
          "Alianzas arquitectos deportivos"]),
        ("FASE 3", "Meses 6–18", (60, 130, 220),
         ["Catálogo renovación España + Italia",
          "Expansión UK y Benelux",
          "Red de instaladores por país",
          "Campaña fondos EU municipios",
          "Software gestión clubs SaaS"]),
    ]

    col_w  = (W - 120 - 40) // 3
    gap    = 20
    col_y  = 188
    col_h  = H - col_y - 60

    f_phase = load_font(FONT_BOLD, 38)
    f_period = load_font(FONT_REG, 24)
    f_item  = load_font(FONT_REG, 22)
    f_num   = load_font(FONT_BOLD, 20)

    for i, (phase, period, color, items) in enumerate(phases):
        cx_c = 60 + i * (col_w + gap)
        rounded_rect(img, cx_c, col_y, cx_c + col_w, col_y + col_h, 14, CARD)
        draw = ImageDraw.Draw(img)
        draw.rectangle([cx_c, col_y, cx_c + col_w, col_y + 7], fill=color)

        draw.text((cx_c + col_w // 2, col_y + 48), phase, font=f_phase, fill=color, anchor='mm')
        draw.text((cx_c + col_w // 2, col_y + 82), period, font=f_period, fill=MUTED, anchor='mm')
        draw.line([cx_c + 20, col_y + 100, cx_c + col_w - 20, col_y + 100], fill=MUTED, width=1)

        for j, item in enumerate(items):
            iy = col_y + 122 + j * 86
            # Circle number
            draw.ellipse([cx_c + 18, iy, cx_c + 44, iy + 26], fill=color)
            draw.text((cx_c + 31, iy + 13), str(j + 1), font=f_num, fill=BG_DARK, anchor='mm')
            # Item text (wrap)
            words = item.split()
            lines = []
            cur = []
            max_iw = col_w - 75
            for word in words:
                test = ' '.join(cur + [word])
                if draw.textlength(test, font=f_item) > max_iw and cur:
                    lines.append(' '.join(cur))
                    cur = [word]
                else:
                    cur.append(word)
            if cur:
                lines.append(' '.join(cur))
            for li, line in enumerate(lines[:2]):
                draw.text((cx_c + 56, iy + li * 26), line, font=f_item, fill=LIGHT)

    return img

# ── Slide 11: PROPUESTA DE VALOR ─────────────────────────────────────────────
def slide_11():
    img = dark_bg(W, H)
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, W, 6], fill=GREEN)
    draw_badge(img, draw, 60, 30, "PROPUESTA DE VALOR", GREEN, BG_DARK, 22)
    draw = ImageDraw.Draw(img)

    f_title = load_font(FONT_BOLD, 68)
    draw.text((60, 88), "Dónde competimos y ", font=f_title, fill=WHITE)
    w1 = draw.textlength("Dónde competimos y ", font=f_title)
    draw.text((60 + w1, 88), "GANAMOS", font=f_title, fill=GREEN)

    # Left panel
    lp_w = int(W * 0.33)
    lp_x, lp_y = 60, 188
    lp_h = H - lp_y - 60
    rounded_rect(img, lp_x, lp_y, lp_x + lp_w, lp_y + lp_h, 14, CARD,
                 outline=GREEN, outline_width=3)
    draw = ImageDraw.Draw(img)
    draw.rectangle([lp_x, lp_y, lp_x + lp_w, lp_y + 6], fill=GREEN)

    quote_text = ('"El único proveedor integral con instalación en 6 semanas, '
                  'financiamiento en cuotas, certificación FIP y soporte '
                  'post-venta en Europa Central y del Norte. '
                  'Desde Alicante al mundo."')
    f_quote = load_font(FONT_BOLDITA, 22)
    words = quote_text.split()
    lines = []
    cur = []
    max_qw = lp_w - 40
    for word in words:
        test = ' '.join(cur + [word])
        if draw.textlength(test, font=f_quote) > max_qw and cur:
            lines.append(' '.join(cur))
            cur = [word]
        else:
            cur.append(word)
    if cur:
        lines.append(' '.join(cur))
    for li, line in enumerate(lines):
        draw.text((lp_x + 20, lp_y + 40 + li * 34), line, font=f_quote, fill=LIGHT)

    # GOLD badge
    badge_y = lp_y + lp_h - 80
    draw_badge(img, draw, lp_x + lp_w // 2 - 100, badge_y, "PROPUESTA ÚNICA", GOLD, BG_DARK, 26)

    # Right panel
    rp_x = lp_x + lp_w + 40
    items = [
        ("VELOCIDAD DE ENTREGA",
         "4–6 semanas vs 12–20 de fabricantes chinos. Decisivo en UK y Alemania."),
        ("FINANCIAMIENTO / LEASING",
         "Ofrecer leasing triplica el universo de clientes en Europa Central."),
        ("SERVICIO 360° INTEGRAL",
         "Diseño + permisos + instalación + mantenimiento + software de gestión."),
        ("SEGMENTO MEDIO DESATENDIDO",
         "3–8 canchas (€60K–€160K) — libre de competencia premium."),
        ("IDENTIDAD LATINOAMERICANA",
         "Diferenciador de imagen en mercado saturado de marcas españolas."),
    ]

    f_item_title = load_font(FONT_BOLD, 28)
    f_item_desc  = load_font(FONT_REG, 22)
    f_num_big    = load_font(FONT_BOLD, 28)

    for i, (title, desc) in enumerate(items):
        iy = 200 + i * 158
        # Green circle number
        draw.ellipse([rp_x, iy, rp_x + 50, iy + 50], fill=GREEN)
        draw.text((rp_x + 25, iy + 25), str(i + 1), font=f_num_big, fill=BG_DARK, anchor='mm')
        # Title + desc
        draw.text((rp_x + 68, iy + 2), title, font=f_item_title, fill=GREEN)
        # Wrap desc
        words = desc.split()
        lines = []
        cur = []
        max_dw = W - rp_x - 68 - 40
        for word in words:
            test = ' '.join(cur + [word])
            if draw.textlength(test, font=f_item_desc) > max_dw and cur:
                lines.append(' '.join(cur))
                cur = [word]
            else:
                cur.append(word)
        if cur:
            lines.append(' '.join(cur))
        for li, line in enumerate(lines[:2]):
            draw.text((rp_x + 68, iy + 40 + li * 30), line, font=f_item_desc, fill=LIGHT)

    return img

# ── Slide 12: CRONOGRAMA ──────────────────────────────────────────────────────
def slide_12():
    img = dark_bg(W, H)
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, W, 6], fill=GREEN)
    draw_badge(img, draw, 60, 30, "HOJA DE RUTA", GREEN, BG_DARK, 22)
    draw = ImageDraw.Draw(img)

    f_title = load_font(FONT_BOLD, 68)
    draw.text((60, 88), "Cronograma de ", font=f_title, fill=WHITE)
    w1 = draw.textlength("Cronograma de ", font=f_title)
    draw.text((60 + w1, 88), "18 meses", font=f_title, fill=GREEN)

    milestones = [
        ("Mes 1–2", "BASES",
         "Demo park · Cert. FIP\nCatálogo 4 idiomas", GREEN),
        ("Mes 3", "COMERCIAL",
         "Agentes DE+FR\nEuropages · LinkedIn", GREEN),
        ("Mes 4–5", "FERIAS",
         "ISPO Munich\nCancha Piloto ×2", GOLD),
        ("Mes 6", "PRIMERAS\nVENTAS",
         "Contratos firmados\nLeasing activo", GOLD),
        ("Mes 8–10", "EXPANSIÓN",
         "UK + Benelux\nInstalador local", BLUE),
        ("Mes 12–18", "ESCALA",
         "Polonia · Renovaciones\n5 países activos", BLUE),
    ]

    n = len(milestones)
    tl_y = 440  # timeline Y center
    margin = 120
    tl_x_start = margin
    tl_x_end = W - margin
    spacing = (tl_x_end - tl_x_start) / (n - 1)

    # Draw connecting line with gradient
    for i in range(n - 1):
        x1 = int(tl_x_start + i * spacing)
        x2 = int(tl_x_start + (i + 1) * spacing)
        c1 = milestones[i][3]
        c2 = milestones[i + 1][3]
        steps = 40
        for s in range(steps):
            t = s / steps
            rx = int(x1 + (x2 - x1) * t)
            r_c = int(c1[0] + (c2[0] - c1[0]) * t)
            g_c = int(c1[1] + (c2[1] - c1[1]) * t)
            b_c = int(c1[2] + (c2[2] - c1[2]) * t)
            draw.line([(rx, tl_y), (rx + (x2 - x1) // steps + 1, tl_y)],
                      fill=(r_c, g_c, b_c), width=6)

    f_ms     = load_font(FONT_BOLD, 22)
    f_node   = load_font(FONT_BOLD, 28)
    f_desc   = load_font(FONT_REG, 20)

    for i, (period, label, desc, color) in enumerate(milestones):
        nx = int(tl_x_start + i * spacing)
        # Outer ring
        draw.ellipse([nx - 24, tl_y - 24, nx + 24, tl_y + 24],
                     fill=tuple(c // 3 for c in color))
        # Inner dot
        draw.ellipse([nx - 14, tl_y - 14, nx + 14, tl_y + 14], fill=color)
        draw.ellipse([nx - 5, tl_y - 5, nx + 5, tl_y + 5], fill=WHITE)

        # Period above
        draw.text((nx, tl_y - 45), period, font=f_ms, fill=MUTED, anchor='mb')

        # Label below (alternating)
        label_lines = label.split('\n')
        desc_lines = desc.split('\n')

        offset_y = tl_y + 40
        for li, ll in enumerate(label_lines):
            draw.text((nx, offset_y + li * 36), ll, font=f_node, fill=color, anchor='mt')
        desc_y = offset_y + len(label_lines) * 36 + 8
        for di, dl in enumerate(desc_lines):
            draw.text((nx, desc_y + di * 28), dl, font=f_desc, fill=LIGHT, anchor='mt')

    # KPI boxes at bottom
    kpis = [
        ("5 ventas", "mes 6", GREEN),
        ("25 ventas", "mes 12", GOLD),
        ("5 países", "mes 18", BLUE),
    ]
    kpi_box_w = 280
    kpi_box_h = 100
    kpi_gap = 40
    total_kw = 3 * kpi_box_w + 2 * kpi_gap
    kpi_x_start = (W - total_kw) // 2
    kpi_y = H - kpi_box_h - 30

    f_kpi_v = load_font(FONT_BOLD, 40)
    f_kpi_l = load_font(FONT_REG, 22)

    for i, (val, lbl, color) in enumerate(kpis):
        kx = kpi_x_start + i * (kpi_box_w + kpi_gap)
        rounded_rect(img, kx, kpi_y, kx + kpi_box_w, kpi_y + kpi_box_h, 12, CARD)
        draw = ImageDraw.Draw(img)
        draw.rectangle([kx, kpi_y, kx + kpi_box_w, kpi_y + 5], fill=color)
        draw.text((kx + kpi_box_w // 2, kpi_y + 38), val, font=f_kpi_v, fill=color, anchor='mm')
        draw.text((kx + kpi_box_w // 2, kpi_y + 75), lbl, font=f_kpi_l, fill=LIGHT, anchor='mm')

    return img

# ── Slide 13: CIERRE ─────────────────────────────────────────────────────────
def slide_13():
    img = court_bg(W, H)
    draw = ImageDraw.Draw(img)

    # Heavy dark overlay
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    for row in range(H):
        t = row / H
        alpha = int(195 + 30 * t)
        odraw.line([(0, row), (W, row)], fill=(4, 6, 12, min(255, alpha)))
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
    draw = ImageDraw.Draw(img)

    # Green stripe at top
    draw.rectangle([0, 0, W, 8], fill=GREEN)

    f_big1 = load_font(FONT_BOLD, 80)
    f_big2 = load_font(FONT_BOLD, 150)
    f_sub  = load_font(FONT_REG, 32)
    f_box_t = load_font(FONT_BOLD, 28)
    f_box_d = load_font(FONT_REG, 20)
    f_btn   = load_font(FONT_BOLD, 30)

    # Center text
    draw.text((W // 2, 120), "EL MOMENTO ES", font=f_big1, fill=WHITE, anchor='mt')
    draw.text((W // 2, 210), "AHORA", font=f_big2, fill=GREEN, anchor='mt')

    draw.text((W // 2, 410),
              "Europa construye 14.000 canchas al año. Alicante está a 8h de Francia y 24h de Alemania.",
              font=f_sub, fill=LIGHT, anchor='mt')

    # 3 next-step boxes
    boxes = [
        ("01", "CERTIFICAR CON FIP",
         "Sin esta certificación no existe acceso\nal mercado profesional europeo."),
        ("02", "DEMO PARK ALICANTE",
         "Una cancha funcionando convierte\nprospectos en compradores."),
        ("03", "AGENTE EN ALEMANIA",
         "El idioma es la única barrera real\nen el mercado más virgen de Europa."),
    ]

    box_w = 460
    box_h = 220
    box_gap = 36
    total_bw = 3 * box_w + 2 * box_gap
    box_x_start = (W - total_bw) // 2
    box_y = 490

    for i, (num, title, desc) in enumerate(boxes):
        bx = box_x_start + i * (box_w + box_gap)
        # Semi-transparent card
        card_overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        card_draw = ImageDraw.Draw(card_overlay)
        # Draw rounded rect on overlay
        r = 14
        card_draw.rectangle([bx + r, box_y, bx + box_w - r, box_y + box_h], fill=(*CARD, 200))
        card_draw.rectangle([bx, box_y + r, bx + box_w, box_y + box_h - r], fill=(*CARD, 200))
        card_draw.ellipse([bx, box_y, bx + 2*r, box_y + 2*r], fill=(*CARD, 200))
        card_draw.ellipse([bx + box_w - 2*r, box_y, bx + box_w, box_y + 2*r], fill=(*CARD, 200))
        card_draw.ellipse([bx, box_y + box_h - 2*r, bx + 2*r, box_y + box_h], fill=(*CARD, 200))
        card_draw.ellipse([bx + box_w - 2*r, box_y + box_h - 2*r, bx + box_w, box_y + box_h], fill=(*CARD, 200))
        img = Image.alpha_composite(img.convert('RGBA'), card_overlay).convert('RGB')
        draw = ImageDraw.Draw(img)

        draw.rectangle([bx, box_y, bx + box_w, box_y + 5], fill=GREEN)
        draw.text((bx + 22, box_y + 26), num, font=f_box_t, fill=GREEN)
        draw.text((bx + 22, box_y + 65), title, font=f_box_t, fill=WHITE)
        desc_lines = desc.split('\n')
        for li, dl in enumerate(desc_lines):
            draw.text((bx + 22, box_y + 108 + li * 30), dl, font=f_box_d, fill=LIGHT)

    # Green pill button
    btn_text = "COMENZAR EXPANSIÓN EUROPA 2026"
    f_btn_final = load_font(FONT_BOLD, 32)
    bbox = draw.textbbox((0, 0), btn_text, font=f_btn_final)
    bw_btn = bbox[2] - bbox[0] + 80
    bh_btn = bbox[3] - bbox[1] + 28
    btn_x = (W - bw_btn) // 2
    btn_y = H - bh_btn - 30
    rounded_rect(img, btn_x, btn_y, btn_x + bw_btn, btn_y + bh_btn, bh_btn // 2, GREEN)
    draw = ImageDraw.Draw(img)
    draw.text((W // 2, btn_y + bh_btn // 2), btn_text, font=f_btn_final, fill=BG_DARK, anchor='mm')

    return img

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    out_dir  = "/home/user/CLAUDE-EDS"
    pdf_path = f"{out_dir}/presentacion_experto_padel.pdf"
    tmp_files = []

    def save_slide(idx, img):
        path = f"{out_dir}/tmp_slide_{idx:02d}.jpg"
        img.save(path, "JPEG", quality=88)
        tmp_files.append(path)
        size_kb = os.path.getsize(path) // 1024
        print(f"  Slide {idx:02d} → {path} ({size_kb} KB)")
        return path

    print("Generating slides...")

    # S1
    print("[1/13] Cover...")
    save_slide(1, slide_01())

    # S2
    print("[2/13] El Mercado...")
    save_slide(2, slide_02())

    # S3
    print("[3/13] Análisis Competitivo...")
    save_slide(3, slide_03())

    # S4
    print("[4/13] Segmentos de Clientes...")
    save_slide(4, slide_04())

    # S5 – Alemania
    print("[5/13] Alemania...")
    save_slide(5, slide_country(
        flag="🇩🇪", name="ALEMANIA", rank="#1 MAYOR POTENCIAL",
        kpi1="84M hab", kpi2="875 canchas",
        bars=[("Oportunidad", 90), ("Logística desde Alicante", 70), ("Poder adquisitivo", 100)],
        clients=["Clubes de tenis en reconversión",
                 "Cadenas McFit · FitX · Holmes Place",
                 "Developers premium Berlín · Múnich · Frankfurt",
                 "Hoteles Marriott · Hilton · Meliá"],
        insight="Mercado hotspot — demanda supera consistentemente la oferta. Un agente comercial alemán resuelve la barrera idiomática.",
        insight_color=GOLD,
        left_colors=((10, 18, 50), (5, 10, 30))
    ))

    # S6 – Francia
    print("[6/13] Francia...")
    save_slide(6, slide_country(
        flag="🇫🇷", name="FRANCIA", rank="#2 CRECIMIENTO RÉCORD",
        kpi1="68M hab", kpi2="4.000 canchas",
        bars=[("Oportunidad", 80), ("Logística desde Alicante", 90), ("Afinidad idiomática", 70)],
        clients=["Clubs omnisports (Lyon, Bordeaux, Nantes)",
                 "Club Med · Accor · Barrière",
                 "Municipios programas deportivos 2026–2030",
                 "Promotoras Costa Azul y Occitanie"],
        insight="+55% crecimiento en 18 meses. A solo 8h de Alicante en camión.",
        insight_color=GREEN,
        left_colors=((20, 10, 60), (8, 5, 35))
    ))

    # S7 – Reino Unido
    print("[7/13] Reino Unido...")
    save_slide(7, slide_country(
        flag="🇬🇧", name="REINO UNIDO", rank="#3 MAYOR VALOR POR CANCHA",
        kpi1="67M hab", kpi2="~800 canchas",
        bars=[("Oportunidad", 90), ("Rentabilidad por proyecto", 100), ("Logística post-Brexit", 60)],
        clients=["Padel boutique clubs (concepto de lujo)",
                 "Premier League Football Clubs",
                 "Hilton · Marriott · IHG programas activos",
                 "Mixed-use developers Londres y Manchester"],
        insight="Post-Brexit requiere declaraciones aduaneras. TLC UE-UK facilita el comercio.",
        insight_color=(100, 100, 220),
        left_colors=((5, 15, 45), (2, 8, 25))
    ))

    # S8 – Benelux
    print("[8/13] Benelux...")
    save_slide(8, slide_country(
        flag="🇳🇱", name="BENELUX", rank="#4 SWEET SPOT",
        kpi1="28M hab comb.", kpi2="5.720 canchas NL+BE",
        bars=[("Poder adquisitivo", 100), ("Logística Rotterdam", 90), ("Apertura comercial", 90)],
        clients=["Padel centers (Eindhoven · Utrecht · Gante)",
                 "Centros deportivos municipales holandeses",
                 "Promotoras housing sostenible",
                 "Inversores sport y leisure"],
        insight="Rotterdam y Amberes: los puertos más grandes de Europa. Inglés como lengua comercial.",
        insight_color=(0, 180, 140),
        left_colors=((0, 30, 40), (0, 15, 22))
    ))

    # S9 – Polonia
    print("[9/13] Polonia...")
    save_slide(9, slide_country(
        flag="🇵🇱", name="POLONIA", rank="#5 MERCADO VIRGEN",
        kpi1="38M hab", kpi2="<10 canchas/millón",
        bars=[("Mercado virgen", 100), ("Crecimiento económico", 80), ("Logística distancia", 40)],
        clients=["Inversores que conocen pádel de España",
                 "Clubes de tenis Varsovia y Cracovia",
                 "Developers lifestyle real estate",
                 "Municipios con fondos EU infraestructura"],
        insight="Primer entrante captura el liderazgo en Europa Central. Mayor riesgo, mayor recompensa.",
        insight_color=RED,
        left_colors=((50, 8, 12), (25, 3, 5))
    ))

    # S10
    print("[10/13] Plan de Acción...")
    save_slide(10, slide_10())

    # S11
    print("[11/13] Propuesta de Valor...")
    save_slide(11, slide_11())

    # S12
    print("[12/13] Cronograma...")
    save_slide(12, slide_12())

    # S13
    print("[13/13] Cierre...")
    save_slide(13, slide_13())

    # Combine into PDF
    print("\nCombining slides into PDF...")
    layout = img2pdf.get_layout_fun(
        (img2pdf.px_to_pt(1920, 96), img2pdf.px_to_pt(1080, 96))
    )
    with open(pdf_path, "wb") as f:
        f.write(img2pdf.convert(tmp_files, layout_fun=layout))

    # Clean up temp files
    print("Cleaning up temporary files...")
    for tf in tmp_files:
        os.remove(tf)

    size_mb = os.path.getsize(pdf_path) / (1024 * 1024)
    print(f"\nDone! PDF saved to: {pdf_path}")
    print(f"File size: {size_mb:.2f} MB")

if __name__ == "__main__":
    main()
