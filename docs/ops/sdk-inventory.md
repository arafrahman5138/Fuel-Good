# Third-Party SDK and Service Inventory

## Mobile SDKs

| Package | Purpose | Status | Update Policy |
| --- | --- | --- | --- |
| `expo` / `react-native` | Core runtime | Approved | Upgrade by Expo SDK cycle, not ad hoc |
| `expo-auth-session` | Google OAuth flow | Approved | Validate against Expo SDK before bump |
| `expo-apple-authentication` | Apple Sign-In | Approved | Keep aligned with Expo SDK |
| `expo-camera` | Camera access | Approved | Test permissions and scan flow on every minor upgrade |
| `expo-image-picker` | Photo library access | Approved | Test permissions and denial flow on every minor upgrade |
| `expo-secure-store` | Secure token storage | Approved | Do not replace without migration plan |

## Backend Services

| Service | Purpose | Status | Notes |
| --- | --- | --- | --- |
| Google OAuth | Social sign-in | Approved | Bundle ID and client IDs must stay aligned |
| Apple Sign-In | Social sign-in | Approved | Physical-device validation required |
| Gemini / Google AI | AI chat and scan features | Approved | Track monthly quota and per-feature cost |
| USDA | Food data | Approved | Verify quota and terms before launch |
| Spoonacular | Food/recipe enrichment | Approved if used | Validate paid/free tier before scale |

## Review Rules

- No new SDK goes into production without:
  - package ownership review
  - last-release recency check
  - privacy impact review
  - iOS release test on a real device
