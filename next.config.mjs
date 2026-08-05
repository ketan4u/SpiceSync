/** @type {import('next').NextConfig} */
const nextConfig = {
  // The quiz engine and its verification harnesses share one set of modules.
  // The harnesses run under `node --experimental-strip-types`, which requires
  // explicit .ts extensions on relative imports, so the app resolves them too.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
