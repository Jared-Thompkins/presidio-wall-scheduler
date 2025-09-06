import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

type Options = {
	timeoutMs?: number;
	pollIntervalMs?: number;
};

async function queryRecentMessages(limit: number = 50): Promise<Array<{ when: string; text: string }>> {
	const db = path.join(os.homedir(), 'Library', 'Messages', 'chat.db');
	const sql = `
      SELECT
        datetime((date/1000000000)+978307200, 'unixepoch', 'localtime') as when_local,
        coalesce(text, '') as text
      FROM message
      WHERE text IS NOT NULL AND length(text) > 0
      ORDER BY date DESC
      LIMIT ${limit};
    `;
	const { stdout } = await execFileAsync('sqlite3', ['-noheader', '-separator', '\u0001', db, sql]);
	const lines = stdout.split('\n').filter(Boolean);
	return lines.map((line) => {
		const [when_local, text] = line.split('\u0001');
		return { when: when_local, text };
	});
}

export async function waitForOtpFromMessagesDb(options: Options = {}): Promise<string> {
	const { timeoutMs = 120_000, pollIntervalMs = 1000 } = options;
	const deadline = Date.now() + timeoutMs;
	const seen = new Set<string>();
	// seed seen with current rows so we only capture new ones after start
	try {
		const initial = await queryRecentMessages();
		initial.forEach((r) => seen.add(`${r.when}|${r.text}`));
	} catch (e) {
		throw new Error('Failed to read Messages database via sqlite3. Grant Full Disk Access to your terminal/app and ensure sqlite3 is installed.');
	}
	while (Date.now() < deadline) {
		try {
			const rows = await queryRecentMessages();
			for (const r of rows) {
				const key = `${r.when}|${r.text}`;
				if (seen.has(key)) continue;
				seen.add(key);
				const match = r.text.match(/\b(\d{6})\b/);
				if (match) return match[1];
			}
		} catch {
			// ignore and continue polling
		}
		await new Promise((r) => setTimeout(r, pollIntervalMs));
	}
	throw new Error('OTP not received from Messages DB in time');
}

// CLI
if (process.argv[1] && process.argv[1].includes('otpMacSqlite.ts')) {
	waitForOtpFromMessagesDb().then((code) => {
		console.log('Received code:', code);
		process.exit(0);
	}).catch((err) => {
		console.error(err);
		process.exit(1);
	});
}


