import { chromium } from 'playwright';
import fs from 'fs/promises';
import { loadConfig } from './env';

async function main() {
	const cfg = loadConfig();
	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({ storageState: cfg.STORAGE_STATE, timezoneId: cfg.TZ });
	const page = await context.newPage();
	await page.goto(cfg.REC_URL, { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

	const dump = await page.evaluate(() => {
		const data: Array<{ tag: string; text: string; role?: string; href?: string; id?: string; cls?: string; testid?: string }>[] = [] as any;
		const elements: Element[] = [
			...Array.from(document.querySelectorAll('a, button, [role="button"], [data-testid], [aria-label]')),
		];
		const uniq = new Set<Element>();
		elements.forEach((el) => {
			if (uniq.has(el)) return; uniq.add(el);
			const tag = el.tagName.toLowerCase();
			const text = (el as HTMLElement).innerText?.trim().slice(0, 120) || '';
			const role = el.getAttribute('role') || undefined;
			const href = (el as HTMLAnchorElement).href || undefined;
			const id = el.id || undefined;
			const cls = el.className || undefined;
			const testid = el.getAttribute('data-testid') || undefined;
			(data as any).push({ tag, text, role, href, id, cls, testid });
		});
		return data;
	});

	await fs.writeFile('inspect-elements.json', JSON.stringify(dump, null, 2));
	await page.screenshot({ path: 'inspect.png', fullPage: true });

	console.log('Wrote inspect-elements.json and inspect.png');
	await context.close();
	await browser.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
