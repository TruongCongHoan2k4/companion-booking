import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.js',
    supportFile: 'cypress/support/e2e.js',
    fixturesFolder: 'cypress/fixtures',
    videosFolder: 'cypress/videos',
    screenshotsFolder: 'cypress/screenshots',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 15000,
  },
  env: {
    apiUrl: process.env.CYPRESS_API_URL || 'http://localhost:3000/api',
    e2eUser: process.env.CYPRESS_E2E_USER || '',
    e2ePassword: process.env.CYPRESS_E2E_PASSWORD || '',
  },
});
