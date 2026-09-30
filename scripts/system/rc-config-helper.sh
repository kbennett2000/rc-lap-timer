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
#
# Secrets are read from stdin so they never appear in argv (visible in `ps`). Every value is
# validated here as well as in the web app, and config files are rewritten line by line without
# sed, so no value is ever interpreted as a regex or shell code.

set -euo pipefail

HOSTAPD_CONF=/etc/hostapd/hostapd.conf

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
  *)
    die "unknown command"
    ;;
esac
