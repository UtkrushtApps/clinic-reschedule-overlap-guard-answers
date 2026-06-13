const { pool } = require('../db');

const SLOT_TIMES = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
const DURATION_MIN = 30;

function asTime(value) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

async function getAvailability(doctorId, date) {
  const doctorRes = await pool.query('SELECT clinic_timezone FROM doctors WHERE id = $1', [doctorId]);
  if (doctorRes.rowCount === 0) {
    const err = new Error('doctor not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const clinicTimezone = doctorRes.rows[0].clinic_timezone;

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const apptRes = await pool.query(
    `SELECT starts_at, ends_at
       FROM appointments
      WHERE doctor_id = $1
        AND starts_at < $2::timestamp
        AND ends_at > $3::timestamp`,
    [doctorId, dayEnd.toISOString(), dayStart.toISOString()]
  );

  const appointments = apptRes.rows.map((r) => ({
    startsAtMs: asTime(r.starts_at),
    endsAtMs: asTime(r.ends_at)
  }));

  const slots = SLOT_TIMES.map((t) => {
    const startsAt = new Date(`${date}T${t}:00.000Z`);
    const endsAt = new Date(startsAt.getTime() + DURATION_MIN * 60000);
    const slotStartMs = startsAt.getTime();
    const slotEndMs = endsAt.getTime();

    const overlapsExistingAppointment = appointments.some(
      (appt) => appt.startsAtMs < slotEndMs && appt.endsAtMs > slotStartMs
    );

    return {
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      available: !overlapsExistingAppointment
    };
  });

  return { clinicTimezone, slots };
}

module.exports = { getAvailability };
