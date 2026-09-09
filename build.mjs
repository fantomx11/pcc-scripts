import { build } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');

// 1. Clean dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 2. Stage legacy folders so unconverted scripts and companion files still exist
const copyDirs = ['classes', 'modules', 'styles', 'components', 'src'];
for (const dir of copyDirs) {
  const srcPath = path.resolve(rootDir, dir);
  if (fs.existsSync(srcPath)) {
    fs.cpSync(srcPath, path.resolve(distDir, dir), { recursive: true });
  }
}

// Stage top-level legacy scripts and HTML utilities
const topLevelFiles = fs.readdirSync(rootDir);
for (const file of topLevelFiles) {
  if (
    (file.endsWith('.js') || file.endsWith('.html')) &&
    file !== 'build.mjs' &&
    file !== 'sketch-generator.html'
  ) {
    fs.copyFileSync(path.resolve(rootDir, file), path.resolve(distDir, file));
  }
}

// 3. Compile converted shared TypeScript files from ts/ into dist/
function findFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.resolve(dir, item.name);
    if (item.isDirectory()) {
      results.push(...findFiles(fullPath, ext));
    } else if (item.name.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

// Find all shared TS files (excluding root bookmarklet entry points like estimate-kanban)
const tsDir = path.resolve(rootDir, 'ts');
const sharedTsFiles = findFiles(path.resolve(tsDir, 'classes'), '.ts');

if (sharedTsFiles.length > 0) {
  console.log(`Compiling ${sharedTsFiles.length} shared TypeScript files for legacy compatibility...`);
  await esbuild.build({
    entryPoints: sharedTsFiles,
    outdir: distDir,
    outbase: tsDir, // ts/classes/Job.ts becomes dist/classes/Job.js
    format: 'esm',
    target: 'es2022',
  });
}

// 4. Bundle estimate-kanban into a single standalone IIFE
const kanbanEntry = fs.existsSync(path.resolve(tsDir, 'estimate-kanban.tsx'))
  ? './ts/estimate-kanban.tsx'
  : fs.existsSync(path.resolve(rootDir, 'estimate-kanban.tsx'))
  ? './estimate-kanban.tsx'
  : './estimate-kanban.js';

console.log(`Bundling estimate-kanban using entry: ${kanbanEntry}...`);

await build({
  configFile: false,
  plugins: [cssInjectedByJsPlugin()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  build: {
    emptyOutDir: false,
    outDir: distDir,
    lib: {
      entry: path.resolve(rootDir, kanbanEntry),
      name: 'EstimateKanban',
      formats: ['iife'],
      fileName: () => 'estimate-kanban.js',
    },
  },
});

const sketchHtml = path.resolve(rootDir, 'sketch-generator.html');
if (fs.existsSync(sketchHtml)) {
  console.log('Bundling sketch-generator.html...');
  await build({
    configFile: false,
    root: rootDir,
    base: './',
    build: {
      emptyOutDir: false,
      outDir: distDir,
      rollupOptions: {
        input: {
          sketch: sketchHtml,
        },
      },
    },
  });
}

console.log('Build completed successfully. Output ready in ./dist');