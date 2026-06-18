#!/usr/bin/env python3
"""
Generates the expert PDF at standard A4-landscape page size (297×210mm)
using PIL's native PDF export — maximum compatibility for mobile viewers.
"""
import os, sys, importlib.util
from pathlib import Path
from PIL import Image

# ── Load slide functions from gen_expert_pdf.py ──────────────────────────
spec = importlib.util.spec_from_file_location("gen", "/home/user/CLAUDE-EDS/gen_expert_pdf.py")
mod  = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

G   = mod.GOLD
GR  = mod.GREEN
RE  = mod.RED

# ── Regenerate all 13 slides as PIL Images ───────────────────────────────
print("Rendering slides (1920×1080) …")
slides_pil = [
    mod.slide_01(),
    mod.slide_02(),
    mod.slide_03(),
    mod.slide_04(),
    mod.slide_country("🇩🇪","ALEMANIA","#1 MAYOR POTENCIAL","84M hab","875 canchas",
        [("Oportunidad",90),("Logística desde Alicante",70),("Poder adquisitivo",100)],
        ["Clubes de tenis en reconversión","Cadenas McFit · FitX · Holmes Place",
         "Developers premium Berlín · Múnich · Frankfurt","Hoteles Marriott · Hilton · Meliá"],
        "Mercado hotspot — demanda supera la oferta. Un agente comercial alemán resuelve la barrera.",
        G, ((10,18,50),(5,10,30))),
    mod.slide_country("🇫🇷","FRANCIA","#2 CRECIMIENTO RÉCORD","68M hab","4.000 canchas",
        [("Oportunidad",80),("Logística desde Alicante",90),("Afinidad idiomática",70)],
        ["Clubs omnisports (Lyon, Bordeaux, Nantes)","Club Med · Accor · Barrière",
         "Municipios programas deportivos 2026–2030","Promotoras Costa Azul y Occitanie"],
        "+55% crecimiento en 18 meses. A solo 8h de Alicante en camión.",
        GR, ((20,10,60),(8,5,35))),
    mod.slide_country("🇬🇧","REINO UNIDO","#3 MAYOR VALOR POR CANCHA","67M hab","~800 canchas",
        [("Oportunidad",90),("Rentabilidad por proyecto",100),("Logística post-Brexit",60)],
        ["Padel boutique clubs (concepto de lujo)","Premier League Football Clubs",
         "Hilton · Marriott · IHG programas activos","Mixed-use developers Londres y Manchester"],
        "Post-Brexit requiere declaraciones aduaneras. TLC UE-UK facilita el comercio.",
        (100,100,220), ((5,15,45),(2,8,25))),
    mod.slide_country("🇳🇱","BENELUX","#4 SWEET SPOT","28M hab comb.","5.720 canchas NL+BE",
        [("Poder adquisitivo",100),("Logística Rotterdam",90),("Apertura comercial",90)],
        ["Padel centers (Eindhoven · Utrecht · Gante)","Centros deportivos municipales holandeses",
         "Promotoras housing sostenible","Inversores sport y leisure"],
        "Rotterdam y Amberes: los puertos más grandes de Europa. Inglés como lengua comercial.",
        (0,180,140), ((0,30,40),(0,15,22))),
    mod.slide_country("🇵🇱","POLONIA","#5 MERCADO VIRGEN","38M hab","<10 canchas/millón",
        [("Mercado virgen",100),("Crecimiento económico",80),("Logística distancia",40)],
        ["Inversores que conocen pádel de España","Clubes de tenis Varsovia y Cracovia",
         "Developers lifestyle real estate","Municipios con fondos EU infraestructura"],
        "Primer entrante captura el liderazgo en Europa Central. Mayor riesgo, mayor recompensa.",
        RE, ((50,8,12),(25,3,5))),
    mod.slide_10(),
    mod.slide_11(),
    mod.slide_12(),
    mod.slide_13(),
]

print(f"  {len(slides_pil)} slides rendered.")

# ── Resize to A4 landscape at 150 DPI ────────────────────────────────────
# A4 landscape: 297mm × 210mm  →  at 150 DPI: 1754 × 1240 px
A4W, A4H = 1754, 1240
print(f"Resizing to A4-landscape {A4W}×{A4H}px @ 150 DPI …")

compat = []
for i, img in enumerate(slides_pil, 1):
    # Scale down keeping aspect ratio (1920×1080 → fits inside 1754×1240)
    img.thumbnail((A4W, A4H), Image.LANCZOS)
    # Centre on dark background to fill page
    bg = Image.new('RGB', (A4W, A4H), (8, 12, 20))
    x  = (A4W - img.width)  // 2
    y  = (A4H - img.height) // 2
    bg.paste(img, (x, y))
    compat.append(bg)
    print(f"  slide {i:02d}: {img.width}×{img.height} → {A4W}×{A4H}")

# ── Save as PDF using PIL (standard, mobile-compatible) ──────────────────
OUT = "/home/user/CLAUDE-EDS/padel_europa_experto_MOVIL.pdf"
print(f"\nSaving PDF → {OUT} …")
compat[0].save(
    OUT,
    format='PDF',
    save_all=True,
    append_images=compat[1:],
    resolution=150,
)
size_mb = os.path.getsize(OUT) / 1024 / 1024
print(f"Done — {len(compat)} pages · {size_mb:.1f} MB")
print(f"Compatible with: Android · iOS · Windows · macOS")
