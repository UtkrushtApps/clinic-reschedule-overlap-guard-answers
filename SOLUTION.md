# Solution Steps

1. Add PostgreSQL safety guarantees in init_database.sql: enable pgcrypto and btree_gist, add a positive-duration check, add a GiST exclusion constraint using tsrange(starts_at, ends_at, '[)') so appointments for the same doctor cannot overlap, and create a reschedule_idempotency_keys table to store completed idempotent responses.

2. Update availability lookup to use half-open interval logic instead of exact start-time matching. Query appointments that intersect the requested day, then mark each 30-minute slot unavailable when appointment.starts_at < slot.ends_at and appointment.ends_at > slot.starts_at.

3. Change the reschedule route to read an Idempotency-Key header or body idempotencyKey, pass it to the service, map overlap conflicts to HTTP 409, and return a stable JSON payload such as { error: 'slot_conflict', message: 'Selected slot is no longer available.' }. Keep 500 only for unexpected internal failures.

4. Rewrite rescheduleAppointment to use a single database transaction. Inside the transaction, insert or lock the idempotency-key row, return the saved response for duplicate completed requests, lock the target appointment with SELECT ... FOR UPDATE, compute the 30-minute half-open range, check for per-doctor overlaps, update the appointment, save the response for the idempotency key, and commit.

5. Handle database-level race protection by catching PostgreSQL exclusion/unique violations, rolling back the transaction, and translating them into the same CONFLICT error used by the explicit overlap check.

6. Update the client API helper so reschedule requests send the idempotency key and preserve HTTP status and backend message when a request fails.

7. Update RescheduleSlotPicker so it clears messages on selection, disables controls while submitting, sends an idempotency key, refetches availability immediately after a successful reschedule, clears the selected slot, and shows a polite success status.

8. Add conflict handling in RescheduleSlotPicker: when the backend returns 409, stop submitting, show the stable conflict message in a role='alert' aria-live region, clear the stale selected slot, and refresh availability so the slot list reflects the latest server state.

