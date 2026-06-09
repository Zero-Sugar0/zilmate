# Escalation Checklist

Use this checklist before escalating to engineering, operations, compliance, or payments.

## Required Information

- User type: worker or venue.
- User email or phone.
- Country.
- City/town.
- Page or feature.
- Exact error message.
- Time and date of issue.
- Browser/device if relevant.
- Screenshots if available.

## Shift Escalation

Include:

- Shift role.
- Shift date/time.
- Venue/company name.
- Worker name.
- Application status.
- Shift status.
- Clock-in/out records.
- Payment ID if available.

## Verification Escalation

Include:

- Country.
- Verification provider: Ghana/Hubtel or Didit.
- Current status.
- Whether front/back/liveness completed.
- Whether account name matches ID name.
- Any rejection reason.

Do not include full ID number in normal support tickets.

## Payment Escalation

Include:

- Provider: Hubtel, Paystack, Razorpay, Stripe.
- Amount and currency.
- Reference/checkout ID/payment ID.
- User ID.
- Shift ID if related.
- Provider response.
- Whether money was captured, pending, failed, refunded, or paid out.

## SMS Escalation

Include:

- Audience: workers, venues, or both.
- Test or batch.
- Sender ID.
- Normalized phone number.
- Hubtel response details.
- Gateway PM2 log line.
- Whether account has SMS credit.

## Fraud Or Abuse Escalation

Escalate immediately if:

- Duplicate accounts suspected.
- Same ID used by multiple accounts.
- Same payout account used by multiple unrelated workers.
- Referral farming suspected.
- Worker changes name around verification.
- Venue asks users to pay off-platform.
- Harassment, threats, unsafe venue, or unsafe worker behavior reported.

## Engineering Escalation Format

Use this format:

```text
Issue:
User type:
Country/city:
User ID/email:
Shift ID/payment ID:
Expected behavior:
Actual behavior:
Exact error:
Steps to reproduce:
Logs/response:
Impact:
Urgency:
```

