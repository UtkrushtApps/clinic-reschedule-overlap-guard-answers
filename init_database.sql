CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  clinic_timezone TEXT NOT NULL
);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES doctors(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT appointments_positive_duration CHECK (ends_at > starts_at),
  CONSTRAINT appointments_no_overlap_per_doctor EXCLUDE USING gist (
    doctor_id WITH =,
    tsrange(starts_at, ends_at, '[)') WITH &&
  )
);

CREATE UNIQUE INDEX uq_doctor_exact_start ON appointments (doctor_id, starts_at);

CREATE TABLE reschedule_idempotency_keys (
  idempotency_key TEXT PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  starts_at TIMESTAMP NOT NULL,
  response JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO doctors (id, name, clinic_timezone) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Dr. Alice Nguyen', 'America/Chicago'),
  ('22222222-2222-2222-2222-222222222222', 'Dr. Bobby Tan', 'America/New_York');

INSERT INTO patients (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Maria Lopez'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'John Carter'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Priya Shah');

INSERT INTO appointments (id, doctor_id, patient_id, starts_at, ends_at, created_at) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2024-06-10 14:00:00', '2024-06-10 14:30:00', now()),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2024-06-10 15:00:00', '2024-06-10 15:30:00', now()),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '2024-06-10 13:00:00', '2024-06-10 13:30:00', now());
