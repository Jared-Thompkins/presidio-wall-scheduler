import { chromium } from 'playwright';
import { loadConfig } from './env';
import fs from 'fs/promises';
import path from 'path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

async function main() {
	const cfg = loadConfig();
	const storagePath = cfg.STORAGE_STATE!;
	const storageDir = path.dirname(storagePath);
	await fs.mkdir(storageDir, { recursive: true });

	const userDataDir = cfg.USER_DATA_DIR!;
	await fs.mkdir(userDataDir, { recursive: true });

	const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
	const page = await context.newPage();
	await page.goto(cfg.REC_URL);
	console.log('Log in on the page (including OTP).');
	const rl = readline.createInterface({ input, output });
	await rl.question('Press Enter here to save session once fully logged in...');
	rl.close();

	await context.storageState({ path: storagePath });

	try {
		const raw = await fs.readFile(storagePath, 'utf-8');
		const json = JSON.parse(raw) as { cookies?: Array<{ domain: string; name: string }>; };
		const recCookies = (json.cookies || []).filter(c => /rec\.us/i.test(c.domain));
		if (recCookies.length > 0) {
			console.log(`Saved storage with ${recCookies.length} cookie(s) for rec.us: ${recCookies.map(c => c.name).join(', ')}`);
		} else {
			console.warn('Saved storage, but did not find cookies for rec.us. Login may not be persisted.');
		}
	} catch {
		console.warn('Saved storage, but could not verify contents.');
	}

	await context.close();
	console.log('Storage state saved at', storagePath);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
