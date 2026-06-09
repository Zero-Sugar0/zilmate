# Worker Support Playbook

Use this guide when helping workers sign up, verify identity, find shifts, apply, clock in/out, message venues, update profile details, or get paid.

## Worker Journey

1. Sign up as a worker.
2. Complete worker setup: country, city, town, roles, experience, certifications, availability, phone.
3. Verify identity.
4. Add payout details.
5. Browse eligible shifts in their city.
6. Apply for shifts matching their roles and location.
7. If accepted, coordinate with the venue in Messages.
8. Clock in when the shift starts.
9. Clock out when the shift ends.
10. Wait for completion processing and payout.

## Common Worker Issues

### Worker Cannot See Shifts

Check:

- Worker country, city, and town are saved.
- Shift is in the same city as the worker.
- Worker has selected roles matching available shifts.
- Shift status is open.
- Shift is not standby-only unless needed.
- Worker profile setup is completed.

Explain:

> ZiloShift shows workers shifts in their own city so they do not travel too far or apply for work they cannot realistically attend. Anyone in the same city should see shifts across towns in that city.

Escalate if:

- Same-city open shifts exist but do not show.
- Role filters are wrong after profile updates.
- The worker sees corrupted text or missing company names.

### Worker Wants To Verify Identity

Ghanaian workers use the Ghana Card verification flow. Other countries use Didit verification.

Check:

- Worker country is correct.
- Ghanaian workers should see Verify Now and be routed to Ghana verification.
- Non-Ghanaian workers should be routed through Didit.

Do not:

- Ask for full ID numbers over chat.
- Upload documents for the user.
- Mark identity verified manually without admin review.

### Worker Is Ghanaian And Verification Fails

Ask:

- Did they scan the front and back of the Ghana Card?
- Did the liveness camera show their face?
- Does the name on the account match the name on the card?
- Did they use a clear, well-lit card image?

Explain:

> Ghana verification checks the card data and compares it against the worker profile details. If the profile name does not match the card, verification may stop before sending details for Hubtel verification.

Escalate if:

- Camera is blank.
- Front/back scan captures but verification never proceeds.
- Hubtel returns a provider error.
- User was verified but still sees pending.

### Worker Cannot Clock In

Check:

- Worker has been accepted for the shift.
- Shift date/time has started or is close enough to start.
- QR code clock-in is available from venue, or worker manual clock-in is enabled.
- There is no existing active time entry.

Explain:

> Once clocked in, the shift should move to Active and remain active even if the worker leaves and returns to the page.

Escalate if:

- Worker clocked in successfully but the page later asks them to clock in again.
- Duplicate time entries exist.
- Clock-in works for QR but not manual, or vice versa.

### Worker Was Accepted But Did Not Receive SMS

For Ghana workers, acceptance SMS should be sent through Hubtel.

Check:

- Worker country is GH.
- Profile phone number is present and valid.
- Phone can normalize to Ghana MSISDN format, for example `23324xxxxxxx`.
- Shift acceptance event happened.

Escalate if:

- Phone is valid but no SMS log/campaign result exists.
- Hubtel gateway returns 400, 401, 402, or 500.

### Worker Payout Issues

Check:

- Country and payout provider:
  - Ghana: Hubtel mobile money or bank.
  - Nigeria/Kenya/South Africa: Paystack.
  - India: Razorpay.
  - Other markets: Stripe.
- Worker completed the shift.
- Shift was processed by completion function.
- Worker payout details are saved.

Do not promise exact payout timing unless the payment status is confirmed.

Escalate if:

- Payment captured but payout not created.
- Payout provider rejected account details.
- Worker was paid the wrong amount.
- Any fraud or duplicate-account concern exists.

## Worker Profile Support

Workers can update:

- Phone.
- City/town.
- Roles.
- Experience.
- Certifications and certificate uploads.
- Availability.
- Payout details.

Workers should not be able to update legal first/last name after signup without controlled support review, because name changes can weaken identity checks.

## Worker Tone Guide

Use clear, supportive language:

> I can help with that. First I’ll check your account country, city, and role settings, because those decide which shifts appear for you.

Avoid:

> It should work.

Better:

> If your city and roles are saved correctly, same-city shifts should appear. If they do not, I’ll escalate it as a visibility bug.