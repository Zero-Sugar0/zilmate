# Payments And Payouts

Use this guide to support billing setup, shift payment, worker payout, profile promotion, and country-specific payment rails.

## Payment Provider By Market

- Ghana: Hubtel for checkout, SMS, worker payout, and Ghana-specific flows.
- Nigeria, Kenya, South Africa: Paystack where configured.
- India: Razorpay.
- UK, US, and other markets: Stripe where configured.

## Venue Billing

Venues may need to connect billing before posting or paying for shifts.

Ghana venue billing:

- Uses Hubtel gateway `/api/checkout/initiate`.
- Requires gateway `SUPABASE_SERVICE_ROLE_KEY` to be a real service_role key.
- Requires Hubtel checkout credentials and account number.
- Writes checkout/payment state into `payments`.

Common errors:

- `SUPABASE_SERVICE_ROLE_KEY must have role service_role, not anon`: gateway env uses anon key. Replace with Supabase service role key and restart PM2.
- `Could not find worker_amount column`: live `payments` schema missing compatibility column. Add column and reload schema.
- Upstream 500: check gateway PM2 logs and Hubtel response body.

## Worker Payout

Workers must have valid payout details before payout can complete.

Ghana worker payout:

- Mobile money or bank details.
- Phone/account name should be verified where possible.
- Hubtel sends money or bank transfer through gateway.

Other markets:

- Paystack recipients/subaccounts for supported African countries.
- Razorpay fund accounts for India.
- Stripe Connect for Stripe markets.

## Profile Promotion

Workers can pay to promote their profile for 7 days.

Provider routing:

- Ghana: Hubtel checkout.
- Paystack countries: Paystack checkout.
- India: Razorpay checkout.
- Other markets: Stripe checkout.

If profile promotion payment succeeds but profile is not promoted:

- Check payment verification function for the provider.
- Check `profile_promotions`.
- Check `workers.promoted_until`.
- Escalate if provider captured payment but app did not update.

## Refunds And Disputes

Do not promise refunds until status is confirmed.

Escalate when:

- Worker no-show.
- Venue cancels after worker acceptance.
- Worker cancels after acceptance.
- Payment captured but shift canceled.
- Duplicate charge.
- Wrong amount.

## Payment Safety Rules

- Never ask users for full card numbers.
- Never share service_role keys, API keys, Basic Auth tokens, or gateway tokens.
- Never manually mark payment captured without provider evidence.
- Always record provider, reference, amount, currency, and user ID in escalations.

