import { chromium } from 'playwright';
import { loadConfig } from './env';

function addDays(date: Date, days: number): Date {
	const d = new Date(date);
	d.setUTCDate(d.getUTCDate() + days);
	return d;
}

function getOrdinal(n: number): string {
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return s[(v - 20) % 10] || s[v] || s[0];
}

function getZonedDateOnly(date: Date, timeZone: string): Date {
	const parts = new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		timeZone,
	}).formatToParts(date).reduce<Record<string, number>>((acc, p) => {
		if (p.type === 'year') acc.year = Number(p.value);
		if (p.type === 'month') acc.month = Number(p.value);
		if (p.type === 'day') acc.day = Number(p.value);
		return acc;
	}, {} as any);
	return new Date(Date.UTC(parts.year!, (parts.month! - 1), parts.day!, 12, 0, 0));
}

function getTzParts(date: Date, timeZone: string) {
	const fmt = new Intl.DateTimeFormat('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone,
	});
	const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
		if (p.type !== 'literal') acc[p.type] = p.value;
		return acc;
	}, {});
	return {
		weekday: parts.weekday!,
		month: parts.month!,
		day: Number(parts.day!),
		year: Number(parts.year!),
	};
}

function buildReactDatepickerAriaLabel(date: Date, timeZone: string): string {
	const p = getTzParts(date, timeZone);
	return `Choose ${p.weekday}, ${p.month} ${p.day}${getOrdinal(p.day)}, ${p.year}`;
}

async function openDatepicker(page: any) {
	const input = page.locator('.react-datepicker__input-container input, input.react-datepicker-ignore-onclickoutside');
	await input.first().click({ force: true });
	await page.locator('.react-datepicker-popper, .react-datepicker').first().waitFor({ state: 'visible', timeout: 5000 });
}

async function goToMonthIfNeeded(page: any, targetMonthYear: string) {
	for (let i = 0; i < 12; i++) {
		const header = page.locator('.react-datepicker__header [class*="font-medium"], .react-datepicker__header small');
		const text = (await header.first().textContent())?.trim() || '';
		if (text === targetMonthYear) return;
		await page.locator('button:has(img[alt="right"])').first().click();
		await page.waitForTimeout(30);
	}
}

async function selectSpecificDate(page: any, timeZone: string, year: number, month: number, dayNum: number) {
	const targetDate = new Date(Date.UTC(year, month - 1, dayNum, 12, 0, 0));
	await openDatepicker(page);

	const monthYearFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone });
	await goToMonthIfNeeded(page, monthYearFmt.format(targetDate));

	const aria = buildReactDatepickerAriaLabel(targetDate, timeZone);
	console.log('Target aria-label:', aria);
	const day = page.locator(`[aria-label="${aria}"]`);
	await day.first().waitFor({ state: 'visible', timeout: 3000 });
	const disabled = await day.first().getAttribute('aria-disabled');
	if (disabled === 'true') throw new Error(`Target date disabled: ${aria}`);
	await day.first().click();

	const input = page.locator('.react-datepicker__input-container input, input.react-datepicker-ignore-onclickoutside');
	const value = await input.first().inputValue();
	console.log('Date input value after click:', value);
}

async function main() {
	const cfg = loadConfig();
	const context = await chromium.launchPersistentContext(cfg.USER_DATA_DIR!, { headless: false, timezoneId: cfg.TZ });
	const page = await context.newPage();
	await page.goto(cfg.REC_URL, { waitUntil: 'domcontentloaded' });
	await selectSpecificDate(page, cfg.TZ, 2025, 9, 6);

	// Select time slot by visible label
	const label = '5:00 PM';
	const slotButton = page.locator('button:has-text("' + label + '")');
	await slotButton.first().waitFor({ state: 'visible', timeout: 3000 });
	await slotButton.first().click();
	console.log('Clicked slot label:', label);

	// Open participant dropdown and choose the last option
	const listboxBtn = page.locator('button[aria-haspopup="listbox"]');
	await listboxBtn.first().waitFor({ state: 'visible', timeout: 5000 });
	await listboxBtn.first().scrollIntoViewIfNeeded();
	await listboxBtn.first().click();
	const options = page.locator('[role="option"]');
	await options.first().waitFor({ state: 'visible', timeout: 5000 });
	const count = await options.count();
	if (count > 0) {
		await options.nth(count - 1).click();
		console.log('Selected participant: last option');
	} else {
		console.log('No participant options found');
	}

	// Click Book button
	const bookBtn = page.getByRole('button', { name: /^Book$/i });
	await bookBtn.first().waitFor({ state: 'visible', timeout: 5000 });
	await bookBtn.first().click();
	console.log('Clicked Book');

	await page.waitForTimeout(1500);
	await context.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
