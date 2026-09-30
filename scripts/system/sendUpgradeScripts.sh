#!/bin/bash
# Copies this checkout's upgrade scripts to the timer: the first step of every upgrade (docs/updateNotes.md).
#
# The timer runs the upgrade scripts in its home folder, which the previous upgrade left there. Without this step, a
# fix to the upgrade itself only takes effect one upgrade later, and a timer last upgraded before these scripts were
# rewritten would run its old upgrade, which drops the database (after saving a copy it never puts back).
#
# Run it on the build box, on the timer's Wi-Fi, with the SSH key set up (ssh-copy-id pi@rclaptimer.local):
#   scripts/system/sendUpgradeScripts.sh [user@timer]    (the default is pi@rclaptimer.local)
set -euo pipefail
cd "$(dirname "$0")/../.."

timer=${1:-pi@rclaptimer.local}

scp scripts/system/upgrayedd.sh scripts/system/piUpgrade1.sh scripts/system/piUpgrade2.sh "$timer:"
# The old upgrade's database scripts go too, so nothing can run them by mistake.
ssh "$timer" 'chmod +x upgrayedd.sh piUpgrade1.sh piUpgrade2.sh && rm -f dbCycle.sh dbCycle.sql'

echo "Sent the upgrade scripts to $timer. Next, on the timer: ssh $timer, then ./upgrayedd.sh"
