# Verification And Trust

This guide explains how support should handle identity verification, Ghana Card checks, Didit verification, name matching, and trust signals.

## Verification Routes By Country

- Ghana workers: Ghana Card flow with card front, card back, liveness/selfie, and Hubtel verification.
- Non-Ghana workers: Didit KYC flow.
- Venues: business verification flow where required.

## Ghana Worker Verification

The Ghana flow should:

1. Capture front of Ghana Card.
2. Capture back of Ghana Card.
3. Capture liveness selfie.
4. Scan card data.
5. Check profile name against card name before server verification.
6. Send verified card fields to server-side Hubtel verification.
7. Store verification result and return status to frontend.

Credentials must stay server-side. Never expose Hubtel Basic Auth or account numbers to users.

## Name Matching Rule

The worker profile name must match the ID holder. This prevents a person from using another person’s Ghana Card.

If names do not match:

- Ask the worker to confirm their account legal name.
- Do not manually change names after signup without controlled support review.
- Escalate if the worker says their legal name was entered incorrectly.

## Name Change Risk

Workers should not freely change first or last name after signup because a bad actor could:

1. Change account name to match a stolen card.
2. Verify with stolen card.
3. Change account name back.

Support action:

- Treat name changes as sensitive.
- Require admin review and proof.
- Keep an audit trail.

## Didit Verification

Non-Ghanaian users use Didit. Support should:

- Confirm user country.
- Confirm they clicked Verify Now.
- Ask for the verification status shown.
- Ask whether they returned to the app after completing Didit.

Escalate if:

- Didit success does not sync back.
- Didit webhook failed.
- User is stuck pending after completion.

## Admin Verification Queue

Admins may review:

- Pending ID verifications.
- Rejected verification reasons.
- Uploaded card/selfie assets where allowed.
- Ghana verification raw response summary.

Admins should not approve identities based only on a user message.

## Trust Signals For Venues

Trust features venues may use:

- Ratings from past roles.
- Completed shift count.
- Reliability score.
- No-show history.
- Certifications.
- Intro video.
- Reference checks.

Support should explain these as confidence signals, not guarantees.

