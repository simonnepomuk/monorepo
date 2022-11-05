import adapter from '../../dist/libs/sveltekit-adapter-firebase/index.js';
import preprocess from 'svelte-preprocess';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://github.com/sveltejs/svelte-preprocess
  // for more information about preprocessors
  preprocess: preprocess(),

  kit: {
    alias: {
      $stores: 'src/stores',
    },
    adapter: adapter({ outDir: '../../dist/apps/test-app' }),
    csrf: {
      checkOrigin: false,
    },
  },
};

export default config;
