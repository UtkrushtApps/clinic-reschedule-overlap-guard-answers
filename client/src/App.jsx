import React from 'react';
import RescheduleSlotPicker from './RescheduleSlotPicker';

const DOCTOR_ID = '11111111-1111-1111-1111-111111111111';
const APPOINTMENT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const DATE = '2024-06-10';

export default function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 520, margin: '40px auto' }}>
      <h1>CareSlot</h1>
      <p>Reschedule appointment for Maria Lopez with Dr. Alice Nguyen.</p>
      <RescheduleSlotPicker
        doctorId={DOCTOR_ID}
        appointmentId={APPOINTMENT_ID}
        date={DATE}
      />
    </div>
  );
}
