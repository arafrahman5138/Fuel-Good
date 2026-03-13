#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Ensure CocoaPods runs with Homebrew + clean Ruby gem environment.
unset GEM_HOME
unset GEM_PATH
unset RUBYOPT
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

preferred_devices=(
  "iPhone 15 Pro Max"
  "iPhone 15 Pro"
  "iPhone 15"
  "iPhone 17"
  "iPhone 17 Pro"
  "iPhone 17 Pro Max"
)

available_devices="$(xcrun simctl list devices available)"
selected_device=""

for device in "${preferred_devices[@]}"; do
  if grep -Fq "$device" <<<"$available_devices"; then
    selected_device="$device"
    break
  fi
done

if [[ -z "$selected_device" ]]; then
  echo "No preferred iOS simulator found. Available devices:" >&2
  echo "$available_devices" >&2
  exit 1
fi

echo "Launching Expo on simulator: $selected_device"
npx expo run:ios --device "$selected_device"
