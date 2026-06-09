# Admin Tools And SMS Campaigns

This guide trains admins to use campaign tools, verification queues, user management, shifts, payments, and disputes.

## Admin SMS Campaigns

SMS campaigns are for Ghana users through Hubtel SMS.

Supported audiences:

- Workers.
- Venues.
- Both workers and venues.

The campaign tool should:

1. Let admin choose audience.
2. Preview real recipients.
3. Show skipped users missing phone numbers.
4. Send a test SMS before bulk sending.
5. Send personalized batch SMS through Hubtel.
6. Save campaign logs in `sms_campaigns`.

## Hubtel SMS Contract

The gateway follows Hubtel SMS docs:

- Single test SMS: `POST /v1/messages/send`.
- Personalized batch SMS: `POST /v1/messages/batch/personalized/send`.
- Basic Auth is built from SMS credentials.
- Sender ID max length is 11 characters.

Supported variables:

- `{{first_name}}`
- `{{last_name}}`
- `{{name}}`
- `{{company_name}}`
- `{{account_type}}`
- `{{city}}`
- `{{town}}`

## SMS Troubleshooting

If test SMS returns 400:

- Check Hubtel error details.
- Check phone format normalizes to `233...`.
- Check sender ID is 11 characters or less.
- Check message length is not too long.
- Check SMS account credit.
- Check if recipient is blacklisted.
- Check SMS credentials.

If no workers appear:

- Check Ghana workers have profile phone numbers.
- Workers without phone numbers are skipped.

If venues appear but workers do not:

- Venue phone may exist on `venues.phone`.
- Worker phone must exist on `profiles.phone`.

## Admin Verification Page

Admins can review identity and business verification.

Do not approve:

- Mismatched names.
- Blurry IDs.
- Missing liveness.
- Suspicious duplicate accounts.

## Admin Payments Page

Admins should use this for:

- Captured payments.
- Payout status.
- Failed provider responses.
- Refund checks.

Never expose secret keys in admin notes or user replies.

## Admin Disputes Page

Admins should review:

- Worker/venue claims.
- Shift status.
- Clock-in/out.
- Messages.
- Payment status.
- Reliability/no-show history.

Keep notes factual and timestamped.

