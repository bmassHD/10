import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MapPin,
  ExternalLink,
  Phone,
  Clock,
  Car,
  AlertCircle,
  Layers,
  Building2,
  Map as MapIcon,
  User,
  LocateFixed,
  Loader2,
  Radar,
  Plus,
  Edit3,
  Trash2,
  MousePointerClick,
  X,
  Calendar,
} from 'lucide-react';
import L from 'leaflet';
import {
  EpidemicCase,
  EpidemicDiseaseType,
  MapLocation,
} from '../../types';
import {
  EPIDEMIC_DISEASE_OPTIONS,
  EPIDEMIC_STATUS_META,
  getEpidemicDiseaseConfig,
} from '../../constants/epidemicDiseases';
import {
  deleteEpidemicCase,
  logAuditEvent,
  subscribeEpidemicCases,
} from '../../services/firebaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { EpidemicCaseModal } from './EpidemicCaseModal';

interface StationMapSectionProps {
  locations?: MapLocation[];
  stationName?: string;
  defaultAddress?: string;
  embedded?: boolean;
  epidemicMapButtonVisible?: boolean;
}

const GEO_SESSION_COORDS_KEY = 'tyt_geo_coords';
const GEO_SESSION_PROMPTED_KEY = 'tyt_geo_prompted';

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Haversine formula to compute distance in kilometers between two GPS coordinates
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate driving time in minutes based on distance
export function estimateDrivingMinutes(distanceKm: number): number {
  const speedKmH = 30;
  const minutes = Math.round((distanceKm / speedKmH) * 60) + 2;
  return Math.max(minutes, 2);
}

