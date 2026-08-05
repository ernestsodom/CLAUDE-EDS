import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "mammoth", "xlsx", "pdf-lib", "docx", "pptxgenjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
