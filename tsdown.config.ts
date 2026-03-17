import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: { build: true },
    target: 'node20',
  },
  {
    entry: { cli: 'src/cli.ts' },
    format: ['cjs', 'esm'],
    dts: false,
    banner: { js: '#!/usr/bin/env node' },
    target: 'node20',
    copy: [
      {
        from: 'src/templates/presets/**/*.txt',
        to: 'dist/presets',
        flatten: true,
      },
    ],
  },
  {
    // Child process entry for per-font subsetting (enables true multi-core parallelism).
    entry: { 'minify-child': 'src/core/minify-child.ts' },
    format: ['esm', 'cjs'],
    dts: false,
    target: 'node20',
  },
])
