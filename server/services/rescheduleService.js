const { pool } = require('../db');

const DURATION_MIN = 30;
const CONFLICT_MESSAGE = 'Selected slot is no longer available.';

function makeError(message, code) {
  const err = new Error(message);
  err.code = code;
  return err;
}

function makeConflictError() {
  return makeError(CONFLICT_MESSAGE, 'CONFLICT');
}

function isDatabaseOverlapError(err) {
  return err && (err.code === '23P01' || err.code === '23505');
}

function normalizeDateOrThrow(value, fieldName) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw makeError(`${fieldName} must be a valid date-time`, 'BAD_REQUEST');
  }
  return date;
}

function sameInstant(left, rightIso) {
  return new Date(left).getTime() === new Date(rightIso).getTime();
}

async function rescheduleAppointment({ appointmentId, startsAt, idempotencyKey }) {
  const normalizedStartsAt = normalizeDateOrThrow(startsAt, 'startsAt');
  const normalizedEndsAt = new Date(normalizedStartsAt.getTime() + DURATION_MIN * 60000);
  const startsAtISO = normalizedStartsAt.toISOString();
  const endsAtISO = normalizedEndsAt.toISOString();
  const trimmedIdempotencyKey = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';

  const client = await pool.connect();
  let inTransaction = false;

  try {
    await client.query('BEGIN');
    inTransaction = true;

    if (trimmedIdempotencyKey) {
      await client.query(
        `INSERT INTO reschedule_idempotency_keys (idempotency_key, appointment_id, starts_at)
         VALUES ($1, $2, $3::timestamp)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [trimmedIdempotencyKey, appointmentId, startsAtISO]
      );

      const idempotencyRes = await client.query(
        `SELECT appointment_id::text AS appointment_id, starts_at, response
           FROM reschedule_idempotency_keys
          WHERE idempotency_key = $1
          FOR UPDATE`,
        [trimmedIdempotencyKey]
      );

      if (idempotencyRes.rowCount === 0) {
        throw makeError('idempotency key could not be locked', 'INTERNAL');
      }

      const existingKey = idempotencyRes.rows[0];
      if (
        existingKey.appointment_id !== appointmentId ||
        !sameInstant(existingKey.starts_at, startsAtISO)
      ) {
        throw makeError(
          'Idempotency key was already used for a different reschedule request.',
          'IDEMPOTENCY_KEY_REUSED'
        );
      }

      if (existingKey.response) {
        await client.query('COMMIT');
        inTransaction = false;
        return existingKey.response;
      }
    }

    const apptRes = await client.query(
      'SELECT id, doctor_id FROM appointments WHERE id = $1 FOR UPDATE',
      [appointmentId]
    );

    if (apptRes.rowCount === 0) {
      throw makeError('appointment not found', 'NOT_FOUND');
    }

    const doctorId = apptRes.rows[0].doctor_id;

    const conflictRes = await client.query(
      `SELECT id
         FROM appointments
        WHERE doctor_id = $1
          AND id <> $2
          AND starts_at < $3::timestamp
          AND ends_at > $4::timestamp
        LIMIT 1`,
      [doctorId, appointmentId, endsAtISO, startsAtISO]
    );

    if (conflictRes.rowCount > 0) {
      throw makeConflictError();
    }

    await client.query(
      `UPDATE appointments
          SET starts_at = $1::timestamp,
              ends_at = $2::timestamp
        WHERE id = $3`,
      [startsAtISO, endsAtISO, appointmentId]
    );

    const result = {
      ok: true,
      appointmentId,
      startsAt: startsAtISO,
      endsAt: endsAtISO
    };

    if (trimmedIdempotencyKey) {
      await client.query(
        `UPDATE reschedule_idempotency_keys
            SET response = $2::jsonb
          WHERE idempotency_key = $1`,
        [trimmedIdempotencyKey, JSON.stringify(result)]
      );
    }

    await client.query('COMMIT');
    inTransaction = false;
    return result;
  } catch (err) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        // Preserve the original error; rollback failure is only diagnostic.
      }
    }

    if (isDatabaseOverlapError(err)) {
      throw makeConflictError();
    }

    throw err;
  } finally {
    client.release();
  }
}

module.exports = { rescheduleAppointment, CONFLICT_MESSAGE };
