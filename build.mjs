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

const buildFiles = {
  'compliance.html': {
    builder: justCopy
  },
  'index.html': {
    builder: justCopy
  },
  'estimate-discrepancy-filter.js': {
    builder: justCopy
  },

  'sketch-generator.html': {
    builder: buildHtml,
  },
  'estimate-matcher.html':  {
    builder: buildHtml,
  },

  'simplify-job-list.tsx': {
    builder: buildIIFE,
    name: "SimplifyJobList",
    fileName: () => 'simplify-job-list.js'
  },
  'wo-to-calendar.tsx': {
    builder: buildIIFE,
    name: 'WorkOrderCalendar',
    fileName: () => 'wo-to-calendar.js',
  },
  'estimate-kanban.tsx': {
    builder: buildIIFE,
    name: 'EstimateKanban',
    fileName: () => 'estimate-kanban.js',
  },
  'rich-text-notes.ts': {
    builder: buildIIFE,
    name: 'RichTextNotes',
    fileName: () => 'rich-text-notes.js',
  },  
};

async function buildIIFE(name, schema) {
  const entry = path.resolve(srcDir, name);
  if (!fs.existsSync(entry)) {
    console.warn(`Skipping ${name}: file not found at ${entry}`);
    return;
  }

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
        entry: path.resolve(rootDir, entry),
        name: schema.name,
        formats: ['iife'],
        fileName: schema.fileName,
      },
    },
  });
}

async function buildHtml(name, schema) {
  const entry = path.resolve(srcDir, name);
  if (!fs.existsSync(entry)) {
    console.warn(`Skipping ${name}: file not found at ${entry}`);
    return;
  }

  const chunkName = name.replace(/\.html$/, '');
  await build({
    configFile: false,
    root: srcDir,
    base: './',
    build: {
      emptyOutDir: false,
      outDir: distDir,
      rollupOptions: {
        input: {
          [chunkName]: entry,
        },
      },
    },
  });
}

async function justCopy(name, schema) {
  // Check ts/ directory first, then fallback to rootDir
  let srcPath = path.resolve(srcDir, name);
  if (!fs.existsSync(srcPath)) {
    srcPath = path.resolve(rootDir, name);
  }

  if (!fs.existsSync(srcPath)) {
    console.warn(`Skipping ${name}: file not found in ${srcDir} or ${rootDir}`);
    return;
  }

  // Support schema.fileName as a function, string, or default to the source name
  const destName = typeof schema?.fileName === 'function'
    ? schema.fileName()
    : (schema?.fileName || name);

  const destPath = path.resolve(distDir, destName);

  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
}

for (const [name, schema] of Object.entries(buildFiles)) {
  console.log(`Building: ${name}`);
  await schema.builder(name, schema);
}

console.log('Build completed successfully. Output ready in ./dist');