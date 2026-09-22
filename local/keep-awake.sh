#!/bin/bash
# Stops the Mac idle-sleeping so the monitor keeps polling overnight.
# Userland only: no password, no system settings changed, and it only
# holds the machine awake while it is on AC power.
PLIST="$HOME/Library/LaunchAgents/com.juancruz.ps5pro-awake.plist"

if [ "$1" = "off" ]; then
  launchctl unload "$PLIST" 2>/dev/null
  rm -f "$PLIST"
  echo "Keep-awake removed. The Mac sleeps normally again."
  exit 0
fi

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.juancruz.ps5pro-awake</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-s</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null
launchctl load "$PLIST"
echo "Keep-awake active. The Mac will not idle-sleep while plugged in."
echo "Turn it off with: ./local/keep-awake.sh off"
