// Tipografías disponibles en el back office (Google Fonts) con los pesos que cada una publica.
export const FONTS = {
  'Red Hat Display': [400, 500, 600, 700, 800, 900],
  'Red Hat Text': [400, 500, 600, 700],
  'Montserrat': [400, 500, 600, 700, 800, 900],
  'Poppins': [400, 500, 600, 700, 800, 900],
  'Archivo': [400, 500, 600, 700, 800, 900],
  'DM Sans': [400, 500, 600, 700, 800, 900],
  'Outfit': [400, 500, 600, 700, 800, 900],
  'Work Sans': [400, 500, 600, 700, 800, 900],
  'Raleway': [400, 500, 600, 700, 800, 900],
  'Barlow': [400, 500, 600, 700, 800, 900],
  'Libre Franklin': [400, 500, 600, 700, 800, 900],
  'Source Sans 3': [400, 500, 600, 700, 800, 900],
  'Mulish': [400, 500, 600, 700, 800, 900],
  'Nunito Sans': [400, 600, 700, 800, 900],
  'Open Sans': [400, 500, 600, 700, 800],
  'Roboto': [400, 500, 700, 900],
  'Lato': [400, 700, 900],
  'Josefin Sans': [400, 500, 600, 700],
  'Playfair Display': [400, 500, 600, 700, 800, 900],
  'Merriweather': [400, 700, 900],
};

export function fontsHref(display, body) {
  const fam = [...new Set([display, body])].filter(f => FONTS[f])
    .map(f => `family=${f.replace(/ /g, '+')}:wght@${FONTS[f].join(';')}`);
  return `https://fonts.googleapis.com/css2?${fam.join('&')}&display=swap`;
}
