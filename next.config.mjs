/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Avoid intermittent filesystem cache rename errors on Windows dev runs.
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
