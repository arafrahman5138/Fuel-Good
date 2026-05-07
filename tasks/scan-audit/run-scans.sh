#!/usr/bin/env bash
# Drives scan audits across test images. Per image: add-as-newest, run maestro flow.
set -u
ROOT="/Users/arafrahman/Desktop/Fuel-Good"
UDID="F5D305DD-96D3-458D-9ECA-CE4BD92783F3"
IMG_DIR="$ROOT/tasks/scan-audit/images"
SHOT_DIR="$ROOT/tasks/scan-audit/screenshots"
FLOW="$ROOT/tasks/scan-audit/flows/scan-one.yaml"
MAESTRO="/Users/arafrahman/.maestro/bin/maestro"

# Format: image_basename:mode
TESTS=(
  "meal_01_healthy_plate:meal"
  "meal_02_diner_burger:meal"
  "meal_05_yogurt_bowl:meal"
  "meal_06_pizza_slice:meal"
  "meal_09_cafeteria_tray:meal"
  "meal_10_acai_bowl:meal"
  "label_01_greek_yogurt_clean:product"
  "label_02_sugary_cereal_ultra:product"
  "label_04_protein_bar_isolates:product"
  "label_05_tortilla_chips_simple:product"
  "edge_01_blurry_dim_meal:meal"
  "edge_02_restaurant_menu:meal"
)

cd "$ROOT"
mkdir -p "$SHOT_DIR/results"

for spec in "${TESTS[@]}"; do
  name="${spec%%:*}"
  mode="${spec##*:}"
  img="$IMG_DIR/$name.png"
  shot="tasks/scan-audit/screenshots/results/${name}"
  [ -f "$img" ] || { echo "MISSING: $img"; continue; }

  echo "=== [$name / $mode] ==="
  # Add as newest photo so it lands top-left in the picker
  xcrun simctl addmedia "$UDID" "$img" || { echo "addmedia failed"; continue; }
  sleep 1
  "$MAESTRO" test -e MODE="$mode" -e SCREENSHOT="$shot" "$FLOW" 2>&1 | tail -8
  echo
done

echo "All scans complete. Screenshots in $SHOT_DIR/results/"
