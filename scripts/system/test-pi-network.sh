#!/usr/bin/env bash
# Checks the Pi's web server settings (scripts/system/nginx/rc-lap-timer.conf) in the nginx version Raspberry Pi OS
# (bookworm) ships, in front of a stand-in for the app. Needs docker, openssl and curl. CI runs it (pi-network job).
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

# The files nginx gets, laid out as on the Pi: the settings, and a throwaway certificate where they expect the
# timer's. Containers here have no IPv6, so the [::] listens go (they're the same as the IPv4 ones).
root="$work/root"
mkdir -p "$root/etc/nginx/conf.d" "$root/etc/ssl/certs" "$root/etc/ssl/private"
grep -v 'listen \[::\]' scripts/system/nginx/rc-lap-timer.conf > "$root/etc/nginx/conf.d/default.conf"
openssl req -x509 -nodes -days 1 -newkey rsa:2048 -subj "/CN=rc-lap-timer" \
  -keyout "$root/etc/ssl/private/rc-lap-timer.key" -out "$root/etc/ssl/certs/rc-lap-timer.crt" 2> /dev/null

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
