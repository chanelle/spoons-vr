// SPOONS build: Vite + Meta IWSDK. `npm run build` writes static files to dist/.
import { defineConfig } from 'vite';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';

export default defineConfig({
  base: './', // relative paths, so dist/ works from any folder (e.g. /spoons-vr/ on GitHub Pages)
  plugins: [
    // Dev only: injects the IWER emulator (Quest 3) on localhost so the XR path runs without a headset.
    // SPOONS_HTTP=1 serves plain HTTP for headless test runs; default is HTTPS (needed by a real Quest).
    iwsdkDev({ emulator: { device: 'metaQuest3' }, https: !process.env.SPOONS_HTTP }),
  ],
  server: { host: true, port: 8081 },
  build: { target: 'esnext', outDir: 'dist', sourcemap: false },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
});
