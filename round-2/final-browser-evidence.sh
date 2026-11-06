#!/bin/sh
set -eu
python3 .overhaul-evidence/ui-ux-overhaul/round-2/hash-build.py
set +e
sh .overhaul-evidence/ui-ux-overhaul/round-2/test-final-head.sh > .overhaul-evidence/ui-ux-overhaul/round-2/interactions/final-head/browser.log 2>&1
result=$?
set -e
printf '%s\n' "$result" > .overhaul-evidence/ui-ux-overhaul/round-2/interactions/final-head/exit-code.txt
python3 .overhaul-evidence/ui-ux-overhaul/round-2/classify-results.py .overhaul-evidence/ui-ux-overhaul/round-2/interactions/final-head
sh .overhaul-evidence/ui-ux-overhaul/round-2/final-media.sh
python3 .overhaul-evidence/ui-ux-overhaul/round-2/audit-media.py
