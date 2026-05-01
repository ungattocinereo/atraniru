import { defineConfig } from 'astro/config';
import compress from 'astro-compress';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://atrani.ru',
  output: 'static',
  redirects: {
    '/photosessions': '/photos',
  },
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
        !page.includes('/privacy-policy') &&
        !page.endsWith('/edit') &&
        !page.endsWith('/edit/'),
      serialize(item) {
        const url = item.url;
        const path = new URL(url).pathname;

        if (path === '/') {
          return { ...item, priority: 1.0, changefreq: 'weekly' };
        }
        if (['/apartments', '/experience', '/contacts', '/blog'].includes(path) ||
            ['/apartments/', '/experience/', '/contacts/', '/blog/'].includes(path)) {
          return { ...item, priority: 0.9, changefreq: 'weekly' };
        }
        if (['/tours-car', '/transport', '/photos', '/orel-i-reshka-amalfi'].includes(path) ||
            ['/tours-car/', '/transport/', '/photos/', '/orel-i-reshka-amalfi/'].includes(path)) {
          return { ...item, priority: 0.8, changefreq: 'monthly' };
        }
        if (path.startsWith('/blog/')) {
          return { ...item, priority: 0.7, changefreq: 'monthly' };
        }
        if (path.startsWith('/photosessions/')) {
          return { ...item, priority: 0.6, changefreq: 'yearly' };
        }
        return { ...item, priority: 0.5, changefreq: 'monthly' };
      },
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
