#!/usr/bin/env python3
"""
Converts the animated HTML presentation to fully static:
- All text/content visible immediately, no opacity:0
- Counter values set directly in HTML (no JS animation)
- Bar chart heights set as inline CSS %
- Opp-fill widths set as inline CSS %
- JS stripped to navigation only
"""
import re
from pathlib import Path

HTML = Path('/home/user/CLAUDE-EDS/presentacion_padel_europa.html')
html = HTML.read_text(encoding='utf-8')

# ── 1. CSS: make fade-up / fade-in / stagger always visible ─────────────
html = html.replace(
    '.fade-up{opacity:0;transform:translateY(28px);transition:all .65s ease}\n'
    '.fade-up.visible{opacity:1;transform:translateY(0)}\n'
    '.fade-in{opacity:0;transition:opacity .75s ease}\n'
    '.fade-in.visible{opacity:1}\n'
    '.stagger>*{opacity:0;transform:translateY(18px);transition:all .55s ease}\n'
    '.stagger.visible>*{opacity:1;transform:translateY(0)}\n'
    '.stagger.visible>*:nth-child(1){transition-delay:.08s}\n'
    '.stagger.visible>*:nth-child(2){transition-delay:.16s}\n'
    '.stagger.visible>*:nth-child(3){transition-delay:.24s}\n'
    '.stagger.visible>*:nth-child(4){transition-delay:.32s}\n'
    '.stagger.visible>*:nth-child(5){transition-delay:.40s}\n'
    '.stagger.visible>*:nth-child(6){transition-delay:.48s}\n'
    '.stagger.visible>*:nth-child(7){transition-delay:.56s}',
    '.fade-up,.fade-in,.stagger>*{opacity:1;transform:none}'
)

# ── 2. CSS: bar-fill starts visible (no height:0) ───────────────────────
html = html.replace(
    'background:linear-gradient(180deg,var(--g-light),var(--g-main));\n'
    '  transition:height 1.4s cubic-bezier(.22,.61,.36,1);height:0}',
    'background:linear-gradient(180deg,var(--g-light),var(--g-main))}'
)

# ── 3. CSS: opp-fill starts visible (no width:0, no transition) ─────────
html = html.replace(
    '  width:0;transition:width 1.2s ease .3s}',
    '  width:0}'   # width set per-element below
)

# ── 4. HTML: set counter values directly (data-target → real text) ───────
def set_counter(html, cls, target, display):
    return html.replace(
        f'class="{cls}" data-target="{target}">0<',
        f'class="{cls}" data-target="{target}">{display}<'
    )

# slide 1 (.cnt)
html = set_counter(html, 'cnt', '35',    '35')
html = set_counter(html, 'cnt', '77300', '77.300')
html = set_counter(html, 'cnt', '15',    '15')
html = set_counter(html, 'cnt', '51000', '51.000')

# slide 2 (.cnt2) — class is "num cnt2"
for old, new in [('77300','77.300'),('35','35'),('225','225'),('24600','24.600')]:
    html = html.replace(
        f'class="num cnt2" data-target="{old}">0<',
        f'class="num cnt2" data-target="{old}">{new}<'
    )

# slide 12 (.cnt3) — two "5" and one "25"
# Replace carefully in order: first "5", then "25", then second "5"
html = html.replace(
    'class="cnt3" data-target="5">0<',
    'class="cnt3" data-target="5">5<',
    2   # replace both occurrences
)
html = html.replace(
    'class="cnt3" data-target="25">0<',
    'class="cnt3" data-target="25">25<'
)

# ── 5. HTML: bar-fill — set height as inline % ──────────────────────────
def set_bar_height(html, pct, extra_style=''):
    old_no_extra  = f'data-pct="{pct}"></div>'
    new_no_extra  = f'data-pct="{pct}" style="height:{pct}%"></div>'
    old_with_extra = f'data-pct="{pct}" style="{extra_style}"></div>'
    new_with_extra = f'data-pct="{pct}" style="{extra_style};height:{pct}%"></div>'
    if extra_style:
        html = html.replace(old_with_extra, new_with_extra)
    else:
        html = html.replace(old_no_extra, new_no_extra)
    return html

html = set_bar_height(html, '95')
html = set_bar_height(html, '59', 'background:linear-gradient(180deg,#e74c3c,#c0392b)')
html = set_bar_height(html, '24', 'background:linear-gradient(180deg,#3498db,#2980b9)')
html = set_bar_height(html, '23', 'background:linear-gradient(180deg,#9b59b6,#8e44ad)')
html = set_bar_height(html, '21', 'background:linear-gradient(180deg,#f39c12,#e67e22)')
html = set_bar_height(html, '5',  'background:linear-gradient(180deg,#95a5a6,#7f8c8d)')

# ── 6. HTML: opp-fill — set width as inline style ───────────────────────
# Pattern: <div class="opp-fill" data-w="N[N]">  or with style=
def fill_opp(html, w, extra=''):
    if extra:
        old = f'class="opp-fill" data-w="{w}" style="{extra}"'
        new = f'class="opp-fill" data-w="{w}" style="{extra};width:{w}%"'
    else:
        old = f'class="opp-fill" data-w="{w}"'
        new = f'class="opp-fill" data-w="{w}" style="width:{w}%"'
    return html.replace(old, new)

