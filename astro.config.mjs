import { defineConfig } from 'astro/config';
import compress from 'astro-compress';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://atrani.ru',
  output: 'static',
  vite: {
    server: {
      proxy: {
        '/hooks': 'http://127.0.0.1:40003',
        '/webhook': 'http://127.0.0.1:40003',
      },
    },
  },
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes('/api-test') &&
        !page.endsWith('/edit') &&
        !page.endsWith('/edit/'),
    }),
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
