import { defineConfig } from 'tsup';

// Bundle the workspace packages (they ship TS source) but keep real npm deps
// external so they resolve from node_modules at runtime.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  skipNodeModulesBundle: true,
  noExternal: [/^@ddotsjobs\//],
  sourcemap: true,
});
