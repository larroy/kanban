import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: false, // tests share DB state — run serially
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [['list'], ['html', { open: 'never' }]],

	use: {
		baseURL: 'http://localhost:5173',
		trace: 'on-first-retry',
		// Give the app time to settle after navigation
		actionTimeout: 10_000,
		navigationTimeout: 15_000,
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	// Start the SvelteKit dev server before running tests
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: true,
		timeout: 30_000,
	},
});
