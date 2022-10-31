import { mergeConfig } from 'vite';
import baseConfig from '../../vitest.config';

export default mergeConfig(baseConfig, {
  plugins: [],
  test: {
    coverage: {
      reporter: ['text', 'json', 'html'],
      provider: 'c8',
      reportsDirectory: '../../coverage/sveltekit-adapter-firebase'
    },
  }
});
