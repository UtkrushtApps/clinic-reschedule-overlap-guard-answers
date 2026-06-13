const path = require('path');
const express = require('express');
const { pool } = require('./db');
const availabilityRoutes = require('./routes/availability');
const rescheduleRoutes = require('./routes/reschedule');

const app = express();
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'db_unavailable' });
  }
});

app.use('/api', availabilityRoutes);
app.use('/api', rescheduleRoutes);

const clientBuild = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuild, 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`CareSlot server listening on ${PORT}`);
});
