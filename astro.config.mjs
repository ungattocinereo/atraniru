// @ts-check
import { defineConfig } from 'astro/config';
import compress from 'astro-compress';

// https://astro.build/config
export default defineConfig({
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
