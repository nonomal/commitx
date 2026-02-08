import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/index.ts'],
  format: ['esm'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // 将 templates 目录的处理交给 package.json 的 files 字段
  external: ['inquirer'],
});
