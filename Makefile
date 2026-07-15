# Fuel Good — dev shortcuts

# Live scan-accuracy eval against a local backend (needs a real GOOGLE_API_KEY
# in backend/.env, backend on :8000, and a bearer token in /tmp/fuelgood-token.txt
# or the TOKEN env var; ANTHROPIC/USDA keys optional but affect nutrition metrics).
# Regression-gate against the archived baseline:
#   make scan-eval BASELINE=tasks/scan-qa-2026-07-10/baseline-2026-07-10-nokeys/summary.json
BASELINE ?=
scan-eval:
	backend/venv/bin/python tasks/scan-qa-2026-07-10/run_suite.py \
		$(if $(BASELINE),--assert-baseline $(BASELINE),)

.PHONY: scan-eval
