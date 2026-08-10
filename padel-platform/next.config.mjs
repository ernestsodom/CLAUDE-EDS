/**
 * Cabeceras de seguridad (FASE 15).
 *
 * No sustituyen a RLS ni a los permisos del servidor —esa sigue siendo
 * la frontera real— pero cierran clases de ataque que ocurren en el
 * navegador y que ninguna politica de base de datos puede tocar:
 * clickjacking, sniffing de MIME y filtrado de referrer, entre otras.
 * `Strict-Transport-Security` solo tiene efecto real servido por HTTPS
 * (Vercel lo sirve siempre asi).
 */
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: false },
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
export default nextConfig;
