## Presidio Wall Scheduler

Automate booking pickleball reservations at the presidio wall in San Francisco

### What you need
- **Mac with Messages**: iPhone SMS forwarding enabled to your Mac.

### One-time setup
1) Install deps
```bash
npm install
```

2) Configure environment (.env)
```bash
# Timezone for booking window
TZ="America/Los_Angeles"

# Persistent browser profile (keeps cookies)
USER_DATA_DIR=.pw-user-data

# Desired time slot label (default is "6:00 PM")
TARGET_SLOT_TIME="6:00 PM"

# Optional: override booking URL
# REC_URL=https://www.rec.us/presidiowall

# Optional: Twilio fallback (rarely needed)
# TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

3) Enable iPhone → Mac SMS forwarding
- On your iPhone: Settings → Messages → Text Message Forwarding → enable your Mac.
- Verify you can see your verification SMS in the Mac Messages app.

4) Grant Full Disk Access
- macOS System Settings → Privacy & Security → Full Disk Access.
- Add and enable the app you will run from (Terminal, iTerm, Cursor, or VS Code). Quit and reopen the app.

5) Save a logged-in session
```bash
npm run save:storage
```
This opens a browser. Log in once (including phone verification if prompted), then press Enter in the terminal. Your session will persist in `USER_DATA_DIR`.

### Dry-run test (optional)
```bash
npm run test:date
```
Exercises the flow and verification step outside the actual 8:00 AM window. It will click "Send Code" and read the 6‑digit OTP from the Mac Messages database automatically.

### Real run (8:00 AM PT)
```bash
npm run book
```
- Starts in headed mode.
- Waits until 8:00 PT, refreshes, selects the date exactly +7 days from today, looks for your slot label, and retries fast.
- **Retry policy**: refresh-and-retry up to 20 times with ~0.7s checks until the slot is visible.
- Once found: ensures participant is selected, clicks Book, clicks "Send Code", reads the OTP from Messages, fills it, and submits.

### Scheduling (macOS LaunchAgent) **Optional
- See `src/launchd/README.md` for a simple LaunchAgent plist and wrapper script.
- Typical schedule: 7:59:45 AM PT every Thursday.

### Notes on OTP
- The script reads OTPs from the **Mac Messages database** automatically. Keep Messages open and ensure SMS forwarding is on.
- Twilio is optional and only used as a fallback if you add the credentials above. Most sites reject VoIP numbers for account phone; prefer using your real mobile with Mac forwarding.

### Troubleshooting
- **OTP not captured**:
  - Ensure Messages shows the SMS on the Mac.
  - Ensure you ran from an app with Full Disk Access. Reopen the app after granting.
  - Try manual listener: `npm run otp:mac:db`, then trigger Send Code and confirm it prints.
- **Logged out / prompt to log in**:
  - Run `npm run save:storage` again outside the booking window.
- **Slot never appears**:
  - The script will try 20 times and exit. Verify your slot label matches exactly (e.g., `6:00 PM`). Try again on the next release.

