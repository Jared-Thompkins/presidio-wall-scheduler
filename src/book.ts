import { chromium, BrowserContext } from 'playwright';
import { loadConfig } from './env';
import { waitForOtp } from './otpTwilio';

function msUntil(targetIsoLocal: string, tz: string): number {
	const now = new Date();
	const [y, m, d] = targetIsoLocal.split('T')[0].split('-').map(Number);
	const [hh, mm] = targetIsoLocal.split('T')[1].split(':').map(Number);
	const target = new Date(Date.UTC(y, m - 1, d, hh - now.getTimezoneOffset() / 60, mm));
	return target.getTime() - now.getTime();
}

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
	return new Date(Date.UTC(parts.year!, (parts.month! - 1), parts.day!, 12, 0, 0)); // noon UTC to avoid DST edges
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

async function selectDateSevenDaysFromNow(page: any, timeZone: string) {
	const now = new Date();
	const zonedToday = getZonedDateOnly(now, timeZone);
	const targetDate = addDays(zonedToday, 7);
	await openDatepicker(page);

	const monthYearFmt = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone });
	await goToMonthIfNeeded(page, monthYearFmt.format(targetDate));

	const aria = buildReactDatepickerAriaLabel(targetDate, timeZone);
	const day = page.locator(`[aria-label="${aria}"]`);
	await day.first().waitFor({ state: 'visible', timeout: 3000 });
	const disabled = await day.first().getAttribute('aria-disabled');
	if (disabled === 'true') throw new Error(`Target date disabled: ${aria}`);
	await day.first().click();
}

async function ensureOtp(page: any, cfg: ReturnType<typeof loadConfig>) {
	// This function is a placeholder where we wait for OTP prompt, then pull code via Twilio
	if (!cfg.TWILIO_ACCOUNT_SID || !cfg.TWILIO_AUTH_TOKEN || !cfg.TWILIO_PHONE_NUMBER) return;
	try {
		await page.waitForSelector('input[autocomplete="one-time-code"], input[name*="code" i]', { timeout: 3000 });
		const code = await waitForOtp({
			accountSid: cfg.TWILIO_ACCOUNT_SID,
			authToken: cfg.TWILIO_AUTH_TOKEN,
			twilioPhone: cfg.TWILIO_PHONE_NUMBER,
			userPhoneLast4: cfg.USER_PHONE_LAST4,
			matchRegex: /(\d{6})/,
			timeoutMs: 45_000,
		});
		await page.fill('input[autocomplete="one-time-code"], input[name*="code" i]', code);
		await page.getByRole('button', { name: /verify|submit|continue/i }).click({ timeout: 5000 });
	} catch {
		// No OTP prompt or failure; continue best-effort
	}
}

async function prepareContext(userDataDir: string, timezoneId: string): Promise<BrowserContext> {
	const context = await chromium.launchPersistentContext(userDataDir, { headless: false, timezoneId });
	return context;
}

async function book() {
	const cfg = loadConfig();
	const context = await prepareContext(cfg.USER_DATA_DIR!, cfg.TZ);
	const page = await context.newPage();
	await page.goto(cfg.REC_URL, { waitUntil: 'domcontentloaded' });
	await ensureOtp(page, cfg);

	// Wait for 08:00 in the page's timezone (context is set to cfg.TZ). If already past, continues immediately.
	await page.waitForFunction(() => {
		const d = new Date();
		return d.getHours() > 8 || (d.getHours() === 8 && d.getMinutes() >= 0);
	}, { timeout: 90_000 }).catch(() => {});
	await page.reload({ waitUntil: 'domcontentloaded' });

	// Date selection: pick date exactly 7 days from now
	await selectDateSevenDaysFromNow(page, cfg.TZ);

	// Time slot: click the button with the desired time label (e.g., 6:00 PM)
	const slotLabel = cfg.TARGET_SLOT_TIME || '6:00 PM';
	const slotButton = page.locator('button:has-text("' + slotLabel + '")');
	await slotButton.first().waitFor({ state: 'visible', timeout: 3000 });
	await slotButton.first().click();

	// TODO: Implement selectors for court selection and final booking submit
	// Example placeholders:
	// await page.getByRole('button', { name: cfg.TARGET_DATE }).click();
	// await page.getByRole('button', { name: cfg.TARGET_COURT || 'Court 1' }).click();
	// await page.getByText(cfg.TARGET_TIME).click();
	// await page.getByRole('button', { name: /book|reserve/i }).click();

	await ensureOtp(page, cfg);
	await page.screenshot({ path: `booking-${Date.now()}.png`, fullPage: true });
	await context.close();
	await context.browser()?.close();
}

book().catch((err) => {
	console.error(err);
	process.exit(1);
});
