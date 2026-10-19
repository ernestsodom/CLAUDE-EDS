/** @type {import('next').NextConfig} */
export default {
  experimental: {
    // Las fotos se comprimen en el navegador, pero dejamos margen.
    serverActions: { bodySizeLimit: '4mb' },
  },
};
