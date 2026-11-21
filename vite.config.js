import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// A unique id for every build. On Vercel this is the git commit; locally a timestamp.
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || Date.now().toString(36)).slice(0, 12);
const BUILD_TIME = new Date().toISOString();
// On Vercel this is the message of the git commit being deployed.
const BUILD_MSG = (process.env.VERCEL_GIT_COMMIT_MESSAGE || '').split('\n')[0].slice(0, 140);

// Writes /version.json next to the site so open tabs can tell when a new version is live.
const versionFile = () => ({
  name: 'version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: BUILD_ID, builtAt: BUILD_TIME, message: BUILD_MSG }) });
  },
});

// `npm run build:demo` produces a single self-contained HTML file (no Firebase,
// resumes stored in the browser). Normal builds are a regular multi-file SPA.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'demo' ? [react(), viteSingleFile()] : [react(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
    __BUILD_MSG__: JSON.stringify(BUILD_MSG),
  },
  build: mode === 'demo' ? { outDir: 'dist-demo', assetsInlineLimit: 100000000 } : {},
}));
