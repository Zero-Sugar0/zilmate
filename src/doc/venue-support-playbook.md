# Venue Support Playbook

Use this guide when helping venues set up company profiles, connect billing, post shifts, review applicants, accept workers, monitor attendance, message workers, and manage payments.

## Venue Journey

1. Sign up as a venue.
2. Complete venue setup: company name, country, city, town, company type, about/company description.
3. Verify business where required.
4. Connect billing/payment.
5. Post shifts with role, date, time, rate, description, dress code, instructions, certifications.
6. Review applicants and AI match information.
7. Accept worker.
8. Coordinate in Messages.
9. Confirm clock-in/out and completion.
10. Handle ratings, disputes, or future preferred workers.

## Common Venue Issues

### Venue Cannot Connect Billing

Check country:

- Ghana venues use Hubtel checkout/pre-auth.
- African countries supported by Paystack should use Paystack.
- India uses Razorpay.
- Other countries generally use Stripe.

For Ghana Hubtel errors, check:

- Gateway server has real `SUPABASE_SERVICE_ROLE_KEY`, not anon.
- `payments` table has required compatibility columns such as `worker_amount`.
- Hubtel gateway URL/token are configured.
- Hubtel account number and checkout credentials are configured.

Explain:

> Billing setup must complete before some payment-related actions can work. Ghana uses Hubtel, so the checkout page should open from the Account page.

Escalate if:

- Error says upstream 500.
- Error mentions schema cache.
- Error mentions service_role key.
- Hubtel checkout opens but never returns connected.

### Venue Cannot Post A Shift

Check:

- Venue setup completed.
- Venue country/city/town saved.
- Company about/description exists.
- Required role selected.
- Date/time/rate are valid.
- Billing requirements are satisfied for that country.

Escalate if:

- UI accepts inputs but shift does not save.
- Role list is missing categories.
- Rate suggestion blocks posting.

### Venue Cannot See Applicants

Check:

- Shift is open or has applications.
- Applicants have applied.
- Venue is the owner of the shift.
- AI match may take a few seconds; loading state should show.

Explain:

> Applicant matching can take a moment because ZiloShift scores role fit, reliability, location, and profile trust signals.

Escalate if:

- Blank screen remains after 10 seconds.
- AI matching repeats every time and causes delays.
- Applicant list appears for wrong venue.

### Venue Wants To See Worker Trust Signals

Venues should see:

- Worker rating and reliability.
- Completed shift count.
- Work history summary.
- Role history.
- Intro video, if uploaded.
- Certification badges and expiry dates, if available.
- Reference checks where supported.

Escalate if:

- Video does not play.
- Certifications are uploaded but not shown.
- Ratings from past roles do not appear.

### Venue Accepted Worker But Cannot Track Attendance

Check:

- Worker accepted status.
- Worker has clocked in.
- Map/arrival view availability.
- Messages thread exists.

Explain:

> After accepting a worker, the venue should be able to coordinate through Messages and see attendance status. If live travel tracking is enabled, it should appear from the shift/applicant view.

Escalate if:

- Worker says they clocked in but venue still sees only Hired.
- QR clock-in does not generate or scan.
- Map does not load.

## Venue Account Updates

Venues should be able to update:

- Company about.
- City/town.
- Contact phone.
- Billing/payout connection where applicable.
- Team details if enterprise features are enabled.

Support should encourage venues to fill in company descriptions because workers use that to understand what the company does and what is expected.

## Venue Tone Guide

Use operational language:

> I’ll check the shift status, billing connection, and applicant list first. Those three usually explain why a venue cannot hire or view workers.

Avoid vague language:

> Maybe the worker did not apply.

Better:

> I can see whether applications exist and whether the applicant list is failing to load.

