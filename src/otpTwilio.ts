import twilio from 'twilio';

export type OtpOptions = {
	accountSid: string;
	authToken: string;
	twilioPhone: string;
	userPhoneLast4?: string;
	matchRegex?: RegExp;
	sinceSeconds?: number;
	timeoutMs?: number;
	pollIntervalMs?: number;
};

export async function waitForOtp(options: OtpOptions): Promise<string> {
	const {
		accountSid,
		authToken,
		twilioPhone,
		userPhoneLast4,
		matchRegex = /(\d{6})/,
		sinceSeconds = 120,
		timeoutMs = 30_000,
		pollIntervalMs = 1_000,
	} = options;

	const client = twilio(accountSid, authToken);
	const deadline = Date.now() + timeoutMs;
	let lastMessageSid: string | undefined;

	while (Date.now() < deadline) {
		const since = new Date(Date.now() - sinceSeconds * 1000);
		const messages = await client.messages.list({ to: twilioPhone, dateSentAfter: since, limit: 10 });
		for (const msg of messages) {
			if (lastMessageSid && msg.sid === lastMessageSid) continue;
			const from = msg.from || '';
			if (userPhoneLast4 && !from.endsWith(userPhoneLast4)) continue;
			const body = msg.body || '';
			const match = body.match(matchRegex);
			if (match) {
				return match[1];
			}
			lastMessageSid = msg.sid;
		}
		await new Promise((r) => setTimeout(r, pollIntervalMs));
	}
	throw new Error('OTP not received in time');
}
