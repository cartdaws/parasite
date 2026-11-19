import { defineConfig } from 'vite';
// Relative base so the production build works from any sub-path.
export default defineConfig({ base: './', server: { port: 5173 } });
