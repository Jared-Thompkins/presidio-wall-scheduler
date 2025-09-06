import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type MacOtpOptions = {
	sinceSeconds?: number;
	timeoutMs?: number;
	pollIntervalMs?: number;
};

const APPLESCRIPT_LAST_MESSAGES = `
set out to ""
try
  tell application "Messages"
    repeat with c in chats
      try
        set m to last item of (messages of c)
        set t to text of m
        if t is not missing value then
          set ds to date string of (time sent of m)
          set ts to time string of (time sent of m)
          set out to out & ds & " " & ts & "|" & t & linefeed
        end if
      end try
    end repeat
  end tell
on error errMsg
  return "ERROR:" & errMsg
end try
return out
`;

async function readRecentRawLines(): Promise<string[]> {
	const { stdout } = await execFileAsync('osascript', ['-e', APPLESCRIPT_LAST_MESSAGES]);
	if (stdout.startsWith('ERROR:')) {
		throw new Error(`AppleScript error: ${stdout}`);
	}
	return stdout.split('\n').filter(Boolean);
}

export async function waitForOtpFromMacMessages(options: MacOtpOptions = {}): Promise<string> {
	const { timeoutMs = 120_000, pollIntervalMs = 1000 } = options;
	const deadline = Date.now() + timeoutMs;
	// Baseline of already seen lines to avoid picking an old code
	const seen = new Set<string>(await readRecentRawLines());
	while (Date.now() < deadline) {
		try {
			const lines = await readRecentRawLines();
			for (const line of lines) {
				if (seen.has(line)) continue;
				const sep = line.indexOf('|');
				const text = sep === -1 ? line : line.slice(sep + 1);
				const match = text.match(/(\d{6})/);
				seen.add(line);
				if (match) return match[1];
			}
		} catch {
			// ignore and continue polling
		}
		await new Promise((r) => setTimeout(r, pollIntervalMs));
	}
	throw new Error('OTP not received from Messages in time');
}

// Simple CLI for manual testing
if (process.argv[1] && process.argv[1].includes('otpMac.ts')) {
	waitForOtpFromMacMessages().then((code) => {
		console.log('Received code:', code);
		process.exit(0);
	}).catch((err) => {
		console.error(err);
		process.exit(1);
	});
}


