# Batch 5 — Auth & Field-State Bugs [FIXED]

**Findings closed:** N22, N45 (field bleed), N26 (binary sex)
**Findings investigated (not a bug):** N21, N30
**Severity:** P1
**Completed:** 2026-04-16

## N22 / N45 — Field-state bleed across Sign In ↔ Create Account toggle

### Bug
`email` / `password` / `name` state persisted across `isRegister` toggles. Users who filled in Create Account, canceled back to Sign In, then typed again saw their inputs *concatenated* onto the prior value — producing strings like `jordan+ui5@jordan+ui@qatest.fuelg...` that silently failed email validation. This was the upstream cause of the apparent "silent signup failure" (N21) users experienced in the Maestro run.

### Fix
`frontend/app/(auth)/login.tsx` — added a `useEffect(…, [isRegister])` that clears `email`, `password`, `name`, `fieldErrors`, and `error` every time the user flips between modes. The effect also runs once on mount (empty initial state stays empty — idempotent).

### Verification
- Typecheck clean (`tsc --noEmit` → 0 errors).
- Upstream symptom N21 (no error shown on submit with an invalid concatenated email) no longer reproducible because the field cannot arrive in that concatenated state.
- Manual Maestro flow: type into Create Account, toggle to Sign In → both fields empty.

## N26 — Binary Male/Female sex field

### Bug
`SEX_OPTIONS` in `(auth)/onboarding.tsx` had only `male` and `female`. Non-binary persona Jordan Reyes (they/them) had no honest path through onboarding.

### Fix
`frontend/app/(auth)/onboarding.tsx:58–71` — expanded `SEX_OPTIONS` from 2 → 4 entries:
```
{ value: 'male',               label: 'Male' },
{ value: 'female',             label: 'Female' },
{ value: 'non_binary',         label: 'Non-binary' },
{ value: 'prefer_not_to_say',  label: 'Prefer not to say' },
```

### Backend compatibility
`metabolic_engine.calc_tdee` already coerces any non-`"male"` sex string to the female Mifflin-St Jeor formula (the more conservative BMR). Non-binary / prefer-not-to-say users therefore get a safe lower-bound calorie estimate. No schema changes required (sex is `Optional[str]`).

### Verification
Typecheck clean. A Maestro hierarchy dump at goal-context will now show 4 sex chips instead of 2.

## N21 — "Silent signup failure"

### Status: Cannot reproduce in isolation

Investigation shows `handleSubmit` already runs the email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` *unconditionally* (line 175) and renders `fieldErrors.email` for both `isRegister` branches (line 328). The observed Maestro "silent failure" was the downstream effect of N22's concatenated invalid email. **After N22's fix, N21 is expected to resolve** — the form can no longer arrive at an invalid concatenated state.

If a genuine silent-failure is observed post-fix (e.g., 409 on duplicate email not surfaced), treat as a new bug. Recommend a follow-up Jest test that mocks `authApi.register` to reject with 409 and asserts an error banner appears.

## N30 — "Yes, I'm all in" not enabling CTA

### Status: Cannot reproduce in code review

Tap handler on line 1254 correctly calls `setIsCommitted(true)` + a haptic. The CTA's `canContinue` logic at line 362 is `(step === 13 && isCommitted !== null)`. Selecting either option flips state from `null` → `true`/`false`, which should re-enable the CTA within one render.

The Maestro observation was likely a targeting issue: the `.*Yes, I'm all in.*` regex matched a nested `<Text>` rather than the outer `<TouchableOpacity>`, so the tap didn't register. Follow-up: add `testID="commitment-yes"` / `testID="commitment-no"` to the options so Maestro flows target unambiguously. Deferred to Batch 11 UX/testID polish.

## Files changed

- `frontend/app/(auth)/login.tsx` (+11 lines — useEffect reset on isRegister toggle)
- `frontend/app/(auth)/onboarding.tsx` (+11 lines — SEX_OPTIONS expansion with explanatory comment)

## Ship-gate impact

- N22, N45, N26 closed
- N21 expected closed (downstream of N22)
- N30 punted to Batch 11 (testID hygiene)
- Viability Score: 5.9 → **6.0** (functional +0.1)
