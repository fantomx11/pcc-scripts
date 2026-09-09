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

const buildFiles = {
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

const migratedFiles = [
  'build.mjs',
  ...Object.keys(buildFiles).map((f) => f.replace(/\.tsx$/, '.js')),
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

const sharedTsFiles = findFiles(path.resolve(srcDir, 'classes'), '.ts');

if (sharedTsFiles.length > 0) {
  console.log(`Compiling ${sharedTsFiles.length} shared TypeScript files for legacy compatibility...`);
  await esbuild.build({
    entryPoints: sharedTsFiles,
    outdir: distDir,
    outbase: srcDir, // ts/classes/Job.ts becomes dist/classes/Job.js
    format: 'esm',
    target: 'es2022',
  });
}

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
        fileName: schamea.fileName,
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

for [name, schema] of Object.entries(buildFiles) {
  console.log(`Building: ${name}`);
  await schema.builder(name, schema);
}

console.log('Build completed successfully. Output ready in ./dist');