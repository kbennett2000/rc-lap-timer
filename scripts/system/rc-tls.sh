#!/usr/bin/env bash
# The timer's HTTPS certificate, made on the timer itself. Each timer gets its own key, and its own small certificate
# authority (CA) that phones can install to trust it (see the README). The CA signs the timer's certificate once, and
# its private key is then destroyed, so it can never sign anything else: not even someone holding the SD card can
# make a certificate for another site with it.
#
# Runs at every boot (rc-lap-timer-tls.service) and during upgrades. It only makes new files when they're missing,
# weren't made by this script, or expire within 60 days; a new certificate means a new CA, which phones install again.
# TLS_DIR puts the files somewhere other than /etc/ssl, and TLS_HOSTNAME names the timer (tests).
set -euo pipefail

dir=${TLS_DIR:-/etc/ssl}
host=${TLS_HOSTNAME:-$(hostname)}
cert=$dir/certs/rc-lap-timer.crt
key=$dir/private/rc-lap-timer.key
ca=$dir/certs/rc-lap-timer-ca.crt
days=825 # the longest phones accept (Apple's limit)
renew_days=60

if [ -f "$cert" ] && [ -f "$key" ] && [ -f "$ca" ] &&
  openssl x509 -in "$cert" -noout -ext subjectAltName 2> /dev/null | grep -q "IP Address:192.168.4.1" &&
  openssl x509 -in "$cert" -noout -checkend $((renew_days * 86400)) > /dev/null; then
  echo "The timer's certificate is current."
  exit 0
fi

# Directories that already exist (on the Pi, /etc/ssl's) keep their owners and modes.
[ -d "$dir/certs" ] || mkdir -p -m 755 "$dir/certs"
[ -d "$dir/private" ] || mkdir -p -m 700 "$dir/private"

# Keys are made in memory where there is some, and never leave this directory except the timer's own.
umask 077
work=$(mktemp -d -p /dev/shm 2> /dev/null || mktemp -d)
trap 'rm -rf "$work"' EXIT

names=$(printf '%s\n' rc-lap-timer rc-lap-timer.local "$host" "$host.local" | awk 'NF && !seen[$0]++' |
  sed 's/^/DNS:/' | paste -sd, -)

openssl req -x509 -new -nodes -newkey ec -pkeyopt ec_paramgen_curve:P-256 -sha256 -days "$days" \
  -subj "/O=RC Lap Timer/CN=RC Lap Timer ($host)" \
  -addext "basicConstraints=critical,CA:true,pathlen:0" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -keyout "$work/ca.key" -out "$work/ca.crt" 2> /dev/null
openssl req -new -nodes -newkey ec -pkeyopt ec_paramgen_curve:P-256 -sha256 \
  -subj "/O=RC Lap Timer/CN=rc-lap-timer" -keyout "$work/timer.key" -out "$work/timer.csr" 2> /dev/null
cat > "$work/timer.ext" << EXT
basicConstraints=critical,CA:false
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
subjectAltName=$names,IP:192.168.4.1
EXT
openssl x509 -req -in "$work/timer.csr" -CA "$work/ca.crt" -CAkey "$work/ca.key" \
  -set_serial "0x$(openssl rand -hex 16)" -days "$days" -sha256 -extfile "$work/timer.ext" \
  -out "$work/timer.crt" 2> /dev/null

# The CA's work is done.
shred -u "$work/ca.key" 2> /dev/null || rm -f "$work/ca.key"

openssl verify -CAfile "$work/ca.crt" "$work/timer.crt" > /dev/null
if [ "$(openssl pkey -in "$work/timer.key" -pubout)" != "$(openssl x509 -in "$work/timer.crt" -noout -pubkey)" ]; then
  echo "The new certificate doesn't match its key, so nothing was changed." >&2
  exit 1
fi

install -m 600 "$work/timer.key" "$key"
install -m 644 "$work/timer.crt" "$cert"
install -m 644 "$work/ca.crt" "$ca"
echo "Made a new certificate for this timer ($names, IP:192.168.4.1), valid for $days days."
echo "Phones that trusted the timer before need its new certificate: http://192.168.4.1/rc-lap-timer-ca.crt"
