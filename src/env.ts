import dotenv from 'dotenv';

dotenv.config();

export type Config = {
	REC_URL: string;
	TARGET_DATE: string;
	TARGET_TIME: string;
	TARGET_SLOT_TIME?: string;
	TARGET_COURT?: string;
	TZ: string;
	TWILIO_ACCOUNT_SID?: string;
	TWILIO_AUTH_TOKEN?: string;
	TWILIO_PHONE_NUMBER?: string;
	USER_PHONE_LAST4?: string;
	STORAGE_STATE?: string;
	USER_DATA_DIR?: string;
};

export function loadConfig(): Config {
	const env = process.env;
	const cfg: Config = {
		REC_URL: env.REC_URL || 'https://www.rec.us/presidiowall',
		TARGET_DATE: env.TARGET_DATE || '',
		TARGET_TIME: env.TARGET_TIME || '08:00',
		TARGET_SLOT_TIME: env.TARGET_SLOT_TIME || '6:00 PM',
		TARGET_COURT: env.TARGET_COURT,
		TZ: env.TZ || 'America/Los_Angeles',
		TWILIO_ACCOUNT_SID: env.TWILIO_ACCOUNT_SID,
		TWILIO_AUTH_TOKEN: env.TWILIO_AUTH_TOKEN,
		TWILIO_PHONE_NUMBER: env.TWILIO_PHONE_NUMBER,
		USER_PHONE_LAST4: env.USER_PHONE_LAST4,
		STORAGE_STATE: env.STORAGE_STATE || '.pw-user-data/storage-state.json',
		USER_DATA_DIR: env.USER_DATA_DIR || '.pw-user-data',
	};
	// TARGET_DATE is optional now because we select +7d automatically. TARGET_TIME defaults to 08:00.
	return cfg;
}
