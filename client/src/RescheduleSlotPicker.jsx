import React, { useEffect, useState } from 'react';
import { fetchAvailability, reschedule } from './api';

const SLOT_CONFLICT_MESSAGE = 'Selected slot is no longer available.';

function makeIdempotencyKey(appointmentId, startsAt) {
  const randomPart =
    typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${appointmentId}:${startsAt}:${randomPart}`;
}

export default function RescheduleSlotPicker({ doctorId, appointmentId, date }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setConflictMessage('');
    setErrorMessage('');
    setSuccessMessage('');

    fetchAvailability(doctorId, date)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setErrorMessage('Failed to load availability. Please try again.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [doctorId, date]);

  async function refreshAvailability() {
    const freshData = await fetchAvailability(doctorId, date);
    setData(freshData);
    return freshData;
  }

  async function onConfirm() {
    if (!selected || submitting) return;

    const startsAt = selected;
    const idempotencyKey = makeIdempotencyKey(appointmentId, startsAt);

    setSubmitting(true);
    setConflictMessage('');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await reschedule(appointmentId, startsAt, idempotencyKey);
      await refreshAvailability();
      setSelected(null);
      setSuccessMessage('Appointment rescheduled. Availability has been updated.');
    } catch (err) {
      if (err && err.status === 409) {
        setConflictMessage(err.message || SLOT_CONFLICT_MESSAGE);
        setSelected(null);
        try {
          await refreshAvailability();
        } catch (refreshErr) {
          // Keep the conflict visible even if the follow-up refresh fails.
        }
      } else {
        setErrorMessage('Reschedule failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div>Loading slots…</div>;

  return (
    <div>
      {errorMessage && (
        <div role="alert" style={{ marginBottom: 12, color: '#8a1f11' }}>
          {errorMessage}
        </div>
      )}

      {conflictMessage && (
        <div role="alert" aria-live="assertive" style={{ marginBottom: 12, color: '#8a1f11' }}>
          {conflictMessage}
        </div>
      )}

      {successMessage && (
        <div role="status" aria-live="polite" style={{ marginBottom: 12, color: '#245c1a' }}>
          {successMessage}
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {data &&
          data.slots.map((slot) => {
            const label = new Date(slot.startsAt).toLocaleTimeString([], {
              hour: 'numeric',
              minute: '2-digit'
            });
            return (
              <li key={slot.startsAt} style={{ marginBottom: 6 }}>
                <button
                  type="button"
                  disabled={!slot.available || submitting}
                  aria-pressed={selected === slot.startsAt}
                  onClick={() => {
                    setSelected(slot.startsAt);
                    setConflictMessage('');
                    setErrorMessage('');
                    setSuccessMessage('');
                  }}
                  style={{
                    padding: '6px 12px',
                    background: selected === slot.startsAt ? '#cfe8ff' : '#f0f0f0'
                  }}
                >
                  {label} {slot.available ? '' : '(taken)'}
                </button>
              </li>
            );
          })}
      </ul>

      <button
        type="button"
        disabled={!selected || submitting}
        onClick={onConfirm}
        style={{ padding: '8px 16px' }}
      >
        Confirm reschedule
      </button>
      {submitting && (
        <span role="status" aria-live="polite" style={{ marginLeft: 12 }}>
          Rescheduling…
        </span>
      )}
    </div>
  );
}
