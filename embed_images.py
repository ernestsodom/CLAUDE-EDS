#!/usr/bin/env python3
"""
Generates synthetic background images (padel court + country gradients)
using Pillow and embeds them as base64 data URIs into the HTML.
"""
import base64, io, re, os, math
from PIL import Image, ImageDraw, ImageFilter
from pathlib import Path

HTML_PATH = Path('/home/user/CLAUDE-EDS/presentacion_padel_europa.html')

# ── helpers ──────────────────────────────────────────────────────────────────

def to_data_uri(img: Image.Image, quality=82) -> str:
    buf = io.BytesIO()
    img.convert('RGB').save(buf, format='JPEG', quality=quality, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    return f'data:image/jpeg;base64,{b64}'

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def gradient(w, h, top_color, bot_color, direction='v'):
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            if direction == 'v':
                t = y / (h - 1)
            elif direction == 'h':
                t = x / (w - 1)
            else:  # diagonal
                t = (x / w + y / h) / 2
            px[x, y] = lerp_color(top_color, bot_color, t)
    return img

def add_noise(img, amount=8):
    import random
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = px[x, y]
            n = random.randint(-amount, amount)
            px[x, y] = (max(0,min(255,r+n)), max(0,min(255,g+n)), max(0,min(255,b+n)))
    return img

# ── Slide 1 & 13: Padel court top-down ────────────────────────────────────

def make_padel_court(w=1280, h=720) -> Image.Image:
    """Top-down view of a padel court."""
    img = Image.new('RGB', (w, h), (8, 25, 15))  # dark surround
    draw = ImageDraw.Draw(img)

    # Court dimensions (proportional to real 20x10m)
    margin_x = int(w * 0.12)
    margin_y = int(h * 0.10)
    cw = w - 2 * margin_x  # court width on canvas
    ch = h - 2 * margin_y  # court height on canvas
    x0, y0 = margin_x, margin_y
    x1, y1 = x0 + cw, y0 + ch

    # Court surface — artificial grass green
    draw.rectangle([x0, y0, x1, y1], fill=(22, 105, 55))

    # Service boxes (4 rectangles)
    mid_x = x0 + cw // 2
    service_depth = int(ch * 0.30)
    # left service area top/bottom
    draw.rectangle([x0, y0, mid_x, y0 + service_depth], fill=(19, 95, 50))
    draw.rectangle([x0, y1 - service_depth, mid_x, y1], fill=(19, 95, 50))
    draw.rectangle([mid_x, y0, x1, y0 + service_depth], fill=(19, 95, 50))
    draw.rectangle([mid_x, y1 - service_depth, mid_x + (x1-mid_x), y1], fill=(19, 95, 50))

    lw = max(2, w // 320)  # line width

    # Outer boundary
    draw.rectangle([x0, y0, x1, y1], outline=(255, 255, 255), width=lw)

    # Center line (vertical)
    draw.line([(mid_x, y0), (mid_x, y1)], fill=(255, 255, 255), width=lw)

    # Service lines (horizontal, 30% from each end)
    draw.line([(x0, y0 + service_depth), (x1, y0 + service_depth)], fill=(255,255,255), width=lw)
    draw.line([(x0, y1 - service_depth), (x1, y1 - service_depth)], fill=(255,255,255), width=lw)

    # Net (center horizontal line, thicker)
    mid_y = y0 + ch // 2
    draw.line([(x0, mid_y), (x1, mid_y)], fill=(220, 220, 220), width=lw * 2)

    # Subtle dark overlay gradient for visual depth
    overlay = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    for i in range(60):
        alpha = int(200 * (i / 59) ** 1.5)
        odraw.rectangle([0, h - 60 + i, w, h - 59 + i], fill=(0, 0, 0, alpha))
        odraw.rectangle([0, i, w, i + 1], fill=(0, 0, 0, alpha))
    img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')

    # Dark vignette
    for strength, rect in [(0.4, [0, 0, w//4, h]), (0.4, [3*w//4, 0, w, h]),
                           (0.3, [0, 0, w, h//5]), (0.3, [0, 4*h//5, w, h])]:
        v = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        vd = ImageDraw.Draw(v)
        vd.rectangle(rect, fill=(0, 0, 0, int(255 * strength)))
        img = Image.alpha_composite(img.convert('RGBA'), v).convert('RGB')

    return img

# ── Country backgrounds ───────────────────────────────────────────────────

def make_country_bg(w, h, c1, c2, c3=None) -> Image.Image:
    """Three-tone diagonal gradient for country slides."""
    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.6 + y / h * 0.4)
            if c3 and t > 0.55:
                tt = (t - 0.55) / 0.45
                color = lerp_color(c2, c3, min(tt, 1))
            else:
                tt = t / 0.55 if c3 else t
                color = lerp_color(c1, c2, min(tt, 1))
            px[x, y] = color
    img = img.filter(ImageFilter.GaussianBlur(radius=2))
    add_noise(img, 6)
    return img

# ── Generate all images ───────────────────────────────────────────────────

images = {
    # key = fragment of the Unsplash photo ID
    'photo-1554068865': make_padel_court(1280, 720),   # slide 1 bg
    'photo-1526676317': make_padel_court(1280, 720),   # slide 13 bg

    # Country backgrounds (portrait-ish for the left panel)
    'photo-1558618666': make_country_bg(700, 560,      # Germany – steel blue
        (10, 18, 40), (30, 50, 90), (5, 10, 25)),
    'photo-1499856871': make_country_bg(700, 560,      # France – midnight blue-purple
        (12, 10, 45), (35, 20, 80), (6, 5, 30)),
    'photo-1513635269': make_country_bg(700, 560,      # UK – deep navy
        (5, 12, 35), (15, 35, 75), (2, 6, 20)),
    'photo-1534351590': make_country_bg(700, 560,      # Benelux – dark teal
        (0, 25, 35), (0, 60, 80), (0, 15, 22)),
    'photo-1539037116': make_country_bg(700, 560,      # Poland – dark crimson
        (40, 5, 10), (90, 15, 20), (20, 2, 5)),
}

print("Generated images:")
for k, img in images.items():
    size_est = img.width * img.height * 3 // 10  # rough JPEG estimate
    print(f"  {k}  {img.size}  ~{size_est//1024}KB")

# ── Embed into HTML ───────────────────────────────────────────────────────

with open(HTML_PATH, 'r', encoding='utf-8') as f:
    html = f.read()

urls_in_html = sorted(set(re.findall(
    r'https://images\.unsplash\.com/[^\'")\s]+', html
)))
print(f"\nEmbedding into {len(urls_in_html)} URL slots...")

replaced = 0
for url in urls_in_html:
    # Match by photo ID fragment
    matched_key = None
    for key in images:
        if key in url:
            matched_key = key
            break
    if matched_key:
        data_uri = to_data_uri(images[matched_key])
        html = html.replace(url, data_uri)
        replaced += 1
        print(f"  replaced {matched_key}")
    else:
        print(f"  NO MATCH: {url[:60]}")

with open(HTML_PATH, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(HTML_PATH) // 1024
print(f"\nDone! {replaced}/{len(urls_in_html)} images embedded.")
print(f"HTML size: {size_kb} KB ({size_kb/1024:.1f} MB)")
