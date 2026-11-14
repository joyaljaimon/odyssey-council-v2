// Load the shared root .env (BRAIN_URL, NEXT_PUBLIC_BRAIN_WS, PUBLIC_BASE_URL, ...) so every package uses one file.
try { process.loadEnvFile(new URL("../.env", import.meta.url)); } catch { /* no .env: use defaults */ }

/** @type {import('next').NextConfig} */
export default {
  devIndicators: false, // the dev badge would show up in the FaceTime video
  outputFileTracingRoot: new URL("..", import.meta.url).pathname,
  transpilePackages: ["@odyssey/contracts", "@odyssey/story"],
};
