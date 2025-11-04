import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/login", destination: "/pages/PageLogin" },
        { source: "/home", destination: "/pages/PageHome" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
