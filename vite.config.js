import { defineConfig } from 'vite';

// Relative base so the build works at https://<user>.github.io/<repo>/. The build stamp is shown on the menu.
const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
export default defineConfig({ base: './', define: { __BUILD__: JSON.stringify(stamp) } });
