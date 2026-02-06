// @ts-check
import { defineConfig } from 'astro/config';
import compress from 'astro-compress';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [
    compress({
      brotli: true,
      gzip: true,
      html: true,
      css: true,
      js: true,
      svg: true,
      img: false, 
      image: false 
    }),
  ],
});
