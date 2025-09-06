### LaunchAgent setup (macOS)

1. Create a wrapper shell script that runs the booking at the scheduled time:

```bash
#!/bin/zsh
cd "$(dirname "$0")/.."
/usr/bin/env -S PATH="/usr/local/bin:/opt/homebrew/bin:$PATH" npm run book >> run.log 2>&1
```

Save as `scripts/run-book.sh` and `chmod +x scripts/run-book.sh`.

2. Create a LaunchAgent plist at `~/Library/LaunchAgents/com.presidio.wall.scheduler.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.presidio.wall.scheduler</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>cd /Users/USERNAME/presidio-wall-scheduler && ./scripts/run-book.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
      <key>Hour</key>
      <integer>7</integer>
      <key>Minute</key>
      <integer>59</integer>
      <key>Weekday</key>
      <integer>5</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/USERNAME/Library/Logs/presidio-wall-scheduler.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/USERNAME/Library/Logs/presidio-wall-scheduler.err</string>
    <key>RunAtLoad</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>/Users/USERNAME/presidio-wall-scheduler</string>
    <key>EnvironmentVariables</key>
    <dict>
      <key>REC_URL</key>
      <string>https://www.rec.us/presidiowall</string>
    </dict>
  </dict>
</plist>
```

Replace `USERNAME` with your mac username.

3. Load and test:

```bash
launchctl unload ~/Library/LaunchAgents/com.presidio.wall.scheduler.plist 2>/dev/null || true
launchctl load -w ~/Library/LaunchAgents/com.presidio.wall.scheduler.plist
launchctl start com.presidio.wall.scheduler
```
