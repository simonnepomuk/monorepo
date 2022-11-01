import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npx nx preview test-app',
    port: 5000,
    timeout: 30000,
  },
};

export default config;
