#!/usr/bin/env bash
# Checks the timer's HTTPS certificate (scripts/system/rc-tls.sh) and web server settings
# (scripts/system/nginx/rc-lap-timer.conf), in the nginx version Raspberry Pi OS (bookworm) ships, in front of a
# stand-in for the app. Needs docker, openssl, curl and GNU date. CI runs it (pi-network job).
set -euo pipefail
cd "$(dirname "$0")/../.."

nginx_image=nginx:1.22
work=$(mktemp -d)
cleanup() {
  docker rm -f rclt-nginx rclt-app > /dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT

failures=0
check() {
  local what=$1 expected=$2 actual=$3
  if [ "$actual" = "$expected" ]; then
    echo "ok   $what"
  else
    echo "FAIL $what: expected '$expected', got '$actual'"
    failures=$((failures + 1))
  fi
}

# The files nginx gets, laid out as on the Pi: the settings, and the certificate the timer makes for itself.
# Containers here have no IPv6, so the [::] listens go (they're the same as the IPv4 ones).
root="$work/root"
ssl="$root/etc/ssl"
mkdir -p "$root/etc/nginx/conf.d"
grep -v 'listen \[::\]' scripts/system/nginx/rc-lap-timer.conf > "$root/etc/nginx/conf.d/default.conf"
TLS_DIR="$ssl" TLS_HOSTNAME=rclaptimer scripts/system/rc-tls.sh > /dev/null

cert="$ssl/certs/rc-lap-timer.crt"
ca="$ssl/certs/rc-lap-timer-ca.crt"
check "the certificate is signed by the timer's CA" "OK" "$(openssl verify -CAfile "$ca" "$cert" 2>&1 | sed 's/.*: //')"
check "it names the timer every way phones reach it" \
  "DNS:rc-lap-timer, DNS:rc-lap-timer.local, DNS:rclaptimer, DNS:rclaptimer.local, IP Address:192.168.4.1" \
  "$(openssl x509 -in "$cert" -noout -ext subjectAltName | tail -1 | xargs)"
check "it's for a web server" "TLS Web Server Authentication" \
  "$(openssl x509 -in "$cert" -noout -ext extendedKeyUsage | tail -1 | xargs)"
days=$((($(date -d "$(openssl x509 -in "$cert" -noout -enddate | cut -d= -f2)" +%s) - \
  $(date -d "$(openssl x509 -in "$cert" -noout -startdate | cut -d= -f2)" +%s)) / 86400))
check "it lasts no longer than iPhones accept (825 days)" "yes" "$([ "$days" -le 825 ] && echo yes || echo "$days days")"
check "the only private key left is the timer's own" "$ssl/private/rc-lap-timer.key" \
  "$(grep -rl 'PRIVATE KEY' "$ssl")"
before=$(cat "$ssl"/certs/* | sha256sum)
TLS_DIR="$ssl" TLS_HOSTNAME=rclaptimer scripts/system/rc-tls.sh > /dev/null
check "a second run keeps the certificate" "$before" "$(cat "$ssl"/certs/* | sha256sum)"
# Timers flashed from the old SD image have its shared, self-signed certificate (docs/raspberryPiSetup.md used to
# make it this way).
old="$work/old-ssl"
mkdir -p "$old/certs" "$old/private"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -subj "/CN=rc-lap-timer/O=RC Lap Timer/C=US" \
  -keyout "$old/private/rc-lap-timer.key" -out "$old/certs/rc-lap-timer.crt" 2> /dev/null
check "a timer with the old shared certificate gets its own" "Made" \
  "$(TLS_DIR="$old" TLS_HOSTNAME=rclaptimer scripts/system/rc-tls.sh | head -c 4)"

# Copied in as a tar stream rather than mounted: some docker setups (snap) can't see the host's /tmp.
docker create --name rclt-nginx -p 127.0.0.1:8080:80 -p 127.0.0.1:8443:443 "$nginx_image" > /dev/null
tar -C "$root" -cf - . | docker cp - rclt-nginx:/
docker start rclt-nginx > /dev/null
# The app's stand-in shares nginx's network, as the app does on the Pi: it answers "app:<path>" on 127.0.0.1:3000.
docker run -d --name rclt-app --network container:rclt-nginx python:3.12-alpine python -c '
from http.server import BaseHTTPRequestHandler, HTTPServer
class App(BaseHTTPRequestHandler):
    def answer(self):
        left = int(self.headers.get("content-length") or 0)
        while left > 0:
            left -= len(self.rfile.read(min(left, 65536)))
        body = ("app:" + self.path).encode()
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    do_GET = do_POST = answer
    def log_message(self, *args):
        pass
HTTPServer(("127.0.0.1", 3000), App).serve_forever()
' > /dev/null

for _ in $(seq 1 30); do
  curl -fsk -o /dev/null https://127.0.0.1:8443/ && break
  sleep 1
done

check "nginx accepts the settings" "ok" "$(docker exec rclt-nginx nginx -t > /dev/null 2>&1 && echo ok || echo rejected)"
check "plain HTTP moves to HTTPS" "301 https://127.0.0.1/api/data" \
  "$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://127.0.0.1:8080/api/data)"
check "plain HTTP reaches the sync status route" "app:/api/sync/status" "$(curl -s http://127.0.0.1:8080/api/sync/status)"
check "plain HTTP reaches the sync route" "app:/api/sync" "$(curl -s http://127.0.0.1:8080/api/sync)"
check "HTTPS reaches the app" "app:/" "$(curl -sk https://127.0.0.1:8443/)"
check "a phone that trusts the CA trusts the timer by name" "app:/" \
  "$(curl -s --cacert "$ca" --resolve rc-lap-timer:8443:127.0.0.1 https://rc-lap-timer:8443/)"
check "... and at 192.168.4.1" "app:/" \
  "$(curl -s --cacert "$ca" --connect-to 192.168.4.1:8443:127.0.0.1:8443 https://192.168.4.1:8443/)"
check "plain HTTP hands out the CA for phones to install" "200 application/x-x509-ca-cert" \
  "$(curl -s -o "$work/downloaded.crt" -w '%{http_code} %{content_type}' http://127.0.0.1:8080/rc-lap-timer-ca.crt)"
check "... the timer's own" "same" "$(cmp -s "$work/downloaded.crt" "$ca" && echo same || echo different)"
check "HTTPS blocks image optimization" "404" "$(curl -sk -o /dev/null -w '%{http_code}' https://127.0.0.1:8443/_next/image)"

big="$work/big.json"
head -c 20000000 /dev/zero | tr '\0' ' ' > "$big"
post() { curl -sk -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' --data-binary "@$big" "$1"; }
check "a 20 MB backup reaches the sync route over plain HTTP" "200" "$(post http://127.0.0.1:8080/api/sync)"
check "a 20 MB backup reaches the sync route over HTTPS" "200" "$(post https://127.0.0.1:8443/api/sync)"
check "other routes keep nginx's 1 MB limit" "413" "$(post https://127.0.0.1:8443/api/data)"

if [ "$failures" -gt 0 ]; then
  docker logs rclt-nginx 2>&1 | tail -20
  exit 1
fi
echo "The Pi's web server settings work."
