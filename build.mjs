import { build } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.resolve(rootDir, 'dist');
const srcDir = path.resolve(rootDir, 'ts');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

const copyDirs = ['classes', 'modules', 'styles', 'components', 'src'];
for (const dir of copyDirs) {
  const srcPath = path.resolve(rootDir, dir);
  if (fs.existsSync(srcPath)) {
    fs.cpSync(srcPath, path.resolve(distDir, dir), { recursive: true });
  }
}

const migratedFiles = [
  'build.mjs',
  'sketch-generator.html',
  'estimate-matcher.html',
  'simplify-job-list.js'
];

const topLevelFiles = fs.readdirSync(rootDir);
for (const file of topLevelFiles) {
  if ((file.endsWith('.js') || file.endsWith('.html')) && migratedFiles.indexOf(file) === -1) {
    fs.copyFileSync(path.resolve(rootDir, file), path.resolve(distDir, file));
  }
}

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

const simplifyEntry = fs.existsSync(path.resolve(tsDir, 'simplify-job-list.tsx'))
  ? './ts/simplify-job-list.tsx'
  : './simplify-job-list.js';

console.log(`Bundling simplify-job-list using entry: ${simplifyEntry}...`);

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
      entry: path.resolve(rootDir, simplifyEntry),
      name: 'SimplifyJobList',
      formats: ['iife'],
      fileName: () => 'simplify-job-list.js',
    },
  },
});

const matcherHtml = path.resolve(tsDir, 'estimate-matcher.html');
if (fs.existsSync(matcherHtml)) {
  console.log('Bundling ts/estimate-matcher.html...');
  await build({
    configFile: false,
    root: tsDir, // Vite root set to ts/ so HTML outputs to dist/estimate-matcher.html
    base: './',  // Relative asset URLs (./assets/...) for subpath hosting
    build: {
      emptyOutDir: false,
      outDir: distDir,
      rollupOptions: {
        input: {
          'estimate-matcher': matcherHtml,
        },
      },
    },
  });
}

console.log('Build completed successfully. Output ready in ./dist');