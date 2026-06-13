const { Pool } = require('pg');

const pool = new Pool({
  host: 'postgres',
  port: 5432,
  user: 'careslot',
  password: 'careslot_pw',
  database: 'careslot'
});

module.exports = { pool };
