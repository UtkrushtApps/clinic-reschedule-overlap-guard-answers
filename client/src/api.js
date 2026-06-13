export async function fetchAvailability(doctorId, date) {
  const res = await fetch(`/api/doctors/${doctorId}/availability?date=${encodeURIComponent(date)}`);
  if (!res.ok) {
    throw new Error('Failed to load availability');
  }
  return res.json();
}

async function parseErrorResponse(res, fallbackMessage) {
  let payload = null;
  try {
    payload = await res.json();
  } catch (err) {
    payload = null;
  }

  const message = (payload && (payload.message || payload.error)) || fallbackMessage;
  const error = new Error(message);
  error.status = res.status;
  error.payload = payload;
  return error;
}

export async function reschedule(appointmentId, startsAt, idempotencyKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(`/api/appointments/${appointmentId}/reschedule`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ startsAt, idempotencyKey })
  });

  if (!res.ok) {
    throw await parseErrorResponse(res, 'Reschedule failed');
  }

  return res.json();
}
