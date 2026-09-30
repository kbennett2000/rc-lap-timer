#!/bin/bash
# RC Lap Timer system configuration helper.
#
# Installed as /usr/local/bin/rc-config-helper.sh (root-owned, mode 755) and run by the web app via
#   sudo -n /usr/local/bin/rc-config-helper.sh <command> [arg]
# with the sudoers rule in docs/raspberryPiSetup.md.
#
# Commands:
#   hostname <name>       set the device hostname (RFC 1123 label)
#   password-stdin        set the pi user's password, read from the first line of stdin
#   wifi-stdin <ssid>     set the access point SSID ("" = unchanged) and passphrase, read from the
#                         first line of stdin (empty line = unchanged)
#   reboot                reboot the device
#   set-clock <seconds>   set the clock forward to a phone's or browser's time (seconds since 1970), once per boot
#
# Secrets are read from stdin so they never appear in argv (visible in `ps`). Every value is
# validated here as well as in the web app, and config files are rewritten line by line without
# sed, so no value is ever interpreted as a regex or shell code.

set -euo pipefail

HOSTAPD_CONF=/etc/hostapd/hostapd.conf
# Gone after a reboot (/run is in memory). The tests point it elsewhere; sudo doesn't pass the setting on.
CLOCK_FLAG="${RC_CLOCK_FLAG:-/run/rc-lap-timer-clock-set}"

die() {
  echo "rc-config-helper: $*" >&2
  exit 1
}

valid_hostname() {
  [[ "$1" =~ ^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$ ]]
}

valid_ssid() {
  [[ "$1" =~ ^[A-Za-z0-9-]{1,32}$ ]]
}

# Printable ASCII only (no control characters or newlines), within the given length range.
valid_secret() {
  local value="$1" min="$2" max="$3"
  [ "${#value}" -ge "$min" ] && [ "${#value}" -le "$max" ] && [[ "$value" =~ ^[[:print:]]+$ ]] && [[ "$value" != *[![:ascii:]]* ]]
}

# Replace the value of every "key=..." line in a file, keeping the file's owner and mode.
set_conf_value() {
  local file="$1" key="$2" value="$3" tmp line
  tmp="$(mktemp)"
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" == "$key="* ]]; then
      printf '%s=%s\n' "$key" "$value"
    else
      printf '%s\n' "$line"
    fi
  done < "$file" > "$tmp"
  cat "$tmp" > "$file"
  rm -f "$tmp"
}

read_secret_from_stdin() {
  local secret=""
  IFS= read -r secret || true
  printf '%s' "$secret"
}

update_hostname() {
  local name="$1" tmp line replaced=0
  valid_hostname "$name" || die "invalid hostname"
  if command -v hostnamectl > /dev/null 2>&1; then
    hostnamectl set-hostname "$name"
  else
    printf '%s\n' "$name" > /etc/hostname
  fi
  tmp="$(mktemp)"
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" == 127.0.1.1[[:space:]]* ]]; then
      printf '127.0.1.1\t%s\n' "$name"
      replaced=1
    else
      printf '%s\n' "$line"
    fi
  done < /etc/hosts > "$tmp"
  if [ "$replaced" -eq 0 ]; then
    printf '127.0.1.1\t%s\n' "$name" >> "$tmp"
  fi
  cat "$tmp" > /etc/hosts
  rm -f "$tmp"
  echo "Hostname updated"
}

update_password() {
  local pass
  pass="$(read_secret_from_stdin)"
  valid_secret "$pass" 8 64 || die "invalid password"
  printf 'pi:%s\n' "$pass" | chpasswd
  echo "Password updated"
}

update_wifi() {
  local ssid="$1" pass
  pass="$(read_secret_from_stdin)"
  if [ -z "$ssid" ] && [ -z "$pass" ]; then
    die "nothing to change"
  fi
  if [ -n "$ssid" ]; then
    valid_ssid "$ssid" || die "invalid SSID"
  fi
  if [ -n "$pass" ]; then
    valid_secret "$pass" 8 63 || die "invalid Wi-Fi passphrase"
  fi
  [ -n "$ssid" ] && set_conf_value "$HOSTAPD_CONF" ssid "$ssid"
  [ -n "$pass" ] && set_conf_value "$HOSTAPD_CONF" wpa_passphrase "$pass"
  # hostapd is not restarted here: that would drop the Wi-Fi connection of the device making the
  # request before it gets a response. The web app reboots the Pi afterwards, which applies it.
  echo "Wi-Fi settings updated (applied after reboot)"
}

# The Pi has no clock battery and no internet, so after being switched off its clock is behind until something sets
# it. The web app passes on the time of the first phone or browser that opens it. The clock only moves forward, and
# only once per boot, so a device with a wrong clock can't undo a good setting or keep moving it.
set_clock() {
  local target="$1"
  [[ "$target" =~ ^[0-9]{10}$ ]] || die "invalid time"
  if [ -e "$CLOCK_FLAG" ]; then
    echo "Clock already set since boot"
    return
  fi
  if [ "$target" -le "$(date +%s)" ]; then
    echo "Clock not changed"
    return
  fi
  date -u -s "@$target" > /dev/null
  touch "$CLOCK_FLAG"
  # fake-hwclock restores the saved time at boot: save it now, since a Pi is usually unplugged rather than shut down.
  if command -v fake-hwclock > /dev/null 2>&1; then
    fake-hwclock save > /dev/null || echo "rc-config-helper: couldn't save the time with fake-hwclock" >&2
  fi
  echo "Clock set"
}

case "${1:-}" in
  hostname)
    [ "$#" -eq 2 ] || die "usage: hostname <name>"
    update_hostname "$2"
    ;;
  password-stdin)
    [ "$#" -eq 1 ] || die "usage: password-stdin (password on stdin)"
    update_password
    ;;
  wifi-stdin)
    [ "$#" -eq 2 ] || die "usage: wifi-stdin <ssid> (passphrase on stdin)"
    update_wifi "$2"
    ;;
  reboot)
    [ "$#" -eq 1 ] || die "usage: reboot"
    echo "Rebooting"
    shutdown -r now
    ;;
  set-clock)
    [ "$#" -eq 2 ] || die "usage: set-clock <seconds since 1970>"
    set_clock "$2"
    ;;
  *)
    die "unknown command"
    ;;
esac
