import { useState, useEffect, useCallback, useRef } from 'react';

export type LocationPermissionState = 'granted' | 'denied' | 'prompt';

export function useUserPermissions() {
  const locationSupported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const notificationSupported = typeof window !== 'undefined' && 'Notification' in window;

  const [locationStatus, setLocationStatus] = useState<LocationPermissionState>(() =>
    locationSupported ? 'prompt' : 'denied'
  );
  const [notificationStatus, setNotificationStatus] = useState<NotificationPermission>(() =>
    notificationSupported ? Notification.permission : 'denied'
  );
  const [permissionsChecked, setPermissionsChecked] = useState<boolean>(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const locationStatusRef = useRef<LocationPermissionState>(locationStatus);
  const notificationStatusRef = useRef<NotificationPermission>(notificationStatus);

  useEffect(() => {
    locationStatusRef.current = locationStatus;
  }, [locationStatus]);

  useEffect(() => {
    notificationStatusRef.current = notificationStatus;
  }, [notificationStatus]);

  const queryLocationPermission = useCallback(async (): Promise<LocationPermissionState> => {
    if (!locationSupported) {
      setLocationStatus('denied');
      return 'denied';
    }
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        const nextState: LocationPermissionState =
          result.state === 'granted' || result.state === 'denied' ? result.state : 'prompt';
        setLocationStatus(nextState);
        return nextState;
      } catch {
        // Fallback below if browser blocks/does not support permissions.query('geolocation')
      }
    }
    return locationStatusRef.current;
  }, [locationSupported]);

  const refreshPermissions = useCallback(async () => {
    const nextNotif: NotificationPermission = notificationSupported
      ? Notification.permission
      : 'denied';
    setNotificationStatus(nextNotif);

    const nextLoc = await queryLocationPermission();
    setPermissionsChecked(true);
    return {
      locationStatus: nextLoc,
      notificationStatus: nextNotif,
    };
  }, [notificationSupported, queryLocationPermission]);

  useEffect(() => {
    let disposed = false;
    let geoPermStatus: PermissionStatus | null = null;
    let notifPermStatus: PermissionStatus | null = null;

    const safetyTimer = window.setTimeout(() => {
      if (!disposed) {
        setPermissionsChecked(true);
      }
    }, 450);

    const init = async () => {
      if (notificationSupported) {
        setNotificationStatus(Notification.permission);
      } else {
        setNotificationStatus('denied');
      }

      if (locationSupported && navigator.permissions && typeof navigator.permissions.query === 'function') {
        try {
          geoPermStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (!disposed) {
            const nextGeo: LocationPermissionState =
              geoPermStatus.state === 'granted' || geoPermStatus.state === 'denied'
                ? geoPermStatus.state
                : 'prompt';
            setLocationStatus(nextGeo);
            geoPermStatus.onchange = () => {
              if (!disposed && geoPermStatus) {
                const updated: LocationPermissionState =
                  geoPermStatus.state === 'granted' || geoPermStatus.state === 'denied'
                    ? geoPermStatus.state
                    : 'prompt';
                setLocationStatus(updated);
              }
            };
          }
        } catch {
          // Permissions API for geolocation not supported
        }
      }

      if (notificationSupported && navigator.permissions && typeof navigator.permissions.query === 'function') {
        try {
          notifPermStatus = await navigator.permissions.query({ name: 'notifications' as PermissionName });
          if (!disposed) {
            setNotificationStatus(Notification.permission);
            notifPermStatus.onchange = () => {
              if (!disposed) {
                setNotificationStatus(Notification.permission);
              }
            };
          }
        } catch {
          // Permissions API for notifications not supported
        }
      }

      if (!disposed) {
        setPermissionsChecked(true);
        window.clearTimeout(safetyTimer);
      }
    };

    void init();

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void refreshPermissions();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      disposed = true;
      window.clearTimeout(safetyTimer);
      if (geoPermStatus) geoPermStatus.onchange = null;
      if (notifPermStatus) notifPermStatus.onchange = null;
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [locationSupported, notificationSupported, refreshPermissions]);

  const requestLocation = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!locationSupported) {
        setLocationStatus('denied');
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
          setLocationStatus('granted');
          resolve(coords);
        },
        async (err) => {
          if (err && err.code === 1) {
            setLocationStatus('denied');
          } else {
            await queryLocationPermission();
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }, [locationSupported, queryLocationPermission]);

  const requestNotification = useCallback(async (): Promise<boolean> => {
    if (!notificationSupported) {
      setNotificationStatus('denied');
      return false;
    }

    if (Notification.permission === 'granted') {
      setNotificationStatus('granted');
      return true;
    }

    try {
      const perm = await Notification.requestPermission();
      setNotificationStatus(perm);
      return perm === 'granted';
    } catch {
      const fallback = Notification.permission;
      setNotificationStatus(fallback);
      return String(fallback) === 'granted';
    }
  }, [notificationSupported]);

  // Synchronously invoke both native prompts inside the caller's user-gesture stack
  const requestRequiredPermissions = useCallback(async (): Promise<{
    locationGranted: boolean;
    notificationGranted: boolean;
    bothGranted: boolean;
  }> => {
    const notifPromise: Promise<NotificationPermission> = notificationSupported
      ? Notification.permission === 'granted'
        ? Promise.resolve<NotificationPermission>('granted')
        : Promise.resolve(Notification.requestPermission()).catch(() => Notification.permission)
      : Promise.resolve<NotificationPermission>('denied');

    const locPromise = requestLocation();

    const [notifPerm, coords] = await Promise.all([notifPromise, locPromise]);
    setNotificationStatus(notifPerm);
    const refreshed = await refreshPermissions();

    const finalNotifGranted = notifPerm === 'granted' || refreshed.notificationStatus === 'granted';
    const finalLocGranted = Boolean(coords) || refreshed.locationStatus === 'granted';

    if (finalLocGranted) {
      setLocationStatus('granted');
    }

    return {
      locationGranted: finalLocGranted,
      notificationGranted: finalNotifGranted,
      bothGranted: finalLocGranted && finalNotifGranted,
    };
  }, [notificationSupported, requestLocation, refreshPermissions]);

  const hasAllRequiredPermissions =
    permissionsChecked &&
    locationStatus === 'granted' &&
    notificationStatus === 'granted';

  return {
    locationStatus,
    notificationStatus,
    locationSupported,
    notificationSupported,
    permissionsChecked,
    hasAllRequiredPermissions,
    userCoords,
    refreshPermissions,
    requestLocation,
    requestNotification,
    requestRequiredPermissions,
  };
}
