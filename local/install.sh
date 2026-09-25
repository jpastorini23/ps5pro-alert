#!/bin/bash
# Installs the Mac-side runner. Target's API only answers residential IPs,
# so this machine is the only place Target can be watched.
set -e
REPO="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/com.juancruz.ps5pro-alert.plist"

if [ ! -f "$REPO/.env" ]; then
  echo "Missing $REPO/.env — copy .env.example to .env and set NOTIFY_EMAIL."
  exit 1
fi

cd "$REPO" && npm install --no-audit --no-fund --silent

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.juancruz.ps5pro-alert</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>$REPO/check.js</string>
  </array>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>STATE_FILE</key><string>./state.local.json</string>
    <key>LOOP_SECONDS</key><string>3600</string>
    <key>NO_AUTO_OPEN</key><string>1</string>
    <key>SKIP_SOURCES</key><string>target</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$REPO/monitor.log</string>
  <key>StandardErrorPath</key><string>$REPO/monitor.log</string>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Installed. Polling continuously; launchd restarts it if it dies."
echo "Log:    tail -f $REPO/monitor.log"
echo "Stop:   launchctl unload $PLIST"
