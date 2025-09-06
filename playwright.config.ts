import { defineConfig } from '@playwright/test';

export default defineConfig({
	use: {
		headless: false,
		viewport: { width: 1280, height: 800 },
	},
	timeout: 60_000,
});
