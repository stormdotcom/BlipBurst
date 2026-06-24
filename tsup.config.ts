import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'adapters/nestjs/index': 'src/adapters/nestjs/index.ts',
    'adapters/express/index': 'src/adapters/express/index.ts',
    'adapters/react/index': 'src/adapters/react/index.ts',
    'adapters/testing/index': 'src/adapters/testing/index.ts',
    'intercept/index': 'src/intercept/index.ts',
    'cli/blipburst': 'cli/blipburst.ts',
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
});
