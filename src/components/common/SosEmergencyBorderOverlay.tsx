import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { handleFirestoreError, OperationType } from '../../firebase/errorHandler';

/**
 * Full-viewport blinking gradient border shown across all platforms, devices, and routes
 * whenever there is at least one unaccepted SOS signal (`status === 'active'`).
 * Disappears automatically in real time as soon as all active SOS signals are accepted (`responding`)
 * or closed (`resolved` / `cancelled`).
 */
export const SosEmergencyBorderOverlay: React.FC = () => {
  const [hasUnacceptedSos, setHasUnacceptedSos] = useState(false);

  useEffect(() => {
    const activeSosQuery = query(
      collection(db, 'rescueSignals'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      activeSosQuery,
      snapshot => {
        const activeExists = snapshot.docs.some(docSnap => docSnap.data()?.status === 'active');
        setHasUnacceptedSos(activeExists);
      },
      error => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'rescueSignals');
        } catch {
          // Non-blocking error handling so snapshot listener never crashes app tree
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  if (!hasUnacceptedSos) {
    return null;
  }

  return (
    <div aria-hidden="true" className="pointer-events-none">
      <div className="sos-site-border-glow" />
      <div className="sos-site-border-frame" />
    </div>
  );
};