# Germany (s5)
html = fill_opp(html, '90')
html = fill_opp(html, '70', 'background:linear-gradient(90deg,#e67e22,#f39c12)')
html = fill_opp(html, '100', 'background:linear-gradient(90deg,#f1c40f,#f39c12)')

# France (s6) – 80%, 90% (dup), 70% (dup) already handled or different style
# Need to handle duplicate w= values with different styles
# Let's use a regex-based approach for the rest
fills = [
    ('80',  ''),
    ('90',  'background:linear-gradient(90deg,#e67e22,#f39c12)'),
    ('70',  'background:linear-gradient(90deg,#9b59b6,#8e44ad)'),
    ('90',  ''),
    ('60',  'background:linear-gradient(90deg,#e67e22,#f39c12)'),
    ('100', 'background:linear-gradient(90deg,#f1c40f,#f39c12)'),
    ('100', ''),
    ('90',  'background:linear-gradient(90deg,#e67e22,#f39c12)'),
    ('90',  'background:linear-gradient(90deg,#1abc9c,#16a085)'),
    ('100', ''),
    ('40',  'background:linear-gradient(90deg,#e67e22,#f39c12)'),
    ('80',  'background:linear-gradient(90deg,#e74c3c,#c0392b)'),
]

# Use a single-pass regex replacement to set all opp-fill widths
def add_width_to_opp_fill(html):
    def replacer(m):
        full = m.group(0)
        # Already has width set? skip
        if 'width:' in full:
            return full
        w_m = re.search(r'data-w="(\d+)"', full)
        if not w_m:
            return full
        w = w_m.group(1)
        # Insert width into existing style or add new style attr
        style_m = re.search(r'style="([^"]*)"', full)
        if style_m:
            new_style = style_m.group(1).rstrip(';') + f';width:{w}%'
            return full.replace(style_m.group(0), f'style="{new_style}"')
        else:
            return full.replace('>', f' style="width:{w}%">', 1)
    return re.sub(r'<div class="opp-fill"[^>]*>', replacer, html)

html = add_width_to_opp_fill(html)

# ── 7. JS: strip down to navigation only ────────────────────────────────
new_script = '''<script>
const slides = Array.from(document.querySelectorAll('section'));
const N = slides.length;
let cur = 0;

/* desktop dots */
const dotsEl = document.getElementById('dots');
slides.forEach(function(_,i){
  const d = document.createElement('button');
  d.className = 'dot' + (i===0 ? ' on' : '');
  d.onclick = function(){ goTo(i); };
  dotsEl.appendChild(d);
});

/* mobile pips */
const pipsEl = document.getElementById('mpips');
slides.forEach(function(_,i){
  const p = document.createElement('button');
  p.className = 'mpip' + (i===0 ? ' on' : '');
  p.onclick = function(){ goTo(i); };
  pipsEl.appendChild(p);
});

document.getElementById('mprev').onclick = function(){ goTo(cur-1); };
document.getElementById('mnext').onclick = function(){ goTo(cur+1); };

function goTo(n){
  n = Math.max(0, Math.min(N-1, n));
  cur = n;
  slides[n].scrollIntoView({behavior:'smooth', block:'start'});
  updateNav(n);
}

function updateNav(i){
  document.querySelectorAll('.dot').forEach(function(d,j){ d.classList.toggle('on', j===i); });
  document.querySelectorAll('.mpip').forEach(function(p,j){ p.classList.toggle('on', j===i); });
  document.getElementById('progress').style.width = ((i+1)/N*100) + '%';
  document.getElementById('slide-ctr').textContent =
    String(i+1).padStart(2,'0') + ' / ' + String(N).padStart(2,'0');
}

/* Update nav indicator when user scrolls manually */
const io = new IntersectionObserver(function(entries){
  entries.forEach(function(e){
    if(e.isIntersecting){ cur = slides.indexOf(e.target); updateNav(cur); }
  });
},{rootMargin:'0px 0px -40% 0px', threshold:0});
slides.forEach(function(s){ io.observe(s); });

/* keyboard */
document.addEventListener('keydown', function(e){
  if(e.key==='ArrowDown'||e.key==='ArrowRight') goTo(cur+1);
  if(e.key==='ArrowUp'||e.key==='ArrowLeft') goTo(cur-1);
});
</script>'''

# Replace everything from <script> to </script> (the last one before </body>)
html = re.sub(r'<script>.*?</script>', new_script, html, flags=re.DOTALL)

HTML.write_text(html, encoding='utf-8')
size = HTML.stat().st_size // 1024
print(f"Done — {size} KB")

# Quick sanity checks
checks = [
    ('Counters set', '>35<' in html and '>77.300<' in html),
    ('Opp-fill widths', 'width:90%' in html and 'width:80%' in html),
    ('Bar heights', 'height:95%' in html and 'height:59%' in html),
    ('No opacity:0', 'opacity:0' not in html),
    ('No height:0 on bar-fill', 'height:0}' not in html),
    ('Nav JS present', 'scrollIntoView' in html),
]
for label, ok in checks:
    print(f"  {'OK' if ok else 'FAIL'}  {label}")
