#!/bin/bash
# Tests rc-config-helper.sh's set-clock command without root or a Pi: stand-ins for date and fake-hwclock record what
# the helper asks of them. CI runs this in the pi-network job.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"

NOW=1790000000
cat > "$work/bin/date" << EOF
#!/bin/bash
if [ "\$*" = "+%s" ]; then echo $NOW; exit 0; fi
echo "date \$*" >> "$work/calls"
EOF
cat > "$work/bin/fake-hwclock" << EOF
#!/bin/bash
echo "fake-hwclock \$*" >> "$work/calls"
EOF
chmod +x "$work/bin/date" "$work/bin/fake-hwclock"
: > "$work/calls"

pass=0
fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then
    pass=$((pass + 1))
    echo "  ok    $1"
  else
    fail=$((fail + 1))
    echo "  FAIL  $1: expected [$2], got [$3]"
  fi
}

# Runs the helper and prints its output, its exit status and the calls it made (then forgets the calls).
run() {
  local output status
  output="$(PATH="$work/bin:/usr/bin:/bin" RC_CLOCK_FLAG="$work/clock-set" bash "$here/rc-config-helper.sh" "$@" 2>&1)" &&
    status=0 || status=$?
  printf '%s|%s|%s' "$output" "$status" "$(tr '\n' ';' < "$work/calls")"
  : > "$work/calls"
}
reboot() { rm -f "$work/clock-set"; }

echo "== set-clock"
check "a time ahead sets the clock and saves it" \
  "Clock set|0|date -u -s @$((NOW + 3600));fake-hwclock save;" "$(run set-clock $((NOW + 3600)))"
check "it's set once per boot" "Clock already set since boot|0|" "$(run set-clock $((NOW + 7200)))"
reboot
check "a time behind changes nothing" "Clock not changed|0|" "$(run set-clock $((NOW - 60)))"
check "the same time changes nothing" "Clock not changed|0|" "$(run set-clock $NOW)"
check "and doesn't use up the boot's setting" "no" "$([ -e "$work/clock-set" ] && echo yes || echo no)"
for bad in abc 123 1e9 -1 99999999999 " 1790003600" "1790003600 "; do
  check "\"$bad\" is refused" "rc-config-helper: invalid time|1|" "$(run set-clock "$bad")"
done
check "a missing time is refused" "rc-config-helper: usage: set-clock <seconds since 1970>|1|" "$(run set-clock)"
check "an extra argument is refused" "rc-config-helper: usage: set-clock <seconds since 1970>|1|" \
  "$(run set-clock $((NOW + 3600)) now)"
rm "$work/bin/fake-hwclock"
check "without fake-hwclock the clock is still set" "Clock set|0|date -u -s @$((NOW + 60));" \
  "$(run set-clock $((NOW + 60)))"

echo "== other commands"
check "an unknown command is refused" "rc-config-helper: unknown command|1|" "$(run set-time $((NOW + 60)))"
check "hostname still checks its name" "rc-config-helper: invalid hostname|1|" "$(run hostname 'bad name')"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
