#!/bin/bash
# Wedge regression probe (pass-8 P1 #1). Usage: run_churn.sh <rounds> <label>
# Each round = 5 churn cycles (churn-cycle.yaml) + screenshot + blank check.
# Exits non-zero on the first blank frame. Requires a signed-in app on the sim.
set -u
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export PATH="$JAVA_HOME/bin:$HOME/.maestro/bin:$PATH"
ROUNDS="${1:-6}"
LABEL="${2:-probe}"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/churn-$LABEL"
mkdir -p "$OUT"

for i in $(seq 1 "$ROUNDS"); do
  maestro test "$DIR/flows/churn-cycle.yaml" >/dev/null 2>&1
  SHOT="$OUT/round-$i.png"
  xcrun simctl io booted screenshot "$SHOT" >/dev/null 2>&1
  BLANK=$(/Users/arafrahman/Fuel-Good/backend/venv/bin/python - "$SHOT" <<'EOF'
import sys
from PIL import Image
import statistics
img = Image.open(sys.argv[1]).convert("L")
w, h = img.size
# ignore status bar (top ~7%) and tab bar (bottom ~12%)
region = img.crop((0, int(h*0.08), w, int(h*0.86)))
px = list(region.getdata())[::37]
print("BLANK" if statistics.pstdev(px) < 6 else "OK")
EOF
)
  echo "round $i: $BLANK"
  if [ "$BLANK" = "BLANK" ]; then
    echo "WEDGE REPRODUCED at round $i ($SHOT)"
    exit 1
  fi
done
echo "clean: $ROUNDS rounds ($((ROUNDS*5)) cycles), no blank frames"
