import { defineConfig } from 'vite';
// Relative base so the production build works from any sub-path.
// fonts are inlined (assetsInlineLimit) so the build is fully self-contained
export default defineConfig({ base: './', server: { port: 5173 }, build: { assetsInlineLimit: 200000 } });