function readCachedSessionCoords(): { lat: number; lng: number } | null {
  try {
    const raw = sessionStorage.getItem(GEO_SESSION_COORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    // Ignore storage read error
  }
  return null;
}

export const StationMapSection: React.FC<StationMapSectionProps> = ({
  locations = [],
  defaultAddress = '',
  embedded = false,
  epidemicMapButtonVisible = true,
}) => {
  const { isStaff, isAdmin, currentUser, userProfile } = useAuth();
  const { showToast } = useToast();

  const activeLocations = useMemo(
    () =>
      [...locations].sort((a, b) => {
        if (a.isPrimary && !b.isPrimary) return -1;
        if (!a.isPrimary && b.isPrimary) return 1;
        return 0;
      }),
    [locations]
  );

  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(
    activeLocations.find(l => l.isPrimary) || activeLocations[0] || null
  );

  // Symmetrical map tile mode: 'satellite' | 'streets'
  const [mapTileType, setMapTileType] = useState<'streets' | 'satellite'>('satellite');

  // Auto-acquired geolocation stored for current session
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(() =>
    readCachedSessionCoords()
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Epidemic Map overlay state
  const [showEpidemicMap, setShowEpidemicMap] = useState<boolean>(false);
  const [selectedDiseaseFilter, setSelectedDiseaseFilter] = useState<EpidemicDiseaseType | 'all'>(
    'sot_xuat_huyet'
  );
  const [epidemicCases, setEpidemicCases] = useState<EpidemicCase[]>([]);
  const [selectedEpidemicCaseId, setSelectedEpidemicCaseId] = useState<string | null>(null);
  const [deletingCaseId, setDeletingCaseId] = useState<string | null>(null);

  // Mark / Edit Epidemic Case modal & map-pick mode (for Super Admin, Admin, Cán bộ Y tế)
  const [epidemicModalOpen, setEpidemicModalOpen] = useState<boolean>(false);
  const [editingEpidemicCase, setEditingEpidemicCase] = useState<EpidemicCase | null>(null);
  const [modalDraftState, setModalDraftState] = useState<Partial<EpidemicCase> | null>(null);
  const [pickedMapCoords, setPickedMapCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isPickingMapPoint, setIsPickingMapPoint] = useState<boolean>(false);

  // Leaflet map refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const epidemicLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const shouldFocusUserOnNextGpsRef = useRef<boolean>(false);
  const isPickingMapPointRef = useRef<boolean>(false);

  useEffect(() => {
    isPickingMapPointRef.current = isPickingMapPoint;
  }, [isPickingMapPoint]);

  // If Admin hides the epidemic map button for all users, force-hide overlay & reset pick mode
  useEffect(() => {
    if (!epidemicMapButtonVisible) {
      setShowEpidemicMap(false);
      setIsPickingMapPoint(false);
      setEpidemicModalOpen(false);
    }
  }, [epidemicMapButtonVisible]);

  // Subscribe to epidemic cases when button is visible
  useEffect(() => {
    if (!epidemicMapButtonVisible) {
      setEpidemicCases([]);
      return;
    }
    const unsub = subscribeEpidemicCases(
      items => {
        setEpidemicCases(items);
      },
      err => {
        console.warn('Subscribe epidemicCases failed:', err);
      }
    );
    return () => unsub();
  }, [epidemicMapButtonVisible]);

  const filteredEpidemicCases = useMemo(() => {
    if (!epidemicMapButtonVisible || !showEpidemicMap) return [];
    if (selectedDiseaseFilter === 'all') return epidemicCases;
    return epidemicCases.filter(c => c.diseaseType === selectedDiseaseFilter);
  }, [epidemicMapButtonVisible, showEpidemicMap, selectedDiseaseFilter, epidemicCases]);

  const epidemicSummary = useMemo(() => {
    const base =
      selectedDiseaseFilter === 'all'
        ? epidemicCases
        : epidemicCases.filter(c => c.diseaseType === selectedDiseaseFilter);
    return {
      total: base.length,
      active: base.filter(c => c.status === 'active').length,
      monitoring: base.filter(c => c.status === 'monitoring').length,
      resolved: base.filter(c => c.status === 'resolved').length,
    };
  }, [epidemicCases, selectedDiseaseFilter]);

  // Request user geolocation & persist for current session
  const requestGeoLocation = useCallback((recenterMap = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Trình duyệt không hỗ trợ định vị GPS.');
      return;
    }

    if (recenterMap) {
      shouldFocusUserOnNextGpsRef.current = true;
    }
    setIsLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(coords);
        setIsLocating(false);
        try {
          sessionStorage.setItem(GEO_SESSION_COORDS_KEY, JSON.stringify(coords));
          sessionStorage.setItem(GEO_SESSION_PROMPTED_KEY, '1');
        } catch {
          // Ignore storage error
        }

        if (recenterMap && mapInstanceRef.current) {
          mapInstanceRef.current.setView([coords.lat, coords.lng], 16, { animate: true });
        }
      },
      err => {
        shouldFocusUserOnNextGpsRef.current = false;
        setIsLocating(false);
        try {
          sessionStorage.setItem(GEO_SESSION_PROMPTED_KEY, '1');
        } catch {
          // Ignore storage error
        }
        if (err.code === 1) {
          setGeoError('Vui lòng cấp quyền vị trí trình duyệt để xem vị trí của bạn trên bản đồ.');
        } else {
          setGeoError('Chưa lấy được tọa độ GPS. Hãy kiểm tra định vị thiết bị và thử lại.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const handleViewMyLocation = useCallback(() => {
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
      userMarkerRef.current?.openPopup();
    }
    requestGeoLocation(true);
  }, [userLocation, requestGeoLocation]);

  // Acquire GPS silently when already granted; only prompt automatically on dedicated map view (!embedded)
  useEffect(() => {
    let cancelled = false;

    const autoInitLocation = async () => {
      const alreadyPrompted = (() => {
        try {
          return sessionStorage.getItem(GEO_SESSION_PROMPTED_KEY) === '1';
        } catch {
          return false;
        }
      })();

      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (cancelled) return;
          if (status.state === 'granted') {
            requestGeoLocation(false);
            return;
          }
          if (status.state === 'denied') {
            if (!embedded) {
              setGeoError('Quyền định vị đang tắt trong cài đặt trình duyệt.');
            }
            return;
          }
        } catch {
          // Permissions API not supported for geolocation -> fall through
        }
      }

      // Never trigger browser geolocation prompt automatically from homepage embedded map
      if (embedded) return;

      if (!alreadyPrompted && !cancelled) {
        requestGeoLocation(false);
      }
    };

    autoInitLocation();
    return () => {
      cancelled = true;
    };
  }, [requestGeoLocation, embedded]);

  // Refresh GPS automatically on pull-to-refresh event from AppShell
  useEffect(() => {
    const onRefreshLocation = () => {
      requestGeoLocation(true);
    };
    window.addEventListener('tyt:refresh-location', onRefreshLocation);
    return () => window.removeEventListener('tyt:refresh-location', onRefreshLocation);
  }, [requestGeoLocation]);

  // Keep selectedLocation updated if locations list changes
  useEffect(() => {
    if (locations.length > 0 && !selectedLocation) {
      setSelectedLocation(locations.find(l => l.isPrimary) || locations[0]);
    }
  }, [locations, selectedLocation]);

  // Clean up Leaflet instance on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        tileLayerRef.current = null;
        markersLayerRef.current = null;
        epidemicLayerRef.current = null;
      }
    };
  }, []);

  // Distance calculation
  const locationsWithDistance = activeLocations.map(loc => {
    let distanceKm: number | null = null;
    let driveMinutes: number | null = null;

    if (userLocation) {
      distanceKm = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        loc.lat,
        loc.lng
      );
      driveMinutes = estimateDrivingMinutes(distanceKm);
    }

    return {
      ...loc,
      distanceKm,
      driveMinutes,
    };
  });

  const sortedLocations = [...locationsWithDistance].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    if (a.distanceKm !== null && b.distanceKm !== null) {
      return a.distanceKm - b.distanceKm;
    }
    return 0;
  });

  const nearestLocation =
    userLocation && locationsWithDistance.length > 0
      ? [...locationsWithDistance].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))[0]
      : null;

  const canRenderMap =
    activeLocations.length > 0 ||
    Boolean(userLocation) ||
    (epidemicMapButtonVisible && showEpidemicMap);

  // Initialize and update Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!canRenderMap) return;

    const firstEpidemic = filteredEpidemicCases[0];
    const initialCenter: [number, number] = selectedLocation
      ? [selectedLocation.lat, selectedLocation.lng]
      : firstEpidemic
      ? [firstEpidemic.lat, firstEpidemic.lng]
      : userLocation
      ? [userLocation.lat, userLocation.lng]
      : [10.7516, 106.7024];

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const initialTileUrl =
        mapTileType === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const tileLayer = L.tileLayer(initialTileUrl, { maxZoom: 19 }).addTo(map);
      const markersLayer = L.layerGroup().addTo(map);
      const epidemicLayer = L.layerGroup().addTo(map);

      map.on('click', (ev: L.LeafletMouseEvent) => {
        if (isPickingMapPointRef.current) {
          setIsPickingMapPoint(false);
          setPickedMapCoords({
            lat: Number(ev.latlng.lat.toFixed(6)),
            lng: Number(ev.latlng.lng.toFixed(6)),
          });
          setEpidemicModalOpen(true);
        }
      });

      mapInstanceRef.current = map;
      tileLayerRef.current = tileLayer;
      markersLayerRef.current = markersLayer;
      epidemicLayerRef.current = epidemicLayer;
    } else if (tileLayerRef.current) {
      const newUrl =
        mapTileType === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      tileLayerRef.current.setUrl(newUrl);
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const epidemicLayer = epidemicLayerRef.current;
    if (!map || !markersLayer || !epidemicLayer) return;

    markersLayer.clearLayers();
    epidemicLayer.clearLayers();

    // Update cursor in pick mode
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = isPickingMapPoint ? 'crosshair' : '';
    }

    const createStationIcon = (isPrimary: boolean, isSelected: boolean) =>
      L.divIcon({
        className: 'custom-medical-pin',
        html: `
          <div style="
            background: ${isSelected ? '#047857' : isPrimary ? '#dc2626' : '#0284c7'};
            color: white;
            border-radius: 50%;
            width: ${isSelected ? '38px' : '32px'};
            height: ${isSelected ? '38px' : '32px'};
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.45);
            border: 3px solid white;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
          ">
            ✚
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

    activeLocations.forEach(loc => {
      const isSelected = selectedLocation && loc.id === selectedLocation.id;
      const marker = L.marker([loc.lat, loc.lng], {
        icon: createStationIcon(!!loc.isPrimary, !!isSelected),
      });

      marker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px; line-height: 1.4; min-width: 180px;">
          <strong style="color: #065f46; font-size: 13px;">${escapeHtml(loc.name)}</strong><br/>
          <span style="color: #4b5563;">${escapeHtml(loc.address)}</span><br/>
          ${loc.phone ? `<span style="color: #dc2626; font-weight: 600;">ĐT: ${escapeHtml(loc.phone)}</span><br/>` : ''}
          ${loc.workingHours ? `<span style="color: #6b7280; font-size: 11px;">${escapeHtml(loc.workingHours)}</span>` : ''}
        </div>
      `);

      marker.on('click', () => {
        setSelectedLocation(loc);
      });

      markersLayer.addLayer(marker);
    });

    // Render Epidemic Cases & Containment Circles
    if (epidemicMapButtonVisible && showEpidemicMap) {
      filteredEpidemicCases.forEach(c => {
        const diseaseCfg = getEpidemicDiseaseConfig(c.diseaseType);
        const statusMeta = EPIDEMIC_STATUS_META[c.status] || EPIDEMIC_STATUS_META.active;
        const isSelected = selectedEpidemicCaseId === c.id;

        const circle = L.circle([c.lat, c.lng], {
          radius: c.radiusMeters,
          color: statusMeta.circleColor,
          fillColor: statusMeta.circleFillColor,
          fillOpacity: c.status === 'resolved' ? 0.1 : isSelected ? 0.32 : 0.2,
          weight: isSelected ? 3 : 2,
          dashArray:
            c.status === 'monitoring'
              ? '6 4'
              : c.status === 'resolved'
              ? '3 5'
              : undefined,
        });

        const popupHtml = `
          <div style="font-family: inherit; font-size: 12px; line-height: 1.45; min-width: 210px; max-width: 270px;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
              <span style="background:${statusMeta.circleColor};color:white;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;">
                ${escapeHtml(diseaseCfg.label)}
              </span>
              <span style="color:#64748b;font-size:11px;font-weight:600;">
                ${escapeHtml(statusMeta.label)}
              </span>
            </div>
            ${c.caseLabel ? `<strong style="color:#0f172a;font-size:13px;display:block;margin-bottom:2px;">${escapeHtml(c.caseLabel)}</strong>` : ''}
            <div style="color:#be123c;font-weight:700;margin-bottom:4px;">
              Khoanh vùng: ${Number(c.radiusMeters).toLocaleString('vi-VN')} m
            </div>
            <div style="color:#334155;margin-bottom:4px;">
              <strong>Địa chỉ:</strong> ${escapeHtml(c.fullAddress)}
            </div>
            <div style="color:#64748b;font-size:11px;">
              Ngày ghi nhận: ${escapeHtml(c.recordedDate)}
            </div>
            ${c.notes ? `<div style="color:#475569;font-size:11px;margin-top:4px;padding-top:4px;border-top:1px solid #e2e8f0;">${escapeHtml(c.notes)}</div>` : ''}
          </div>
        `;

        circle.bindPopup(popupHtml);
        circle.on('click', () => {
          setSelectedEpidemicCaseId(c.id);
        });
        epidemicLayer.addLayer(circle);

        const pinIcon = L.divIcon({
          className: 'custom-epidemic-pin',
          html: `
            <div style="
              background: ${statusMeta.circleColor};
              color: white;
              border-radius: 9999px;
              min-width: ${isSelected ? '34px' : '28px'};
              height: ${isSelected ? '34px' : '28px'};
              padding: 0 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 3px 10px rgba(0,0,0,0.4);
              border: 2.5px solid white;
              font-weight: 800;
              font-size: 10px;
              letter-spacing: -0.02em;
              cursor: pointer;
              white-space: nowrap;
            ">
              ${escapeHtml(diseaseCfg.shortLabel)}
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const epiMarker = L.marker([c.lat, c.lng], { icon: pinIcon });
        epiMarker.bindPopup(popupHtml);
        epiMarker.on('click', () => {
          setSelectedEpidemicCaseId(c.id);
        });
        epidemicLayer.addLayer(epiMarker);
      });
    }

    if (userLocation) {
      const userIcon = L.divIcon({
        className: 'user-geo-pin',
        html: `
          <div style="
            background: #2563eb;
            color: white;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.3);
            border: 3px solid white;
            font-size: 10px;
          ">●</div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
      userMarker.bindPopup(
        `<div style="font-family:inherit;font-size:12px;"><strong>Vị trí của bạn</strong><br/><span style="font-family:monospace;font-size:11px;color:#475569;">${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}</span></div>`
      );
      markersLayer.addLayer(userMarker);
      userMarkerRef.current = userMarker;

      if (shouldFocusUserOnNextGpsRef.current) {
        shouldFocusUserOnNextGpsRef.current = false;
        map.setView([userLocation.lat, userLocation.lng], 16, { animate: true });
        userMarker.openPopup();
      }
    } else {
      userMarkerRef.current = null;
    }
  }, [
    canRenderMap,
    activeLocations,
    selectedLocation,
    userLocation,
    mapTileType,
    epidemicMapButtonVisible,
    showEpidemicMap,
    filteredEpidemicCases,
    selectedEpidemicCaseId,
    isPickingMapPoint,
  ]);

  // Fit bounds cleanly when user ticks "Xem bản đồ dịch bệnh"
  const handleToggleEpidemicMap = (checked: boolean) => {
    setShowEpidemicMap(checked);
    if (!checked) {
      setIsPickingMapPoint(false);
      return;
    }
    if (mapInstanceRef.current && epidemicCases.length > 0) {
      const targetList =
        selectedDiseaseFilter === 'all'
          ? epidemicCases
          : epidemicCases.filter(c => c.diseaseType === selectedDiseaseFilter);
      if (targetList.length > 0) {
        const first = targetList[0];
        const bounds = L.latLng(first.lat, first.lng).toBounds(Math.max(400, first.radiusMeters * 2.5));
        targetList.slice(1).forEach(item => {
          bounds.extend(L.latLng(item.lat, item.lng).toBounds(Math.max(400, item.radiusMeters * 2.5)));
        });
        mapInstanceRef.current.fitBounds(bounds, { padding: [36, 36], maxZoom: 16 });
      }
    }
  };

  const focusEpidemicCaseOnMap = (c: EpidemicCase) => {
    setSelectedEpidemicCaseId(c.id);
    if (mapInstanceRef.current) {
      const bounds = L.latLng(c.lat, c.lng).toBounds(Math.max(300, c.radiusMeters * 2.6));
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    }
  };

  const handleOpenAddEpidemicCase = () => {
    setEditingEpidemicCase(null);
    setModalDraftState(null);
    setPickedMapCoords(null);
    setIsPickingMapPoint(false);
    setShowEpidemicMap(true);
    setEpidemicModalOpen(true);
  };

  const handleOpenEditEpidemicCase = (c: EpidemicCase) => {
    setEditingEpidemicCase(c);
    setModalDraftState(null);
    setPickedMapCoords(null);
    setIsPickingMapPoint(false);
    setEpidemicModalOpen(true);
  };

  const handleDeleteEpidemicCase = async (c: EpidemicCase) => {
    setDeletingCaseId(c.id);
    try {
      await deleteEpidemicCase(c.id);
      await logAuditEvent(
        'Xóa điểm dịch bệnh trên bản đồ',
        'Bản đồ dịch bệnh',
        `Xóa ${getEpidemicDiseaseConfig(c.diseaseType).label} (${c.radiusMeters}m) tại ${c.fullAddress}`,
        {
          uid: currentUser?.uid || 'staff',
          name: userProfile?.displayName || currentUser?.email || 'Cán bộ Y tế',
        }
      );
      if (selectedEpidemicCaseId === c.id) {
        setSelectedEpidemicCaseId(null);
      }
      showToast('success', 'Đã xóa điểm khoanh vùng dịch bệnh');
    } catch (err: any) {
      showToast('error', 'Không thể xóa điểm dịch bệnh', err?.message);
    } finally {
      setDeletingCaseId(null);
    }
  };

  const getGoogleMapsDirUrl = (loc: MapLocation) => {
    if (userLocation) {
      return `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${loc.lat},${loc.lng}&travelmode=driving`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
  };

  const getAppleMapsDirUrl = (loc: MapLocation) => {
    if (userLocation) {
      return `https://maps.apple.com/?saddr=${userLocation.lat},${userLocation.lng}&daddr=${loc.lat},${loc.lng}&dirflg=d`;
    }
    return `https://maps.apple.com/?ll=${loc.lat},${loc.lng}&q=${encodeURIComponent(loc.name)}`;
  };

  return (
    <div
      data-section-title={!embedded ? 'Bản đồ điểm y tế' : undefined}
      className={
        embedded
          ? 'p-5 sm:p-6 space-y-5'
          : 'rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden p-5 sm:p-7 space-y-5'
      }
    >
      {/* Header & Symmetrical Tile Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="min-w-0 space-y-1">
          {!embedded && (
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Mạng Lưới Điểm Y Tế &amp; GPS
            </h2>
          )}
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isLocating
              ? 'Đang xác định vị trí GPS...'
              : userLocation
              ? 'Đã định vị GPS · Vuốt xuống để cập nhật'
              : 'Bấm "Xem vị trí của tôi" để tính khoảng cách & chỉ đường'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
          {/* Admin-controlled checkbox: "Xem bản đồ dịch bệnh" */}
          {epidemicMapButtonVisible && (
            <label
              className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-2.5 transition cursor-pointer select-none whitespace-nowrap ${
                showEpidemicMap
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700 text-rose-800 dark:text-rose-200 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-rose-300 dark:hover:border-rose-700'
              }`}
            >
              <input
                type="checkbox"
                checked={showEpidemicMap}
                onChange={e => handleToggleEpidemicMap(e.target.checked)}
                className="w-4 h-4 rounded accent-rose-600 cursor-pointer shrink-0"
              />
              <Radar
                className={`w-4 h-4 shrink-0 ${
                  showEpidemicMap ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
                }`}
              />
              <span>Xem bản đồ dịch bệnh</span>
              {epidemicCases.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold tabular-nums ${
                    showEpidemicMap
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {epidemicCases.length}
                </span>
              )}
            </label>
          )}

          {/* Strictly Symmetrical 2-Button Toggle */}
          <div className="grid grid-cols-2 w-full sm:w-64 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs sm:text-sm font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setMapTileType('satellite')}
              className={`px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                mapTileType === 'satellite'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span>Vệ tinh</span>
            </button>

            <button
              type="button"
              onClick={() => setMapTileType('streets')}
              className={`px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                mapTileType === 'streets'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MapIcon className="w-4 h-4 shrink-0" />
              <span>Giao thông</span>
            </button>
          </div>
        </div>
      </div>

      {/* Epidemic Map Filter & Staff Action Bar */}
      {epidemicMapButtonVisible && showEpidemicMap && (
        <div className="p-4 rounded-2xl bg-rose-50/75 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/80 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200 whitespace-nowrap">
                  Loại dịch bệnh:
                </span>
                <select
                  value={selectedDiseaseFilter}
                  onChange={e =>
                    setSelectedDiseaseFilter(e.target.value as EpidemicDiseaseType | 'all')
                  }
                  aria-label="Chọn loại dịch bệnh hiển thị trên bản đồ"
                  className="px-3 py-1.5 rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900 text-xs font-bold text-rose-800 dark:text-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {EPIDEMIC_DISEASE_OPTIONS.map(opt => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                  <option value="all">Tất cả dịch bệnh đang theo dõi</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 tabular-nums">
                  Đang khoanh vùng: {epidemicSummary.active}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 tabular-nums">
                  Theo dõi: {epidemicSummary.monitoring}
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 tabular-nums">
                  Đã xử lý: {epidemicSummary.resolved}
                </span>
              </div>
            </div>

            {isStaff && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenAddEpidemicCase}
                  className="min-h-[38px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Đánh dấu ca bệnh tại nhà</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPickingMapPoint(prev => !prev)}
                  className={`min-h-[38px] px-3 py-2 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    isPickingMapPoint
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500'
                      : 'bg-white dark:bg-slate-900 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-100/60'
                  }`}
                >
                  {isPickingMapPoint ? (
                    <>
                      <X className="w-3.5 h-3.5 shrink-0" />
                      <span>Hủy chấm bản đồ</span>
                    </>
                  ) : (
                    <>
                      <MousePointerClick className="w-3.5 h-3.5 shrink-0" />
                      <span>Chấm trên bản đồ</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {isPickingMapPoint && (
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-950 dark:text-amber-200 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-amber-700 dark:text-amber-300 shrink-0" />
                Chế độ chọn điểm đang bật: Hãy bấm trực tiếp vào vị trí nhà Ca bệnh trên bản đồ bên dưới để tự động lấy địa chỉ &amp; khoanh vùng.
              </span>
              <button
                type="button"
                onClick={() => setIsPickingMapPoint(false)}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-bold cursor-pointer shrink-0"
              >
                Hủy
              </button>
            </div>
          )}
        </div>
      )}

      {/* Geolocation notice / prompt */}
      {geoError ? (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs sm:text-sm text-rose-800 dark:text-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{geoError}</span>
          </div>
          <button
            type="button"
            onClick={() => requestGeoLocation(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            Cấp quyền Vị trí
          </button>
        </div>
      ) : !embedded && !userLocation && !isLocating ? (
        <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-800 text-xs sm:text-sm text-blue-900 dark:text-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <LocateFixed className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              Yêu cầu quyền Vị trí (GPS) để xác định điểm y tế gần bạn nhất và chỉ đường chính xác.
            </span>
          </div>
          <button
            type="button"
            onClick={() => requestGeoLocation(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            Cấp quyền Vị trí
          </button>
        </div>
      ) : null}

      {/* Nearest location banner */}
      {nearestLocation && (
        <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-emerald-700 text-white shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                Điểm y tế gần nhất
              </span>
              <strong className="text-sm sm:text-base text-slate-900 dark:text-white block truncate">
                {nearestLocation.name}
              </strong>
              <div className="text-slate-600 dark:text-slate-300 text-xs mt-0.5 tabular-nums">
                {nearestLocation.distanceKm?.toFixed(1)} km · ~{nearestLocation.driveMinutes} phút
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 w-full sm:w-64 gap-2 shrink-0">
            <a
              href={getGoogleMapsDirUrl(nearestLocation)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition whitespace-nowrap"
            >
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
            <a
              href={getAppleMapsDirUrl(nearestLocation)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition whitespace-nowrap"
            >
              <span>Apple Maps</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
        </div>
      )}

      {/* Map Canvas & Station List */}
      {!canRenderMap ? (
        <div className="p-10 text-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Building2 className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            Chưa có điểm y tế
          </h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Quản trị viên có thể bổ sung tọa độ các điểm trạm trong Bảng Quản trị.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Leaflet Map Canvas */}
          <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner h-[360px] sm:h-[440px] relative isolate z-0">
            <div ref={mapContainerRef} className="w-full h-full" />

            <div className="absolute top-3 inset-x-3 z-[1000] flex items-center justify-between gap-2 pointer-events-none">
              <div className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900/85 backdrop-blur-md border border-slate-700/80 text-xs font-semibold text-white flex items-center whitespace-nowrap tabular-nums shadow-md pointer-events-auto truncate max-w-[56%]">
                {mapTileType === 'satellite' ? 'Vệ tinh' : 'Giao thông'} · {activeLocations.length} điểm
                {epidemicMapButtonVisible && showEpidemicMap
                  ? ` · ${filteredEpidemicCases.length} vùng dịch`
                  : ''}
              </div>

              <button
                type="button"
                onClick={handleViewMyLocation}
                disabled={isLocating}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/95 dark:bg-slate-900/95 hover:bg-emerald-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 text-xs font-bold shadow-md backdrop-blur-md flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 pointer-events-auto disabled:opacity-70"
                title="Đưa bản đồ về vị trí GPS hiện tại của bạn"
              >
                {isLocating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                ) : (
                  <LocateFixed className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                )}
                <span>{isLocating ? 'Đang định vị...' : 'Xem vị trí của tôi'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Epidemic Cases List when active, otherwise Station Selector Cards */}
          <div className="space-y-3 overflow-y-auto max-h-[440px] pr-0.5">
            {epidemicMapButtonVisible && showEpidemicMap ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                    <Radar className="w-3.5 h-3.5" />
                    <span>Vùng dịch trên bản đồ ({filteredEpidemicCases.length})</span>
                  </h3>
                </div>

                {filteredEpidemicCases.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/20 space-y-2">
                    <Radar className="w-7 h-7 text-rose-400 mx-auto" />
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Chưa ghi nhận điểm dịch bệnh nào
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isStaff
                        ? 'Cán bộ Y tế / Admin có thể bấm "Đánh dấu ca bệnh tại nhà" để khoanh vùng trực tiếp lên bản đồ.'
                        : 'Hiện tại địa bàn chưa có điểm khoanh vùng dịch bệnh đang công bố.'}
                    </p>
                  </div>
                ) : (
                  filteredEpidemicCases.map(c => {
                    const diseaseCfg = getEpidemicDiseaseConfig(c.diseaseType);
                    const statusMeta = EPIDEMIC_STATUS_META[c.status] || EPIDEMIC_STATUS_META.active;
                    const isSelected = selectedEpidemicCaseId === c.id;
                    const canDelete = isAdmin || (isStaff && currentUser?.uid === c.reportedByUid);

                    return (
                      <div
                        key={c.id}
                        onClick={() => focusEpidemicCaseOnMap(c)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                          isSelected
                            ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-500 shadow-xs'
                            : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${diseaseCfg.badgeBgClass} ${diseaseCfg.badgeTextClass}`}
                            >
                              {diseaseCfg.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          <span className="text-xs font-extrabold text-rose-700 dark:text-rose-300 tabular-nums shrink-0">
                            R = {c.radiusMeters.toLocaleString('vi-VN')} m
                          </span>
                        </div>

                        {c.caseLabel && (
                          <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white leading-snug">
                            {c.caseLabel}
                          </div>
                        )}

                        <p className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span>{c.fullAddress}</span>
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Calendar className="w-3 h-3" />
                            <span>{c.recordedDate}</span>
                          </span>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span>Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>

                        {c.notes && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-white/70 dark:bg-slate-900/60 px-2.5 py-1.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60">
                            {c.notes}
                          </p>
                        )}

                        {isStaff && (
                          <div
                            className="pt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center justify-end gap-2"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => handleOpenEditEpidemicCase(c)}
                              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-emerald-500 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Sửa</span>
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                disabled={deletingCaseId === c.id}
                                onClick={() => void handleDeleteEpidemicCase(c)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>{deletingCaseId === c.id ? 'Đang xóa...' : 'Xóa'}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              sortedLocations.map(loc => {
                const isSelected = selectedLocation && loc.id === selectedLocation.id;

                return (
                  <div
                    key={loc.id}
                    onClick={() => {
                      setSelectedLocation(loc);
                      if (mapInstanceRef.current) {
                        mapInstanceRef.current.setView([loc.lat, loc.lng], 15, { animate: true });
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500 shadow-xs'
                        : 'bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            loc.isPrimary ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                          }`}
                        >
                          ✚
                        </span>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight truncate">
                          {loc.name}
                        </h3>
                      </div>

                      {loc.isPrimary && (
                        <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 whitespace-nowrap shrink-0">
                          Điểm chính
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-slate-600 dark:text-slate-400 text-xs pl-8">
                      <p className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{loc.address}</span>
                      </p>
                      {loc.headName && (
                        <p className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200 truncate">
                          <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate">{loc.headName}</span>
                        </p>
                      )}
                      {loc.phone && (
                        <p className="flex items-center gap-1.5 tabular-nums">
                          <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{loc.phone}</span>
                        </p>
                      )}
                      {loc.workingHours && (
                        <p className="flex items-center gap-1.5 truncate">
                          <Clock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">{loc.workingHours}</span>
                        </p>
                      )}
                    </div>

                    {loc.distanceKm !== null && (
                      <div className="pl-8 text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {loc.distanceKm.toFixed(1)} km · ~{loc.driveMinutes} phút
                      </div>
                    )}

                    <div className="pl-8 pt-2 flex items-center gap-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <a
                        href={getGoogleMapsDirUrl(loc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <span>Google Maps</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                      <span className="text-slate-300 dark:text-slate-700">·</span>
                      <a
                        href={getAppleMapsDirUrl(loc)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="font-semibold text-slate-600 dark:text-slate-300 hover:underline inline-flex items-center gap-1 whitespace-nowrap"
                      >
                        <span>Apple Maps</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modal for Super Admin / Admin / Cán bộ Y tế to mark or edit epidemic cases */}
      <EpidemicCaseModal
        isOpen={epidemicModalOpen}
        initialCase={editingEpidemicCase}
        draftState={modalDraftState}
        pickedCoords={pickedMapCoords}
        stationDefaultAddress={defaultAddress}
        allowMapPick
        onRequestMapPick={draft => {
          setModalDraftState(draft);
          setEpidemicModalOpen(false);
          setShowEpidemicMap(true);
          setIsPickingMapPoint(true);
          showToast(
            'info',
            'Chọn vị trí trên bản đồ',
            'Bấm vào vị trí nhà Ca bệnh trên bản đồ để tự động lấy địa chỉ.'
          );
        }}
        onClose={() => {
          setEpidemicModalOpen(false);
          setEditingEpidemicCase(null);
          setModalDraftState(null);
          setPickedMapCoords(null);
        }}
        onSaved={saved => {
          setShowEpidemicMap(true);
          focusEpidemicCaseOnMap(saved);
        }}
      />
    </div>
  );
};
