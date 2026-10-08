// Tipografías disponibles (Google Fonts). Los pesos listados existen en cada familia.
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Segoe UI", system-ui, -apple-system, sans-serif';
const S = (w, c = 'serif') => ({ w, c });
export const FONTS = {
  // Serif para títulos
  'DM Serif Display': S([400]),
  'Fraunces': S([400, 500, 600, 700]),
  'Young Serif': S([400]),
  'Cormorant Garamond': S([400, 500, 600, 700]),
  'Playfair Display': S([400, 500, 600, 700, 800]),
  'Libre Baskerville': S([400, 700]),
  'Lora': S([400, 500, 600, 700]),
  'Merriweather': S([400, 700]),
  'EB Garamond': S([400, 500, 600, 700]),
  'Crimson Pro': S([400, 500, 600, 700]),
  'Newsreader': S([400, 500, 600, 700]),
  'Source Serif 4': S([400, 500, 600, 700]),
  'Spectral': S([400, 500, 600, 700]),
  'Bitter': S([400, 500, 600, 700]),
  'Roboto Slab': S([400, 500, 600, 700]),
  'Zilla Slab': S([400, 500, 600, 700]),
  'Instrument Serif': S([400]),
  'Gloock': S([400]),
  'Prata': S([400]),
  'Abril Fatface': S([400]),
  'Marcellus': S([400]),
  'Cinzel': S([400, 500, 600, 700]),
  // Sans serif
  'Jost': S([400, 500, 600, 700], 'sans'),
  'Figtree': S([400, 500, 600, 700, 800], 'sans'),
  'Instrument Sans': S([400, 500, 600, 700], 'sans'),
  'Bricolage Grotesque': S([400, 500, 600, 700, 800], 'sans'),
  'DM Sans': S([400, 500, 600, 700], 'sans'),
  'Manrope': S([400, 500, 600, 700, 800], 'sans'),
  'Inter': S([400, 500, 600, 700, 800], 'sans'),
  'Poppins': S([400, 500, 600, 700, 800], 'sans'),
  'Montserrat': S([400, 500, 600, 700, 800], 'sans'),
  'Nunito': S([400, 500, 600, 700, 800], 'sans'),
  'Nunito Sans': S([400, 600, 700, 800], 'sans'),
  'Work Sans': S([400, 500, 600, 700], 'sans'),
  'Outfit': S([400, 500, 600, 700, 800], 'sans'),
  'Plus Jakarta Sans': S([400, 500, 600, 700, 800], 'sans'),
  'Raleway': S([400, 500, 600, 700, 800], 'sans'),
  'Open Sans': S([400, 500, 600, 700, 800], 'sans'),
  'Lato': S([400, 700, 900], 'sans'),
  'Source Sans 3': S([400, 500, 600, 700], 'sans'),
  'Rubik': S([400, 500, 600, 700], 'sans'),
  'Karla': S([400, 500, 600, 700], 'sans'),
  'Mulish': S([400, 500, 600, 700, 800], 'sans'),
  'Red Hat Display': S([400, 500, 600, 700, 800], 'sans'),
  'Red Hat Text': S([400, 500, 600, 700], 'sans'),
  'Lexend': S([400, 500, 600, 700], 'sans'),
  'Sora': S([400, 500, 600, 700, 800], 'sans'),
  'Space Grotesk': S([400, 500, 600, 700], 'sans'),
  'Archivo': S([400, 500, 600, 700, 800], 'sans'),
  'Barlow': S([400, 500, 600, 700, 800], 'sans'),
  'Libre Franklin': S([400, 500, 600, 700, 800], 'sans'),
  'Urbanist': S([400, 500, 600, 700, 800], 'sans'),
  'Albert Sans': S([400, 500, 600, 700, 800], 'sans'),
  'Onest': S([400, 500, 600, 700, 800], 'sans'),
  'Hanken Grotesk': S([400, 500, 600, 700, 800], 'sans'),
  'Josefin Sans': S([400, 500, 600, 700], 'sans'),
  'Quicksand': S([400, 500, 600, 700], 'sans'),
  'Comfortaa': S([400, 500, 600, 700], 'sans'),
  'Syne': S([400, 500, 600, 700, 800], 'sans'),
  'Unbounded': S([400, 500, 600, 700, 800], 'sans'),
  'Oswald': S([400, 500, 600, 700], 'sans'),
  'Bebas Neue': S([400], 'sans'),
  'Anton': S([400], 'sans'),
  'Righteous': S([400], 'sans'),
};

export const fontStack = name => `"${name}", ${FONTS[name]?.c === 'sans' ? SANS : SERIF}`;

// Una hoja por familia: si una falla, la otra igual carga.
export function fontHref(name, weights) {
  const f = FONTS[name];
  if (!f) return null;
  const ws = [...new Set(weights.filter(w => f.w.includes(w)))].sort((a, b) => a - b);
  const use = ws.length ? ws : f.w;
  const fam = name.replace(/ /g, '+') + (use.length === 1 && use[0] === 400 ? '' : ':wght@' + use.join(';'));
  return `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
}
