# App Store Privacy Questionnaire Notes

Use this as the starting point for App Store Connect. Re-verify before submission.

## Data Likely Collected

- Contact info: email address
- User content: meal photos, nutrition/log data, chat prompts, preference selections
- Identifiers: account ID
- Diagnostics: client error events sent to backend telemetry, server logs

## Data Usage Mapping

| Data Type | Purpose |
| --- | --- |
| Email | Account creation, sign-in, support |
| Photos/images | User-initiated meal or label scanning |
| Chat content | AI wellness guidance |
| Nutrition logs and preferences | Personalization and history |
| Diagnostics | App reliability and bug investigation |

## Tracking

- No ad tracking is currently implemented.
- Revisit this if analytics or attribution SDKs are added later.

## Age Rating Guidance

- General wellness and food guidance app
- No user-generated social feed
- No gambling, alcohol sales, or mature content
- Default assumption: standard age rating, not kids-targeted
