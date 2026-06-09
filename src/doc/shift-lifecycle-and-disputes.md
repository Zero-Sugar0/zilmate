# Shift Lifecycle And Disputes

This guide explains how shifts move through the platform and how support should handle attendance, cancellations, no-shows, disputes, and completion.

## Shift Statuses

Typical statuses:

- Draft: venue started but has not posted.
- Open: workers can apply.
- Filled: venue accepted a worker.
- In progress: worker clocked in.
- Completed: work done and ready for completion/payment processing.
- Cancelled: shift no longer happening.

## Standby Shifts

Standby shifts should not display as normal available paid shifts immediately. They should only become relevant when the primary worker does not show or the venue activates standby need.

Escalate if:

- Worker sees primary and standby shift at the same time.
- Standby shift shows `0` pay and still allows normal application.

## Applications

Workers apply for shifts. Venues review applications, match score, trust details, ratings, role history, videos, and certifications.

Support should check:

- Application status: pending, accepted, declined, withdrawn.
- Shift owner.
- Worker identity verification status.
- Worker role match.

## Acceptance

When a venue accepts a worker:

- Worker should see accepted shift.
- Worker and venue should be able to message.
- Ghana workers should receive SMS if phone is valid.
- Venue should see attendance/arrival state where available.

## Clock In And Clock Out

Clock-in can happen by:

- Venue QR code.
- Worker manual clock-in where allowed.

Expected behavior:

- Once clocked in, shift should show active.
- Returning to the shift page should not ask for clock-in again.
- Clock-out should close the active time entry.

Escalate if duplicate time entries appear or status resets.

## No-Shows

Each worker no-show should reduce reliability by `-3`.

Support should:

- Confirm shift date/time.
- Confirm venue marked no-show.
- Check messages/arrival evidence.
- Escalate disputes if worker contests.

## Cancellations

Worker cancellation can affect reliability and fees. Venue cancellation can trigger refund/worker compensation rules depending on timing.

Escalate if:

- Worker bypasses cancellation rules.
- Venue is charged incorrectly.
- Refund is stuck.
- Worker says venue canceled but marked worker no-show.

## Disputes

Collect:

- Shift ID or role/date/venue.
- Worker and venue user IDs if available.
- Timeline.
- Messages.
- Clock-in/out records.
- Payment records.
- Screenshots if user has them.

Do not decide high-risk disputes without admin review.

