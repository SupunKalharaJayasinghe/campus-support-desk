/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Filesystem pack cache on Windows can corrupt (missing vendor-chunks, ENOENT); memory is stable.
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
