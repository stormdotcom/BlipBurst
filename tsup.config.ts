import { defineConfig } from 'tsup';

export default defineConfig([
  // Main entries with full DTS
  {
    entry: {
      'index': 'src/index.ts',
      'adapters/testing/index': 'src/adapters/testing/index.ts',
      'intercept/index': 'src/intercept/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    splitting: false,
    clean: true,
    external: [
      'axios', '@opentelemetry/api', 'react', '@angular/common',
      'rxjs', '@nestjs/common', 'express', 'node-fetch',
    ],
    esbuildOptions(options) {
      options.platform = 'node';
    },
  },
  // Peer-dep adapters — DTS disabled (peer deps not installed in dev)
  {
    entry: {
      'adapters/nestjs/index': 'src/adapters/nestjs/index.ts',
      'adapters/express/index': 'src/adapters/express/index.ts',
      'adapters/react/index': 'src/adapters/react/index.ts',
      'cli/blipburst': 'cli/blipburst.ts',
    },
    format: ['esm', 'cjs'],
    dts: false,
    sourcemap: true,
    splitting: false,
    external: [
      'axios', '@opentelemetry/api', 'react', '@angular/common',
      'rxjs', '@nestjs/common', 'express', 'node-fetch',
    ],
    esbuildOptions(options) {
      options.platform = 'node';
    },
  },
]);
