import './globals.css';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Liga Manquehue',
  description: 'Liga de Ex Alumnos y Apoderados — Colegio Sagrados Corazones de Manquehue',
};

export const viewport = { themeColor: '#0a2463' };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
