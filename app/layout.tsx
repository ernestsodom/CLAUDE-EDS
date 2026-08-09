import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Padel Business Management Platform',
    template: '%s · Padel Business',
  },
  description:
    'Sistema operativo de gestion del negocio de canchas de padel: comercial, fabricacion, logistica, instalacion y finanzas.',
};

export const viewport: Viewport = {
  themeColor: '#080808',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="min-h-screen bg-base text-content antialiased">{children}</body>
    </html>
  );
}
