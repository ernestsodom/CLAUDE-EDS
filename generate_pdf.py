#!/usr/bin/env python3
"""
Renders each slide of presentacion_padel_europa.html at 1920x1080
and merges screenshots into a PDF.
"""
import asyncio
import os
from pathlib import Path
from PIL import Image
import img2pdf

HTML_PATH = Path(__file__).parent / "presentacion_padel_europa.html"
PDF_PATH  = Path(__file__).parent / "padel_europa_slides_HD.pdf"
TMP_DIR   = Path(__file__).parent / "_slide_imgs"

SECTION_IDS = [f"s{i}" for i in range(1, 14)]  # s1 … s13
VIEWPORT_W  = 1920
VIEWPORT_H  = 1080

async def main():
    from playwright.async_api import async_playwright

    TMP_DIR.mkdir(exist_ok=True)
    file_url = HTML_PATH.as_uri()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )
        ctx = await browser.new_context(
            viewport={"width": VIEWPORT_W, "height": VIEWPORT_H},
            device_scale_factor=1,
        )
        page = await ctx.new_page()

        # Load the file and wait for images
        print(f"Loading {file_url} ...")
        await page.goto(file_url, wait_until="networkidle", timeout=30000)

        # Give JS animations a moment to settle
        await page.wait_for_timeout(1500)

        # Inject helper: force all background-image sections to be visible,
        # disable CSS transitions/animations so screenshots are sharp
        await page.add_style_tag(content="""
            * { animation-duration: 0s !important; transition-duration: 0s !important; }
            .bar-fill { transition: none !important; }
        """)

        img_paths = []
        for sid in SECTION_IDS:
            print(f"  Capturing #{sid} ...")

            # Scroll section into view (top-aligned)
            await page.evaluate(f"""
                const el = document.getElementById('{sid}');
                el.scrollIntoView({{behavior:'instant', block:'start'}});
            """)
            await page.wait_for_timeout(400)

            # Trigger intersection observer / bar animations for this section
            await page.evaluate(f"""
                // fire animBars if this is the chart slide
                if (typeof animBars === 'function') animBars();
            """)
            await page.wait_for_timeout(300)

            # Get section bounding box
            box = await page.evaluate(f"""
                (() => {{
                    const el = document.getElementById('{sid}');
                    const r  = el.getBoundingClientRect();
                    const scrollTop = window.scrollY;
                    return {{
                        x: 0,
                        y: r.top + scrollTop,
                        w: {VIEWPORT_W},
                        h: Math.max(r.height, {VIEWPORT_H})
                    }};
                }})()
            """)

            # Screenshot the viewport area right now (section is at top of viewport)
            # Use clip to exactly one viewport height (slide format)
            shot_path = TMP_DIR / f"slide_{sid}.png"
            await page.screenshot(
                path=str(shot_path),
                clip={"x": 0, "y": 0, "width": VIEWPORT_W, "height": VIEWPORT_H},
            )
            img_paths.append(shot_path)
            print(f"    -> saved {shot_path.name}")

        await browser.close()

    # Merge into PDF at A4-landscape equivalent (but keep 16:9 ratio)
    print(f"\nMerging {len(img_paths)} slides into PDF ...")

    # img2pdf wants bytes; we pass layout = (w, h) in pt
    # 1920x1080 px at 96 dpi → 20in × 11.25in → 1440 × 810 pt
    W_PT = img2pdf.px_to_pt(VIEWPORT_W, 96)
    H_PT = img2pdf.px_to_pt(VIEWPORT_H, 96)
    layout = img2pdf.get_layout_fun((W_PT, H_PT))

    with open(PDF_PATH, "wb") as f:
        f.write(img2pdf.convert(
            [str(p) for p in img_paths],
            layout_fun=layout,
        ))

    size_kb = PDF_PATH.stat().st_size // 1024
    print(f"PDF saved: {PDF_PATH}  ({size_kb} KB)")

    # Cleanup temp images
    for p in img_paths:
        p.unlink(missing_ok=True)
    TMP_DIR.rmdir()

if __name__ == "__main__":
    asyncio.run(main())
