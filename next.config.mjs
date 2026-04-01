/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    // Windows: PackFileCacheStrategy often fails with ENOENT when renaming
    // *.pack.gz_ -> *.pack.gz (AV/sync/locking). Memory cache avoids that path.
    if (dev && process.platform === "win32") {
      config.cache = { type: "memory" };
    }
    return config;
  },
};

export default nextConfig;
