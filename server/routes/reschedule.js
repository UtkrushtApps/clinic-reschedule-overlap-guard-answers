const express = require('express');
const { rescheduleAppointment, CONFLICT_MESSAGE } = require('../services/rescheduleService');

const router = express.Router();

router.post('/appointments/:appointmentId/reschedule', async (req, res) => {
  const { appointmentId } = req.params;
  const { startsAt, idempotencyKey: bodyIdempotencyKey } = req.body || {};
  const headerIdempotencyKey = req.get('Idempotency-Key');
  const idempotencyKey = headerIdempotencyKey || bodyIdempotencyKey;

  if (!startsAt) {
    return res.status(400).json({ error: 'startsAt is required' });
  }

  try {
    const result = await rescheduleAppointment({ appointmentId, startsAt, idempotencyKey });
    return res.json(result);
  } catch (err) {
    if (err && err.code === 'CONFLICT') {
      return res.status(409).json({
        error: 'slot_conflict',
        message: CONFLICT_MESSAGE
      });
    }
    if (err && err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'appointment_not_found' });
    }
    if (err && err.code === 'BAD_REQUEST') {
      return res.status(400).json({ error: err.message });
    }
    if (err && err.code === 'IDEMPOTENCY_KEY_REUSED') {
      return res.status(409).json({
        error: 'idempotency_key_reused',
        message: 'Idempotency key was already used for a different reschedule request.'
      });
    }
    return res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
