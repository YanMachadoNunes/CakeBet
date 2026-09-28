import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ancora a raiz aqui (evita o Turbopack subir até a home por causa de um bun.lock lá).
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
