import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  headers: async () => [
    {
      source: "/pdfjs/wasm/:path*",
      headers: [
        { key: "Content-Type", value: "application/wasm" },
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/pdfjs/:path*.mjs",
      headers: [
        {
          key: "Content-Type",
          value: "text/javascript; charset=utf-8",
        },
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ],
};

export default nextConfig;
