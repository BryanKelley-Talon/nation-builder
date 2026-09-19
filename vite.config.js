/* Nation Builder (Flashpoint History), 2026. GNU GPL v3 with additional terms — see LICENSE and NOTICE.md. */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { shipLicenses } from './vite-plugin-licenses.js';

function buildId() {
  try {
    return execSync('git log -1 --pretty=format:%h').toString().trim();
  } catch (e) {
    return 'dev';
  }
}

process.env.VITE_BUILD_ID = buildId();

export default defineConfig({
  // Relative base so the build works from any subdomain or folder.
  base: './',
  plugins: [react(), shipLicenses()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        about: resolve(import.meta.dirname, 'about.html'),
        name_license: resolve(import.meta.dirname, 'name_license.html'),
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/*.ts', 'test/**/*.test.js'],
  },
});
