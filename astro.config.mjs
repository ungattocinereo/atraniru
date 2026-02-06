import { defineConfig } from 'astro/config';
import compress from 'astro-compress';

export default defineConfig({
  site: 'https://atrani.ru',
  output: 'static',
  integrations: [
    compress({
      HTML: true,
      CSS: true,
      JS: true,
      SVG: true,
      Image: false,
      brotli: false,
      gzip: false,
    }),
  ],
});
