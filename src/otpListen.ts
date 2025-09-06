import { loadConfig } from './env';
import { waitForOtp } from './otpTwilio';

async function main() {
	const cfg = loadConfig();
	if (!cfg.TWILIO_ACCOUNT_SID || !cfg.TWILIO_AUTH_TOKEN || !cfg.TWILIO_PHONE_NUMBER) {
		throw new Error('Missing Twilio env vars: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_PHONE_NUMBER');
	}
	console.log('Listening for OTP SMS to', cfg.TWILIO_PHONE_NUMBER);
	const code = await waitForOtp({
		accountSid: cfg.TWILIO_ACCOUNT_SID,
		authToken: cfg.TWILIO_AUTH_TOKEN,
		twilioPhone: cfg.TWILIO_PHONE_NUMBER,
		matchRegex: /(\d{6})/,
		sinceSeconds: 300,
		timeoutMs: 120_000,
		pollIntervalMs: 1000,
	});
	console.log('Received code:', code);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});


