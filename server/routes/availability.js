const express = require('express');
const { getAvailability } = require('../services/availabilityService');

const router = express.Router();

router.get('/doctors/:doctorId/availability', async (req, res) => {
  const { doctorId } = req.params;
  const date = req.query.date || '2024-06-10';
  try {
    const result = await getAvailability(doctorId, date);
    res.json(result);
  } catch (err) {
    if (err && err.code === 'NOT_FOUND') {
      return res.status(404).json({ error: 'doctor_not_found' });
    }
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
