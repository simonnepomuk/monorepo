import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npx nx preview e2e-sveltekit-adapter-firebase',
    //we abuse the sverdle endpoint as health endpoint for the webserver
    url: 'http://localhost:5001/sveltekit-adapter/us-central1/handler/sverdle',
    timeout: 60 * 1000,
    reuseExistingServer: false,
  },
  use: {
    baseURL: 'http://localhost:5000/',
  },
};

export default config;
