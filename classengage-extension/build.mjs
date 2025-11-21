import * as esbuild from 'esbuild';

// Bundle content script
await esbuild.build({
  entryPoints: ['src/contentScript.src.js'],
  bundle: true,
  outfile: 'src/extension/contentScript.js',
  format: 'iife',
  target: ['chrome100'],
  minify: false,
});

// Bundle background script
await esbuild.build({
  entryPoints: ['src/background.src.js'],
  bundle: true,
  outfile: 'src/extension/background.js',
  format: 'esm',
  target: ['chrome100'],
  minify: false,
});

console.log('Build complete!');
