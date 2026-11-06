#!/bin/sh
set -eu
sh .overhaul-evidence/ui-ux-overhaul/round-2/capture.sh > .overhaul-evidence/ui-ux-overhaul/round-2/interactions/capture-7580af910.log 2>&1
sh .overhaul-evidence/ui-ux-overhaul/round-2/videos.sh > .overhaul-evidence/ui-ux-overhaul/round-2/interactions/videos-7580af910.log 2>&1
sh .overhaul-evidence/ui-ux-overhaul/round-2/compose.sh > .overhaul-evidence/ui-ux-overhaul/round-2/interactions/compose-7580af910.log 2>&1
python3 .overhaul-evidence/ui-ux-overhaul/round-2/gallery.py
