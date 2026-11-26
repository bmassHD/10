import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Settings,
  MessageSquare,
  Users,
  Shield,
  Save,
  CheckCircle2,
  AlertCircle,
  BadgeCheck,
  Building,
  Phone,
  Clock,
  MapPin,
  RefreshCw,
  Sparkles,
  LogIn,
  FolderGit2,
  Database,
  Lock,
  UserCheck,
  Edit,
  Trash2,
  ExternalLink,
  ShieldAlert,
  CreditCard,
  Building2,
  Stethoscope,
  FileText,
  Globe,
  Navigation,
  Plus,
  Compass,
  Bell,
  User,
  Wrench,
  EyeOff,
  Eye,
  Syringe,
  Pin,
  CalendarPlus,
  BellRing,
  Copy,
  Hospital,
  PartyPopper,
  CalendarClock,
  Activity,
  Ban,
  MonitorSmartphone,
  Smartphone,
  Tablet,
  Laptop,
  ShieldCheck,
  KeyRound,
  Search,
  Network,
  Megaphone,
  Code2,
  Ticket,
  Link2,
  Check,
  FileSpreadsheet,
  X,
  Unlock,
  LayoutGrid,
  ShoppingBag,
  Award,
  Star,
  ArrowLeft,
  Palette,
  Briefcase,
  Radar,
  Image as ImageIcon,
  Upload,
  Crop,
} from 'lucide-react';
import { GitHubService } from '../../services/githubService';
import * as XLSX from 'xlsx';
import {
  FacebookLogo,
  ZaloLogo,
  TikTokLogo,
  YouTubeLogo,
} from '../common/SocialPlatformLogos';
import {
  SystemSettings,
  FeedbackItem,
  UserProfile,
  AuditLog,
  GitHubConfig,
  MapLocation,
  QuickLink,
  EmergencyContact,
  VaccinationScheduleItem,
  StartupPopupConfig,
  VaccinationStartupPopupConfig,
  TargetedNotification,
  Announcement,
  Post,
  StationEvent,
  HolidayScheduleItem,
  WorkSchedule,
  AccessRestrictionRules,
  ReferralCodeItem,
  UserVerifiedDevice,
  ReferralIssuerTier,
  RolePermissionsConfig,
  RolePermissionPolicy,
  ServiceRating,
  ServiceRatingCategory,
  LegacyUserSnapshot,
  UserMigrationClaim,
  AuthProviderId,
  AuthProviderStatus,
  AuthProvidersStatusMap,
  SidebarColorsConfig,
  BusinessTripConfig,
  EpidemicCase,
  RoleType,
} from '../../types';
import {
  AUTH_PROVIDER_CATEGORIES,
  AUTH_PROVIDER_CATALOG,
  resolveAuthProvidersMap,
} from '../../constants/authProviders';
import { AuthProviderIcon } from '../auth/OtherAuthMethodsPanel';
import {
  updateSystemSettings,
  updateFeedbackResponse,
  deleteFeedback,
  updateUserRole,
  deleteUserProfile,
  deleteTargetedNotification,
  deleteAnnouncement,
  logAuditEvent,
  cleanDataForFirestore,
  getConfiguredEmergencyContacts,
  sortLocationsPrimaryFirst,
  sortVaccinationSchedules,
  getActiveVaccinationSchedules,
  formatVaccinationDateRange,
  formatIsoDateVN,
  enumerateDateRange,
  resolveVaccinationLifecycle,
  savePushSubscriptionRecord,
  listReferralCodes,
  createReferralCode,
  toggleReferralCodeStatus,
  deleteReferralCode,
  generateRandomReferralCode,
  DEFAULT_VACCINATION_START_TIME,
  DEFAULT_VACCINATION_END_TIME,
  DEFAULT_VACCINATION_AUDIENCE,
  DEFAULT_VACCINATION_VACCINES,
  DEFAULT_VACCINATION_NOTES,
  CONTROLLABLE_SIDEBAR_TABS,
  DEFAULT_ROLE_PERMISSIONS,
  resolveRolePermissions,
  ROLE_PERMISSION_PRESETS,
  SERVICE_RATING_CATEGORY_LABELS,
  deleteServiceRating,
  listLegacyUserSnapshots,
  listUserMigrationClaims,
  resolveUserMigrationClaim,
  subscribeEpidemicCases,
  deleteEpidemicCase,
} from '../../services/firebaseService';
import {
  getOrCreateDeviceId,
  requestSystemNotificationPermission,
  sendTestBackgroundPush,
  setDeviceNotificationEnabled,
  subscribeDeviceToWebPush,
} from '../../services/systemNotificationService';
import { downloadVaccinationIcs } from '../../utils/calendarUtils';
import { doc, updateDoc, setDoc, deleteDoc, deleteField, collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db, firebaseConfig } from '../../firebase/config';
import { useAuth, PRIMARY_ADMIN_EMAIL, isBootstrapAdminEmail } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { GitHubFileManager } from '../admin/GitHubFileManager';
import { BackupManager } from '../admin/BackupManager';
import { NearbyFacilitiesManager } from '../admin/NearbyFacilitiesManager';
import { EventsManager } from '../admin/EventsManager';
import { WorkAndHolidaySetupManager } from '../admin/WorkAndHolidaySetupManager';
import { SendNotificationModal } from '../modals/SendNotificationModal';
import { EpidemicCaseModal } from '../portal/EpidemicCaseModal';
import { EPIDEMIC_STATUS_META, getEpidemicDiseaseConfig } from '../../constants/epidemicDiseases';
import { SystemDiagnosticsManager } from '../admin/SystemDiagnosticsManager';
import { AgentAutomationManager } from '../admin/AgentAutomationManager';
import { SepayPaymentManager } from '../admin/SepayPaymentManager';
import { OrganizationAccountsManager } from '../admin/OrganizationAccountsManager';
import { FirebaseConfigReadonlyCard } from '../admin/FirebaseConfigReadonlyCard';
import { AppsManager } from '../admin/AppsManager';
import { AdminDashboardOverview } from '../admin/AdminDashboardOverview';
import { BusinessTripView } from './BusinessTripView';
import { buildAdminNavGroups, AdminSubTab as AdminShellSubTab } from '../admin/AdminShell';
import { getBalancedMobileGridClass, getBalancedMobileItemSpan } from '../../utils/mobileGrid';
import { StationLogo } from '../common/StationLogo';
import { VerifiedBlueTick } from '../common/VerifiedBlueTick';
import { UserAvatar } from '../common/UserAvatar';
import { ImageCropModal, ImageCropResult } from '../common/ImageCropModal';
import { PaginationBar } from '../common/PaginationBar';
import {
  ACCOUNT_SECURITY_CARD_TITLE,
  getAccountSecuritySyncItems,
  getUserVerificationProgress,
} from '../../utils/verificationBadge';
import { fetchAdminSepayState, SepayVipRecord, updateAdminUserVipStatus } from '../../services/sepayService';
import { FeedbackAttachmentViewer } from '../common/FeedbackAttachmentViewer';
import { PersonnelDirectoryView } from './PersonnelDirectoryView';
import {
  ACCESS_RESTRICTION_ITEMS,
  detectClientEnvironment,
} from '../../utils/deviceAccessDetector';
import {
  BhxhLookupEndpoint,
  fetchBhxhAdminConfig,
  saveBhxhAdminConfig,
  testBhxhTokenConnection,
  lookupBhxhFacility,
  lookupBhxhCard,
  normalizeBhxhDobInput,
  isValidBhxhDob,
  describeBhxhHang,
  describeBhxhTuyen,
  getNormalizedBhxhHistoryKcb,
} from '../../services/bhxhService';
import {
  normalizeCccd,
  getStationDepartmentOptions,
  resolveDepartmentOptionValue,
  isNonAdminHealthStaffAccount,
} from '../../services/orgPersonnelSyncService';
import {
  normalizeAndValidatePhone,
  buildPhoneLockId,
  maskPhoneForLock,
  buildCccdLockId,
  maskCccdForLock,
  claimExclusiveIdentifierLock,
  releaseExclusiveIdentifierLock,
} from '../../utils/verifiedIdentity';
import {
  BAN_DURATION_PRESETS,
  BanDurationPresetKey,
  formatBanRemainingVi,
  formatBanTimestampVi,
  getEffectiveUserStatus,
  isProtectedSuperAdminProfile,
  isUserActivelyBanned,
  toLocalDateTimeInputValue,
} from '../../utils/userBan';

interface AdminConsoleViewProps {
  settings: SystemSettings;
  feedbackList: FeedbackItem[];
  users: UserProfile[];
  auditLogs: AuditLog[];
  events?: StationEvent[];
  workSchedules?: WorkSchedule[];
  onPreviewEvent?: (ev: StationEvent) => void;
  onPreviewHoliday?: (holiday: HolidayScheduleItem) => void;
  onRefreshData: () => void;
  openAuthModal: () => void;
  onNavigateToLogin?: () => void;
  onOpenOrgChart?: () => void;
  initialSubTab?: string;
  activeSubTab?: string;
  onSubTabChange?: (tab: AdminSubTab) => void;
  onExitAdmin?: () => void;
}

type AdminSubTab = AdminShellSubTab;

const VALID_ADMIN_SUBTABS = new Set<AdminSubTab>([
  'dashboard',
  'vaccination_setup',
  'work_holiday_setup',
  'business_trip_setup',
  'events_setup',
  'notifications',
  'station_setup',
  'org_personnel',
  'functions_duties',
  'map_locations',
  'nearby_facilities',
  'footer_links',
  'users',
  'referral_codes',
  'org_accounts',
  'feedback',
  'ratings',
  'github_storage',
  'backup',
  'audit',
  'system_control',
  'bhxh_api',
  'sepay_payment',
  'ai_automation',
  'diagnostics',
  'firebase_config',
  'apps_setup',
]);

export const AdminConsoleView: React.FC<AdminConsoleViewProps> = ({
  settings,
  feedbackList,
  users,
  auditLogs,
  events = [],
  workSchedules = [],
  onPreviewEvent,
  onPreviewHoliday,
  onRefreshData,
  openAuthModal,
  onNavigateToLogin,
  onOpenOrgChart,
  initialSubTab,
  activeSubTab,
  onSubTabChange,
  onExitAdmin,
}) => {
  const { currentUser, userProfile, isPrimaryAdmin, isSuperAdmin, isAdmin, isStaff } = useAuth();
  const canManageSuperAdminTier = Boolean(isSuperAdmin || isPrimaryAdmin);
  const { showToast, showConfirm } = useToast();

  const resolvedInitialTab: AdminSubTab =
    (activeSubTab && VALID_ADMIN_SUBTABS.has(activeSubTab as AdminSubTab)
      ? (activeSubTab as AdminSubTab)
      : initialSubTab && VALID_ADMIN_SUBTABS.has(initialSubTab as AdminSubTab)
      ? (initialSubTab as AdminSubTab)
      : 'dashboard');

  const [internalSubTab, setInternalSubTab] = useState<AdminSubTab>(resolvedInitialTab);
  const subTab: AdminSubTab =
    activeSubTab && VALID_ADMIN_SUBTABS.has(activeSubTab as AdminSubTab)
      ? (activeSubTab as AdminSubTab)
      : internalSubTab;

  const setSubTab = (next: AdminSubTab) => {
    setInternalSubTab(next);
    if (onSubTabChange) {
      onSubTabChange(next);
    }
  };

  useEffect(() => {
    if (initialSubTab && VALID_ADMIN_SUBTABS.has(initialSubTab as AdminSubTab)) {
      setInternalSubTab(initialSubTab as AdminSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    if (activeSubTab && VALID_ADMIN_SUBTABS.has(activeSubTab as AdminSubTab)) {
      setInternalSubTab(activeSubTab as AdminSubTab);
    }
  }, [activeSubTab]);

  // Station settings form state
  const [stationName, setStationName] = useState(settings.stationName || '');
  const [parentUnitName, setParentUnitName] = useState(settings.parentUnitName || '');
  const [subTitle, setSubTitle] = useState(settings.subTitle || '');
  const [address, setAddress] = useState(settings.address || '');
  const [hotline, setHotline] = useState(settings.hotline || '');
  const [stationEmail, setStationEmail] = useState(settings.email || '');
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>(() => {
    const existing = getConfiguredEmergencyContacts(settings);
    return existing.length > 0 ? existing : [];
  });
  const [workingHours, setWorkingHours] = useState(settings.workingHours || '');
  const [leaderName, setLeaderName] = useState(settings.leaderName || '');
  const [bannerNotice, setBannerNotice] = useState(settings.bannerNotice || '');
  const [coverImageUrl, setCoverImageUrl] = useState(settings.coverImageUrl || '');
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false);
  const [coverPreviewError, setCoverPreviewError] = useState(false);
  const [coverUseProxy, setCoverUseProxy] = useState(false);
  const [coverRetryTick, setCoverRetryTick] = useState(0);
  const [coverCropSource, setCoverCropSource] = useState<{ src: string; fileName?: string } | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Functions & Duties (Chức năng & Nhiệm vụ - nhập thủ công, mỗi dòng đầu cách vào 1cm)
  const [functionsDutiesText, setFunctionsDutiesText] = useState(
    settings.customFunctionsAndDuties || ''
  );
  const [savingFunctionsDuties, setSavingFunctionsDuties] = useState(false);

  // Map Locations state (Bản đồ đa điểm & Tọa độ) - Trụ sở chính luôn đứng đầu tiên
  const [mapLocationsList, setMapLocationsList] = useState<MapLocation[]>(() =>
    sortLocationsPrimaryFirst(
      settings.mapLocations && settings.mapLocations.length > 0 ? settings.mapLocations : []
    )
  );
  const [savingMapLocations, setSavingMapLocations] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocLat, setNewLocLat] = useState('');
  const [newLocLng, setNewLocLng] = useState('');
  const [newLocPhone, setNewLocPhone] = useState('');
  const [newLocHeadName, setNewLocHeadName] = useState('');
  const [newLocHours, setNewLocHours] = useState('');
  const [newLocNotes, setNewLocNotes] = useState('');
  const [newLocIsPrimary, setNewLocIsPrimary] = useState(false);
  const [editingLocation, setEditingLocation] = useState<MapLocation | null>(null);

  // Footer Quick Links & Social Links state
  const [quickLinksList, setQuickLinksList] = useState<QuickLink[]>(
    settings.quickLinks && settings.quickLinks.length > 0 ? settings.quickLinks : []
  );
  const [savingQuickLinks, setSavingQuickLinks] = useState(false);
  const [showAddQuickLinkModal, setShowAddQuickLinkModal] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkDesc, setNewLinkDesc] = useState('');
  const [newLinkBadge, setNewLinkBadge] = useState('');
  const [socialFacebook, setSocialFacebook] = useState(settings.socialLinks?.facebook || '');
  const [socialZalo, setSocialZalo] = useState(settings.socialLinks?.zalo || '');
  const [socialTiktok, setSocialTiktok] = useState(settings.socialLinks?.tiktok || '');
  const [socialYoutube, setSocialYoutube] = useState(settings.socialLinks?.youtube || '');
  const [savingSocialLinks, setSavingSocialLinks] = useState(false);

  const [editorialBoard, setEditorialBoard] = useState(settings.editorialBoard || '');
  const [responsiblePerson, setResponsiblePerson] = useState(settings.responsiblePerson || '');
  const [copyrightText, setCopyrightText] = useState(settings.copyrightText || '');
  const [savingFooterMeta, setSavingFooterMeta] = useState(false);

  // Software Team & Technical Support Contact state
  const [softTeamEnabled, setSoftTeamEnabled] = useState<boolean>(
    settings.softwareTeamContact?.enabled !== false
  );
  const [softTeamName, setSoftTeamName] = useState(settings.softwareTeamContact?.teamName || '');
  const [softTeamRole, setSoftTeamRole] = useState(settings.softwareTeamContact?.roleLabel || '');
  const [softTeamPerson, setSoftTeamPerson] = useState(settings.softwareTeamContact?.personName || '');
  const [softTeamPhone, setSoftTeamPhone] = useState(settings.softwareTeamContact?.phone || '');
  const [softTeamEmail, setSoftTeamEmail] = useState(settings.softwareTeamContact?.email || '');
  const [softTeamZalo, setSoftTeamZalo] = useState(settings.softwareTeamContact?.zaloUrl || '');
  const [softTeamFacebook, setSoftTeamFacebook] = useState(settings.softwareTeamContact?.facebookUrl || '');
  const [softTeamWebsite, setSoftTeamWebsite] = useState(settings.softwareTeamContact?.websiteUrl || '');
  const [softTeamHours, setSoftTeamHours] = useState(settings.softwareTeamContact?.supportHours || '');
  const [softTeamNote, setSoftTeamNote] = useState(settings.softwareTeamContact?.note || '');
  const [savingSoftTeam, setSavingSoftTeam] = useState(false);

  // Vaccination Schedules state (Lịch tiêm chủng - Tin tức quan trọng hàng đầu)
  const [vaccinationSchedulesList, setVaccinationSchedulesList] = useState<VaccinationScheduleItem[]>(
    () => sortVaccinationSchedules(settings.vaccinationSchedules)
  );
  const [savingVaccination, setSavingVaccination] = useState(false);
  const [showVaccinationModal, setShowVaccinationModal] = useState(false);
  const [editingVaccination, setEditingVaccination] = useState<VaccinationScheduleItem | null>(null);
  const [vacTitle, setVacTitle] = useState('');
  const [vacProgramType, setVacProgramType] = useState<VaccinationScheduleItem['programType']>('expanded');
  const [vacDate, setVacDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [vacEndDate, setVacEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [vacCreateMode, setVacCreateMode] = useState<'range' | 'daily_split'>('range');
  const [vacDateLabel, setVacDateLabel] = useState('');
  const [vacStartTime, setVacStartTime] = useState(DEFAULT_VACCINATION_START_TIME);
  const [vacEndTime, setVacEndTime] = useState(DEFAULT_VACCINATION_END_TIME);
  const [vacTimeRange, setVacTimeRange] = useState(`${DEFAULT_VACCINATION_START_TIME} - ${DEFAULT_VACCINATION_END_TIME}`);
  const [vacLocation, setVacLocation] = useState('');
  const [vacCustomLocationMode, setVacCustomLocationMode] = useState(false);
  const [vacSecondaryLocationsText, setVacSecondaryLocationsText] = useState('');
  const [vacTargetAudience, setVacTargetAudience] = useState(DEFAULT_VACCINATION_AUDIENCE);
  const [vacVaccines, setVacVaccines] = useState(DEFAULT_VACCINATION_VACCINES);
  const [vacNotes, setVacNotes] = useState(DEFAULT_VACCINATION_NOTES);
  const [vacStatus, setVacStatus] = useState<VaccinationScheduleItem['status']>('upcoming');
  const [vacIsPinned, setVacIsPinned] = useState(true);
  const [vacIsActive, setVacIsActive] = useState(true);

  // General Top Banner & Pop-up state (Thông báo bình thường - tách biệt với Tiêm chủng)
  const [bannerNoticeEnabled, setBannerNoticeEnabled] = useState<boolean>(
    settings.bannerNoticeEnabled ?? Boolean(settings.bannerNotice?.trim())
  );
  const [popupEnabled, setPopupEnabled] = useState<boolean>(
    settings.startupPopup?.enabled !== false
  );
  const [popupNoticeType, setPopupNoticeType] = useState<
    'general' | 'epidemic' | 'schedule' | 'urgent'
  >(settings.startupPopup?.noticeType || 'general');
  const [popupTitle, setPopupTitle] = useState<string>(
    settings.startupPopup?.title || 'Thông báo từ Trạm Y Tế'
  );
  const [popupMessage, setPopupMessage] = useState<string>(
    settings.startupPopup?.message || ''
  );
  const [popupCtaView, setPopupCtaView] = useState<
    'none' | 'news' | 'duty' | 'documents' | 'map' | 'vaccination' | 'nearby_facilities' | 'rescue' | 'events'
  >(settings.startupPopup?.ctaView || 'none');
  const [popupCtaLabel, setPopupCtaLabel] = useState<string>(
    settings.startupPopup?.ctaLabel || ''
  );
  const [popupFrequency, setPopupFrequency] = useState<'per_session' | 'daily' | 'always'>(
    settings.startupPopup?.frequency || 'per_session'
  );
  const [savingPopup, setSavingPopup] = useState(false);

  // Separate Vaccination Top Banner & Pop-up state (Thông báo Tiêm chủng riêng biệt)
  const [vacBannerEnabled, setVacBannerEnabled] = useState<boolean>(
    settings.vaccinationBannerEnabled !== false
  );
  const [vacBannerNote, setVacBannerNote] = useState<string>(
    settings.vaccinationBannerNote || ''
  );
  const [vacPopupEnabled, setVacPopupEnabled] = useState<boolean>(
    settings.vaccinationPopup
      ? settings.vaccinationPopup.enabled !== false
      : settings.startupPopup?.includeTopVaccination !== false
  );
  const [vacPopupTitle, setVacPopupTitle] = useState<string>(
    settings.vaccinationPopup?.title || 'Thông Báo Tiêm Chủng'
  );
  const [vacPopupMessage, setVacPopupMessage] = useState<string>(
    settings.vaccinationPopup?.message || ''
  );
  const [vacPopupCtaLabel, setVacPopupCtaLabel] = useState<string>(
    settings.vaccinationPopup?.ctaLabel || 'Xem lịch tiêm chủng'
  );
  const [vacPopupFrequency, setVacPopupFrequency] = useState<'per_session' | 'daily' | 'always'>(
    settings.vaccinationPopup?.frequency || settings.startupPopup?.frequency || 'per_session'
  );
  const [savingVacPopup, setSavingVacPopup] = useState(false);
  const [deviceNotifPerm, setDeviceNotifPerm] = useState<NotificationPermission>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );
  const [testingSwNotif, setTestingSwNotif] = useState(false);

  // Maintenance & Sidebar Tab Visibility state
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(!!settings.maintenanceMode);
  const [cccdLookupEnabled, setCccdLookupEnabled] = useState<boolean>(
    settings.cccdLookupEnabled !== false
  );
  const [epidemicMapButtonVisible, setEpidemicMapButtonVisible] = useState<boolean>(
    settings.epidemicMapButtonVisible !== false
  );
  const [epidemicCasesList, setEpidemicCasesList] = useState<EpidemicCase[]>([]);
  const [showEpidemicCaseModal, setShowEpidemicCaseModal] = useState<boolean>(false);
  const [editingAdminEpidemicCase, setEditingAdminEpidemicCase] = useState<EpidemicCase | null>(null);
  const [deletingAdminEpidemicId, setDeletingAdminEpidemicId] = useState<string | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>(
    settings.maintenanceMessage ||
      'Hệ thống Cổng thông tin điện tử Trạm Y tế đang được bảo trì, nâng cấp định kỳ. Quý người dân cần hỗ trợ y tế khẩn cấp vui lòng liên hệ trực tiếp số Cấp cứu 24/7 bên dưới.'
  );
  const [wifiRestrictionEnabled, setWifiRestrictionEnabled] = useState<boolean>(
    Boolean(settings.wifiIpRestriction?.enabled)
  );
  const [wifiAllowedIpsText, setWifiAllowedIpsText] = useState<string>(
    (settings.wifiIpRestriction?.allowedIps || []).join(', ')
  );
  const [wifiRestrictionMessage, setWifiRestrictionMessage] = useState<string>(
    settings.wifiIpRestriction?.message ||
      'Hệ thống Cổng thông tin điện tử chỉ cho phép truy cập từ mạng WiFi nội bộ của Trạm Y Tế. Vui lòng kết nối đúng mạng nội bộ để tiếp tục.'
  );
  const [hiddenTabs, setHiddenTabs] = useState<string[]>(settings.hiddenTabs || []);
  const [tabMaintenance, setTabMaintenance] = useState<Record<string, boolean>>(
    settings.tabMaintenance || {}
  );
  const [publicSidebarColored, setPublicSidebarColored] = useState<boolean>(
    Boolean(settings.sidebarColors?.publicEnabled)
  );
  const [adminSidebarColored, setAdminSidebarColored] = useState<boolean>(
    Boolean(settings.sidebarColors?.adminEnabled)
  );
  const [authProvidersMap, setAuthProvidersMap] = useState<AuthProvidersStatusMap>(() =>
    resolveAuthProvidersMap(settings)
  );
  const firebaseAuthProvidersUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

  // Business Trip config state
  const [tripConfigEnabled, setTripConfigEnabled] = useState<boolean>(
    settings.businessTripConfig?.enabled !== false
  );
  const [tripSectionTitle, setTripSectionTitle] = useState<string>(
    settings.businessTripConfig?.sectionTitle || 'Lịch Công Tác'
  );
  const [tripSectionSubtitle, setTripSectionSubtitle] = useState<string>(
    settings.businessTripConfig?.sectionSubtitle ||
      'Theo dõi lịch công tác, tập huấn, hội nghị và nhiệm vụ ngoại viện của cán bộ nhân viên Trạm Y tế.'
  );
  const [tripDefaultFilter, setTripDefaultFilter] = useState<'active' | 'upcoming' | 'all'>(
    settings.businessTripConfig?.defaultFilter || 'active'
  );
  const [tripHidePastForCitizens, setTripHidePastForCitizens] = useState<boolean>(
    Boolean(settings.businessTripConfig?.hidePastForCitizens)
  );
  const [savingTripConfig, setSavingTripConfig] = useState<boolean>(false);

  const [rolePermissions, setRolePermissions] = useState<RolePermissionsConfig>(() =>
    resolveRolePermissions(settings)
  );
  const [activeRoleConfigTab, setActiveRoleConfigTab] = useState<'super_admin' | 'admin' | 'user' | 'organization' | 'guest'>('guest');
  const [savingRolePerms, setSavingRolePerms] = useState(false);
  const [savingSystemControl, setSavingSystemControl] = useState(false);

  // Client Platform / Device / Browser Access Control state
  const [accessRules, setAccessRules] = useState<AccessRestrictionRules>(
    settings.accessControl?.rules || {}
  );
  const [accessCustomMessage, setAccessCustomMessage] = useState<string>(
    settings.accessControl?.customMessage ||
      'Hiện tại hệ thống đang tạm hạn chế truy cập trên loại thiết bị hoặc trình duyệt bạn đang sử dụng. Vui lòng chuyển sang thiết bị/trình duyệt được hỗ trợ hoặc liên hệ Trạm Y tế qua số Cấp cứu 24/7 bên dưới.'
  );
  const [accessExemptAdmins, setAccessExemptAdmins] = useState<boolean>(
    settings.accessControl?.exemptAdmins !== false
  );
  const [savingAccessControl, setSavingAccessControl] = useState(false);

  // BHXH API Gateway (CV 366/BHXH-CNTT & nâng cấp 2024 CV 1923/BHXH-CNTT) configuration & live test state
  const [bhxhEnabled, setBhxhEnabled] = useState<boolean>(Boolean(settings.bhxhApi?.enabled));
  const [bhxhBaseUrl, setBhxhBaseUrl] = useState<string>(
    settings.bhxhApi?.baseUrl || 'https://egw.baohiemxahoi.gov.vn'
  );
  const [bhxhLookupEndpoint, setBhxhLookupEndpoint] = useState<BhxhLookupEndpoint>(
    settings.bhxhApi?.lookupEndpoint || 'KQNhanLichSuKCB2024'
  );
  const [bhxhUsername, setBhxhUsername] = useState<string>('');
  const [bhxhPassword, setBhxhPassword] = useState<string>('');
  const [bhxhPasswordMode, setBhxhPasswordMode] = useState<'plain' | 'md5'>('plain');
  const [bhxhClearPassword, setBhxhClearPassword] = useState<boolean>(false);
  const [bhxhHasPassword, setBhxhHasPassword] = useState<boolean>(
    Boolean(settings.bhxhApi?.hasCredentials)
  );
  const [bhxhShowPassword, setBhxhShowPassword] = useState<boolean>(false);
  const [bhxhDefaultMaCskcb, setBhxhDefaultMaCskcb] = useState<string>(
    settings.bhxhApi?.defaultMaCskcb || ''
  );
  const [bhxhDefaultHoTenCb, setBhxhDefaultHoTenCb] = useState<string>('');
  const [bhxhDefaultCccdCb, setBhxhDefaultCccdCb] = useState<string>('');
  const [bhxhAutoLookupFacility, setBhxhAutoLookupFacility] = useState<boolean>(
    settings.bhxhApi?.autoLookupFacilityName !== false
  );
  const [bhxhShowHistoryKcb, setBhxhShowHistoryKcb] = useState<boolean>(
    settings.bhxhApi?.showHistoryKcb !== false
  );
  const [bhxhLoadingConfig, setBhxhLoadingConfig] = useState<boolean>(false);
  const [savingBhxhConfig, setSavingBhxhConfig] = useState<boolean>(false);
  const [bhxhTestMode, setBhxhTestMode] = useState<'token' | 'cskcb' | 'card'>('token');
  const [testMaCskcb, setTestMaCskcb] = useState<string>(settings.bhxhApi?.defaultMaCskcb || '');
  const [testCardMaThe, setTestCardMaThe] = useState<string>('');
  const [testCardHoTen, setTestCardHoTen] = useState<string>('');
  const [testCardNgaySinh, setTestCardNgaySinh] = useState<string>('');
  const [testCardHoTenCb, setTestCardHoTenCb] = useState<string>('');
  const [testCardCccdCb, setTestCardCccdCb] = useState<string>('');
  const [testingBhxhApi, setTestingBhxhApi] = useState<boolean>(false);
  const [bhxhApiCallResult, setBhxhApiCallResult] = useState<{
    endpoint: string;
    ok: boolean;
    durationMs: number;
    calledAt: string;
    summaryTitle: string;
    summaryDetails: string[];
    payload: unknown;
  } | null>(null);

  useEffect(() => {
    if (!isAdmin || !currentUser) return;
    let active = true;
    setBhxhLoadingConfig(true);
    fetchBhxhAdminConfig()
      .then(cfg => {
        if (!active) return;
        setBhxhEnabled(cfg.enabled);
        setBhxhBaseUrl(cfg.baseUrl || 'https://egw.baohiemxahoi.gov.vn');
        setBhxhLookupEndpoint(cfg.lookupEndpoint || 'KQNhanLichSuKCB2024');
        setBhxhUsername(cfg.username || '');
        setBhxhHasPassword(cfg.hasPassword);
        setBhxhDefaultMaCskcb(cfg.defaultMaCskcb || '');
        setBhxhDefaultHoTenCb(cfg.defaultHoTenCb || '');
        setBhxhDefaultCccdCb(cfg.defaultCccdCb || '');
        setBhxhAutoLookupFacility(cfg.autoLookupFacilityName);
        setBhxhShowHistoryKcb(cfg.showHistoryKcb);
        if (cfg.defaultMaCskcb) {
          setTestMaCskcb(prev => prev || cfg.defaultMaCskcb);
        }
        if (cfg.defaultHoTenCb) {
          setTestCardHoTenCb(prev => prev || cfg.defaultHoTenCb);
        }
        if (cfg.defaultCccdCb) {
          setTestCardCccdCb(prev => prev || cfg.defaultCccdCb);
        }
      })
      .catch(() => {
        // Fallback to Firestore public metadata if backend config endpoint unreachable
      })
      .finally(() => {
        if (active) setBhxhLoadingConfig(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, currentUser?.uid, subTab === 'bhxh_api']);

  // Sync realtime settings updates cleanly
  useEffect(() => {
    if (settings.stationName !== undefined) setStationName(settings.stationName || '');
    if (settings.parentUnitName !== undefined) {
      setParentUnitName(
        settings.parentUnitName || 'TRUNG TÂM Y TẾ QUẬN / HUYỆN • SỞ Y TẾ ĐỊA PHƯƠNG'
      );
    }
    if (settings.subTitle !== undefined) setSubTitle(settings.subTitle || '');
    if (settings.address !== undefined) setAddress(settings.address || '');
    if (settings.hotline !== undefined) setHotline(settings.hotline || '');
    if (settings.email !== undefined) setStationEmail(settings.email || '');
    if (settings.workingHours !== undefined) setWorkingHours(settings.workingHours || '');
    if (settings.leaderName !== undefined) setLeaderName(settings.leaderName || '');
    if (settings.bannerNotice !== undefined) setBannerNotice(settings.bannerNotice || '');
    if (settings.coverImageUrl !== undefined) {
      setCoverImageUrl(settings.coverImageUrl || '');
      setCoverPreviewError(false);
      setCoverUseProxy(false);
    }
    const syncedEmergencies = getConfiguredEmergencyContacts(settings);
    if (syncedEmergencies.length > 0) {
      setEmergencyContacts(syncedEmergencies);
    }
    setMapLocationsList(
      sortLocationsPrimaryFirst(
        settings.mapLocations && settings.mapLocations.length > 0 ? settings.mapLocations : []
      )
    );
    setQuickLinksList(
      settings.quickLinks && settings.quickLinks.length > 0 ? settings.quickLinks : []
    );
    setVaccinationSchedulesList(sortVaccinationSchedules(settings.vaccinationSchedules));
    setBannerNoticeEnabled(
      settings.bannerNoticeEnabled ?? Boolean(settings.bannerNotice?.trim())
    );
    setPopupEnabled(settings.startupPopup?.enabled !== false);
    setPopupNoticeType(settings.startupPopup?.noticeType || 'general');
    setPopupTitle(settings.startupPopup?.title || 'Thông báo từ Trạm Y Tế');
    setPopupMessage(settings.startupPopup?.message || '');
    setPopupCtaView(settings.startupPopup?.ctaView || 'none');
    setPopupCtaLabel(settings.startupPopup?.ctaLabel || '');
    setPopupFrequency(settings.startupPopup?.frequency || 'per_session');
    setVacBannerEnabled(settings.vaccinationBannerEnabled !== false);
    setVacBannerNote(settings.vaccinationBannerNote || '');
    setVacPopupEnabled(
      settings.vaccinationPopup
        ? settings.vaccinationPopup.enabled !== false
        : settings.startupPopup?.includeTopVaccination !== false
    );
    setVacPopupTitle(settings.vaccinationPopup?.title || 'Thông Báo Tiêm Chủng');
    setVacPopupMessage(settings.vaccinationPopup?.message || '');
    setVacPopupCtaLabel(settings.vaccinationPopup?.ctaLabel || 'Xem lịch tiêm chủng');
    setVacPopupFrequency(
      settings.vaccinationPopup?.frequency || settings.startupPopup?.frequency || 'per_session'
    );
    setSocialFacebook(settings.socialLinks?.facebook || '');
    setSocialZalo(settings.socialLinks?.zalo || '');
    setSocialTiktok(settings.socialLinks?.tiktok || '');
    setSocialYoutube(settings.socialLinks?.youtube || '');
    setEditorialBoard(settings.editorialBoard || '');
    setResponsiblePerson(settings.responsiblePerson || '');
    setCopyrightText(settings.copyrightText || '');
    setSoftTeamEnabled(settings.softwareTeamContact?.enabled !== false);
    setSoftTeamName(settings.softwareTeamContact?.teamName || '');
    setSoftTeamRole(settings.softwareTeamContact?.roleLabel || '');
    setSoftTeamPerson(settings.softwareTeamContact?.personName || '');
    setSoftTeamPhone(settings.softwareTeamContact?.phone || '');
    setSoftTeamEmail(settings.softwareTeamContact?.email || '');
    setSoftTeamZalo(settings.softwareTeamContact?.zaloUrl || '');
    setSoftTeamFacebook(settings.softwareTeamContact?.facebookUrl || '');
    setSoftTeamWebsite(settings.softwareTeamContact?.websiteUrl || '');
    setSoftTeamHours(settings.softwareTeamContact?.supportHours || '');
    setSoftTeamNote(settings.softwareTeamContact?.note || '');
    setMaintenanceMode(!!settings.maintenanceMode);
    setCccdLookupEnabled(settings.cccdLookupEnabled !== false);
    setEpidemicMapButtonVisible(settings.epidemicMapButtonVisible !== false);
    if (settings.maintenanceMessage) {
      setMaintenanceMessage(settings.maintenanceMessage);
    }
    setHiddenTabs(settings.hiddenTabs || []);
    setTabMaintenance(settings.tabMaintenance || {});
    setPublicSidebarColored(Boolean(settings.sidebarColors?.publicEnabled));
    setAdminSidebarColored(Boolean(settings.sidebarColors?.adminEnabled));
    setAuthProvidersMap(resolveAuthProvidersMap(settings));
    setTripConfigEnabled(settings.businessTripConfig?.enabled !== false);
    setTripSectionTitle(settings.businessTripConfig?.sectionTitle || 'Lịch Công Tác');
    setTripSectionSubtitle(
      settings.businessTripConfig?.sectionSubtitle ||
        'Theo dõi lịch công tác, tập huấn, hội nghị và nhiệm vụ ngoại viện của cán bộ nhân viên Trạm Y tế.'
    );
    setTripDefaultFilter(settings.businessTripConfig?.defaultFilter || 'active');
    setTripHidePastForCitizens(Boolean(settings.businessTripConfig?.hidePastForCitizens));
    setRolePermissions(resolveRolePermissions(settings));
    if (settings.accessControl) {
      setAccessRules(settings.accessControl.rules || {});
      if (settings.accessControl.customMessage !== undefined) {
        setAccessCustomMessage(settings.accessControl.customMessage);
      }
      setAccessExemptAdmins(settings.accessControl.exemptAdmins !== false);
    }
  }, [settings]);

  // Notification modal & published notification + station post analytics state
  const [showSendNotifModal, setShowSendNotifModal] = useState(false);
  const [publishedNotifications, setPublishedNotifications] = useState<TargetedNotification[]>([]);
  const [publishedAnnouncements, setPublishedAnnouncements] = useState<Announcement[]>([]);
  const [publishedPosts, setPublishedPosts] = useState<Post[]>([]);

  useEffect(() => {
    const unsubNotifs = onSnapshot(
      query(collection(db, 'targetedNotifications')),
      snap => {
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as TargetedNotification))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setPublishedNotifications(items);
      },
      () => {}
    );
    const unsubAnns = onSnapshot(
      query(collection(db, 'announcements')),
      snap => {
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Announcement))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setPublishedAnnouncements(items);
      },
      () => {}
    );
    const unsubPosts = onSnapshot(
      query(collection(db, 'posts')),
      snap => {
        const items = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Post))
          .sort((a, b) => (b.views || 0) - (a.views || 0));
        setPublishedPosts(items);
      },
      () => {}
    );
    const unsubEpidemic = subscribeEpidemicCases(
      items => setEpidemicCasesList(items),
      () => {}
    );
    return () => {
      unsubNotifs();
      unsubAnns();
      unsubPosts();
      unsubEpidemic();
    };
  }, []);

  // Response dialog & filter for citizen feedback
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'unanswered' | 'answered' | 'withdrawn'>('all');
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const [selectedFb, setSelectedFb] = useState<FeedbackItem | null>(null);
  const [fbReply, setFbReply] = useState('');
  const [fbDept, setFbDept] = useState('Khoa Khám bệnh');
  const [fbOutcomeStatus, setFbOutcomeStatus] = useState<'resolved' | 'rejected'>('resolved');
  const [submittingReply, setSubmittingReply] = useState(false);

  // User edit modal & Ban modal state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editingUserDevices, setEditingUserDevices] = useState<UserVerifiedDevice[] | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [userCategoryTab, setUserCategoryTab] = useState<'all' | 'elevated' | 'organization' | 'standard' | 'duplicates' | 'banned'>('all');
  const [usersPage, setUsersPage] = useState(1);
  const [sepayVipMap, setSepayVipMap] = useState<Record<string, SepayVipRecord>>({});
  const [paidVerifyUids, setPaidVerifyUids] = useState<Set<string>>(new Set());
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || (subTab !== 'users' && subTab !== 'sepay_payment')) return;
    let active = true;
    fetchAdminSepayState()
      .then(data => {
        if (!active) return;
        const map: Record<string, SepayVipRecord> = {};
        (data.vips || []).forEach(v => {
          if (v?.uid) map[v.uid] = v;
        });
        const paidSet = new Set<string>();
        (data.orders || []).forEach(ord => {
          if (
            ord.status === 'paid' &&
            ord.uid &&
            (ord.orderType === 'vip_package' || (ord.durationDays || 0) > 0)
          ) {
            paidSet.add(ord.uid);
          }
        });
        setSepayVipMap(map);
        setPaidVerifyUids(paidSet);
      })
      .catch(() => {
        // Non-fatal fallback to Firestore user profile fields
      });
    return () => {
      active = false;
    };
  }, [isAdmin, subTab, users.length]);

  const hydrateUserWithVerifyState = (u: UserProfile): UserProfile => {
    const vipRec = sepayVipMap[u.uid];
    if (vipRec?.isVip) {
      return {
        ...u,
        isVip: true,
        vipTier: vipRec.vipTier || u.vipTier,
        vipPackageName: vipRec.vipPackageName || u.vipPackageName,
        vipActivatedAt: vipRec.vipActivatedAt || u.vipActivatedAt,
        vipExpiresAt: vipRec.vipExpiresAt || u.vipExpiresAt,
        vipOrderCode: vipRec.vipOrderCode || u.vipOrderCode,
      };
    }
    if (paidVerifyUids.has(u.uid) && !u.isVip) {
      return {
        ...u,
        isVip: true,
      };
    }
    return u;
  };

  const handleCopyUserUid = async (uid: string) => {
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      setCopiedUid(uid);
      setTimeout(() => setCopiedUid(prev => (prev === uid ? null : prev)), 1800);
      showToast('success', 'Đã sao chép UID', uid);
    } catch {
      showToast('info', 'UID tài khoản', uid);
    }
  };

  const [banModalUser, setBanModalUser] = useState<UserProfile | null>(null);
  const [banMode, setBanMode] = useState<'temporary' | 'permanent'>('temporary');
  const [banPreset, setBanPreset] = useState<BanDurationPresetKey>('24h');
  const [banCustomUntil, setBanCustomUntil] = useState<string>(() =>
    toLocalDateTimeInputValue(Date.now() + 24 * 60 * 60 * 1000)
  );
  const [banReasonInput, setBanReasonInput] = useState('');
  const [submittingBan, setSubmittingBan] = useState(false);

  useEffect(() => {
    const uid = editingUser?.uid;
    if (!uid) {
      setEditingUserDevices(null);
      return;
    }
    let active = true;
    getDocs(collection(db, 'users', uid, 'devices'))
      .then(snap => {
        if (!active) return;
        const list = snap.docs.map(d => d.data() as UserVerifiedDevice);
        setEditingUserDevices(list);
      })
      .catch(() => {
        if (active) setEditingUserDevices(null);
      });
    return () => {
      active = false;
    };
  }, [editingUser?.uid]);

  // Two-Tier Referral Code & Invite Link management (Super Admin & Admin)
  const [referralCodes, setReferralCodes] = useState<ReferralCodeItem[]>([]);
  const [loadingReferrals, setLoadingReferrals] = useState(false);
  const [newRefCodeInput, setNewRefCodeInput] = useState('');
  const [newRefLabelInput, setNewRefLabelInput] = useState('');
  const [newRefIssuerTier, setNewRefIssuerTier] = useState<ReferralIssuerTier>(
    canManageSuperAdminTier ? 'super_admin' : 'admin'
  );
  const [newRefTargetAccountType, setNewRefTargetAccountType] = useState<RoleType>('organization');
  const [newRefRole, setNewRefRole] = useState<RoleType>('organization');
  const [creatingRef, setCreatingRef] = useState(false);
  const [copiedRefText, setCopiedRefText] = useState<string | null>(null);
  const [referralTierFilter, setReferralTierFilter] = useState<'all' | ReferralIssuerTier>('all');

  // Service Ratings & Citizen Experience state
  const [serviceRatings, setServiceRatings] = useState<ServiceRating[]>([]);
  const [ratingCategoryFilter, setRatingCategoryFilter] = useState<'all' | ServiceRatingCategory>('all');
  const [ratingStarFilter, setRatingStarFilter] = useState<number>(0);

  // Firebase Migration & Reconciliation state
  const [legacySnapshots, setLegacySnapshots] = useState<LegacyUserSnapshot[]>([]);
  const [migrationClaims, setMigrationClaims] = useState<UserMigrationClaim[]>([]);
  const [loadingMigrationData, setLoadingMigrationData] = useState(false);
  const [migrationToggleSaving, setMigrationToggleSaving] = useState(false);
  const [migrationBannerNoteInput, setMigrationBannerNoteInput] = useState(
    settings.migrationBannerNote || ''
  );
  const [resolvingClaim, setResolvingClaim] = useState<UserMigrationClaim | null>(null);
  const [claimEditValues, setClaimEditValues] = useState<{
    displayName: string;
    phoneNumber: string;
    citizenId: string;
    department: string;
    position: string;
    role: UserProfile['role'];
    accountType: UserProfile['accountType'];
  }>({
    displayName: '',
    phoneNumber: '',
    citizenId: '',
    department: '',
    position: '',
    role: 'user',
    accountType: 'user',
  });
  const [adminClaimNote, setAdminClaimNote] = useState('');
  const [savingClaimResolution, setSavingClaimResolution] = useState(false);

  useEffect(() => {
    setMigrationBannerNoteInput(settings.migrationBannerNote || '');
  }, [settings.migrationBannerNote]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(
      collection(db, 'serviceRatings'),
      snap => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as ServiceRating))
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        setServiceRatings(list);
      },
      () => {}
    );
    return () => unsub();
  }, [isAdmin]);

  const fetchMigrationData = async () => {
    if (!isAdmin) return;
    setLoadingMigrationData(true);
    try {
      const [snaps, claims] = await Promise.all([
        listLegacyUserSnapshots(),
        listUserMigrationClaims(),
      ]);
      setLegacySnapshots(snaps);
      setMigrationClaims(claims);
    } finally {
      setLoadingMigrationData(false);
    }
  };

  const refreshReferralCodesList = async () => {
    if (!isAdmin) return;
    setLoadingReferrals(true);
    try {
      const items = await listReferralCodes();
      setReferralCodes(items);
    } catch {
      // ignore transient error
    } finally {
      setLoadingReferrals(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || subTab !== 'users') return;
    void fetchMigrationData();
  }, [isAdmin, subTab]);

  useEffect(() => {
    if (!isAdmin || subTab !== 'referral_codes') return;
    let active = true;
    setLoadingReferrals(true);
    listReferralCodes()
      .then(items => {
        if (active) setReferralCodes(items);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingReferrals(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, subTab]);

  // User duplicate detection and categorization
  const userDuplicateInfo = useMemo(() => {
    const emailCounts = new Map<string, number>();
    const cccdCounts = new Map<string, number>();

    users.forEach(u => {
      const email = u.email?.trim().toLowerCase();
      if (email) {
        emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      }
      const cccd = u.citizenId?.trim().replace(/\s+/g, '');
      if (cccd && cccd.length >= 6) {
        cccdCounts.set(cccd, (cccdCounts.get(cccd) || 0) + 1);
      }
    });

    const duplicateUids = new Set<string>();
    users.forEach(u => {
      const email = u.email?.trim().toLowerCase();
      const cccd = u.citizenId?.trim().replace(/\s+/g, '');
      if ((email && (emailCounts.get(email) || 0) > 1) || (cccd && cccd.length >= 6 && (cccdCounts.get(cccd) || 0) > 1)) {
        duplicateUids.add(u.uid);
      }
    });

    return {
      duplicateUids,
      duplicateCount: duplicateUids.size,
    };
  }, [users]);

  const elevatedUsersCount = useMemo(
    () => users.filter(u => u.role === 'admin' || u.role === 'super_admin' || u.accountType === 'admin').length,
    [users]
  );
  const orgUsersCount = useMemo(
    () => users.filter(u => u.role === 'organization' || u.accountType === 'organization').length,
    [users]
  );
  const standardUsersCount = useMemo(
    () => users.filter(u => u.role !== 'admin' && u.role !== 'super_admin' && u.accountType !== 'admin' && u.role !== 'organization' && u.accountType !== 'organization').length,
    [users]
  );
  const bannedUsersCount = useMemo(
    () => users.filter(u => isUserActivelyBanned(u)).length,
    [users]
  );

  const filteredUsersList = useMemo(() => {
    return users.filter(u => {
      const isDuplicate = userDuplicateInfo.duplicateUids.has(u.uid);

      if (userCategoryTab === 'elevated') {
        return u.role === 'admin' || u.role === 'super_admin' || u.accountType === 'admin';
      }
      if (userCategoryTab === 'organization') {
        return u.role === 'organization' || u.accountType === 'organization';
      }
      if (userCategoryTab === 'standard') {
        return u.role !== 'admin' && u.role !== 'super_admin' && u.accountType !== 'admin' && u.role !== 'organization' && u.accountType !== 'organization';
      }
      if (userCategoryTab === 'duplicates') return isDuplicate;
      if (userCategoryTab === 'banned') return isUserActivelyBanned(u);
      return true;
    });
  }, [users, userCategoryTab, userDuplicateInfo]);

  const USERS_PAGE_SIZE = 10;
  useEffect(() => {
    setUsersPage(1);
  }, [userCategoryTab]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredUsersList.length / USERS_PAGE_SIZE));
    if (usersPage > totalPages) {
      setUsersPage(totalPages);
    }
  }, [filteredUsersList.length, usersPage]);

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PAGE_SIZE;
    return filteredUsersList.slice(start, start + USERS_PAGE_SIZE);
  }, [filteredUsersList, usersPage]);

  const getUserRoleLabel = (role?: UserProfile['role']) => {
    switch (role) {
      case 'super_admin':
        return 'Super Admin';
      case 'admin':
        return 'Admin';
      case 'organization':
        return 'Doanh nghiệp / Tổ chức';
      case 'user':
        return 'User';
      case 'other':
        return 'Khác';
      default:
        return 'User';
    }
  };

  const handleExportUsersExcel = () => {
    if (filteredUsersList.length === 0) {
      showToast('warning', 'Không có dữ liệu người dùng để xuất Excel');
      return;
    }
    const rows = filteredUsersList.map((rawUser, idx) => {
      const u = hydrateUserWithVerifyState(rawUser);
      const vProg = getUserVerificationProgress(u, {
        phoneNumber: u.verifiedPhone || u.phoneNumber,
      });
      const accountTypeLabel = getUserRoleLabel(u.role || u.accountType);
      const effectiveStatus = getEffectiveUserStatus(u);
      const activelyBanned = isUserActivelyBanned(u);
      const activityLabel = activelyBanned
        ? u.banType === 'permanent'
          ? 'Bị Ban (Vô thời hạn)'
          : `Bị Ban đến ${formatBanTimestampVi(u.bannedUntilMs || u.bannedUntil)}`
        : effectiveStatus === 'active'
        ? 'Hoạt động'
        : effectiveStatus === 'suspended'
        ? 'Tạm khóa'
        : 'Chờ duyệt';
      return {
        STT: idx + 1,
        UID: u.uid || '',
        'Họ và tên': u.displayName || 'Chưa đặt tên',
        Email: u.email || '',
        SĐT: u.verifiedPhone || u.phoneNumber || '',
        'Số CCCD': u.citizenId || '',
        'Ngày sinh': u.dob || '',
        'Giới tính': u.gender || '',
        'Loại tài khoản': accountTypeLabel,
        'Vai trò': getUserRoleLabel(u.role),
        'Khoa / Phòng': u.department || '',
        'Chức vụ': u.position || '',
        'Trình độ': u.qualification || '',
        'Hoạt động': activityLabel,
        'Thời hạn Ban': activelyBanned
          ? u.banType === 'permanent'
            ? 'Vô thời hạn'
            : formatBanTimestampVi(u.bannedUntilMs || u.bannedUntil)
          : '',
        'Lý do Ban': activelyBanned ? u.banReason || '' : '',
        'Gói Verify': vProg.paidVerified ? 'Đã mua gói Verify' : 'Chưa mua',
        'Trạng thái xác minh': vProg.isFullyVerified ? 'Đã xác minh' : 'Chưa hoàn thành',
        'Quyền sửa thông tin': u.identityVerifiedFromDatabase
          ? u.allowIdentityEditByAdmin
            ? 'Admin mở sửa'
            : 'Đang khóa (CSDL)'
          : 'Tự do',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 24 },
      { wch: 28 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 24 },
      { wch: 20 },
      { wch: 18 },
      { wch: 26 },
      { wch: 18 },
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tai_Khoan_Nguoi_Dung');
    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Danh_sach_tai_khoan_${dateStamp}.xlsx`);
    showToast('success', `Đã xuất ${filteredUsersList.length} tài khoản ra file Excel`);
  };

  // Access check: If not logged in
  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6 animate-in fade-in duration-200">
        <StationLogo size={72} className="mx-auto" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Trung Tâm Quản Trị Hệ Sinh Thái Y Tế
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Khu vực dành riêng cho Quản trị viên và Cán bộ Trạm Y tế để điều hành dữ liệu, phê duyệt phản ánh và quản lý nhân sự.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          {onNavigateToLogin ? (
            <button
              type="button"
              onClick={onNavigateToLogin}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Đi đến trang Đăng nhập & Xác minh
            </button>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Đăng nhập Quản trị viên
            </button>
          )}
        </div>
      </div>
    );
  }

  // Access check: If citizen account with no staff/admin privileges
  if (!isAdmin && !isStaff) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Không có quyền truy cập Bảng Quản trị
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Tài khoản của bạn ({currentUser.email}) hiện là <strong>Tài khoản Người dân</strong>. Vui lòng liên hệ Quản trị viên Trạm Y tế để được phân quyền cán bộ y tế.
        </p>
      </div>
    );
  }

  const handleSaveStationInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('warning', 'Chỉ Quản trị viên mới có quyền cập nhật thông tin Trạm');
      return;
    }

    setSavingSettings(true);
    try {
      const validEmergencyContacts = emergencyContacts
        .filter(item => item.phone.trim() !== '')
        .map((item, idx) => ({
          id: item.id || `ec_${idx + 1}`,
          phone: item.phone.trim(),
          note: item.note.trim(),
        }));

      const trimmedCover = coverImageUrl.trim();
      const normalizedCover = trimmedCover
        ? GitHubService.toRawGitHubUrl(trimmedCover)
        : '';

      await updateSystemSettings({
        stationName: stationName.trim(),
        parentUnitName: parentUnitName.trim(),
        subTitle: subTitle.trim(),
        address: address.trim(),
        hotline: hotline.trim(),
        email: stationEmail.trim(),
        emergencyContacts: validEmergencyContacts,
        emergencyPhone: validEmergencyContacts[0]?.phone || '',
        emergencyNote: validEmergencyContacts[0]?.note || '',
        workingHours: workingHours.trim(),
        leaderName: leaderName.trim(),
        coverImageUrl: normalizedCover,
        updatedAt: new Date().toISOString(),
      });

      await logAuditEvent('Cấu hình trạm y tế', 'Cài đặt', 'Cập nhật thông tin đơn vị', {
        uid: currentUser?.uid || 'admin',
        name: userProfile?.displayName || 'Admin',
      });

      showToast('success', 'Đã lưu cấu hình Trạm Y tế thành công');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lưu cấu hình thất bại', err?.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveGitHubConfig = async (newConfig: GitHubConfig) => {
    await updateSystemSettings({
      githubConfig: newConfig,
      updatedAt: new Date().toISOString(),
    });
    onRefreshData();
  };

  const handleSaveFunctionsDuties = async () => {
    setSavingFunctionsDuties(true);
    try {
      await updateSystemSettings({
        customFunctionsAndDuties: functionsDutiesText.trim(),
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent('Cập nhật Chức năng - Nhiệm vụ', 'Cài đặt', 'Lưu nội dung chức năng nhiệm vụ trạm y tế', {
        uid: currentUser?.uid || 'admin',
        name: userProfile?.displayName || 'Admin',
      });
      showToast('success', 'Đã lưu Chức năng & Nhiệm vụ thành công');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lỗi khi lưu chức năng nhiệm vụ', err?.message);
    } finally {
      setSavingFunctionsDuties(false);
    }
  };

  const handleSaveMapLocations = async (updatedList: MapLocation[]) => {
    setSavingMapLocations(true);
    try {
      const sortedList = sortLocationsPrimaryFirst(updatedList);
      await updateSystemSettings({
        mapLocations: sortedList,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent('Cấu hình Bản đồ', 'Bản đồ', `Cập nhật ${sortedList.length} cơ sở / điểm y tế`, {
        uid: currentUser?.uid || 'admin',
        name: userProfile?.displayName || 'Admin',
      });
      showToast('success', 'Đã lưu danh sách vị trí trên bản đồ (Trụ sở chính đứng đầu)');
      setMapLocationsList(sortedList);
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lỗi khi lưu vị trí bản đồ', err?.message);
    } finally {
      setSavingMapLocations(false);
    }
  };

  const handleAddLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;

    const latNum = parseFloat(newLocLat) || 10.7516;
    const lngNum = parseFloat(newLocLng) || 106.7024;

    const newLoc: MapLocation = {
      id: `loc_${Date.now()}`,
      name: newLocName.trim(),
      address: newLocAddress.trim() || 'Trạm Y tế',
      lat: latNum,
      lng: lngNum,
      phone: newLocPhone.trim() || undefined,
      headName: newLocHeadName.trim() || undefined,
      workingHours: newLocHours.trim() || undefined,
      notes: newLocNotes.trim() || undefined,
      isPrimary: newLocIsPrimary,
    };

    let updated = [...mapLocationsList];
    if (newLocIsPrimary) {
      updated = updated.map(l => ({ ...l, isPrimary: false }));
    }
    updated.push(newLoc);
    handleSaveMapLocations(updated);

    setShowAddLocationModal(false);
    setNewLocName('');
    setNewLocAddress('');
    setNewLocPhone('');
    setNewLocHeadName('');
    setNewLocNotes('');
    setNewLocIsPrimary(false);
  };

  const handleUpdateLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !newLocName.trim()) return;

    const latNum = parseFloat(newLocLat) || 10.7516;
    const lngNum = parseFloat(newLocLng) || 106.7024;

    let updated = mapLocationsList.map(l => {
      if (l.id === editingLocation.id) {
        return {
          ...l,
          name: newLocName.trim(),
          address: newLocAddress.trim(),
          lat: latNum,
          lng: lngNum,
          phone: newLocPhone.trim() || undefined,
          headName: newLocHeadName.trim() || undefined,
          workingHours: newLocHours.trim() || undefined,
          notes: newLocNotes.trim() || undefined,
          isPrimary: newLocIsPrimary,
        };
      }
      return l;
    });

    if (newLocIsPrimary) {
      updated = updated.map(l => ({
        ...l,
        isPrimary: l.id === editingLocation.id,
      }));
    }

    handleSaveMapLocations(updated);
    setEditingLocation(null);
    setNewLocName('');
    setNewLocAddress('');
    setNewLocPhone('');
    setNewLocHeadName('');
    setNewLocNotes('');
    setNewLocIsPrimary(false);
  };

  const handleDeleteLocation = (id: string, name: string) => {
    showConfirm({
      title: 'Xóa vị trí cơ sở?',
      message: `Bạn có chắc muốn xóa điểm "${name}" khỏi bản đồ?`,
      confirmText: 'Xóa vị trí',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        const updated = mapLocationsList.filter(l => l.id !== id);
        handleSaveMapLocations(updated);
      },
    });
  };

  const handleSetPrimaryLocation = (id: string) => {
    const updated = mapLocationsList.map(l => ({
      ...l,
      isPrimary: l.id === id,
    }));
    handleSaveMapLocations(updated);
  };

  const handleSaveQuickLinks = async (updatedList: QuickLink[]) => {
    setSavingQuickLinks(true);
    try {
      await updateSystemSettings({
        quickLinks: updatedList,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent('Cấu hình Footer & Liên kết', 'Footer', `Cập nhật ${updatedList.length} liên kết`, {
        uid: currentUser?.uid || 'admin',
        name: userProfile?.displayName || 'Admin',
      });
      showToast('success', 'Đã lưu danh sách liên kết nhanh');
      setQuickLinksList(updatedList);
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lỗi khi lưu liên kết nhanh', err?.message);
    } finally {
      setSavingQuickLinks(false);
    }
  };

  const handleAddQuickLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;

    const newLink: QuickLink = {
      id: `link_${Date.now()}`,
      title: newLinkTitle.trim(),
      url: newLinkUrl.trim(),
      description: newLinkDesc.trim() || undefined,
      badge: newLinkBadge.trim() || undefined,
    };

    const updated = [...quickLinksList, newLink];
    handleSaveQuickLinks(updated);

    setShowAddQuickLinkModal(false);
    setNewLinkTitle('');
    setNewLinkUrl('');
    setNewLinkDesc('');
    setNewLinkBadge('');
  };

  const handleDeleteQuickLink = (id: string, title: string) => {
    showConfirm({
      title: 'Xóa liên kết?',
      message: `Bạn có chắc muốn xóa "${title}" khỏi footer?`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        const updated = quickLinksList.filter(l => l.id !== id);
        handleSaveQuickLinks(updated);
      },
    });
  };

  const handleSaveSocialLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSocialLinks(true);
    try {
      await updateSystemSettings({
        socialLinks: {
          facebook: socialFacebook.trim(),
          zalo: socialZalo.trim(),
          tiktok: socialTiktok.trim(),
          youtube: socialYoutube.trim(),
        },
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent('Cấu hình Mạng xã hội', 'Footer', 'Cập nhật liên kết Facebook/Zalo/TikTok/YouTube', {
        uid: currentUser?.uid || 'admin',
        name: userProfile?.displayName || 'Admin',
      });
      showToast('success', 'Đã lưu liên kết mạng xã hội Footer');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lỗi khi lưu liên kết mạng xã hội', err?.message);
    } finally {
      setSavingSocialLinks(false);
    }
  };

  const handleSaveFooterMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFooterMeta(true);
    try {
      await updateSystemSettings({
        editorialBoard: editorialBoard.trim().slice(0, 256),
        responsiblePerson: responsiblePerson.trim().slice(0, 256),
        copyrightText: copyrightText.trim().slice(0, 512),
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        'Cập nhật Ban biên tập & Bản quyền Footer',
        'Footer',
        `Ban biên tập: ${editorialBoard.trim() || 'Mặc định'} • Chịu trách nhiệm: ${responsiblePerson.trim() || 'Mặc định'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', 'Đã lưu thông tin Ban biên tập & Bản quyền Footer');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lưu thông tin Footer thất bại', err?.message);
    } finally {
      setSavingFooterMeta(false);
    }
  };

  const handleSaveSoftwareTeamContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSoftTeam(true);
    try {
      const cleanPayload = {
        enabled: softTeamEnabled,
        teamName: softTeamName.trim().slice(0, 200),
        roleLabel: softTeamRole.trim().slice(0, 200),
        personName: softTeamPerson.trim().slice(0, 200),
        phone: softTeamPhone.trim().slice(0, 64),
        email: softTeamEmail.trim().slice(0, 256),
        zaloUrl: softTeamZalo.trim().slice(0, 512),
        facebookUrl: softTeamFacebook.trim().slice(0, 512),
        websiteUrl: softTeamWebsite.trim().slice(0, 512),
        supportHours: softTeamHours.trim().slice(0, 200),
        note: softTeamNote.trim().slice(0, 500),
      };
      await updateSystemSettings({
        softwareTeamContact: cleanPayload,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        'Cập nhật Liên hệ Đội ngũ Phần mềm',
        'Footer',
        `Hiển thị: ${softTeamEnabled ? 'BẬT' : 'TẮT'} • Đơn vị: ${cleanPayload.teamName || 'Trống'} • SĐT: ${cleanPayload.phone || 'Trống'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', 'Đã lưu thông tin liên hệ Đội ngũ Phần mềm');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lưu thông tin Đội ngũ Phần mềm thất bại', err?.message);
    } finally {
      setSavingSoftTeam(false);
    }
  };

  const handleToggleSoftwareTeamImmediate = async () => {
    const prevEnabled = softTeamEnabled;
    const nextEnabled = !prevEnabled;
    setSoftTeamEnabled(nextEnabled);
    try {
      const cleanPayload = {
        enabled: nextEnabled,
        teamName: softTeamName.trim().slice(0, 200),
        roleLabel: softTeamRole.trim().slice(0, 200),
        personName: softTeamPerson.trim().slice(0, 200),
        phone: softTeamPhone.trim().slice(0, 64),
        email: softTeamEmail.trim().slice(0, 256),
        zaloUrl: softTeamZalo.trim().slice(0, 512),
        facebookUrl: softTeamFacebook.trim().slice(0, 512),
        websiteUrl: softTeamWebsite.trim().slice(0, 512),
        supportHours: softTeamHours.trim().slice(0, 200),
        note: softTeamNote.trim().slice(0, 500),
      };
      await updateSystemSettings({
        softwareTeamContact: cleanPayload,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        nextEnabled ? 'Bật hiển thị Liên hệ Đội ngũ Phần mềm' : 'Ẩn Liên hệ Đội ngũ Phần mềm',
        'Footer',
        `Hiển thị công khai: ${nextEnabled ? 'BẬT' : 'TẮT'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        nextEnabled
          ? 'Đã BẬT hiển thị Liên hệ Đội ngũ Phần mềm'
          : 'Đã ẨN Liên hệ Đội ngũ Phần mềm'
      );
      onRefreshData();
    } catch (err: any) {
      setSoftTeamEnabled(prevEnabled);
      showToast('error', 'Cập nhật trạng thái Đội ngũ Phần mềm thất bại', err?.message);
    }
  };

  const handleSaveSystemControl = async () => {
    setSavingSystemControl(true);
    try {
      const now = new Date().toISOString();
      await updateSystemSettings({
        maintenanceMode,
        maintenanceMessage: maintenanceMessage.trim(),
        hiddenTabs,
        tabMaintenance,
        sidebarColors: {
          publicEnabled: publicSidebarColored,
          adminEnabled: adminSidebarColored,
          updatedAt: now,
        },
        authProvidersConfig: {
          providers: authProvidersMap,
          updatedAt: now,
        },
        updatedAt: now,
      });
      await logAuditEvent(
        'Cập nhật Bảo trì & Hiển thị Tab',
        'Hệ thống',
        `Bảo trì tổng: ${maintenanceMode ? 'BẬT' : 'TẮT'} • Tab ẩn: ${hiddenTabs.length} • Tab bảo trì lẻ: ${Object.values(tabMaintenance).filter(Boolean).length}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', 'Đã lưu cấu hình Bảo trì & Hiển thị Tab Sidebar');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lưu cấu hình bảo trì thất bại', err?.message);
    } finally {
      setSavingSystemControl(false);
    }
  };

  const handleToggleAccessRuleImmediate = async (
    ruleKey: keyof AccessRestrictionRules,
    label: string
  ) => {
    const prevRules = accessRules;
    const nextValue = !prevRules[ruleKey];
    const nextRules: AccessRestrictionRules = {
      ...prevRules,
      [ruleKey]: nextValue,
    };
    setAccessRules(nextRules);
    try {
      await updateSystemSettings({
        accessControl: {
          rules: nextRules,
          customMessage: accessCustomMessage.trim(),
          exemptAdmins: accessExemptAdmins,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        nextValue ? `Vô hiệu hóa truy cập: ${label}` : `Mở lại truy cập: ${label}`,
        'Kiểm soát truy cập',
        `${label}: ${nextValue ? 'ĐANG CHẶN' : 'CHO PHÉP'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        nextValue ? 'warning' : 'success',
        nextValue ? `Đã BẬT vô hiệu hóa truy cập ${label}` : `Đã CHO PHÉP truy cập ${label}`
      );
      onRefreshData();
    } catch (err: any) {
      setAccessRules(prevRules);
      showToast('error', 'Cập nhật quy tắc chặn thất bại', err?.message);
    }
  };

  const handleSaveAccessControlDetails = async () => {
    setSavingAccessControl(true);
    try {
      await updateSystemSettings({
        accessControl: {
          rules: accessRules,
          customMessage: accessCustomMessage.trim(),
          exemptAdmins: accessExemptAdmins,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        'Cập nhật thông báo & miễn trừ chặn thiết bị',
        'Kiểm soát truy cập',
        `Miễn trừ Admin: ${accessExemptAdmins ? 'BẬT' : 'TẮT'} • Số quy tắc đang chặn: ${
          Object.values(accessRules).filter(Boolean).length
        }`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', 'Đã lưu cấu hình vô hiệu hóa truy cập');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lưu cấu hình vô hiệu hóa truy cập thất bại', err?.message);
    } finally {
      setSavingAccessControl(false);
    }
  };

  const handleToggleAccessExemptAdminsImmediate = async () => {
    const prevVal = accessExemptAdmins;
    const nextVal = !prevVal;
    setAccessExemptAdmins(nextVal);
    try {
      await updateSystemSettings({
        accessControl: {
          rules: accessRules,
          customMessage: accessCustomMessage.trim(),
          exemptAdmins: nextVal,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        nextVal ? 'Bật miễn trừ Quản trị viên khi chặn thiết bị' : 'Tắt miễn trừ Quản trị viên khi chặn thiết bị',
        'Kiểm soát truy cập',
        `Miễn trừ Admin: ${nextVal ? 'BẬT' : 'TẮT'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        nextVal ? 'success' : 'warning',
        nextVal ? 'Đã BẬT miễn trừ Quản trị viên' : 'Đã TẮT miễn trừ Quản trị viên'
      );
      onRefreshData();
    } catch (err: any) {
      setAccessExemptAdmins(prevVal);
      showToast('error', 'Cập nhật miễn trừ Quản trị viên thất bại', err?.message);
    }
  };

  const handleSaveBhxhConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('warning', 'Chỉ Quản trị viên mới có quyền cấu hình API BHXH');
      return;
    }
    const cleanBaseUrl = bhxhBaseUrl.trim() || 'https://egw.baohiemxahoi.gov.vn';
    const cleanUsername = bhxhUsername.trim();
    const cleanMaCskcb = bhxhDefaultMaCskcb.trim().toUpperCase();
    const cleanHoTenCb = bhxhDefaultHoTenCb.trim();
    const cleanCccdCb = bhxhDefaultCccdCb.replace(/\s+/g, '').trim();

    if (cleanCccdCb && !/^\d{12}$/.test(cleanCccdCb)) {
      showToast('error', 'Số CCCD cán bộ tra cứu (cccdCb) phải gồm đúng 12 chữ số.');
      return;
    }

    if (bhxhPassword.trim() && bhxhPasswordMode === 'md5' && !/^[a-fA-F0-9]{32}$/.test(bhxhPassword.trim())) {
      showToast('error', 'Mật khẩu chế độ MD5 phải gồm đúng 32 ký tự hex (0-9, A-F).');
      return;
    }

    setSavingBhxhConfig(true);
    try {
      const res = await saveBhxhAdminConfig({
        enabled: bhxhEnabled,
        baseUrl: cleanBaseUrl,
        lookupEndpoint: bhxhLookupEndpoint,
        username: cleanUsername,
        password: bhxhPassword.trim() ? bhxhPassword.trim() : undefined,
        passwordMode: bhxhPasswordMode,
        clearPassword: bhxhClearPassword,
        defaultMaCskcb: cleanMaCskcb,
        defaultHoTenCb: cleanHoTenCb,
        defaultCccdCb: cleanCccdCb,
        autoLookupFacilityName: bhxhAutoLookupFacility,
        showHistoryKcb: bhxhShowHistoryKcb,
      });

      const cfg = res.config;
      setBhxhHasPassword(cfg.hasPassword);
      setBhxhPassword('');
      setBhxhClearPassword(false);
      setBhxhDefaultHoTenCb(cfg.defaultHoTenCb || '');
      setBhxhDefaultCccdCb(cfg.defaultCccdCb || '');
      if (cleanMaCskcb && !testMaCskcb) {
        setTestMaCskcb(cleanMaCskcb);
      }
      if (cfg.defaultHoTenCb) setTestCardHoTenCb(cfg.defaultHoTenCb);
      if (cfg.defaultCccdCb) setTestCardCccdCb(cfg.defaultCccdCb);

      const maskedUser = cfg.username
        ? cfg.username.length > 4
          ? `${cfg.username.slice(0, 2)}***${cfg.username.slice(-2)}`
          : `${cfg.username.slice(0, 1)}***`
        : '';
      const nowIso = new Date().toISOString();

      await updateSystemSettings({
        bhxhApi: {
          enabled: cfg.enabled,
          baseUrl: cfg.baseUrl,
          lookupEndpoint: cfg.lookupEndpoint,
          defaultMaCskcb: cfg.defaultMaCskcb,
          usernameMasked: maskedUser,
          hasCredentials: Boolean(cfg.username && cfg.hasPassword),
          hasOfficerInfo: Boolean(cfg.defaultHoTenCb && /^\d{12}$/.test(cfg.defaultCccdCb || '')),
          autoLookupFacilityName: cfg.autoLookupFacilityName,
          showHistoryKcb: cfg.showHistoryKcb,
          updatedAt: nowIso,
        },
        updatedAt: nowIso,
      });

      await logAuditEvent(
        `Cấu hình API BHXH (${cfg.lookupEndpoint} · CV 1923/BHXH-CNTT)`,
        'API BHXH',
        `Trạng thái: ${cfg.enabled ? 'BẬT' : 'TẮT'} • Endpoint: ${cfg.lookupEndpoint} • Gateway: ${cfg.baseUrl} • Mã CSKCB: ${cfg.defaultMaCskcb || 'Chưa đặt'} • Cán bộ: ${cfg.defaultHoTenCb || 'Chưa đặt'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );

      showToast('success', 'Đã lưu cấu hình kết nối API BHXH chuẩn 2024 an toàn trên máy chủ');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lưu cấu hình API BHXH thất bại', err?.message);
    } finally {
      setSavingBhxhConfig(false);
    }
  };

  const handleToggleBhxhSettingImmediate = async (
    field: 'enabled' | 'autoLookupFacilityName' | 'showHistoryKcb'
  ) => {
    if (!isAdmin) {
      showToast('warning', 'Chỉ Quản trị viên mới có quyền cấu hình API BHXH');
      return;
    }
    if (bhxhLoadingConfig) {
      showToast('info', 'Đang đồng bộ cấu hình BHXH từ máy chủ, vui lòng đợi...');
      return;
    }
    const cleanBaseUrl = bhxhBaseUrl.trim() || 'https://egw.baohiemxahoi.gov.vn';
    const cleanUsername = bhxhUsername.trim();
    const cleanMaCskcb = bhxhDefaultMaCskcb.trim().toUpperCase();
    const cleanHoTenCb = bhxhDefaultHoTenCb.trim();
    const cleanCccdCb = bhxhDefaultCccdCb.replace(/\s+/g, '').trim();

    if (cleanCccdCb && !/^\d{12}$/.test(cleanCccdCb)) {
      showToast('error', 'Số CCCD cán bộ tra cứu (cccdCb) phải gồm đúng 12 chữ số.');
      return;
    }

    const prevState = {
      enabled: bhxhEnabled,
      autoLookupFacilityName: bhxhAutoLookupFacility,
      showHistoryKcb: bhxhShowHistoryKcb,
    };
    const nextValue = !prevState[field];
    const nextState = {
      ...prevState,
      [field]: nextValue,
    };

    if (field === 'enabled') setBhxhEnabled(nextValue);
    if (field === 'autoLookupFacilityName') setBhxhAutoLookupFacility(nextValue);
    if (field === 'showHistoryKcb') setBhxhShowHistoryKcb(nextValue);

    setSavingBhxhConfig(true);
    try {
      const res = await saveBhxhAdminConfig({
        enabled: nextState.enabled,
        baseUrl: cleanBaseUrl,
        lookupEndpoint: bhxhLookupEndpoint,
        username: cleanUsername,
        defaultMaCskcb: cleanMaCskcb,
        defaultHoTenCb: cleanHoTenCb,
        defaultCccdCb: cleanCccdCb,
        autoLookupFacilityName: nextState.autoLookupFacilityName,
        showHistoryKcb: nextState.showHistoryKcb,
      });

      const cfg = res.config;
      const maskedUser = cfg.username
        ? cfg.username.length > 4
          ? `${cfg.username.slice(0, 2)}***${cfg.username.slice(-2)}`
          : `${cfg.username.slice(0, 1)}***`
        : '';
      const nowIso = new Date().toISOString();

      await updateSystemSettings({
        bhxhApi: {
          enabled: cfg.enabled,
          baseUrl: cfg.baseUrl,
          lookupEndpoint: cfg.lookupEndpoint,
          defaultMaCskcb: cfg.defaultMaCskcb,
          usernameMasked: maskedUser,
          hasCredentials: Boolean(cfg.username && cfg.hasPassword),
          hasOfficerInfo: Boolean(cfg.defaultHoTenCb && /^\d{12}$/.test(cfg.defaultCccdCb || '')),
          autoLookupFacilityName: cfg.autoLookupFacilityName,
          showHistoryKcb: cfg.showHistoryKcb,
          updatedAt: nowIso,
        },
        updatedAt: nowIso,
      });

      const fieldLabel =
        field === 'enabled'
          ? 'Tra cứu API BHXH'
          : field === 'autoLookupFacilityName'
          ? 'Tự động lấy tên CSKCB ban đầu'
          : 'Hiển thị lịch sử KCB';

      await logAuditEvent(
        `${nextValue ? 'Bật' : 'Tắt'} ${fieldLabel} (BHXH)`,
        'API BHXH',
        `${fieldLabel}: ${nextValue ? 'BẬT' : 'TẮT'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );

      showToast(
        nextValue ? 'success' : 'info',
        nextValue ? `Đã BẬT ${fieldLabel}` : `Đã TẮT ${fieldLabel}`
      );
      onRefreshData();
    } catch (err: any) {
      if (field === 'enabled') setBhxhEnabled(prevState.enabled);
      if (field === 'autoLookupFacilityName') setBhxhAutoLookupFacility(prevState.autoLookupFacilityName);
      if (field === 'showHistoryKcb') setBhxhShowHistoryKcb(prevState.showHistoryKcb);
      showToast('error', 'Cập nhật cấu hình API BHXH thất bại', err?.message);
    } finally {
      setSavingBhxhConfig(false);
    }
  };

  const handleTestBhxhToken = async () => {
    setTestingBhxhApi(true);
    const t0 = performance.now();
    try {
      const res = await testBhxhTokenConnection();
      const durationMs = Math.round(performance.now() - t0);
      setBhxhApiCallResult({
        endpoint: 'POST /api/token/take',
        ok: true,
        durationMs,
        calledAt: new Date().toLocaleTimeString('vi-VN'),
        summaryTitle: res.message || 'Xác thực Token thành công',
        summaryDetails: [
          `maKetQua: ${res.maKetQua || '200'}`,
          `username: ${res.username || '—'}`,
          `expires_in: ${res.expiresIn || '—'}`,
        ],
        payload: res,
      });
      showToast('success', 'Call API /api/token/take thành công', `${durationMs} ms`);
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - t0);
      const msg = err?.message || 'Không thể lấy Token từ cổng BHXH.';
      setBhxhApiCallResult({
        endpoint: 'POST /api/token/take',
        ok: false,
        durationMs,
        calledAt: new Date().toLocaleTimeString('vi-VN'),
        summaryTitle: msg,
        summaryDetails: [],
        payload: { ok: false, error: msg },
      });
      showToast('error', 'Call API /api/token/take thất bại', msg);
    } finally {
      setTestingBhxhApi(false);
    }
  };

  const handleTestBhxhCskcb = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = (testMaCskcb || bhxhDefaultMaCskcb).trim().toUpperCase();
    if (!code) {
      showToast('warning', 'Vui lòng nhập Mã CSKCB cần kiểm tra');
      return;
    }
    setTestingBhxhApi(true);
    const t0 = performance.now();
    try {
      const res = await lookupBhxhFacility(code);
      const durationMs = Math.round(performance.now() - t0);
      const d = res.data;
      const isOkCode = String(d?.maketqua ?? '') === '200';
      setBhxhApiCallResult({
        endpoint: `POST /api/egw/NhanThongTinCSKCB (macskcb=${code})`,
        ok: isOkCode,
        durationMs,
        calledAt: new Date().toLocaleTimeString('vi-VN'),
        summaryTitle: d?.ten || d?.message || `Kết quả mã ${d?.maketqua || '—'}`,
        summaryDetails: [
          `maketqua: ${d?.maketqua || '—'}`,
          `Hạng: ${describeBhxhHang(d?.hang)}`,
          `Tuyến: ${describeBhxhTuyen(d?.tuyen)}`,
          `Hiệu lực: ${String(d?.hieuluc) === '1' ? 'Còn hiệu lực (1)' : 'Ngừng (0)'}`,
          ...(d?.diachi ? [`Địa chỉ: ${d.diachi}`] : []),
        ],
        payload: res,
      });
      showToast(
        isOkCode ? 'success' : 'warning',
        `CSKCB ${code} (${durationMs} ms)`,
        d?.ten || d?.message
      );
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - t0);
      const msg = err?.message || 'Không thể tra cứu Cơ sở KCB.';
      setBhxhApiCallResult({
        endpoint: `POST /api/egw/NhanThongTinCSKCB (macskcb=${code})`,
        ok: false,
        durationMs,
        calledAt: new Date().toLocaleTimeString('vi-VN'),
        summaryTitle: msg,
        summaryDetails: [],
        payload: { ok: false, error: msg },
      });
      showToast('error', 'Call API CSKCB thất bại', msg);
    } finally {
      setTestingBhxhApi(false);
    }
  };

  const handleTestBhxhCardLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = testCardMaThe.trim().toUpperCase();
    const cleanName = testCardHoTen.trim();
    const normDob = normalizeBhxhDobInput(testCardNgaySinh);
    const cleanHoTenCb = (testCardHoTenCb || bhxhDefaultHoTenCb).trim();
    const cleanCccdCb = (testCardCccdCb || bhxhDefaultCccdCb).replace(/\s+/g, '').trim();
    const is2024 = bhxhLookupEndpoint === 'KQNhanLichSuKCB2024' || bhxhLookupEndpoint === 'NhanLichSuKCB2024';

    if (!cleanId || !cleanName || !normDob) {
      showToast('warning', 'Vui lòng nhập đủ Số CCCD/Mã thẻ, Họ tên và Ngày sinh');
      return;
    }
    if (!isValidBhxhDob(normDob)) {
      showToast('warning', 'Ngày sinh phải có dạng DD/MM/YYYY hoặc YYYY');
      return;
    }
    if (is2024 && (!cleanHoTenCb || !/^\d{12}$/.test(cleanCccdCb))) {
      showToast(
        'warning',
        `Hàm ${bhxhLookupEndpoint} yêu cầu Họ tên cán bộ (hoTenCb) và CCCD 12 số của cán bộ (cccdCb)`
      );
      return;
    }

    setTestCardNgaySinh(normDob);
    setTestingBhxhApi(true);
    const t0 = performance.now();
    const endpointLabel = `POST /api/egw/${bhxhLookupEndpoint}`;
    try {
      const res = await lookupBhxhCard({
        maThe: cleanId,
        hoTen: cleanName,
        ngaySinh: normDob,
        ...(is2024 ? { hoTenCb: cleanHoTenCb, cccdCb: cleanCccdCb } : {}),
      });
      const durationMs = Math.round(performance.now() - t0);
      const d = res.data;
      const isValid = d.statusInfo?.severity === 'valid' || d.statusInfo?.severity === 'warning';
      const historyCount = getNormalizedBhxhHistoryKcb(d).length;
      setBhxhApiCallResult({
        endpoint: `POST /api/egw/${d.endpointUsed || bhxhLookupEndpoint}`,
        ok: isValid,
        durationMs,
        calledAt: new Date().toLocaleTimeString('vi-VN'),
        summaryTitle: `maKetQua ${d.maKetQua || '—'}: ${d.statusInfo?.description || d.ghiChu || 'Đã nhận phản hồi'}`,
        summaryDetails: [
          `Họ tên: ${d.hoTen || cleanName}`,
          `Mã thẻ: ${d.maThe || '—'}`,
          `Hạn thẻ: ${d.gtTheTu || '—'} → ${d.gtTheDen || '—'}`,
          `ĐKKCB: ${d.dkbdFacility?.ten ? `${d.dkbdFacility.ten} (${d.maDKBD})` : d.maDKBD || '—'}`,
          `Lịch sử KCB: ${historyCount} lượt`,
        ],
        payload: res,
      });
      showToast(
        isValid ? 'success' : 'info',
        `API ${d.endpointUsed || bhxhLookupEndpoint}: mã ${d.maKetQua} (${durationMs} ms)`,
        d.statusInfo?.description
      );
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - t0);
      const msg = err?.message || `Call API ${bhxhLookupEndpoint} thất bại.`;
      setBhxhApiCallResult({
        endpoint: endpointLabel,
        ok: false,
        durationMs,
        calledAt: new Date().toLocaleTimeString('vi-VN'),
        summaryTitle: msg,
        summaryDetails: [],
        payload: { ok: false, error: msg },
      });
      showToast('error', `Call API ${bhxhLookupEndpoint} thất bại`, msg);
    } finally {
      setTestingBhxhApi(false);
    }
  };

  const handleToggleMaintenanceImmediate = async (nextValue: boolean) => {
    const prevValue = maintenanceMode;
    setMaintenanceMode(nextValue);
    try {
      await updateSystemSettings({
        maintenanceMode: nextValue,
        maintenanceMessage: maintenanceMessage.trim(),
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        nextValue ? 'Bật Bảo trì Toàn hệ thống' : 'Tắt Bảo trì Toàn hệ thống',
        'Hệ thống',
        `Bảo trì tổng: ${nextValue ? 'BẬT' : 'TẮT'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        nextValue ? 'Đã BẬT Bảo trì Toàn hệ thống' : 'Đã TẮT Bảo trì Toàn hệ thống'
      );
    } catch (err: any) {
      setMaintenanceMode(prevValue);
      showToast('error', 'Cập nhật trạng thái bảo trì thất bại', err?.message);
    }
  };

  const handleToggleCccdLookupImmediate = async (nextValue: boolean) => {
    const prevValue = cccdLookupEnabled;
    setCccdLookupEnabled(nextValue);
    try {
      await updateSystemSettings({
        cccdLookupEnabled: nextValue,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        nextValue
          ? 'Bật Tra cứu CCCD tự động (Kho dữ liệu dân cư)'
          : 'Tắt Tra cứu CCCD tự động (Chế độ nhập thủ công bảo mật)',
        'Bảo mật & Hệ thống',
        `Tra cứu CCCD: ${nextValue ? 'BẬT' : 'TẮT (Điền thủ công, khóa tự động quét)'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        nextValue ? 'success' : 'warning',
        nextValue
          ? 'Đã BẬT tính năng Tra cứu CCCD'
          : 'Đã TẮT Tra cứu CCCD — Chuyển sang điền thủ công bảo mật'
      );
      onRefreshData();
    } catch (err: any) {
      setCccdLookupEnabled(prevValue);
      showToast('error', 'Cập nhật cấu hình Tra cứu CCCD thất bại', err?.message);
    }
  };

  const handleToggleEpidemicMapButtonImmediate = async (nextValue: boolean) => {
    const prevValue = epidemicMapButtonVisible;
    setEpidemicMapButtonVisible(nextValue);
    try {
      await updateSystemSettings({
        epidemicMapButtonVisible: nextValue,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        nextValue
          ? 'Hiện nút Xem bản đồ dịch bệnh cho tất cả đối tượng'
          : 'Ẩn nút Xem bản đồ dịch bệnh cho tất cả đối tượng',
        'Bản đồ & Dịch tễ',
        `Nút Xem bản đồ dịch bệnh: ${nextValue ? 'HIỆN (tất cả đối tượng)' : 'ẨN (tất cả đối tượng)'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        nextValue ? 'success' : 'warning',
        nextValue
          ? 'Đã HIỆN nút "Xem bản đồ dịch bệnh" cho tất cả đối tượng'
          : 'Đã ẨN nút "Xem bản đồ dịch bệnh" cho tất cả đối tượng'
      );
      onRefreshData();
    } catch (err: any) {
      setEpidemicMapButtonVisible(prevValue);
      showToast('error', 'Cập nhật hiển thị Bản đồ dịch bệnh thất bại', err?.message);
    }
  };

  const handleDeleteAdminEpidemicCase = async (c: EpidemicCase) => {
    setDeletingAdminEpidemicId(c.id);
    try {
      await deleteEpidemicCase(c.id);
      await logAuditEvent(
        'Xóa điểm khoanh vùng dịch bệnh',
        'Bản đồ & Dịch tễ',
        `Xóa ${getEpidemicDiseaseConfig(c.diseaseType).label} (${c.radiusMeters}m) tại ${c.fullAddress}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', 'Đã xóa điểm dịch bệnh');
    } catch (err: any) {
      showToast('error', 'Xóa điểm dịch bệnh thất bại', err?.message);
    } finally {
      setDeletingAdminEpidemicId(null);
    }
  };

  const handleSaveWifiRestriction = async (enabled: boolean, ipsText: string, msg: string) => {
    const prevEnabled = wifiRestrictionEnabled;
    setWifiRestrictionEnabled(enabled);
    try {
      const allowedIps = ipsText
        .split(/[,;\n]/)
        .map(s => s.trim())
        .filter(Boolean);

      await updateSystemSettings({
        wifiIpRestriction: {
          enabled,
          allowedIps,
          message: msg.trim(),
        },
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        enabled ? 'Bật Giới hạn truy cập WiFi nội bộ' : 'Tắt Giới hạn truy cập WiFi nội bộ',
        'Hệ thống',
        `WiFi IP Restriction: ${enabled ? 'BẬT' : 'TẮT'} (IPS: ${allowedIps.join(', ')})`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', 'Đã lưu cấu hình giới hạn IP / WiFi nội bộ thành công');
    } catch (err: any) {
      setWifiRestrictionEnabled(prevEnabled);
      showToast('error', 'Không thể lưu cấu hình WiFi', err?.message);
    }
  };

  const handleToggleHiddenTabImmediate = async (tabId: string, tabLabel: string) => {
    const prevHidden = hiddenTabs;
    const isCurrentlyHidden = prevHidden.includes(tabId);
    const nextHidden = isCurrentlyHidden
      ? prevHidden.filter(item => item !== tabId)
      : [...prevHidden, tabId];
    setHiddenTabs(nextHidden);
    try {
      await updateSystemSettings({
        hiddenTabs: nextHidden,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        isCurrentlyHidden ? 'Hiện Tab Sidebar' : 'Ẩn Tab Sidebar',
        'Hệ thống',
        `Tab "${tabLabel}" (${tabId}): ${isCurrentlyHidden ? 'Đang hiện' : 'Đang ẩn'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        `Tab "${tabLabel}": ${isCurrentlyHidden ? 'Đã hiển thị' : 'Đã tạm ẩn'}`
      );
    } catch (err: any) {
      setHiddenTabs(prevHidden);
      showToast('error', 'Cập nhật hiển thị tab thất bại', err?.message);
    }
  };

  const handleToggleTabMaintenanceImmediate = async (tabId: string, tabLabel: string) => {
    const prevMap = tabMaintenance;
    const nextMaint = !prevMap[tabId];
    const nextMap = {
      ...prevMap,
      [tabId]: nextMaint,
    };
    setTabMaintenance(nextMap);
    try {
      await updateSystemSettings({
        tabMaintenance: nextMap,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent(
        nextMaint ? 'Bật Bảo trì lẻ phân hệ' : 'Tắt Bảo trì lẻ phân hệ',
        'Hệ thống',
        `Phân hệ "${tabLabel}" (${tabId}): ${nextMaint ? 'Đang bảo trì' : 'Bình thường'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        `Phân hệ "${tabLabel}": ${nextMaint ? 'Đang bảo trì' : 'Hoạt động bình thường'}`
      );
    } catch (err: any) {
      setTabMaintenance(prevMap);
      showToast('error', 'Cập nhật bảo trì phân hệ thất bại', err?.message);
    }
  };

  const handleToggleSidebarColorImmediate = async (target: 'public' | 'admin') => {
    const prevPublic = publicSidebarColored;
    const prevAdmin = adminSidebarColored;
    const nextPublic = target === 'public' ? !prevPublic : prevPublic;
    const nextAdmin = target === 'admin' ? !prevAdmin : prevAdmin;
    setPublicSidebarColored(nextPublic);
    setAdminSidebarColored(nextAdmin);
    const now = new Date().toISOString();
    const nextConfig: SidebarColorsConfig = {
      publicEnabled: nextPublic,
      adminEnabled: nextAdmin,
      updatedAt: now,
    };
    try {
      await updateSystemSettings({
        sidebarColors: nextConfig,
        updatedAt: now,
      });
      const label = target === 'public' ? 'Sidebar Cổng thông tin' : 'Sidebar Trang Quản trị (Admin)';
      const isEnabled = target === 'public' ? nextPublic : nextAdmin;
      await logAuditEvent(
        'Cập nhật Màu sắc Sidebar',
        'Hệ thống',
        `${label}: ${isEnabled ? 'BẬT màu phân nhóm' : 'TẮT (về mặc định)'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        `${label}: ${isEnabled ? 'Đã bật màu sắc phân nhóm' : 'Đã tắt về màu mặc định'}`
      );
    } catch (err: any) {
      setPublicSidebarColored(prevPublic);
      setAdminSidebarColored(prevAdmin);
      showToast('error', 'Cập nhật màu sắc Sidebar thất bại', err?.message);
    }
  };

  const handleSetAuthProviderStatusImmediate = async (
    providerId: AuthProviderId,
    nextStatus: AuthProviderStatus
  ) => {
    const prevMap = authProvidersMap;
    if (prevMap[providerId] === nextStatus) return;
    const nextMap: AuthProvidersStatusMap = {
      ...prevMap,
      [providerId]: nextStatus,
    };
    setAuthProvidersMap(nextMap);
    const now = new Date().toISOString();
    const providerLabel =
      AUTH_PROVIDER_CATALOG.find(item => item.id === providerId)?.label || providerId;
    const statusLabel =
      nextStatus === 'enabled' ? 'BẬT' : nextStatus === 'maintenance' ? 'BẢO TRÌ' : 'TẮT (ẨN)';
    try {
      await updateSystemSettings({
        authProvidersConfig: {
          providers: nextMap,
          updatedAt: now,
        },
        updatedAt: now,
      });
      await logAuditEvent(
        'Cập nhật Phương thức Đăng nhập',
        'Hệ thống',
        `${providerLabel} (${providerId}) → ${statusLabel}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      if (nextStatus === 'enabled' && providerId !== 'qr') {
        showToast(
          'success',
          `${providerLabel}: Đã chuyển sang ${statusLabel}`,
          `Lưu ý: Hãy truy cập ${firebaseAuthProvidersUrl} để bật nhà cung cấp này trên Firebase Console.`
        );
      } else {
        showToast('success', `${providerLabel}: Đã chuyển sang ${statusLabel}`);
      }
    } catch (err: any) {
      setAuthProvidersMap(prevMap);
      showToast('error', 'Cập nhật phương thức đăng nhập thất bại', err?.message);
    }
  };

  const handleSaveBusinessTripConfig = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isAdmin) return;
    setSavingTripConfig(true);
    const now = new Date().toISOString();
    const payload: BusinessTripConfig = {
      enabled: tripConfigEnabled,
      sectionTitle: tripSectionTitle.trim() || 'Lịch Công Tác',
      sectionSubtitle: tripSectionSubtitle.trim(),
      defaultFilter: tripDefaultFilter,
      hidePastForCitizens: tripHidePastForCitizens,
      updatedAt: now,
    };
    try {
      await updateSystemSettings({
        businessTripConfig: payload,
        updatedAt: now,
      });
      await logAuditEvent(
        'Cấu hình Lịch Công Tác',
        'Lịch công tác',
        `Trạng thái: ${tripConfigEnabled ? 'BẬT' : 'TẮT'} · Bộ lọc: ${tripDefaultFilter} · Ẩn lịch cũ: ${
          tripHidePastForCitizens ? 'Có' : 'Không'
        }`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', 'Đã lưu cấu hình Lịch công tác');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lưu cấu hình Lịch công tác thất bại', err?.message);
    } finally {
      setSavingTripConfig(false);
    }
  };

  const handleToggleBusinessTripFieldImmediate = async (
    field: 'enabled' | 'hidePastForCitizens'
  ) => {
    if (!isAdmin) return;
    const prevEnabled = tripConfigEnabled;
    const prevHidePast = tripHidePastForCitizens;
    const nextEnabled = field === 'enabled' ? !prevEnabled : prevEnabled;
    const nextHidePast = field === 'hidePastForCitizens' ? !prevHidePast : prevHidePast;

    if (field === 'enabled') setTripConfigEnabled(nextEnabled);
    if (field === 'hidePastForCitizens') setTripHidePastForCitizens(nextHidePast);

    const now = new Date().toISOString();
    const payload: BusinessTripConfig = {
      enabled: nextEnabled,
      sectionTitle: tripSectionTitle.trim() || 'Lịch Công Tác',
      sectionSubtitle: tripSectionSubtitle.trim(),
      defaultFilter: tripDefaultFilter,
      hidePastForCitizens: nextHidePast,
      updatedAt: now,
    };

    try {
      await updateSystemSettings({
        businessTripConfig: payload,
        updatedAt: now,
      });
      await logAuditEvent(
        'Cập nhật nhanh Lịch Công Tác',
        'Lịch công tác',
        `Trạng thái: ${nextEnabled ? 'BẬT' : 'TẮT'} · Ẩn lịch cũ: ${nextHidePast ? 'Có' : 'Không'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        field === 'enabled'
          ? nextEnabled
            ? 'Đã BẬT hiển thị mục Lịch công tác'
            : 'Đã TẮT hiển thị mục Lịch công tác'
          : nextHidePast
          ? 'Đã BẬT ẩn lịch công tác cũ với người dân'
          : 'Đã TẮT ẩn lịch công tác cũ với người dân'
      );
      onRefreshData();
    } catch (err: any) {
      setTripConfigEnabled(prevEnabled);
      setTripHidePastForCitizens(prevHidePast);
      showToast('error', 'Cập nhật cấu hình Lịch công tác thất bại', err?.message);
    }
  };

  const handleSaveRolePermissions = async (
    nextConfig: RolePermissionsConfig,
    summaryLabel = 'Cập nhật cấu hình phân quyền theo đối tượng'
  ) => {
    const prevConfig = rolePermissions;
    const normalized: RolePermissionsConfig = {
      ...nextConfig,
      super_admin: { fullAccess: true },
      updatedAt: new Date().toISOString(),
      updatedByUid: currentUser?.uid,
    };
    setRolePermissions(normalized);
    setSavingRolePerms(true);
    try {
      await updateSystemSettings({
        rolePermissions: normalized,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent('Phân quyền theo đối tượng', 'Hệ thống', summaryLabel, {
        uid: currentUser?.uid || 'admin',
        name: userProfile?.displayName || 'Admin',
      });
      showToast('success', 'Đã lưu phân quyền đối tượng', summaryLabel);
    } catch (err: any) {
      setRolePermissions(prevConfig);
      showToast('error', 'Không thể lưu phân quyền', err?.message);
    } finally {
      setSavingRolePerms(false);
    }
  };

  const persistVaccinationSchedules = async (
    updatedList: VaccinationScheduleItem[],
    auditDetails: string
  ) => {
    if (!isAdmin) {
      showToast('warning', 'Chỉ Quản trị viên mới có quyền thiết lập Lịch tiêm chủng');
      return;
    }
    setSavingVaccination(true);
    try {
      const sortedList = sortVaccinationSchedules(updatedList);
      await updateSystemSettings({
        vaccinationSchedules: sortedList,
        updatedAt: new Date().toISOString(),
      });
      await logAuditEvent('Cấu hình Lịch Tiêm Chủng', 'Tiêm chủng', auditDetails, {
        uid: currentUser?.uid || 'admin',
        name: userProfile?.displayName || 'Admin',
      });
      setVaccinationSchedulesList(sortedList);
      showToast('success', 'Đã lưu lịch tiêm chủng lên cổng thông tin');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lỗi khi lưu lịch tiêm chủng', err?.message);
    } finally {
      setSavingVaccination(false);
    }
  };

  const getStationLocationOptions = () => {
    const sortedMap = sortLocationsPrimaryFirst(mapLocationsList);
    if (sortedMap.length > 0) {
      return sortedMap.map(loc => {
        const value = `${loc.name}${loc.address ? ` (${loc.address})` : ''}`;
        return {
          id: loc.id,
          value,
          label: `${loc.isPrimary ? '[Điểm chính] ' : '[Điểm phụ] '}${loc.name}${
            loc.address ? ` — ${loc.address}` : ''
          }`,
        };
      });
    }
    const fallbackName =
      settings.stationName && !settings.stationName.includes('Chưa cấu hình')
        ? settings.stationName
        : 'Trụ sở chính Trạm Y tế';
    return [{ id: 'primary_default', value: fallbackName, label: `[Điểm chính] ${fallbackName}` }];
  };

  const openAddVaccinationModal = () => {
    const options = getStationLocationOptions();
    const defaultStationLocation = options[0]?.value || 'Trụ sở chính Trạm Y tế';
    const todayStr = new Date().toISOString().split('T')[0];

    setEditingVaccination(null);
    setVacTitle('Lịch Tiêm Chủng Mở Rộng Định Kỳ');
    setVacProgramType('expanded');
    setVacDate(todayStr);
    setVacEndDate(todayStr);
    setVacCreateMode('range');
    setVacDateLabel('');
    setVacStartTime(DEFAULT_VACCINATION_START_TIME);
    setVacEndTime(DEFAULT_VACCINATION_END_TIME);
    setVacTimeRange(`${DEFAULT_VACCINATION_START_TIME} - ${DEFAULT_VACCINATION_END_TIME}`);
    setVacLocation(defaultStationLocation);
    setVacCustomLocationMode(false);
    setVacSecondaryLocationsText('');
    setVacTargetAudience(DEFAULT_VACCINATION_AUDIENCE);
    setVacVaccines(DEFAULT_VACCINATION_VACCINES);
    setVacNotes(DEFAULT_VACCINATION_NOTES);
    setVacStatus('upcoming');
    setVacIsPinned(true);
    setVacIsActive(true);
    setShowVaccinationModal(true);
  };

  const openEditVaccinationModal = (item: VaccinationScheduleItem) => {
    const start = item.date || new Date().toISOString().split('T')[0];
    const timeMatches = (item.timeRange || '').match(/\b\d{1,2}:\d{2}\b/g);
    const inferredStart =
      item.startTime ||
      (timeMatches?.[0] ? timeMatches[0].padStart(5, '0') : DEFAULT_VACCINATION_START_TIME);
    const inferredEnd =
      item.endTime ||
      (timeMatches && timeMatches.length > 0
        ? timeMatches[timeMatches.length - 1].padStart(5, '0')
        : DEFAULT_VACCINATION_END_TIME);

    const options = getStationLocationOptions();
    const locVal = item.location || '';
    const matchesOption = options.some(o => o.value === locVal);

    setEditingVaccination(item);
    setVacTitle(item.title);
    setVacProgramType(item.programType);
    setVacDate(start);
    setVacEndDate(item.endDate && item.endDate >= start ? item.endDate : start);
    setVacCreateMode('range');
    setVacDateLabel(item.dateLabel || '');
    setVacStartTime(inferredStart);
    setVacEndTime(inferredEnd);
    setVacTimeRange(`${inferredStart} - ${inferredEnd}`);
    setVacLocation(locVal || options[0]?.value || '');
    setVacCustomLocationMode(Boolean(locVal) && !matchesOption);
    setVacSecondaryLocationsText((item.secondaryLocations || []).join('\n'));
    setVacTargetAudience(item.targetAudience || DEFAULT_VACCINATION_AUDIENCE);
    setVacVaccines(item.vaccines || DEFAULT_VACCINATION_VACCINES);
    setVacNotes(item.notes || DEFAULT_VACCINATION_NOTES);
    setVacStatus(item.status || 'upcoming');
    setVacIsPinned(!!item.isPinned);
    setVacIsActive(item.isActive !== false);
    setShowVaccinationModal(true);
  };

  const handleCopyVaccinationSchedule = (item: VaccinationScheduleItem) => {
    const start = item.date || new Date().toISOString().split('T')[0];
    const timeMatches = (item.timeRange || '').match(/\b\d{1,2}:\d{2}\b/g);
    const inferredStart =
      item.startTime ||
      (timeMatches?.[0] ? timeMatches[0].padStart(5, '0') : DEFAULT_VACCINATION_START_TIME);
    const inferredEnd =
      item.endTime ||
      (timeMatches && timeMatches.length > 0
        ? timeMatches[timeMatches.length - 1].padStart(5, '0')
        : DEFAULT_VACCINATION_END_TIME);

    const options = getStationLocationOptions();
    const nextOption = options.find(o => o.value !== item.location) || options[0];

    setEditingVaccination(null); // CRITICAL: creates a NEW independent schedule item
    setVacTitle(item.title);
    setVacProgramType(item.programType);
    setVacDate(start);
    setVacEndDate(item.endDate && item.endDate >= start ? item.endDate : start);
    setVacCreateMode('range');
    setVacDateLabel('');
    setVacStartTime(inferredStart);
    setVacEndTime(inferredEnd);
    setVacTimeRange(`${inferredStart} - ${inferredEnd}`);
    setVacLocation(nextOption?.value || '');
    setVacCustomLocationMode(!nextOption);
    setVacSecondaryLocationsText('');
    setVacTargetAudience(item.targetAudience || DEFAULT_VACCINATION_AUDIENCE);
    setVacVaccines(item.vaccines || DEFAULT_VACCINATION_VACCINES);
    setVacNotes(item.notes || DEFAULT_VACCINATION_NOTES);
    setVacStatus(item.status === 'postponed' ? 'postponed' : 'upcoming');
    setVacIsPinned(false);
    setVacIsActive(true);
    setShowVaccinationModal(true);
    showToast(
      'info',
      'Đã sao chép lịch tiêm',
      'Chọn điểm tiêm tiếp theo từ danh sách và điều chỉnh ngày giờ riêng (hoạt động độc lập).'
    );
  };

  const handleSaveVaccinationSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacTitle.trim() || !vacLocation.trim()) {
      showToast('warning', 'Vui lòng điền đầy đủ Tiêu đề và chọn Điểm tiêm');
      return;
    }

    const nowIso = new Date().toISOString();
    const startDate = vacDate || nowIso.split('T')[0];
    const normalizedEndDate = vacEndDate && vacEndDate.trim() ? vacEndDate.trim() : startDate;

    if (normalizedEndDate < startDate) {
      showToast('warning', 'Ngày kết thúc (Đến ngày) không được nhỏ hơn Ngày bắt đầu (Từ ngày)');
      return;
    }

    const isMultiDay = normalizedEndDate > startDate;
    const cleanStartTime = vacStartTime.trim() || DEFAULT_VACCINATION_START_TIME;
    const cleanEndTime = vacEndTime.trim() || DEFAULT_VACCINATION_END_TIME;
    const resolvedTimeRange = `${cleanStartTime} - ${cleanEndTime}`;
    const resolvedAudience = vacTargetAudience.trim() || DEFAULT_VACCINATION_AUDIENCE;
    const resolvedVaccines = vacVaccines.trim() || DEFAULT_VACCINATION_VACCINES;
    const resolvedNotes = vacNotes.trim() || DEFAULT_VACCINATION_NOTES;

    if (!editingVaccination && isMultiDay && vacCreateMode === 'daily_split') {
      const dates = enumerateDateRange(startDate, normalizedEndDate, 31);
      const newRecords: VaccinationScheduleItem[] = dates.map((d, index) => {
        const autoStatus = resolveVaccinationLifecycle({
          date: d,
          startTime: cleanStartTime,
          endTime: cleanEndTime,
          timeRange: resolvedTimeRange,
          status: vacStatus === 'postponed' ? 'postponed' : 'upcoming',
        }).effectiveStatus;

        return {
          id: `vac_${Date.now()}_${index}`,
          title: vacTitle.trim(),
          programType: vacProgramType,
          date: d,
          startTime: cleanStartTime,
          endTime: cleanEndTime,
          timeRange: resolvedTimeRange,
          location: vacLocation.trim(),
          targetAudience: resolvedAudience,
          vaccines: resolvedVaccines,
          notes: resolvedNotes,
          status: autoStatus,
          isPinned: vacIsPinned,
          isActive: vacIsActive,
          updatedAt: nowIso,
        };
      });

      await persistVaccinationSchedules(
        [...vaccinationSchedulesList, ...newRecords],
        `Tạo đồng loạt ${newRecords.length} lịch tiêm (${formatIsoDateVN(startDate)} - ${formatIsoDateVN(normalizedEndDate)}): ${vacTitle.trim()}`
      );
      setShowVaccinationModal(false);
      setEditingVaccination(null);
      return;
    }

    const autoStatus = resolveVaccinationLifecycle({
      date: startDate,
      endDate: isMultiDay ? normalizedEndDate : undefined,
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      timeRange: resolvedTimeRange,
      status: vacStatus === 'postponed' ? 'postponed' : 'upcoming',
    }).effectiveStatus;

    const record: VaccinationScheduleItem = {
      id: editingVaccination ? editingVaccination.id : `vac_${Date.now()}`,
      title: vacTitle.trim(),
      programType: vacProgramType,
      date: startDate,
      endDate: isMultiDay ? normalizedEndDate : undefined,
      startTime: cleanStartTime,
      endTime: cleanEndTime,
      timeRange: resolvedTimeRange,
      location: vacLocation.trim(),
      targetAudience: resolvedAudience,
      vaccines: resolvedVaccines,
      notes: resolvedNotes,
      status: autoStatus,
      isPinned: vacIsPinned,
      isActive: vacIsActive,
      updatedAt: nowIso,
    };

    const updated = editingVaccination
      ? vaccinationSchedulesList.map(item => (item.id === editingVaccination.id ? record : item))
      : [...vaccinationSchedulesList, record];

    await persistVaccinationSchedules(
      updated,
      editingVaccination
        ? `Cập nhật lịch tiêm: ${record.title}`
        : `Thêm mới lịch tiêm: ${record.title}`
    );
    setShowVaccinationModal(false);
    setEditingVaccination(null);
  };

  const handleSaveStartupPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('warning', 'Chỉ Quản trị viên mới có quyền cấu hình Thông báo bình thường');
      return;
    }
    setSavingPopup(true);
    try {
      const nowIso = new Date().toISOString();
      const startupPopupPayload: StartupPopupConfig = {
        enabled: popupEnabled,
        noticeType: popupNoticeType,
        title: popupTitle.trim() || 'Thông báo từ Trạm Y Tế',
        message: popupMessage.trim(),
        includeTopVaccination: false,
        ctaView: popupCtaView,
        ctaLabel: popupCtaLabel.trim(),
        frequency: popupFrequency,
        updatedAt: nowIso,
      };
      await updateSystemSettings({
        bannerNotice: bannerNotice.trim(),
        bannerNoticeEnabled,
        startupPopup: startupPopupPayload,
        updatedAt: nowIso,
      });
      await logAuditEvent(
        'Cập nhật Thông báo bình thường (Đầu trang & Pop-up)',
        'Tiêm chủng & Thông báo',
        `Banner: ${bannerNoticeEnabled ? 'BẬT' : 'TẮT'} • Pop-up (${popupNoticeType}): ${popupEnabled ? 'BẬT' : 'TẮT'} • Tần suất: ${popupFrequency}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', 'Đã lưu cấu hình Thông báo bình thường (Đầu trang & Pop-up)');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lưu thông báo bình thường thất bại', err?.message);
    } finally {
      setSavingPopup(false);
    }
  };

  const handleToggleStartupNoticeImmediate = async (
    field: 'bannerNoticeEnabled' | 'popupEnabled'
  ) => {
    if (!isAdmin) {
      showToast('warning', 'Chỉ Quản trị viên mới có quyền cấu hình Thông báo bình thường');
      return;
    }
    const prevBanner = bannerNoticeEnabled;
    const prevPopup = popupEnabled;
    const nextBanner = field === 'bannerNoticeEnabled' ? !prevBanner : prevBanner;
    const nextPopup = field === 'popupEnabled' ? !prevPopup : prevPopup;

    if (field === 'bannerNoticeEnabled') setBannerNoticeEnabled(nextBanner);
    if (field === 'popupEnabled') setPopupEnabled(nextPopup);

    try {
      const nowIso = new Date().toISOString();
      const startupPopupPayload: StartupPopupConfig = {
        enabled: nextPopup,
        noticeType: popupNoticeType,
        title: popupTitle.trim() || 'Thông báo từ Trạm Y Tế',
        message: popupMessage.trim(),
        includeTopVaccination: false,
        ctaView: popupCtaView,
        ctaLabel: popupCtaLabel.trim(),
        frequency: popupFrequency,
        updatedAt: nowIso,
      };
      await updateSystemSettings({
        bannerNotice: bannerNotice.trim(),
        bannerNoticeEnabled: nextBanner,
        startupPopup: startupPopupPayload,
        updatedAt: nowIso,
      });
      await logAuditEvent(
        field === 'bannerNoticeEnabled'
          ? `${nextBanner ? 'Bật' : 'Tắt'} Banner thông báo bình thường`
          : `${nextPopup ? 'Bật' : 'Tắt'} Pop-up thông báo bình thường`,
        'Tiêm chủng & Thông báo',
        `Banner: ${nextBanner ? 'BẬT' : 'TẮT'} • Pop-up: ${nextPopup ? 'BẬT' : 'TẮT'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        field === 'bannerNoticeEnabled'
          ? nextBanner
            ? 'Đã BẬT thanh thông báo đầu trang'
            : 'Đã TẮT thanh thông báo đầu trang'
          : nextPopup
          ? 'Đã BẬT Pop-up thông báo bình thường'
          : 'Đã TẮT Pop-up thông báo bình thường'
      );
      onRefreshData();
    } catch (err: any) {
      setBannerNoticeEnabled(prevBanner);
      setPopupEnabled(prevPopup);
      showToast('error', 'Cập nhật thông báo bình thường thất bại', err?.message);
    }
  };

  const handleSaveVaccinationPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('warning', 'Chỉ Quản trị viên mới có quyền cấu hình Thông báo Tiêm chủng');
      return;
    }
    setSavingVacPopup(true);
    try {
      const nowIso = new Date().toISOString();
      const vaccinationPopupPayload: VaccinationStartupPopupConfig = {
        enabled: vacPopupEnabled,
        title: vacPopupTitle.trim() || 'Thông Báo Tiêm Chủng',
        message: vacPopupMessage.trim(),
        ctaLabel: vacPopupCtaLabel.trim() || 'Xem lịch tiêm chủng',
        frequency: vacPopupFrequency,
        updatedAt: nowIso,
      };
      await updateSystemSettings({
        vaccinationBannerEnabled: vacBannerEnabled,
        vaccinationBannerNote: vacBannerNote.trim(),
        vaccinationPopup: vaccinationPopupPayload,
        updatedAt: nowIso,
      });
      await logAuditEvent(
        'Cập nhật Thông báo Tiêm chủng (Đầu trang & Pop-up)',
        'Tiêm chủng & Thông báo',
        `Banner đầu trang: ${vacBannerEnabled ? 'BẬT' : 'TẮT'} • Pop-up: ${vacPopupEnabled ? 'BẬT' : 'TẮT'} • Tần suất: ${vacPopupFrequency}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast('success', 'Đã lưu cấu hình Thông báo Tiêm chủng (Đầu trang & Pop-up)');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Lưu thông báo tiêm chủng thất bại', err?.message);
    } finally {
      setSavingVacPopup(false);
    }
  };

  const handleToggleVaccinationNoticeImmediate = async (
    field: 'vacBannerEnabled' | 'vacPopupEnabled'
  ) => {
    if (!isAdmin) {
      showToast('warning', 'Chỉ Quản trị viên mới có quyền cấu hình Thông báo Tiêm chủng');
      return;
    }
    const prevVacBanner = vacBannerEnabled;
    const prevVacPopup = vacPopupEnabled;
    const nextVacBanner = field === 'vacBannerEnabled' ? !prevVacBanner : prevVacBanner;
    const nextVacPopup = field === 'vacPopupEnabled' ? !prevVacPopup : prevVacPopup;

    if (field === 'vacBannerEnabled') setVacBannerEnabled(nextVacBanner);
    if (field === 'vacPopupEnabled') setVacPopupEnabled(nextVacPopup);

    try {
      const nowIso = new Date().toISOString();
      const vaccinationPopupPayload: VaccinationStartupPopupConfig = {
        enabled: nextVacPopup,
        title: vacPopupTitle.trim() || 'Thông Báo Tiêm Chủng',
        message: vacPopupMessage.trim(),
        ctaLabel: vacPopupCtaLabel.trim() || 'Xem lịch tiêm chủng',
        frequency: vacPopupFrequency,
        updatedAt: nowIso,
      };
      await updateSystemSettings({
        vaccinationBannerEnabled: nextVacBanner,
        vaccinationBannerNote: vacBannerNote.trim(),
        vaccinationPopup: vaccinationPopupPayload,
        updatedAt: nowIso,
      });
      await logAuditEvent(
        field === 'vacBannerEnabled'
          ? `${nextVacBanner ? 'Bật' : 'Tắt'} thanh đếm ngược Tiêm chủng đầu trang`
          : `${nextVacPopup ? 'Bật' : 'Tắt'} Pop-up Tiêm chủng khi mở trang`,
        'Tiêm chủng & Thông báo',
        `Banner tiêm chủng: ${nextVacBanner ? 'BẬT' : 'TẮT'} • Pop-up tiêm chủng: ${nextVacPopup ? 'BẬT' : 'TẮT'}`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        field === 'vacBannerEnabled'
          ? nextVacBanner
            ? 'Đã BẬT thanh đếm ngược Tiêm chủng đầu trang'
            : 'Đã TẮT thanh đếm ngược Tiêm chủng đầu trang'
          : nextVacPopup
          ? 'Đã BẬT Pop-up Tiêm chủng khi mở trang'
          : 'Đã TẮT Pop-up Tiêm chủng khi mở trang'
      );
      onRefreshData();
    } catch (err: any) {
      setVacBannerEnabled(prevVacBanner);
      setVacPopupEnabled(prevVacPopup);
      showToast('error', 'Cập nhật thông báo tiêm chủng thất bại', err?.message);
    }
  };

  const handleEnableAndTestSwNotification = async () => {
    setTestingSwNotif(true);
    try {
      const perm = await requestSystemNotificationPermission();
      setDeviceNotifPerm(perm);
      if (perm !== 'granted') {
        showToast(
          'warning',
          'Chưa được cấp quyền thông báo thiết bị',
          'Vui lòng cho phép Thông báo trong cài đặt trình duyệt để nhận tin khẩn qua Service Worker / PWA.'
        );
        return;
      }
      setDeviceNotificationEnabled(true);
      const subRes = await subscribeDeviceToWebPush({
        uid: currentUser?.uid,
        citizenId: userProfile?.citizenId,
        phoneNumber: userProfile?.phoneNumber,
        department: userProfile?.department,
      });
      if (subRes.ok && subRes.subscription) {
        const subJson = subRes.subscription.toJSON();
        if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
          await savePushSubscriptionRecord({
            deviceId: getOrCreateDeviceId(),
            endpoint: subJson.endpoint,
            keys: { p256dh: subJson.keys.p256dh, auth: subJson.keys.auth },
            uid: currentUser?.uid,
            citizenId: userProfile?.citizenId,
            phoneNumber: userProfile?.phoneNumber,
            department: userProfile?.department,
            updatedAt: new Date().toISOString(),
          });
        }
      }
      const ok = await sendTestBackgroundPush(settings.stationName);
      if (ok) {
        showToast('success', 'Thông báo hệ thống thiết bị (SW/PWA) đã sẵn sàng');
      } else {
        showToast('warning', 'Đã bật quyền nhưng chưa gửi được thông báo thử nghiệm');
      }
    } catch (err: any) {
      showToast('error', 'Lỗi kiểm tra thông báo SW/PWA', err?.message);
    } finally {
      setTestingSwNotif(false);
    }
  };

  const handleTogglePinVaccination = async (id: string) => {
    const target = vaccinationSchedulesList.find(v => v.id === id);
    if (!target) return;
    const updated = vaccinationSchedulesList.map(item =>
      item.id === id ? { ...item, isPinned: !item.isPinned, updatedAt: new Date().toISOString() } : item
    );
    await persistVaccinationSchedules(
      updated,
      `${!target.isPinned ? 'Ghim ưu tiên' : 'Bỏ ghim'} lịch tiêm: ${target.title}`
    );
  };

  const handleToggleActiveVaccination = async (id: string) => {
    const target = vaccinationSchedulesList.find(v => v.id === id);
    if (!target) return;
    const nextActive = target.isActive === false;
    const updated = vaccinationSchedulesList.map(item =>
      item.id === id ? { ...item, isActive: nextActive, updatedAt: new Date().toISOString() } : item
    );
    await persistVaccinationSchedules(
      updated,
      `${nextActive ? 'Công khai' : 'Tạm ẩn'} lịch tiêm: ${target.title}`
    );
  };

  const handleDeleteVaccination = (id: string, title: string) => {
    showConfirm({
      title: 'Xóa lịch tiêm chủng?',
      message: `Bạn có chắc muốn xóa lịch "${title}" khỏi danh sách công bố?`,
      confirmText: 'Xóa lịch tiêm',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        const updated = vaccinationSchedulesList.filter(item => item.id !== id);
        await persistVaccinationSchedules(updated, `Xóa lịch tiêm: ${title}`);
      },
    });
  };

  const handleCreateSampleVaccination = async () => {
    const stationLoc =
      settings.stationName && !settings.stationName.includes('Chưa cấu hình')
        ? settings.stationName
        : 'Trụ sở chính Trạm Y tế';
    const nowIso = new Date().toISOString();
    const todayStr = nowIso.split('T')[0];

    const samples: VaccinationScheduleItem[] = [
      {
        id: `vac_sample_${Date.now()}_1`,
        title: 'Tiêm Chủng Tại Trạm Y Tế',
        programType: 'expanded',
        date: todayStr,
        startTime: DEFAULT_VACCINATION_START_TIME,
        endTime: DEFAULT_VACCINATION_END_TIME,
        timeRange: `${DEFAULT_VACCINATION_START_TIME} - ${DEFAULT_VACCINATION_END_TIME}`,
        location: stationLoc,
        targetAudience: DEFAULT_VACCINATION_AUDIENCE,
        vaccines: DEFAULT_VACCINATION_VACCINES,
        notes: DEFAULT_VACCINATION_NOTES,
        status: 'upcoming',
        isPinned: true,
        isActive: true,
        updatedAt: nowIso,
      },
      {
        id: `vac_sample_${Date.now()}_2`,
        title: 'Chiến Dịch Tiêm Bổ Sung Phòng Bệnh Sởi - Rubella & Cúm Mùa',
        programType: 'campaign',
        date: todayStr,
        startTime: DEFAULT_VACCINATION_START_TIME,
        endTime: DEFAULT_VACCINATION_END_TIME,
        timeRange: `${DEFAULT_VACCINATION_START_TIME} - ${DEFAULT_VACCINATION_END_TIME}`,
        location: stationLoc,
        targetAudience: DEFAULT_VACCINATION_AUDIENCE,
        vaccines: DEFAULT_VACCINATION_VACCINES,
        notes: DEFAULT_VACCINATION_NOTES,
        status: 'upcoming',
        isPinned: false,
        isActive: true,
        updatedAt: nowIso,
      },
    ];

    const merged = [...vaccinationSchedulesList, ...samples];
    await persistVaccinationSchedules(merged, 'Khởi tạo dữ liệu mẫu Lịch Tiêm Chủng');
  };

  const handleAdvanceFeedbackStage = async (
    fb: FeedbackItem,
    nextStatus: 'processing' | 'forwarded',
    stageLabel: string
  ) => {
    try {
      await updateFeedbackResponse(
        fb.id,
        nextStatus,
        undefined,
        fb.assignedDepartment || 'Ban tiếp công dân - Trạm Y tế'
      );
      await logAuditEvent(
        `Chuyển bước phản ánh (${stageLabel})`,
        'Phản ánh',
        `Biên nhận: ${fb.ticketCode}`,
        {
          uid: currentUser.uid,
          name: userProfile?.displayName || 'Cán bộ',
        }
      );
      showToast('success', `Đã chuyển phiếu ${fb.ticketCode} sang ${stageLabel}`);
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Không thể cập nhật tiến trình phản ánh', err?.message);
    }
  };

  const handleSendFeedbackReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFb || !fbReply.trim()) return;

    setSubmittingReply(true);
    try {
      await updateFeedbackResponse(selectedFb.id, fbOutcomeStatus, fbReply.trim(), fbDept);
      await logAuditEvent('Trả lời phản ánh', 'Phản ánh', `Biên nhận: ${selectedFb.ticketCode} (${fbOutcomeStatus})`, {
        uid: currentUser.uid,
        name: userProfile?.displayName || 'Cán bộ',
      });

      showToast('success', 'Đã ban hành kết quả (Bước 5 - Kết thúc) cho công dân');
      setSelectedFb(null);
      setFbReply('');
      setFbOutcomeStatus('resolved');
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Không thể gửi phản hồi', err?.message);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteFeedback = (fb: FeedbackItem) => {
    showConfirm({
      title: 'Xóa phản ánh công dân?',
      message: `Bạn có chắc muốn xóa vĩnh viễn phiếu phản ánh "${fb.ticketCode}" của ${fb.fullName}?`,
      confirmText: 'Xóa phản ánh',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await deleteFeedback(fb.id);
          await logAuditEvent('Xóa phản ánh', 'Phản ánh', `Mã phiếu: ${fb.ticketCode}`, {
            uid: currentUser.uid,
            name: userProfile?.displayName || 'Admin',
          });
          showToast('success', `Đã xóa phản ánh ${fb.ticketCode}`);
          onRefreshData();
        } catch (err: any) {
          showToast('error', 'Xóa phản ánh thất bại', err?.message);
        }
      },
    });
  };

  const handleDeleteUser = (u: UserProfile) => {
    if (u.uid === currentUser.uid) {
      showToast('warning', 'Không thể tự xóa tài khoản đang đăng nhập');
      return;
    }
    if (isBootstrapAdminEmail(u.email) || u.email?.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      showToast('warning', 'Không thể xóa tài khoản Super Admin gốc');
      return;
    }

    showConfirm({
      title: 'Xóa tài khoản người dùng?',
      message: `Hồ sơ của "${u.displayName || u.email}" sẽ bị xóa khỏi hệ thống phân quyền. Hành động này không thể hoàn tác.`,
      confirmText: 'Xóa người dùng',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await deleteUserProfile(u.uid);
          const oldPhoneLock = buildPhoneLockId(u.verifiedPhone || u.phoneNumber || '');
          if (oldPhoneLock) {
            await releaseExclusiveIdentifierLock(oldPhoneLock);
          }
          await logAuditEvent('Xóa người dùng', 'Tài khoản', `Email: ${u.email}`, {
            uid: currentUser.uid,
            name: userProfile?.displayName || 'Admin',
          });
          showToast('success', `Đã xóa người dùng ${u.email}`);
          onRefreshData();
        } catch (err: any) {
          showToast('error', 'Xóa người dùng thất bại', err?.message);
        }
      },
    });
  };

  const handleAdminResetUser2FA = (u: UserProfile) => {
    showConfirm({
      title: 'Đặt lại (Xóa) Authenticator 2FA?',
      message: `Xác nhận xóa cấu hình Khoá 2FA Authenticator cho tài khoản "${u.displayName || u.email}"? Người dùng sẽ có thể thiết lập lại mã Authenticator mới sau khi đăng nhập.`,
      confirmText: 'Đặt lại Authenticator',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        try {
          try {
            await deleteDoc(doc(db, 'users', u.uid, 'security', 'totp'));
          } catch (delErr: any) {
            if (delErr?.code !== 'not-found') {
              throw delErr;
            }
          }
          const nowIso = new Date().toISOString();
          await setDoc(
            doc(db, 'users', u.uid),
            {
              twoFactorEnabled: false,
              twoFactorUpdatedAt: nowIso,
            },
            { merge: true }
          );
          setEditingUser(prev =>
            prev && prev.uid === u.uid
              ? { ...prev, twoFactorEnabled: false, twoFactorUpdatedAt: nowIso }
              : prev
          );
          await logAuditEvent(
            'Quản trị đặt lại (xóa) Authenticator 2FA',
            'Bảo mật tài khoản',
            `Tài khoản: ${u.email} (UID: ${u.uid})`,
            {
              uid: currentUser.uid,
              name: userProfile?.displayName || 'Admin',
            }
          );
          showToast(
            'success',
            `Đã đặt lại Authenticator 2FA cho ${u.email}`,
            'Người dùng có thể quét mã QR mới để thiết lập lại Authenticator.'
          );
          onRefreshData();
        } catch (err: any) {
          showToast('error', 'Không thể đặt lại Authenticator 2FA', err?.message);
        }
      },
    });
  };

  const handleAdminRevokeUserVerify = (u: UserProfile) => {
    showConfirm({
      title: `Gỡ gói Verify của ${u.email || u.displayName}?`,
      message: `Thao tác này sẽ thu hồi trạng thái Tick Xanh Verified của tài khoản ${u.email || u.uid}. Người dùng sẽ phải mua lại gói Verify qua cổng thanh toán SePay để được xác minh lại.`,
      confirmText: 'Xác nhận gỡ gói',
      cancelText: 'Hủy',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await updateAdminUserVipStatus({
            uid: u.uid,
            userEmail: u.email,
            userName: u.displayName,
            isVip: false,
          });
          const nowIso = new Date().toISOString();
          await setDoc(
            doc(db, 'users', u.uid),
            {
              isVip: false,
              vipExpiresAt: deleteField(),
              vipOrderCode: deleteField(),
              vipPackageName: deleteField(),
              vipActivatedAt: deleteField(),
              updatedAt: nowIso,
            },
            { merge: true }
          );
          setSepayVipMap(prev => {
            const next = { ...prev };
            delete next[u.uid];
            return next;
          });
          setPaidVerifyUids(prev => {
            const next = new Set(prev);
            next.delete(u.uid);
            return next;
          });
          if (editingUser?.uid === u.uid) {
            setEditingUser({
              ...editingUser,
              isVip: false,
              vipExpiresAt: undefined,
              vipOrderCode: undefined,
              vipPackageName: undefined,
              vipActivatedAt: undefined,
            });
          }
          await logAuditEvent(
            'Quản trị gỡ gói Verify tài khoản',
            'Thanh toán SePay',
            `Tài khoản: ${u.email} (UID: ${u.uid})`,
            {
              uid: currentUser.uid,
              name: userProfile?.displayName || 'Admin',
            }
          );
          showToast('success', 'Đã thu hồi gói Verify thành công', 'Trạng thái xác minh của tài khoản đã được gỡ.');
          onRefreshData();
        } catch (err: any) {
          showToast('error', 'Không thể gỡ gói Verify', err?.message);
        }
      },
    });
  };

  const handleToggleUserIdentityEdit = async (u: UserProfile) => {
    if (u.role === 'super_admin' || isBootstrapAdminEmail(u.email)) {
      showToast('info', 'Tài khoản Super Admin luôn ở trạng thái Đang mở');
      return;
    }
    const nextAllowed = !Boolean(u.allowIdentityEditByAdmin);
    const nowIso = new Date().toISOString();
    try {
      await setDoc(
        doc(db, 'users', u.uid),
        {
          allowIdentityEditByAdmin: nextAllowed,
          updatedAt: nowIso,
        },
        { merge: true }
      );
      setEditingUser(prev =>
        prev && prev.uid === u.uid
          ? { ...prev, allowIdentityEditByAdmin: nextAllowed, updatedAt: nowIso }
          : prev
      );
      await logAuditEvent(
        nextAllowed
          ? 'Mở quyền chỉnh sửa thông tin định danh'
          : 'Khóa quyền chỉnh sửa thông tin định danh',
        'Quản lý tài khoản',
        `Tài khoản: ${u.email} (UID: ${u.uid})`,
        {
          uid: currentUser?.uid || 'admin',
          name: userProfile?.displayName || 'Admin',
        }
      );
      showToast(
        'success',
        nextAllowed
          ? `Đã mở quyền chỉnh sửa thông tin cho ${u.displayName || u.email}`
          : `Đã khóa lại thông tin định danh của ${u.displayName || u.email}`
      );
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Không thể cập nhật quyền chỉnh sửa thông tin', err?.message);
    }
  };

  const openBanModal = (u: UserProfile) => {
    if (u.uid === currentUser?.uid) {
      showToast('error', 'Không thể tự Ban tài khoản đang đăng nhập');
      return;
    }
    if (isProtectedSuperAdminProfile(u)) {
      showToast('error', 'Không thể Ban tài khoản Super Admin');
      return;
    }
    setBanMode(u.banType === 'permanent' ? 'permanent' : 'temporary');
    setBanPreset('24h');
    const fallbackMs = Date.now() + 24 * 60 * 60 * 1000;
    const initialUntilMs =
      u.bannedUntilMs && u.bannedUntilMs > Date.now() ? u.bannedUntilMs : fallbackMs;
    setBanCustomUntil(toLocalDateTimeInputValue(initialUntilMs));
    setBanReasonInput(u.banReason || '');
    setBanModalUser(u);
  };

  const handleConfirmBanUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banModalUser || !currentUser) return;
    if (banModalUser.uid === currentUser.uid || isProtectedSuperAdminProfile(banModalUser)) {
      showToast('error', 'Không thể Ban tài khoản này');
      return;
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const reason = banReasonInput.trim() || 'Vi phạm quy định sử dụng hệ thống Trạm Y tế.';

    let targetUntilMs: number | undefined;
    let targetUntilIso: string | undefined;

    if (banMode === 'temporary') {
      if (banPreset === 'custom') {
        const parsedMs = new Date(banCustomUntil).getTime();
        if (!Number.isFinite(parsedMs) || parsedMs <= nowMs + 60 * 1000) {
          showToast('error', 'Thời hạn Ban không hợp lệ', 'Vui lòng chọn thời điểm kết thúc lớn hơn hiện tại ít nhất 1 phút.');
          return;
        }
        targetUntilMs = parsedMs;
      } else {
        const presetItem = BAN_DURATION_PRESETS.find(p => p.key === banPreset);
        const dur = presetItem?.durationMs || 24 * 60 * 60 * 1000;
        targetUntilMs = nowMs + dur;
      }
      targetUntilIso = new Date(targetUntilMs).toISOString();
    }

    setSubmittingBan(true);
    try {
      const banPayload = cleanDataForFirestore({
        status: 'banned',
        banType: banMode,
        banReason: reason,
        bannedAt: nowIso,
        bannedByUid: currentUser.uid,
        bannedByName: userProfile?.displayName || currentUser.email || 'Admin',
        updatedAt: nowIso,
        ...(banMode === 'temporary' && targetUntilMs && targetUntilIso
          ? { bannedUntilMs: targetUntilMs, bannedUntil: targetUntilIso }
          : {}),
      });

      await setDoc(
        doc(db, 'users', banModalUser.uid),
        {
          ...banPayload,
          ...(banMode === 'permanent'
            ? { bannedUntil: deleteField(), bannedUntilMs: deleteField() }
            : {}),
        },
        { merge: true }
      );

      setEditingUser(prev =>
        prev && prev.uid === banModalUser.uid
          ? {
              ...prev,
              status: 'banned',
              banType: banMode,
              banReason: reason,
              bannedAt: nowIso,
              bannedByUid: currentUser.uid,
              bannedByName: userProfile?.displayName || currentUser.email || 'Admin',
              bannedUntil: banMode === 'temporary' ? targetUntilIso : undefined,
              bannedUntilMs: banMode === 'temporary' ? targetUntilMs : undefined,
              updatedAt: nowIso,
            }
          : prev
      );

      await logAuditEvent(
        banMode === 'permanent' ? 'Ban tài khoản vô thời hạn' : 'Ban tài khoản có thời hạn',
        'Quản lý tài khoản',
        `Tài khoản: ${banModalUser.email} (${banModalUser.uid}) | ${
          banMode === 'permanent'
            ? 'Vô thời hạn'
            : `Đến ${formatBanTimestampVi(targetUntilMs)}`
        } | Lý do: ${reason}`,
        {
          uid: currentUser.uid,
          name: userProfile?.displayName || 'Admin',
        }
      );

      showToast(
        'success',
        banMode === 'permanent'
          ? `Đã Ban vô thời hạn tài khoản ${banModalUser.displayName || banModalUser.email}`
          : `Đã Ban tài khoản ${banModalUser.displayName || banModalUser.email} đến ${formatBanTimestampVi(targetUntilMs)}`
      );
      setBanModalUser(null);
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Không thể thực hiện Ban tài khoản', err?.message);
    } finally {
      setSubmittingBan(false);
    }
  };

  const handleUnbanUser = (u: UserProfile) => {
    if (!currentUser) return;
    showConfirm({
      title: 'Gỡ Ban tài khoản người dùng',
      message: `Xác nhận gỡ Ban và khôi phục quyền truy cập bình thường cho tài khoản "${u.displayName || u.email}"?`,
      confirmText: 'Xác nhận Gỡ Ban',
      onConfirm: async () => {
        const nowIso = new Date().toISOString();
        try {
          await setDoc(
            doc(db, 'users', u.uid),
            {
              status: 'active',
              banType: deleteField(),
              bannedUntil: deleteField(),
              bannedUntilMs: deleteField(),
              banReason: deleteField(),
              bannedAt: deleteField(),
              bannedByUid: deleteField(),
              bannedByName: deleteField(),
              updatedAt: nowIso,
            },
            { merge: true }
          );

          setEditingUser(prev =>
            prev && prev.uid === u.uid
              ? {
                  ...prev,
                  status: 'active',
                  banType: undefined,
                  bannedUntil: undefined,
                  bannedUntilMs: undefined,
                  banReason: undefined,
                  bannedAt: undefined,
                  bannedByUid: undefined,
                  bannedByName: undefined,
                  updatedAt: nowIso,
                }
              : prev
          );

          await logAuditEvent(
            'Gỡ Ban tài khoản người dùng',
            'Quản lý tài khoản',
            `Đã khôi phục quyền truy cập cho tài khoản: ${u.email} (${u.uid})`,
            {
              uid: currentUser.uid,
              name: userProfile?.displayName || 'Admin',
            }
          );
          showToast('success', `Đã gỡ Ban cho tài khoản ${u.displayName || u.email}`);
          onRefreshData();
        } catch (err: any) {
          showToast('error', 'Không thể gỡ Ban tài khoản', err?.message);
        }
      },
    });
  };

  const handleSaveUserDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    if (
      editingUser.status === 'banned' &&
      (editingUser.uid === currentUser?.uid || isProtectedSuperAdminProfile(editingUser))
    ) {
      showToast('error', 'Không thể Ban tài khoản Super Admin hoặc tài khoản đang đăng nhập');
      return;
    }

    const prevUser = users.find(u => u.uid === editingUser.uid);
    const rawPhone = (editingUser.phoneNumber || '').trim();
    const prevNormalizedPhone = normalizeAndValidatePhone(
      prevUser?.verifiedPhone || prevUser?.phoneNumber || ''
    );
    const prevPhoneLockId = prevNormalizedPhone ? buildPhoneLockId(prevNormalizedPhone) : '';

    let normalizedPhone = '';
    if (rawPhone) {
      normalizedPhone = normalizeAndValidatePhone(rawPhone);
      if (!normalizedPhone) {
        showToast(
          'error',
          'Số điện thoại không hợp lệ',
          'Số điện thoại phải gồm đúng 10 chữ số (VD: 0912345678).'
        );
        return;
      }

      const conflictUser = users.find(
        u =>
          u.uid !== editingUser.uid &&
          normalizeAndValidatePhone(u.verifiedPhone || u.phoneNumber || '') === normalizedPhone
      );
      if (conflictUser) {
        showToast(
          'error',
          'Trùng số điện thoại',
          `Số ${normalizedPhone} đã thuộc về tài khoản "${conflictUser.displayName || conflictUser.email}".`
        );
        return;
      }
    }

    setSavingUser(true);
    try {
      const nowIso = new Date().toISOString();
      if (normalizedPhone) {
        const newPhoneLockId = buildPhoneLockId(normalizedPhone);
        const lockRes = await claimExclusiveIdentifierLock({
          lockId: newPhoneLockId,
          type: 'phone',
          valueMasked: maskPhoneForLock(normalizedPhone),
          ownerUid: editingUser.uid,
        });
        if (!lockRes.ok) {
          showToast(
            'error',
            'Trùng số điện thoại',
            lockRes.error || 'Số điện thoại này đã được tài khoản khác sử dụng.'
          );
          setSavingUser(false);
          return;
        }
        if (prevPhoneLockId && prevPhoneLockId !== newPhoneLockId) {
          await releaseExclusiveIdentifierLock(prevPhoneLockId);
        }
      } else if (prevPhoneLockId) {
        await releaseExclusiveIdentifierLock(prevPhoneLockId);
      }

      const ref = doc(db, 'users', editingUser.uid);
      const cleanCccd = normalizeCccd(editingUser.citizenId);
      const prevCccdDigits = normalizeCccd(prevUser?.citizenId);
      const prevCccdLockId = prevCccdDigits ? buildCccdLockId(prevCccdDigits) : '';

      if (cleanCccd && cleanCccd !== prevCccdDigits) {
        const newCccdLockId = buildCccdLockId(cleanCccd);
        if (newCccdLockId) {
          const cccdLockRes = await claimExclusiveIdentifierLock({
            lockId: newCccdLockId,
            type: 'cccd',
            valueMasked: maskCccdForLock(cleanCccd),
            ownerUid: editingUser.uid,
          });
          if (!cccdLockRes.ok) {
            showToast(
              'error',
              'Trùng số CCCD',
              cccdLockRes.error || 'Số CCCD này đã thuộc về tài khoản khác.'
            );
            setSavingUser(false);
            return;
          }
          if (prevCccdLockId && prevCccdLockId !== newCccdLockId) {
            await releaseExclusiveIdentifierLock(prevCccdLockId);
          }
        }
      } else if (!cleanCccd && prevCccdLockId) {
        await releaseExclusiveIdentifierLock(prevCccdLockId);
      }

      const isBanSelected = editingUser.status === 'banned';
      let resolvedBanType: 'temporary' | 'permanent' =
        editingUser.banType === 'permanent' ? 'permanent' : 'temporary';
      let resolvedUntilMs = editingUser.bannedUntilMs;
      let resolvedUntilIso = editingUser.bannedUntil;

      if (isBanSelected && resolvedBanType === 'temporary') {
        if (!resolvedUntilMs && resolvedUntilIso) {
          const parsed = new Date(resolvedUntilIso).getTime();
          if (Number.isFinite(parsed)) resolvedUntilMs = parsed;
        }
        if (!resolvedUntilMs || resolvedUntilMs <= Date.now()) {
          resolvedUntilMs = Date.now() + 24 * 60 * 60 * 1000;
        }
        resolvedUntilIso = new Date(resolvedUntilMs).toISOString();
      }

      const payload = cleanDataForFirestore({
        displayName: editingUser.displayName,
        phoneNumber: normalizedPhone,
        verifiedPhone: normalizedPhone,
        phoneVerified: Boolean(normalizedPhone),
        ...(normalizedPhone
          ? { phoneVerifiedAt: prevUser?.phoneVerifiedAt || editingUser.phoneVerifiedAt || nowIso }
          : {}),
        citizenId: cleanCccd,
        citizenIdVerified: Boolean(cleanCccd && (prevUser?.citizenIdVerified || editingUser.citizenIdVerified)),
        dob: editingUser.dob || '',
        gender: editingUser.gender || 'Nam',
        ethnicity: editingUser.ethnicity || 'Kinh',
        provinceCode: editingUser.provinceCode || '',
        provinceName: editingUser.provinceName || '',
        wardCode: editingUser.wardCode || '',
        wardName: editingUser.wardName || '',
        address: editingUser.address || '',
        role: editingUser.role,
        accountType: editingUser.accountType,
        department: editingUser.department || '',
        position: editingUser.position || '',
        qualification: editingUser.qualification || '',
        organizationName: editingUser.organizationName || '',
        organizationType: editingUser.organizationType || '',
        taxCode: editingUser.taxCode || '',
        businessLicenseNumber: editingUser.businessLicenseNumber || '',
        organizationAddress: editingUser.organizationAddress || '',
        organizationPhone: editingUser.organizationPhone || '',
        organizationEmail: editingUser.organizationEmail || '',
        status: editingUser.status,
        identityVerifiedFromDatabase: Boolean(cleanCccd && editingUser.identityVerifiedFromDatabase),
        allowIdentityEditByAdmin: Boolean(editingUser.allowIdentityEditByAdmin),
        updatedAt: nowIso,
        ...(isBanSelected
          ? {
              banType: resolvedBanType,
              banReason: (editingUser.banReason || '').trim() || 'Vi phạm quy định hệ thống Trạm Y tế.',
              bannedAt: prevUser?.bannedAt || editingUser.bannedAt || nowIso,
              bannedByUid: prevUser?.bannedByUid || editingUser.bannedByUid || currentUser?.uid || 'admin',
              bannedByName:
                prevUser?.bannedByName ||
                editingUser.bannedByName ||
                userProfile?.displayName ||
                'Admin',
              ...(resolvedBanType === 'temporary' && resolvedUntilMs && resolvedUntilIso
                ? { bannedUntilMs: resolvedUntilMs, bannedUntil: resolvedUntilIso }
                : {}),
            }
          : {}),
      });

      const finalDocPayload = isBanSelected
        ? {
            ...payload,
            ...(resolvedBanType === 'permanent'
              ? { bannedUntil: deleteField(), bannedUntilMs: deleteField() }
              : {}),
          }
        : {
            ...payload,
            banType: deleteField(),
            bannedUntil: deleteField(),
            bannedUntilMs: deleteField(),
            banReason: deleteField(),
            bannedAt: deleteField(),
            bannedByUid: deleteField(),
            bannedByName: deleteField(),
          };

      await setDoc(ref, finalDocPayload, { merge: true });

      // If promoting or demoting admin role
      if (editingUser.role === 'super_admin' || editingUser.role === 'admin') {
        await setDoc(doc(db, 'admins', editingUser.uid), {
          uid: editingUser.uid,
          email: editingUser.email,
          role: editingUser.role,
        });
      }

      showToast('success', 'Đã lưu thông tin người dùng & phân quyền');

      setEditingUser(null);
      onRefreshData();
    } catch (err: any) {
      showToast('error', 'Cập nhật người dùng thất bại', err?.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleCreateReferralCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !currentUser) return;
    const effectiveTier: ReferralIssuerTier = canManageSuperAdminTier ? newRefIssuerTier : 'admin';
    const effectiveRole: RoleType = newRefRole || 'organization';
    setCreatingRef(true);
    try {
      const created = await createReferralCode({
        code: newRefCodeInput.trim() || undefined,
        label: newRefLabelInput.trim() || undefined,
        issuerTier: effectiveTier,
        targetAccountType: effectiveRole,
        targetRole: effectiveRole,
        createdByUid: currentUser.uid,
        createdByEmail: currentUser.email || undefined,
      });
      setReferralCodes(prev => [created, ...prev]);
      setNewRefCodeInput('');
      setNewRefLabelInput('');
      showToast(
        'success',
        'Đã tạo mã giới thiệu',
        `Mã ${created.code} cho vai trò ${getUserRoleLabel(created.targetRole)} đã sẵn sàng sử dụng.`
      );
    } catch (err: any) {
      showToast('error', 'Không thể tạo mã giới thiệu', err?.message || 'Vui lòng thử lại.');
    } finally {
      setCreatingRef(false);
    }
  };

  const handleToggleReferralCode = async (item: ReferralCodeItem) => {
    if (!isAdmin) return;
    const tier = item.issuerTier || 'super_admin';
    if (tier === 'super_admin' && !canManageSuperAdminTier) {
      showToast('warning', 'Chỉ Super Admin mới có quyền khóa/mở mã thuộc đối tượng Super Admin');
      return;
    }
    const nextActive = !item.active;
    try {
      await toggleReferralCodeStatus(item.code, nextActive);
      setReferralCodes(prev =>
        prev.map(r => (r.code === item.code ? { ...r, active: nextActive } : r))
      );
      showToast('success', nextActive ? `Đã kích hoạt mã ${item.code}` : `Đã tạm khóa mã ${item.code}`);
    } catch (err: any) {
      showToast('error', 'Cập nhật trạng thái thất bại', err?.message);
    }
  };

  const handleDeleteReferralCode = (item: ReferralCodeItem) => {
    if (!isAdmin) return;
    const tier = item.issuerTier || 'super_admin';
    if (tier === 'super_admin' && !canManageSuperAdminTier) {
      showToast('warning', 'Chỉ Super Admin mới có quyền xóa mã thuộc đối tượng Super Admin');
      return;
    }
    showConfirm({
      title: `Xóa mã giới thiệu ${item.code}?`,
      message: 'Liên kết giới thiệu sử dụng mã này sẽ không còn hiệu lực đối với lượt đăng ký mới.',
      confirmText: 'Xóa mã',
      isDangerous: true,
      onConfirm: async () => {
        try {
          await deleteReferralCode(item.code);
          setReferralCodes(prev => prev.filter(r => r.code !== item.code));
          showToast('success', `Đã xóa mã ${item.code}`);
        } catch (err: any) {
          showToast('error', 'Không thể xóa mã giới thiệu', err?.message);
        }
      },
    });
  };

  const handleCopyReferralValue = async (value: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedRefText(key);
      setTimeout(() => setCopiedRefText(prev => (prev === key ? null : prev)), 2000);
      showToast('success', `Đã sao chép ${label}`);
    } catch {
      showToast('error', 'Không thể sao chép tự động');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Compact Group Sub-Tab Bar (Standalone Sidebar holds the 6 top-level groups) */}
      {(() => {
        const groups = buildAdminNavGroups({
          newFeedback: feedbackList.filter(f => f.status === 'new').length,
          disputedMigrations: migrationClaims.filter(
            c => c.status === 'disputed' || c.status === 'pending'
          ).length,
          ratingsCount: serviceRatings.length,
        })
          .map(g => ({
            ...g,
            items: g.items.filter(item => !item.adminOnly || isAdmin),
          }))
          .filter(g => g.items.length > 0);
        const currentGroup = groups.find(g => g.items.some(i => i.id === subTab)) || groups[0];
        const siblingItems = currentGroup?.items || [];

        return (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>{currentGroup?.title || 'Bảng Quản Trị'}</span>
              </div>
              {onExitAdmin && (
                <button
                  type="button"
                  onClick={onExitAdmin}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>Về trang bình thường</span>
                </button>
              )}
            </div>

            {siblingItems.length > 1 && (
              <div className={getBalancedMobileGridClass(siblingItems.length)}>
                {siblingItems.map((item, idx) => {
                  const Icon = item.icon;
                  const active = subTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSubTab(item.id)}
                      className={`${getBalancedMobileItemSpan(idx, siblingItems.length)} min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center sm:justify-start gap-2 whitespace-nowrap cursor-pointer border ${
                        active
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs font-bold'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.shortLabel}</span>
                      {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                          }`}
                        >
                          {item.badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Subtab: Admin Dashboard Overview */}
      {subTab === 'dashboard' && (
        <AdminDashboardOverview
          settings={settings}
          users={users}
          feedbackList={feedbackList}
          events={events}
          workSchedules={workSchedules}
        />
      )}

      {/* Subtab: Organization / Business Accounts */}
      {subTab === 'org_accounts' && isAdmin && (
        <OrganizationAccountsManager settings={settings} />
      )}

      {/* Subtab: Agent AI Automation & Document Scanning */}
      {subTab === 'ai_automation' && isAdmin && <AgentAutomationManager settings={settings} />}

      {/* Subtab: SePay Payment Webhook, Custom Order Pricing & VIP Management */}
      {subTab === 'sepay_payment' && isAdmin && <SepayPaymentManager users={users} />}

      {/* Subtab: Read-only Firebase Config & Direct Console Links */}
      {subTab === 'firebase_config' && isAdmin && (
        <FirebaseConfigReadonlyCard settings={settings} onRefresh={onRefreshData} />
      )}

      {/* Subtab: Smartphone-style Apps Launcher Manager */}
      {subTab === 'apps_setup' && isAdmin && <AppsManager settings={settings} />}

      {/* Subtab: System Diagnostics (Vercel, RSS, Firebase, Tenten) */}
      {subTab === 'diagnostics' && <SystemDiagnosticsManager />}

      {/* Subtab: Nhân lực & Khoa phòng (liên kết trực tiếp Sơ đồ tổ chức, tách khỏi tài khoản) */}
      {subTab === 'org_personnel' && (
        <PersonnelDirectoryView
          settings={settings}
          settingsLoaded={true}
          embeddedInAdmin
          onOpenOrgChart={onOpenOrgChart}
        />
      )}

      {/* Subtab: Events Setup */}
      {subTab === 'events_setup' && (
        <EventsManager events={events} onPreviewEvent={onPreviewEvent} />
      )}

      {/* Subtab: Weekly Work Schedule & Holidays Setup */}
      {subTab === 'work_holiday_setup' && (
        <WorkAndHolidaySetupManager
          settings={settings}
          workSchedules={workSchedules}
          onPreviewHoliday={onPreviewHoliday}
        />
      )}

      {/* Subtab: Business Trip Configuration & Schedule Management */}
      {subTab === 'business_trip_setup' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveBusinessTripConfig}
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-0.5">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-emerald-600" />
                  <span>Cấu hình hiển thị Lịch công tác (Trang công khai)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Điều chỉnh tiêu đề, bộ lọc mặc định và bật/tắt mục Lịch công tác trên thanh menu cổng thông tin.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span
                  className={`text-xs font-bold ${
                    tripConfigEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {tripConfigEnabled ? 'Đang bật' : 'Đang tắt'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tripConfigEnabled}
                  aria-label="Bật hoặc tắt hiển thị Lịch công tác"
                  onClick={() => void handleToggleBusinessTripFieldImmediate('enabled')}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    tripConfigEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      tripConfigEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tiêu đề mục Lịch công tác
                </label>
                <input
                  type="text"
                  value={tripSectionTitle}
                  onChange={e => setTripSectionTitle(e.target.value)}
                  placeholder="Lịch Công Tác"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bộ lọc mặc định khi mở trang
                </label>
                <select
                  value={tripDefaultFilter}
                  onChange={e => setTripDefaultFilter(e.target.value as 'active' | 'upcoming' | 'all')}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                >
                  <option value="active">Đang công tác</option>
                  <option value="upcoming">Sắp đi công tác</option>
                  <option value="all">Tất cả lịch</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="min-w-0">
                  <div className="font-bold text-slate-800 dark:text-slate-100">
                    Ẩn lịch cũ với người dân
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Chỉ hiện chuyến đang/sắp diễn ra
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={tripHidePastForCitizens}
                  aria-label="Ẩn lịch công tác đã kết thúc đối với người dân"
                  onClick={() => void handleToggleBusinessTripFieldImmediate('hidePastForCitizens')}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    tripHidePastForCitizens ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      tripHidePastForCitizens ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mô tả phụ hiển thị đầu trang
              </label>
              <input
                type="text"
                value={tripSectionSubtitle}
                onChange={e => setTripSectionSubtitle(e.target.value)}
                placeholder="Theo dõi lịch công tác, tập huấn, hội nghị và nhiệm vụ ngoại viện của cán bộ nhân viên Trạm Y tế."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingTripConfig}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition shadow-xs"
              >
                {savingTripConfig ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Lưu cấu hình công tác</span>
              </button>
            </div>
          </form>

          <BusinessTripView userProfiles={users} settings={settings} />
        </div>
      )}

      {/* Subtab 0: Vaccination Schedule Setup (Tin Tức Quan Trọng Hàng Đầu) */}
      {subTab === 'vaccination_setup' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Syringe className="w-5 h-5 text-emerald-600" />
                <span>Thiết Lập Lịch Tiêm Chủng</span>
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hiển thị trên trang Lịch Tiêm Chủng riêng biệt (#lich-tiem-chung), phân tách rõ điểm tiêm chính và các điểm tiêm phụ.
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                <span>Tổng: {vaccinationSchedulesList.length} lịch</span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Công khai: {vaccinationSchedulesList.filter(v => v.isActive !== false).length}
                </span>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <span className="text-rose-700 dark:text-rose-400">
                  Ghim đầu: {vaccinationSchedulesList.filter(v => v.isPinned).length}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              {vaccinationSchedulesList.length === 0 && (
                <button
                  type="button"
                  disabled={savingVaccination}
                  onClick={handleCreateSampleVaccination}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer whitespace-nowrap shrink-0"
                >
                  Tạo lịch mẫu
                </button>
              )}
              <button
                type="button"
                disabled={savingVaccination}
                onClick={openAddVaccinationModal}
                className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm lịch tiêm</span>
              </button>
            </div>
          </div>

          {vaccinationSchedulesList.length === 0 ? (
            <div className="p-10 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
                <Syringe className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  Chưa có lịch tiêm chủng
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Thêm lịch tiêm mở rộng hoặc chiến dịch để hiển thị ưu tiên trên cổng thông tin.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md mx-auto pt-2">
                <button
                  type="button"
                  onClick={handleCreateSampleVaccination}
                  disabled={savingVaccination}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  Tạo lịch mẫu
                </button>
                <button
                  type="button"
                  onClick={openAddVaccinationModal}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition cursor-pointer"
                >
                  + Thêm lịch đầu tiên
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {vaccinationSchedulesList.map((item, idx) => {
                const isHidden = item.isActive === false;
                const programText =
                  item.programType === 'expanded'
                    ? 'Tiêm chủng mở rộng'
                    : item.programType === 'campaign'
                    ? 'Chiến dịch tiêm chủng'
                    : 'Tiêm chủng dịch vụ';
                const lifecycleStatus = resolveVaccinationLifecycle(item).effectiveStatus;
                const statusText =
                  lifecycleStatus === 'ongoing'
                    ? 'Đang triển khai'
                    : lifecycleStatus === 'upcoming'
                    ? 'Sắp diễn ra'
                    : lifecycleStatus === 'postponed'
                    ? 'Tạm hoãn'
                    : 'Đã kết thúc';

                return (
                  <div
                    key={item.id}
                    className={`p-5 rounded-2xl bg-white dark:bg-slate-900 border transition space-y-3.5 ${
                      isHidden
                        ? 'border-slate-200 dark:border-slate-800 opacity-75'
                        : item.isPinned
                        ? 'border-emerald-400 dark:border-emerald-700'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                          <span className="font-mono font-bold text-slate-400 tabular-nums">
                            #{idx + 1}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span
                            className={`font-bold ${
                              lifecycleStatus === 'ongoing'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : lifecycleStatus === 'upcoming'
                                ? 'text-teal-700 dark:text-teal-400'
                                : lifecycleStatus === 'postponed'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-slate-500'
                            }`}
                          >
                            {statusText}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {programText}
                          </span>
                        </div>

                        <h4 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                          {item.title}
                        </h4>
                      </div>

                      {/* Action Buttons: Copy for next site, Edit, Delete */}
                      <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => handleCopyVaccinationSchedule(item)}
                          className="px-3 py-2 sm:px-3.5 rounded-xl text-xs font-semibold border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 hover:bg-teal-100 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          title="Sao chép lịch này để thiết lập riêng cho điểm tiếp theo (hoạt động độc lập)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Sao chép điểm tiếp</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditVaccinationModal(item)}
                          className="px-3 py-2 sm:px-3.5 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Sửa</span>
                        </button>

                        <button
                          type="button"
                          disabled={savingVaccination}
                          onClick={() => handleDeleteVaccination(item.id, item.title)}
                          className="px-3 py-2 sm:px-3.5 rounded-xl text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>

                    <dl className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="space-y-0.5">
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Ngày &amp; Giờ
                        </dt>
                        <dd className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                          {formatVaccinationDateRange(item)} · {item.timeRange}
                        </dd>
                      </div>

                      <div className="space-y-0.5">
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Điểm tiêm chính &amp; phụ
                        </dt>
                        <dd className="font-semibold text-slate-800 dark:text-slate-200 space-y-0.5">
                          <div>Chính: {item.location}</div>
                          {item.secondaryLocations && item.secondaryLocations.length > 0 && (
                            <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                              Phụ: {item.secondaryLocations.join(' · ')}
                            </div>
                          )}
                        </dd>
                      </div>

                      <div className="space-y-0.5">
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Đối tượng
                        </dt>
                        <dd className="text-slate-700 dark:text-slate-300">
                          {item.targetAudience}
                        </dd>
                      </div>

                      <div className="space-y-0.5">
                        <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Vắc xin
                        </dt>
                        <dd className="text-slate-700 dark:text-slate-300">
                          {item.vaccines}
                        </dd>
                      </div>
                    </dl>

                    {item.notes && (
                      <p className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 px-3 py-2 rounded-xl">
                        <strong>Lưu ý:</strong> {item.notes}
                      </p>
                    )}

                    {/* Inline Controls Bar */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!!item.isPinned}
                            aria-label="Ghim đầu trang"
                            disabled={savingVaccination}
                            onClick={() => handleTogglePinVaccination(item.id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                              item.isPinned ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                item.isPinned ? 'translate-x-4.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                          <Pin className="w-3.5 h-3.5 text-rose-600" />
                          <span>Ghim đầu trang</span>
                        </div>

                        <div className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={item.isActive !== false}
                            aria-label={isHidden ? 'Đang ẩn' : 'Đang công khai'}
                            disabled={savingVaccination}
                            onClick={() => handleToggleActiveVaccination(item.id)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                              item.isActive !== false ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                item.isActive !== false ? 'translate-x-4.5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                          {isHidden ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
                          <span>{isHidden ? 'Đang ẩn' : 'Đang công khai'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          downloadVaccinationIcs(item, settings.stationName);
                          showToast('success', 'Đã xuất tệp lịch (.ics)');
                        }}
                        className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        <span>Xuất .ics</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Subtab: Dedicated Notifications Management Sidetab */}
      {subTab === 'notifications' && (
        <div className="space-y-6">
          {/* Top Action Bar */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-emerald-600" />
                  <span>Trung Tâm Quản Lý Thông Báo &amp; Pop-up</span>
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Khi ban hành thông báo mới, hệ thống tự động phát cảnh báo khẩn đến thiết bị người dùng (Service Worker / PWA Push). Thiết lập thông báo đầu trang và Pop-up được tách riêng cho Tiêm chủng và Thông báo bình thường.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  type="button"
                  onClick={handleEnableAndTestSwNotification}
                  disabled={testingSwNotif}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  title="Kiểm tra & kích hoạt thông báo Service Worker / PWA trên thiết bị này"
                >
                  <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {testingSwNotif
                      ? 'Đang kiểm tra...'
                      : deviceNotifPerm === 'granted'
                      ? 'Thử thông báo thiết bị (SW/PWA)'
                      : 'Bật thông báo thiết bị'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowSendNotifModal(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <Bell className="w-4 h-4 shrink-0" />
                  <span>Ban hành thông báo mới</span>
                </button>
              </div>
            </div>
          </div>

          {/* Section Header: Separate Top-Page & Startup Popup Configs */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* 1. General / Normal Notice Setup Card (Top Banner + Startup Pop-up) */}
            <form
              onSubmit={handleSaveStartupPopup}
              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Thông báo bình thường · Cấu hình riêng
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Thông Báo Bình Thường (Đầu Trang &amp; Pop-up)</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Thông báo hành chính, phòng chống dịch, giờ khám BHYT... hiển thị và đóng độc lập với Tiêm chủng.
                  </p>
                </div>
              </div>

              {/* Separate Top-Banner Toggle & Content for General Notice */}
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-amber-900 dark:text-amber-200">
                    1. Thanh thông báo đầu trang (Banner bình thường)
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bannerNoticeEnabled}
                    aria-label="Bật hoặc tắt thanh thông báo đầu trang bình thường"
                    onClick={() => void handleToggleStartupNoticeImmediate('bannerNoticeEnabled')}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      bannerNoticeEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        bannerNoticeEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nội dung thông báo ghim đầu trang (có nút đóng X riêng)
                  </label>
                  <textarea
                    rows={2}
                    value={bannerNotice}
                    onChange={e => setBannerNotice(e.target.value)}
                    placeholder="Ví dụ: Thông báo tạm thay đổi khung giờ khám BHYT buổi sáng hoặc hướng dẫn đăng ký khám sức khỏe..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Separate Startup Pop-up Toggle & Fields for General Notice */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    2. Hộp thoại Pop-up khi mở trang (Thông báo bình thường)
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={popupEnabled}
                    aria-label="Bật hoặc tắt hộp thoại Pop-up thông báo bình thường"
                    onClick={() => void handleToggleStartupNoticeImmediate('popupEnabled')}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      popupEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        popupEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phân loại thông báo
                    </label>
                    <select
                      value={popupNoticeType}
                      onChange={e =>
                        setPopupNoticeType(
                          e.target.value as 'general' | 'epidemic' | 'schedule' | 'urgent'
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="general">Thông báo chung</option>
                      <option value="epidemic">Phòng chống dịch bệnh</option>
                      <option value="schedule">Lịch khám &amp; Hoạt động trạm</option>
                      <option value="urgent">Thông báo khẩn / Lưu ý quan trọng</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tần suất tự động hiển thị
                    </label>
                    <select
                      value={popupFrequency}
                      onChange={e =>
                        setPopupFrequency(e.target.value as 'per_session' | 'daily' | 'always')
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="per_session">Mỗi phiên mở trình duyệt mới</option>
                      <option value="daily">1 lần mỗi ngày cho mỗi thiết bị</option>
                      <option value="always">Luôn hiển thị mỗi khi tải lại trang</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tiêu đề hộp thoại Pop-up
                  </label>
                  <input
                    type="text"
                    value={popupTitle}
                    onChange={e => setPopupTitle(e.target.value)}
                    placeholder="Thông báo từ Trạm Y Tế"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nội dung Pop-up khi mở trang (để trống nếu chỉ dùng thanh Banner)
                  </label>
                  <textarea
                    rows={3}
                    value={popupMessage}
                    onChange={e => setPopupMessage(e.target.value)}
                    placeholder="Ví dụ: Trạm Y tế thông báo lịch khám sức khỏe định kỳ cho người cao tuổi, hoặc khuyến cáo phòng chống dịch sốt xuất huyết..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nút điều hướng trên Pop-up (Tuỳ chọn)
                    </label>
                    <select
                      value={popupCtaView}
                      onChange={e =>
                        setPopupCtaView(
                          e.target.value as
                            | 'none'
                            | 'news'
                            | 'duty'
                            | 'documents'
                            | 'map'
                            | 'vaccination'
                            | 'nearby_facilities'
                            | 'rescue'
                            | 'events'
                        )
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="none">Chỉ hiển thị nút Đóng</option>
                      <option value="news">Đến Bảng tin &amp; Truyền thông</option>
                      <option value="duty">Đến Lịch trực 24/7</option>
                      <option value="documents">Đến Văn bản &amp; Biểu mẫu</option>
                      <option value="map">Đến Bản đồ điểm y tế</option>
                      <option value="events">Đến Trang Sự kiện &amp; Ngày lễ</option>
                      <option value="nearby_facilities">Đến Cơ sở Y tế lân cận</option>
                      <option value="rescue">Đến Bản đồ Cứu hộ cứu nạn SOS</option>
                    </select>
                  </div>

                  {popupCtaView !== 'none' && (
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nhãn nút chuyển trang
                      </label>
                      <input
                        type="text"
                        value={popupCtaLabel}
                        onChange={e => setPopupCtaLabel(e.target.value)}
                        placeholder="Xem chi tiết thông báo"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingPopup}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
                >
                  {savingPopup ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu thông báo bình thường</span>
                </button>
              </div>
            </form>

            {/* 2. Separate Vaccination Notice Setup Card (Top Banner + Startup Pop-up) */}
            <form
              onSubmit={handleSaveVaccinationPopup}
              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Tiêm chủng mở rộng · Cấu hình riêng
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Syringe className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Thông Báo Tiêm Chủng (Đầu Trang &amp; Pop-up)</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Thanh đếm ngược tiêm chủng đầu trang và hộp thoại Pop-up lịch tiêm riêng biệt, tự động lấy từ {getActiveVaccinationSchedules(settings).length} lịch tiêm đang công khai.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSubTab('vaccination_setup')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer whitespace-nowrap shrink-0 self-start"
                >
                  Quản lý Lịch tiêm ({getActiveVaccinationSchedules(settings).length})
                </button>
              </div>

              {/* Separate Top-Banner Toggle & Note for Vaccination */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200">
                    1. Thanh đếm ngược Tiêm chủng đầu trang
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={vacBannerEnabled}
                    aria-label="Bật hoặc tắt thanh đếm ngược Tiêm chủng đầu trang"
                    onClick={() => void handleToggleVaccinationNoticeImmediate('vacBannerEnabled')}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      vacBannerEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        vacBannerEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ghi chú ngắn kèm theo trên thanh Tiêm chủng đầu trang (tuỳ chọn, có nút đóng X riêng)
                  </label>
                  <input
                    type="text"
                    value={vacBannerNote}
                    onChange={e => setVacBannerNote(e.target.value)}
                    placeholder="Ví dụ: Mang theo sổ tiêm chủng & CCCD của trẻ khi đến trạm"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Separate Startup Pop-up Toggle & Fields for Vaccination */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white">
                    2. Hộp thoại Pop-up Tiêm chủng khi mở trang
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={vacPopupEnabled}
                    aria-label="Bật hoặc tắt hộp thoại Pop-up Tiêm chủng khi mở trang"
                    onClick={() => void handleToggleVaccinationNoticeImmediate('vacPopupEnabled')}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      vacPopupEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        vacPopupEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tiêu đề Pop-up Tiêm chủng
                    </label>
                    <input
                      type="text"
                      value={vacPopupTitle}
                      onChange={e => setVacPopupTitle(e.target.value)}
                      placeholder="Thông Báo Tiêm Chủng"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tần suất tự động hiển thị
                    </label>
                    <select
                      value={vacPopupFrequency}
                      onChange={e =>
                        setVacPopupFrequency(e.target.value as 'per_session' | 'daily' | 'always')
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="per_session">Mỗi phiên mở trình duyệt mới</option>
                      <option value="daily">1 lần mỗi ngày cho mỗi thiết bị</option>
                      <option value="always">Luôn hiển thị mỗi khi tải lại trang</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Lời nhắn / Lưu ý bổ sung trên Pop-up Tiêm chủng (tuỳ chọn)
                  </label>
                  <textarea
                    rows={3}
                    value={vacPopupMessage}
                    onChange={e => setVacPopupMessage(e.target.value)}
                    placeholder="Ví dụ: Kính mời phụ huynh đưa trẻ trong độ tuổi đi tiêm chủng đầy đủ, đúng lịch theo thông báo các điểm tiêm bên dưới..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nhãn nút xem lịch tiêm chủng
                  </label>
                  <input
                    type="text"
                    value={vacPopupCtaLabel}
                    onChange={e => setVacPopupCtaLabel(e.target.value)}
                    placeholder="Xem lịch tiêm chủng"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingVacPopup}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-xs"
                >
                  {savingVacPopup ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu thông báo tiêm chủng</span>
                </button>
              </div>
            </form>
          </div>

          {/* Analytics Overview Cards (Notification Views + Station Post Views) */}
          {(() => {
            const totalNotifViews =
              publishedNotifications.reduce(
                (sum, n) =>
                  sum +
                  Math.max(
                    n.viewCount || 0,
                    (n.readByDeviceIds || []).length,
                    (n.readByUids || []).length
                  ),
                0
              ) +
              publishedAnnouncements.reduce(
                (sum, a) => sum + Math.max(a.viewCount || 0, (a.readByDeviceIds || []).length),
                0
              );

            const totalPostViews = publishedPosts.reduce((sum, p) => sum + (p.views || 0), 0);

            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Thông báo đã phát
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {publishedNotifications.length + publishedAnnouncements.length}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Lượt xem thông báo
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {totalNotifViews}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Bài viết của Trạm
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {publishedPosts.length}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    Lượt xem bài viết Trạm
                  </div>
                  <div className="text-2xl font-extrabold text-teal-700 dark:text-teal-400 tabular-nums">
                    {totalPostViews}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Issued Targeted Notifications & Broadcasts List */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-600" />
                  <span>Thông Báo Đã Phát Hành &amp; Thống Kê Lượt Xem ({publishedNotifications.length + publishedAnnouncements.length})</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Theo dõi tin khẩn, thông báo đẩy nền và lượt người dân đã xem từng thông báo.
                </p>
              </div>
            </div>

            {publishedNotifications.length === 0 && publishedAnnouncements.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có thông báo phát hành nào. Nhấn &quot;Ban hành thông báo mới&quot; để gửi thông báo đến người dân hoặc cán bộ.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {publishedNotifications.map(notif => {
                  const priorityLabel =
                    notif.priority === 'hoatoc'
                      ? 'Hỏa tốc'
                      : notif.priority === 'khan'
                      ? 'Khẩn cấp'
                      : 'Bình thường';
                  const targetLabel =
                    notif.targetType === 'all'
                      ? 'Toàn dân & cán bộ'
                      : notif.targetType === 'bulk_cccd'
                      ? `CCCD: ${notif.targetCccd || '—'}`
                      : notif.targetType === 'individual'
                      ? `SĐT: ${notif.targetPhone || '—'}`
                      : `Đơn vị: ${notif.targetOrgName || '—'}`;
                  const viewsCount = Math.max(
                    notif.viewCount || 0,
                    (notif.readByDeviceIds || []).length,
                    (notif.readByUids || []).length
                  );
                  return (
                    <div
                      key={notif.id}
                      className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span
                            className={`font-bold ${
                              notif.priority === 'hoatoc'
                                ? 'text-rose-700 dark:text-rose-400'
                                : notif.priority === 'khan'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}
                          >
                            {priorityLabel}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="font-medium text-slate-600 dark:text-slate-300">
                            {targetLabel}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            <span>{viewsCount} lượt xem</span>
                          </span>
                          {notif.createdAt && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">·</span>
                              <span className="font-mono text-slate-400 tabular-nums">
                                {new Date(notif.createdAt).toLocaleString('vi-VN')}
                              </span>
                            </>
                          )}
                        </div>
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {notif.title}
                        </h5>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {notif.content}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          showConfirm({
                            title: 'Xóa thông báo này?',
                            message: `Thu hồi và xóa thông báo "${notif.title}" khỏi hệ thống?`,
                            confirmText: 'Xóa thông báo',
                            cancelText: 'Hủy',
                            isDangerous: true,
                            onConfirm: async () => {
                              try {
                                await deleteTargetedNotification(notif.id);
                                showToast('success', 'Đã xóa thông báo');
                              } catch (err: any) {
                                showToast('error', 'Xóa thất bại', err?.message);
                              }
                            },
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 self-end sm:self-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  );
                })}

                {publishedAnnouncements.map(ann => {
                  const annViews = Math.max(
                    ann.viewCount || 0,
                    (ann.readByDeviceIds || []).length
                  );
                  return (
                    <div
                      key={ann.id}
                      className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                          <span className="font-bold text-teal-700 dark:text-teal-400">
                            Thông báo chung ({ann.type})
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">·</span>
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            <Eye className="w-3.5 h-3.5 shrink-0" />
                            <span>{annViews} lượt xem</span>
                          </span>
                          {ann.createdAt && (
                            <>
                              <span className="text-slate-300 dark:text-slate-700">·</span>
                              <span className="font-mono text-slate-400 tabular-nums">
                                {ann.createdAt}
                              </span>
                            </>
                          )}
                        </div>
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                          {ann.title}
                        </h5>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                          {ann.content}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          showConfirm({
                            title: 'Xóa thông báo?',
                            message: `Xóa thông báo "${ann.title}"?`,
                            confirmText: 'Xóa',
                            cancelText: 'Hủy',
                            isDangerous: true,
                            onConfirm: async () => {
                              try {
                                await deleteAnnouncement(ann.id);
                                showToast('success', 'Đã xóa thông báo');
                              } catch (err: any) {
                                showToast('error', 'Xóa thất bại', err?.message);
                              }
                            },
                          })
                        }
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 transition inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 self-end sm:self-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Station Posts View Analytics Card */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-teal-600" />
                  <span>Thống Kê Lượt Xem Bài Viết Của Trạm ({publishedPosts.length})</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Xếp hạng các bài viết truyền thông y tế do Trạm đăng tải theo số lượt người dân đã đọc.
                </p>
              </div>
            </div>

            {publishedPosts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có bài viết nào được đăng từ Trạm Y tế.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {publishedPosts.map((post, idx) => (
                  <div
                    key={post.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-xs font-mono font-bold text-slate-400 pt-0.5 tabular-nums shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {post.title}
                        </h5>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {post.publishedAt} · {post.authorName || 'Trạm Y tế'}
                        </p>
                      </div>
                    </div>

                    <div className="inline-flex items-center gap-1.5 font-mono text-sm font-extrabold text-teal-700 dark:text-teal-400 tabular-nums whitespace-nowrap shrink-0">
                      <Eye className="w-4 h-4" />
                      <span>{post.views || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtab 1: Station Setup */}
      {subTab === 'station_setup' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Cấu Hình Thông Tin Trạm Y Tế
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Thông tin hiển thị trên Banner trang chủ, chân trang và liên hệ chính thức.
            </p>
          </div>

          <form onSubmit={handleSaveStationInfo} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Đơn vị Trực thuộc Cấp trên *
                </label>
                <input
                  type="text"
                  required
                  value={parentUnitName}
                  onChange={e => setParentUnitName(e.target.value)}
                  placeholder="Ví dụ: TRUNG TÂM Y TẾ KHU VỰC • SỞ Y TẾ ĐỊA PHƯƠNG"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tên Trạm Y tế *
                </label>
                <input
                  type="text"
                  required
                  value={stationName}
                  onChange={e => setStationName(e.target.value)}
                  placeholder="Ví dụ: TRẠM Y TẾ XÃ / PHƯỜNG..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800 dark:text-emerald-300"
                />
              </div>

              <div className="col-span-full">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Khẩu hiệu / Giới thiệu tóm tắt
                </label>
                <input
                  type="text"
                  value={subTitle}
                  onChange={e => setSubTitle(e.target.value)}
                  placeholder="Cổng thông tin điện tử & Y tế cơ sở"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="col-span-full">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Địa chỉ trụ sở chính *
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Số nhà, Tên đường, Xã/Phường, Tỉnh/Thành phố"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Đường dây nóng / Hotline *
                </label>
                <input
                  type="text"
                  required
                  value={hotline}
                  onChange={e => setHotline(e.target.value)}
                  placeholder="02xx xxxx xxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Email / Gmail chính thức của Trạm
                </label>
                <input
                  type="email"
                  value={stationEmail}
                  onChange={e => setStationEmail(e.target.value)}
                  placeholder="tramyte.phuong@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="col-span-full rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block font-bold text-rose-800 dark:text-rose-300 text-xs sm:text-sm">
                      Số cấp cứu khẩn cấp 24/7 &amp; Ghi chú đi kèm
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Cổng thông tin chỉ hiển thị đúng các số đã thiết lập tại đây (không tự động thêm số khác).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setEmergencyContacts(prev => [
                        ...prev,
                        { id: `ec_${Date.now()}`, phone: '', note: '' },
                      ])
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm số cấp cứu</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {emergencyContacts.length === 0 && (
                    <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-dashed border-rose-200 dark:border-rose-800 text-xs text-slate-500 dark:text-slate-400">
                      Chưa thiết lập số cấp cứu nào. Nhấn <strong>"Thêm số cấp cứu"</strong> để thêm đường dây trực 24/7 của đơn vị.
                    </div>
                  )}
                  {emergencyContacts.map((contact, idx) => (
                    <div
                      key={contact.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start bg-white dark:bg-slate-900 p-3 rounded-xl border border-rose-100 dark:border-slate-800"
                    >
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Số cấp cứu {emergencyContacts.length > 1 ? `#${idx + 1}` : ''}
                        </label>
                        <input
                          type="text"
                          value={contact.phone}
                          onChange={e =>
                            setEmergencyContacts(prev =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, phone: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Ví dụ: 115 hoặc 028 xxxx xxxx"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold text-rose-600"
                        />
                      </div>

                      <div className={emergencyContacts.length > 1 ? 'sm:col-span-7' : 'sm:col-span-8'}>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Ghi chú đi kèm số cấp cứu {emergencyContacts.length > 1 ? `#${idx + 1}` : ''}
                        </label>
                        <input
                          type="text"
                          value={contact.note}
                          onChange={e =>
                            setEmergencyContacts(prev =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, note: e.target.value } : item
                              )
                            )
                          }
                          placeholder="Ví dụ: Tiếp nhận sơ cứu ban đầu, thường trực 24/24..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        />
                      </div>

                      {emergencyContacts.length > 1 && (
                        <div className="sm:col-span-1 flex sm:justify-end sm:pt-6">
                          <button
                            type="button"
                            onClick={() =>
                              setEmergencyContacts(prev => prev.filter((_, i) => i !== idx))
                            }
                            title="Xóa số cấp cứu này"
                            className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Thời gian làm việc
                </label>
                <input
                  type="text"
                  value={workingHours}
                  onChange={e => setWorkingHours(e.target.value)}
                  placeholder="Sáng: 07:00 - 11:00 | Chiều: 13:00 - 17:00 (Thứ 2 - Thứ 6)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Lãnh đạo phụ trách Trạm
                </label>
                <input
                  type="text"
                  value={leaderName}
                  onChange={e => setLeaderName(e.target.value)}
                  placeholder="BS CKI. Nguyễn Văn B - Trưởng Trạm"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Station Portal Cover Image (Ảnh bìa) */}
              <div className="col-span-full rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm">
                      <ImageIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Cấu hình Ảnh bìa Trang chủ Trạm Y tế</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Hiển thị trên đầu trang chủ cổng thông tin (khuyên dùng ảnh ngang tỉ lệ 16:5 hoặc 16:6). Hỗ trợ tải ảnh từ thiết bị hoặc dán URL ảnh.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      ref={coverFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          if (!file.type.startsWith('image/')) {
                            throw new Error('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WebP...).');
                          }
                          const rawDataUrl = await new Promise<string>((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(String(reader.result || ''));
                            reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh từ thiết bị.'));
                            reader.readAsDataURL(file);
                          });
                          setCoverPreviewError(false);
                          setCoverCropSource({ src: rawDataUrl, fileName: file.name });
                        } catch (err: any) {
                          showToast('error', 'Không thể nạp ảnh bìa', err?.message || 'Vui lòng thử lại.');
                        } finally {
                          if (coverFileInputRef.current) coverFileInputRef.current.value = '';
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingCoverImage}
                      onClick={() => coverFileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                    >
                      {uploadingCoverImage ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{uploadingCoverImage ? 'Đang xử lý...' : 'Chọn ảnh & Cắt bìa'}</span>
                    </button>
                    {coverImageUrl.trim() && (
                      <>
                        <button
                          type="button"
                          disabled={uploadingCoverImage}
                          onClick={() => {
                            const src = GitHubService.toRawGitHubUrl(coverImageUrl);
                            setCoverCropSource({ src, fileName: 'station-cover.jpg' });
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Crop className="w-3.5 h-3.5" />
                          <span>Cắt ảnh hiện tại</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCoverImageUrl('');
                            setCoverPreviewError(false);
                            setCoverUseProxy(false);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xóa ảnh bìa</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Đường dẫn URL ảnh bìa (hoặc tự động điền khi tải ảnh lên)
                  </label>
                  <input
                    type="text"
                    value={coverImageUrl}
                    onChange={e => {
                      setCoverImageUrl(e.target.value);
                      setCoverPreviewError(false);
                      setCoverUseProxy(false);
                    }}
                    placeholder="https://... hoặc tải ảnh từ máy bằng nút bên trên"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-mono"
                  />
                </div>

                {(() => {
                  const normalizedCoverPreview = GitHubService.toRawGitHubUrl(coverImageUrl);
                  if (!normalizedCoverPreview) {
                    return (
                      <div className="p-4 rounded-2xl border border-dashed border-emerald-300/70 dark:border-emerald-800/70 bg-white/70 dark:bg-slate-900/50 text-center text-xs text-slate-500 dark:text-slate-400">
                        Chưa cấu hình ảnh bìa. Khi để trống, trang chủ sẽ dùng nền màu chuyển sắc mặc định của Trạm Y tế.
                      </div>
                    );
                  }
                  const isHttpCover = /^https?:\/\//i.test(normalizedCoverPreview);
                  const previewImgSrc =
                    coverUseProxy && isHttpCover
                      ? `${GitHubService.toImageProxyUrl(normalizedCoverPreview)}${coverRetryTick ? `&t=${coverRetryTick}` : ''}`
                      : normalizedCoverPreview;

                  return (
                    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 relative h-36 sm:h-48">
                      {!coverPreviewError ? (
                        <img
                          key={`${previewImgSrc}_${coverRetryTick}`}
                          src={previewImgSrc}
                          alt="Xem trước ảnh bìa Trạm Y tế"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            if (!coverUseProxy && isHttpCover) {
                              setCoverUseProxy(true);
                              return;
                            }
                            setCoverPreviewError(true);
                          }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-rose-300 text-xs gap-2 px-4 text-center">
                          <AlertCircle className="w-5 h-5" />
                          <span>Không thể tải ảnh từ URL này. Vui lòng kiểm tra lại liên kết hoặc tải ảnh trực tiếp từ máy.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCoverPreviewError(false);
                              setCoverUseProxy(false);
                              setCoverRetryTick(t => t + 1);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-[11px] font-semibold cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Thử tải lại</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition flex items-center gap-2"
              >
                {savingSettings ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu cấu hình đơn vị
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtab: Functions & Duties (Chức Năng & Nhiệm Vụ - Thụt lề 1cm) */}
      {subTab === 'functions_duties' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-600" />
                  Quản Lý Chức Năng & Nhiệm Vụ Của Trạm Y Tế
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Nội dung được hiển thị công khai trên Trang chủ. Mỗi dòng đầu của đoạn văn sẽ được hệ thống <strong>tự động thụt lề 1 cm</strong> theo chuẩn văn bản hành chính nhà nước.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFunctionsDutiesText(
                      `Trạm Y tế xã, phường, thị trấn là đơn vị y tế thuộc Trung tâm Y tế huyện, quận, thị xã, thành phố thuộc tỉnh, có chức năng cung cấp, thực hiện các dịch vụ chuyên môn, kỹ thuật về y tế dự phòng, khám bệnh, chữa bệnh ban đầu, phục hồi chức năng, chăm sóc sức khỏe sinh sản và kế hoạch hóa gia đình, cung ứng thuốc thiết yếu, quản lý sức khỏe cộng đồng và truyền thông giáo dục sức khỏe trên địa bàn.\n\nVề y tế dự phòng: Trạm chịu trách nhiệm thường trực triển khai tiêm chủng mở rộng an toàn, quản lý và kiểm soát dịch bệnh truyền nhiễm, phát hiện sớm và dập dịch kịp thời; thực hiện công tác vệ sinh môi trường, an toàn nguồn nước và phòng chống ngộ độc thực phẩm tại cộng đồng.\n\nVề khám bệnh, chữa bệnh: Trạm tổ chức sơ cứu, cấp cứu 24/7; khám chữa bệnh ngoại trú và điều trị thông thường cho người dân tham gia Bảo hiểm Y tế (BHYT); quản lý, điều trị định kỳ các bệnh không lây nhiễm phổ biến như Tăng huyết áp, Đái tháo đường, bệnh phổi tắc nghẽn mạn tính; phối hợp chuyển tuyến bảo đảm an toàn tính mạng người bệnh.\n\nVề chuyển đổi số y tế: Trạm Y tế thực hiện số hóa 100% hồ sơ sức khỏe điện tử toàn dân gắn với mã số định danh cá nhân VNeID; kết nối phần mềm tư vấn khám bệnh từ xa Bác sĩ cho mọi nhà; bảo mật tuyệt đối dữ liệu y tế và phục vụ nhân dân tiện ích, văn minh.`
                    );
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 transition"
                >
                  Tải văn bản mẫu TT33/BYT
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Editor */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Soạn Thảo Nội Dung Thủ Công
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  Xuống dòng = Đoạn mới
                </span>
              </div>

              <textarea
                rows={14}
                value={functionsDutiesText}
                onChange={e => setFunctionsDutiesText(e.target.value)}
                placeholder="Nhập nội dung chức năng nhiệm vụ... Mỗi lần xuống dòng tạo thành một đoạn văn và sẽ tự động thụt vào 1cm..."
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs sm:text-sm leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  {functionsDutiesText.split('\n').filter(p => p.trim()).length} đoạn văn bản
                </span>
                <button
                  type="button"
                  onClick={handleSaveFunctionsDuties}
                  disabled={savingFunctionsDuties}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                >
                  {savingFunctionsDuties ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Lưu Chức Năng - Nhiệm Vụ
                </button>
              </div>
            </div>

            {/* Live Preview Display with strict 1cm indentation */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Xem Trước Thực Tế (Thụt Đầu Dòng 1cm)
                  </h4>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  text-indent: 1cm
                </span>
              </div>

              <div className="bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-100 dark:border-slate-800/80 min-h-[300px]">
                {functionsDutiesText.trim() ? (
                  <div className="space-y-3.5">
                    {functionsDutiesText
                      .split('\n')
                      .filter(p => p.trim().length > 0)
                      .map((p, idx) => (
                        <p
                          key={idx}
                          className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300 text-justify mb-3 [text-indent:1cm]"
                          style={{ textIndent: '1cm' }}
                        >
                          {p.trim()}
                        </p>
                      ))}
                  </div>
                ) : (
                  <div className="h-48 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                    <p>Chưa nhập nội dung.</p>
                    <p className="text-[11px] mt-1 text-slate-500">
                      Hãy nhập văn bản ở ô bên trái hoặc bấm "Tải văn bản mẫu TT33/BYT".
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab: Map Locations (Bản Đồ Đa Điểm & Tọa Độ) */}
      {subTab === 'map_locations' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Quản Lý Mạng Lưới Điểm Y Tế & Tọa Độ Bản Đồ ({mapLocationsList.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Thiết lập các cơ sở, phân trạm, điểm tiêm chủng và điểm sơ cấp cứu trên cùng một bản đồ tương tác với tọa độ vĩ độ/kinh độ.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddLocationModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm vị trí cơ sở</span>
              </button>
            </div>
          </div>

          {/* Locations Grid (Trụ sở chính luôn đứng đầu tiên) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortLocationsPrimaryFirst(mapLocationsList).map(loc => (
              <div
                key={loc.id}
                className={`p-5 rounded-3xl bg-white dark:bg-slate-900 border transition shadow-sm space-y-3.5 relative flex flex-col justify-between ${
                  loc.isPrimary
                    ? 'border-emerald-500/80 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                        {loc.name}
                      </h4>
                    </div>
                    {loc.isPrimary && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                        Trụ sở chính
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {loc.address}
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 font-mono text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Vĩ độ (Lat):</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{loc.lat}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Kinh độ (Lng):</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">{loc.lng}</strong>
                    </div>
                  </div>

                  {loc.headName && (
                    <div className="text-xs text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span>Trưởng điểm: {loc.headName}</span>
                    </div>
                  )}

                  {loc.phone && (
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{loc.phone}</span>
                    </div>
                  )}

                  {loc.notes && (
                    <p className="text-[11px] text-slate-500 italic">
                      "{loc.notes}"
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    {!loc.isPrimary && (
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryLocation(loc.id)}
                        className="text-[11px] text-emerald-600 hover:underline font-semibold"
                      >
                        Đặt chính
                      </button>
                    )}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-slate-500 hover:text-emerald-600 flex items-center gap-0.5"
                    >
                      <span>Google Map</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingLocation(loc);
                        setNewLocName(loc.name);
                        setNewLocAddress(loc.address);
                        setNewLocLat(String(loc.lat));
                        setNewLocLng(String(loc.lng));
                        setNewLocPhone(loc.phone || '');
                        setNewLocHeadName(loc.headName || '');
                        setNewLocHours(loc.workingHours || '');
                        setNewLocNotes(loc.notes || '');
                        setNewLocIsPrimary(!!loc.isPrimary);
                      }}
                      className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                      title="Chỉnh sửa vị trí này"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteLocation(loc.id, loc.name)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                      title="Xóa điểm này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {mapLocationsList.length === 0 && (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
              <MapPin className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Chưa có cơ sở nào trên bản đồ
                </h4>
                <p className="text-xs text-slate-500">
                  Thêm trụ sở chính hoặc các phân trạm y tế để người dân dễ dàng tìm đường và định vị.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddLocationModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm điểm đầu tiên</span>
              </button>
            </div>
          )}

          {/* Epidemic Map Visibility Configuration Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/70 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-bold text-rose-950 dark:text-rose-200 flex items-center gap-2">
                  <Radar className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span>Cấu hình Bản đồ Dịch bệnh (Sốt xuất huyết &amp; dịch tễ)</span>
                </h4>
                <p className="text-xs text-rose-900/80 dark:text-rose-300/80 leading-relaxed">
                  <strong>Hiện / Ẩn nút "Xem bản đồ dịch bệnh" cho tất cả đối tượng:</strong> Khi <strong>Ẩn</strong>, dấu tick "Xem bản đồ dịch bệnh" và lớp khoanh vùng dịch bệnh sẽ ẩn hoàn toàn trên Bản đồ đối với mọi vai trò (người dân, khách, cán bộ, admin).
                </p>
              </div>

              <div className="inline-flex items-center gap-2.5 shrink-0 select-none">
                <span
                  className={`text-xs font-bold ${
                    epidemicMapButtonVisible
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {epidemicMapButtonVisible ? 'Đang HIỆN nút' : 'Đang ẨN nút'}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={epidemicMapButtonVisible}
                  aria-label="Hiện hoặc ẩn nút Xem bản đồ dịch bệnh cho tất cả đối tượng"
                  onClick={() => void handleToggleEpidemicMapButtonImmediate(!epidemicMapButtonVisible)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    epidemicMapButtonVisible ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      epidemicMapButtonVisible ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-rose-200/70 dark:border-rose-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Danh sách Ca bệnh &amp; Vùng khoanh dịch tễ ({epidemicCasesList.length})
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingAdminEpidemicCase(null);
                  setShowEpidemicCaseModal(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Đánh dấu ca bệnh mới (Tại nhà)</span>
              </button>
            </div>

            {epidemicCasesList.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-dashed border-rose-200 dark:border-rose-800 text-xs text-slate-500 dark:text-slate-400">
                Chưa có điểm dịch bệnh nào được đánh dấu. Super Admin, Admin hoặc Cán bộ Y tế có thể đánh dấu trực tiếp tại nhà ca bệnh trên Bản đồ hoặc bấm nút phía trên.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {epidemicCasesList.map(c => {
                  const cfg = getEpidemicDiseaseConfig(c.diseaseType);
                  const st = EPIDEMIC_STATUS_META[c.status] || EPIDEMIC_STATUS_META.active;
                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/70 shadow-xs space-y-2.5 flex flex-col justify-between text-xs"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${cfg.badgeBgClass} ${cfg.badgeTextClass}`}
                          >
                            {cfg.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${st.badgeClass}`}>
                            {st.label}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between gap-2">
                          <span className="truncate">{c.caseLabel || 'Điểm dịch khoanh vùng'}</span>
                          <span className="text-rose-700 dark:text-rose-300 tabular-nums shrink-0">
                            {c.radiusMeters.toLocaleString('vi-VN')} m
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                          {c.fullAddress}
                        </p>
                        <div className="text-[11px] font-mono text-slate-400">
                          {c.lat}, {c.lng} · Ngày {c.recordedDate}
                        </div>
                        {c.notes && (
                          <p className="text-[11px] text-slate-500 italic">"{c.notes}"</p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          <span>Google Map</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAdminEpidemicCase(c);
                              setShowEpidemicCaseModal(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                            title="Sửa điểm dịch bệnh"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={deletingAdminEpidemicId === c.id}
                            onClick={() => void handleDeleteAdminEpidemicCase(c)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer disabled:opacity-50"
                            title="Xóa điểm dịch bệnh"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtab: Cơ Sở Y Tế Lân Cận */}
      {subTab === 'nearby_facilities' && isAdmin && (
        <NearbyFacilitiesManager settings={settings} />
      )}

      {/* Subtab: Footer & Quick Links */}
      {subTab === 'footer_links' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" />
                Cấu Hình Footer & Các Nhánh Liên Kết Nhanh
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Quản lý các liên kết nhanh đến Cổng Dịch vụ công, BHXH Việt Nam, Bộ Y tế và các cổng thông tin vệ tinh.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAddQuickLinkModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm liên kết mới</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Tên liên kết / Cổng</th>
                  <th className="py-3 px-3">Địa chỉ URL</th>
                  <th className="py-3 px-3">Mô tả tóm tắt</th>
                  <th className="py-3 px-3">Nhãn / Badge</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {quickLinksList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                      Chưa có liên kết nhanh tùy chỉnh. Đang hiển thị danh sách mặc định của Bộ Y tế.
                    </td>
                  </tr>
                ) : (
                  quickLinksList.map(link => (
                    <tr key={link.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{link.title}</span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-emerald-600 max-w-xs truncate">
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          {link.url}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </td>
                      <td className="py-3 px-3 text-slate-500 max-w-xs truncate">{link.description || '—'}</td>
                      <td className="py-3 px-3">
                        {link.badge ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {link.badge}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteQuickLink(link.id, link.title)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          title="Xóa liên kết này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Social Links Configuration Card (Facebook, Zalo, TikTok, YouTube) */}
          <form
            onSubmit={handleSaveSocialLinks}
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
          >
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                <span>Kênh Mạng Xã Hội Footer (Facebook, Zalo, TikTok, YouTube)</span>
                <span className="inline-flex items-center gap-1 ml-1">
                  <FacebookLogo className="w-4 h-4" />
                  <ZaloLogo className="w-4 h-4" />
                  <TikTokLogo className="w-4 h-4" />
                  <YouTubeLogo className="w-4 h-4" />
                </span>
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Icon mạng xã hội chỉ hiển thị ở Footer khi được nhập đường dẫn hợp lệ (bỏ trống nếu không sử dụng).
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <FacebookLogo className="w-4 h-4" />
                  <span>Facebook Fanpage URL</span>
                </label>
                <input
                  type="url"
                  value={socialFacebook}
                  onChange={e => setSocialFacebook(e.target.value)}
                  placeholder="https://facebook.com/tramytexa..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <ZaloLogo className="w-4 h-4" />
                  <span>Zalo OA / Liên hệ Zalo URL</span>
                </label>
                <input
                  type="url"
                  value={socialZalo}
                  onChange={e => setSocialZalo(e.target.value)}
                  placeholder="https://zalo.me/..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <TikTokLogo className="w-4 h-4" />
                  <span>TikTok Channel URL</span>
                </label>
                <input
                  type="url"
                  value={socialTiktok}
                  onChange={e => setSocialTiktok(e.target.value)}
                  placeholder="https://tiktok.com/@tramyte..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  <YouTubeLogo className="w-4 h-4" />
                  <span>YouTube Channel URL</span>
                </label>
                <input
                  type="url"
                  value={socialYoutube}
                  onChange={e => setSocialYoutube(e.target.value)}
                  placeholder="https://youtube.com/@tramyte..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={savingSocialLinks}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer"
              >
                {savingSocialLinks ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Lưu kênh mạng xã hội</span>
              </button>
            </div>
          </form>

          {/* Footer Editorial Board, Responsible Person & Copyright Form */}
          <form
            onSubmit={handleSaveFooterMeta}
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
          >
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Thông Tin Ban Biên Tập, Chịu Trách Nhiệm &amp; Bản Quyền Footer
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Hiển thị ở dải chân trang cuối cùng. Nếu để trống, hệ thống tự lấy theo Tên Trạm Y tế và Giám đốc trong cấu hình đơn vị.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ban biên tập
                </label>
                <input
                  type="text"
                  maxLength={256}
                  value={editorialBoard}
                  onChange={e => setEditorialBoard(e.target.value)}
                  placeholder={stationName || 'Trạm Y tế Phường / Xã ...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Chịu trách nhiệm nội dung
                </label>
                <input
                  type="text"
                  maxLength={256}
                  value={responsiblePerson}
                  onChange={e => setResponsiblePerson(e.target.value)}
                  placeholder="Giám đốc Nguyễn Văn A"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Bản quyền thuộc về
                </label>
                <input
                  type="text"
                  maxLength={512}
                  value={copyrightText}
                  onChange={e => setCopyrightText(e.target.value)}
                  placeholder={`© ${new Date().getFullYear()} Bản quyền thuộc về ${stationName || 'Trạm Y Tế'}`}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={savingFooterMeta}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {savingFooterMeta ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Lưu thông tin Ban biên tập &amp; Bản quyền</span>
              </button>
            </div>
          </form>

          {/* Software Team & Technical Support Contact Configuration Form */}
          <form
            onSubmit={handleSaveSoftwareTeamContact}
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-emerald-600" />
                  Thông Tin Liên Hệ Đội Ngũ Phần Mềm &amp; Hỗ Trợ Kỹ Thuật
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Hiển thị ở Footer, mục Cài đặt hệ thống và Tài khoản &amp; Thiết bị để người dùng/cán bộ liên hệ hỗ trợ kỹ thuật, báo lỗi hoặc nâng cấp tính năng.
                </p>
              </div>

              <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={softTeamEnabled}
                  aria-label="Bật hoặc tắt hiển thị liên hệ Đội ngũ Phần mềm"
                  onClick={() => void handleToggleSoftwareTeamImmediate()}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    softTeamEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                      softTeamEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {softTeamEnabled ? 'Đang hiển thị công khai' : 'Đang ẩn'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên đội ngũ / Đơn vị phát triển
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={softTeamName}
                  onChange={e => setSoftTeamName(e.target.value)}
                  placeholder="Ví dụ: Đội ngũ Kỹ thuật & Phần mềm Y tế số"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Vai trò / Bộ phận phụ trách
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={softTeamRole}
                  onChange={e => setSoftTeamRole(e.target.value)}
                  placeholder="Ví dụ: Phát triển phần mềm & Hỗ trợ vận hành 24/7"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Người phụ trách / Kỹ thuật viên
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={softTeamPerson}
                  onChange={e => setSoftTeamPerson(e.target.value)}
                  placeholder="Họ và tên người phụ trách kỹ thuật"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại / Hotline hỗ trợ kỹ thuật
                </label>
                <input
                  type="tel"
                  maxLength={64}
                  value={softTeamPhone}
                  onChange={e => setSoftTeamPhone(e.target.value)}
                  placeholder="09xx xxx xxx"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email liên hệ đội ngũ
                </label>
                <input
                  type="email"
                  maxLength={256}
                  value={softTeamEmail}
                  onChange={e => setSoftTeamEmail(e.target.value)}
                  placeholder="hotro@domain.vn"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Khung giờ tiếp nhận hỗ trợ
                </label>
                <input
                  type="text"
                  maxLength={200}
                  value={softTeamHours}
                  onChange={e => setSoftTeamHours(e.target.value)}
                  placeholder="Ví dụ: Thứ 2 - Thứ 7 (07:30 - 21:00)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Liên kết Zalo hỗ trợ (URL)
                </label>
                <input
                  type="url"
                  maxLength={512}
                  value={softTeamZalo}
                  onChange={e => setSoftTeamZalo(e.target.value)}
                  placeholder="https://zalo.me/..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Liên kết Facebook hỗ trợ (URL)
                </label>
                <input
                  type="url"
                  maxLength={512}
                  value={softTeamFacebook}
                  onChange={e => setSoftTeamFacebook(e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Website / Trang tài liệu đội ngũ (URL)
                </label>
                <input
                  type="url"
                  maxLength={512}
                  value={softTeamWebsite}
                  onChange={e => setSoftTeamWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú hướng dẫn liên hệ
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={softTeamNote}
                  onChange={e => setSoftTeamNote(e.target.value)}
                  placeholder="Ví dụ: Tiếp nhận báo lỗi kỹ thuật, yêu cầu chỉnh sửa giao diện và hướng dẫn quản trị viên."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                disabled={savingSoftTeam}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {savingSoftTeam ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Lưu liên hệ Đội ngũ Phần mềm</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtab 2: Users & Detailed RBAC */}
      {subTab === 'users' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Quản Lý Tài Khoản & Phân Quyền Vai Trò
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Phân loại rõ ràng giữa tài khoản cán bộ/quản trị có vai trò và tài khoản công dân thông thường. Tự động lọc &amp; cảnh báo trùng lặp Gmail hoặc số CCCD.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportUsersExcel}
                disabled={filteredUsersList.length === 0}
                className="self-start sm:self-auto px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer shrink-0"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Xuất Excel ({filteredUsersList.length})</span>
              </button>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setUserCategoryTab('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  userCategoryTab === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                Tất cả tài khoản ({users.length})
              </button>
              <button
                type="button"
                onClick={() => setUserCategoryTab('elevated')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  userCategoryTab === 'elevated'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                Quản trị Admin ({elevatedUsersCount})
              </button>
              <button
                type="button"
                onClick={() => setUserCategoryTab('organization')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  userCategoryTab === 'organization'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                Doanh nghiệp / Tổ chức ({orgUsersCount})
              </button>
              <button
                type="button"
                onClick={() => setUserCategoryTab('standard')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  userCategoryTab === 'standard'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                User / Người dùng ({standardUsersCount})
              </button>
              <button
                type="button"
                onClick={() => setUserCategoryTab('duplicates')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  userCategoryTab === 'duplicates'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60'
                }`}
              >
                ⚠️ Trùng Gmail / CCCD ({userDuplicateInfo.duplicateCount})
              </button>
              <button
                type="button"
                onClick={() => setUserCategoryTab('banned')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5 ${
                  userCategoryTab === 'banned'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:text-rose-300 dark:hover:bg-rose-900/60'
                }`}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Bị Ban ({bannedUsersCount})</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  <th className="py-3 px-3">AVT</th>
                  <th className="py-3 px-3">Họ và tên</th>
                  <th className="py-3 px-3">UID</th>
                  <th className="py-3 px-3">Email</th>
                  <th className="py-3 px-3">SĐT</th>
                  <th className="py-3 px-3">Số CCCD</th>
                  <th className="py-3 px-3">Ngày sinh</th>
                  <th className="py-3 px-3">Giới tính</th>
                  <th className="py-3 px-3">Loại tài khoản</th>
                  <th className="py-3 px-3">Vai trò</th>
                  <th className="py-3 px-3">Khoa / Phòng</th>
                  <th className="py-3 px-3">Chức vụ</th>
                  <th className="py-3 px-3">Hoạt động</th>
                  <th className="py-3 px-3">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-12 text-center text-slate-400">
                      {userCategoryTab === 'duplicates'
                        ? 'Tuyệt vời! Không phát hiện tài khoản nào bị trùng lặp Gmail hoặc CCCD.'
                        : 'Không tìm thấy tài khoản người dùng phù hợp với bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((rawUser: UserProfile, idx: number) => {
                    const u = hydrateUserWithVerifyState(rawUser);
                    const isDup = userDuplicateInfo.duplicateUids.has(u.uid);
                    const phoneVal = u.verifiedPhone || u.phoneNumber || '';
                    const vProg = getUserVerificationProgress(u, {
                      phoneNumber: phoneVal,
                    });
                    return (
                      <tr key={`user_${u.uid || 'no_uid'}_${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition whitespace-nowrap">
                        <td className="py-3 px-3">
                          <UserAvatar
                            src={u.avatarUrl}
                            name={u.displayName || u.email || 'User'}
                            size={34}
                            isPrimaryAdmin={u.role === 'super_admin' || isBootstrapAdminEmail(u.email)}
                            rounded="xl"
                          />
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {u.displayName || 'Chưa đặt tên'}
                            </span>
                            {vProg.isFullyVerified && <VerifiedBlueTick size="xs" />}
                            {isDup && (
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                title="Phát hiện trùng lặp Gmail hoặc CCCD với tài khoản khác"
                              >
                                ⚠️ Trùng
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {u.uid ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className="font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md select-all"
                                title={u.uid}
                              >
                                {u.uid}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleCopyUserUid(u.uid)}
                                className="p-1 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 cursor-pointer transition"
                                title="Sao chép UID"
                              >
                                {copiedUid === u.uid ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {u.email || '—'}
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {phoneVal || '—'}
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                          {u.citizenId || '—'}
                        </td>

                        <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                          {u.dob || '—'}
                        </td>

                        <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-300">
                          {u.gender || '—'}
                        </td>

                        <td className="py-3 px-3" colSpan={2}>
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              u.role === 'super_admin'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                : u.role === 'admin'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : u.role === 'organization' || u.accountType === 'organization'
                                ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                : u.role === 'other'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {getUserRoleLabel(u.role)}
                          </span>
                        </td>

                        <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-300">
                          {u.department || '—'}
                        </td>

                        <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-300">
                          {u.position || '—'}
                        </td>

                        <td className="py-3 px-3">
                          {(() => {
                            const activelyBanned = isUserActivelyBanned(u);
                            const effectiveStatus = getEffectiveUserStatus(u);
                            if (activelyBanned) {
                              const banSummary =
                                u.banType === 'permanent'
                                  ? 'Ban vô thời hạn'
                                  : `Ban đến ${formatBanTimestampVi(u.bannedUntilMs || u.bannedUntil)}`;
                              return (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
                                  title={u.banReason ? `Lý do: ${u.banReason}` : banSummary}
                                >
                                  <Ban className="w-3 h-3 shrink-0" />
                                  <span>{banSummary}</span>
                                </span>
                              );
                            }
                            return (
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  effectiveStatus === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                                    : effectiveStatus === 'suspended'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                                }`}
                              >
                                {effectiveStatus === 'active'
                                  ? 'Hoạt động'
                                  : effectiveStatus === 'suspended'
                                  ? 'Tạm khóa'
                                  : 'Chờ duyệt'}
                              </span>
                            );
                          })()}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                vProg.isFullyVerified
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/70'
                              }`}
                            >
                              {vProg.isFullyVerified ? 'Đã xác minh' : 'Chưa hoàn thành'}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {vProg.completedCount}/{vProg.totalCount} ·{' '}
                              <span className={vProg.paidVerified ? 'text-sky-600 dark:text-sky-400 font-semibold' : 'text-rose-600 dark:text-rose-400'}>
                                {vProg.paidVerified ? 'Đã mua Verify' : 'Chưa mua Verify'}
                              </span>
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingUser(u)}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" /> Chỉnh sửa
                            </button>

                            {(u.role === 'super_admin' || isBootstrapAdminEmail(u.email)) ? (
                              <span
                                className="px-2 py-1 text-xs font-semibold rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 inline-flex items-center gap-1"
                                title="Tài khoản Super Admin luôn ở trạng thái Đang mở"
                              >
                                <Unlock className="w-3 h-3" />
                                <span>Đang mở</span>
                              </span>
                            ) : (u.identityVerifiedFromDatabase || u.citizenIdVerified || u.allowIdentityEditByAdmin) && (
                              <button
                                type="button"
                                onClick={() => void handleToggleUserIdentityEdit(u)}
                                className={`px-2 py-1 text-xs font-semibold rounded-lg transition inline-flex items-center gap-1 cursor-pointer ${
                                  u.allowIdentityEditByAdmin
                                    ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100'
                                    : 'text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40'
                                }`}
                                title={
                                  u.allowIdentityEditByAdmin
                                    ? 'Đang mở cho phép người dùng sửa thông tin — Nhấn để khóa lại'
                                    : 'Đang khóa thông tin — Nhấn để mở cho phép người dùng chỉnh sửa'
                                }
                              >
                                {u.allowIdentityEditByAdmin ? (
                                  <>
                                    <Lock className="w-3 h-3" />
                                    <span>Khóa sửa TT</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3 h-3" />
                                    <span>Mở sửa TT</span>
                                  </>
                                )}
                              </button>
                            )}

                            {u.twoFactorEnabled && (
                              <button
                                type="button"
                                onClick={() => handleAdminResetUser2FA(u)}
                                className="px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                                title="Đặt lại (xóa) Authenticator 2FA để người dùng thiết lập lại"
                              >
                                Đặt lại 2FA
                              </button>
                            )}

                            {u.uid !== currentUser.uid && !isProtectedSuperAdminProfile(u) && (
                              isUserActivelyBanned(u) ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnbanUser(u)}
                                  className="px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Gỡ Ban và khôi phục quyền truy cập"
                                >
                                  <Unlock className="w-3.5 h-3.5" /> Gỡ Ban
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openBanModal(u)}
                                  className="px-2 py-1 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Ban tài khoản (có thời hạn hoặc vô thời hạn)"
                                >
                                  <Ban className="w-3.5 h-3.5" /> Ban
                                </button>
                              )
                            )}

                            {u.uid !== currentUser.uid &&
                              !isBootstrapAdminEmail(u.email) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="px-2 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                                  title="Xóa tài khoản người dùng này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <PaginationBar
            currentPage={usersPage}
            totalItems={filteredUsersList.length}
            pageSize={USERS_PAGE_SIZE}
            onPageChange={setUsersPage}
            itemLabel="người dùng"
          />

          {/* User Edit Modal */}
          {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg md:max-w-3xl lg:max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-emerald-600" />
                    Chỉnh Sửa Hồ Sơ & Phân Quyền
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveUserDetail} className="space-y-3.5 text-xs">
                  {(() => {
                    const editVProg = getUserVerificationProgress(editingUser, {
                      phoneNumber: editingUser.verifiedPhone || editingUser.phoneNumber,
                    });
                    const trustedCount = editingUserDevices
                      ? editingUserDevices.filter(d => d.isTrusted).length
                      : undefined;
                    const syncSecurityItems = getAccountSecuritySyncItems(editingUser, {
                      phoneNumber: editingUser.verifiedPhone || editingUser.phoneNumber,
                      trustedDevicesCount: trustedCount,
                      currentDeviceTrusted:
                        trustedCount !== undefined ? trustedCount > 0 : undefined,
                      isAdmin:
                        editingUser.role === 'admin' ||
                        editingUser.role === 'super_admin' ||
                        editingUser.accountType === 'admin' ||
                        isBootstrapAdminEmail(editingUser.email),
                    });
                    return (
                      <>
                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] text-slate-400">Email:</span>
                            <div className="font-semibold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                              <span className="truncate">{editingUser.email}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-slate-400">UID:</span>
                            <div className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              <span className="select-all">{editingUser.uid}</span>
                              <button
                                type="button"
                                onClick={() => void handleCopyUserUid(editingUser.uid)}
                                className="p-0.5 rounded text-slate-400 hover:text-emerald-600 cursor-pointer"
                                title="Sao chép UID"
                              >
                                {copiedUid === editingUser.uid ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Gói Verify & Thời hạn Tick Xanh */}
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <BadgeCheck className={`w-4 h-4 ${editingUser.isVip ? 'text-sky-500' : 'text-slate-400'}`} />
                              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                Trạng thái Verify (Tick Xanh): {editingUser.isVip ? 'Đã Verify' : 'Chưa Verify'}
                              </span>
                            </div>
                            {editingUser.isVip && (
                              <button
                                type="button"
                                onClick={() => handleAdminRevokeUserVerify(editingUser)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                                title="Gỡ gói Verify (xóa trạng thái xác minh), bắt buộc người dùng phải mua lại"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Gỡ gói Verify (Thu hồi)</span>
                              </button>
                            )}
                          </div>
                          {editingUser.isVip && (
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                              <div>Mã đơn SePay đối soát: <strong className="font-mono">{editingUser.vipOrderCode || 'Cấp bởi Admin'}</strong></div>
                              <div>Thời hạn hiệu lực: <strong className="text-emerald-700 dark:text-emerald-300">{editingUser.vipExpiresAt ? new Date(editingUser.vipExpiresAt).toLocaleString('vi-VN') : 'Dài hạn'}</strong></div>
                            </div>
                          )}
                        </div>

                        {/* Bảo mật & Xác minh tài khoản (Đồng bộ với Hồ sơ người dùng) */}
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 tabular-nums">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                <span>{ACCOUNT_SECURITY_CARD_TITLE}</span>
                                {editVProg.isFullyVerified && <VerifiedBlueTick size="xs" />}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                Đã hoàn tất {editVProg.completedCount}/{editVProg.totalCount} điều kiện xác minh ({editVProg.percent}%)
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAdminResetUser2FA(editingUser)}
                              className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer transition"
                              title="Xóa dữ liệu Authenticator 2FA của tài khoản này để người dùng thiết lập lại"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>Đặt lại (Xóa) Authenticator</span>
                            </button>
                          </div>

                          <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${editVProg.percent}%` }}
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                            {syncSecurityItems.map(item => (
                              <div
                                key={item.key}
                                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70"
                              >
                                <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                  {item.title}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md font-semibold shrink-0 text-[10px] ${
                                    item.tone === 'emerald'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : item.tone === 'sky'
                                      ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                      : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {item.statusLabel}
                                </span>
                              </div>
                            ))}
                            {editingUser.smsMfaEnabled && (
                              <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900/70 border border-sky-200/70 dark:border-sky-800/60">
                                <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                                  SMS MFA (Dự phòng)
                                </span>
                                <span className="px-2 py-0.5 rounded-md font-semibold shrink-0 text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                                  Đang bật
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Họ và tên *
                      </label>
                      <input
                        type="text"
                        required
                        value={editingUser.displayName || ''}
                        onChange={e => setEditingUser({ ...editingUser, displayName: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Số điện thoại (10 số)
                      </label>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        value={editingUser.phoneNumber || ''}
                        onChange={e =>
                          setEditingUser({
                            ...editingUser,
                            phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10),
                          })
                        }
                        placeholder="0912345678 (10 chữ số)"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Số CCCD / CMND (12 số)
                      </label>
                      <input
                        type="text"
                        maxLength={12}
                        value={editingUser.citizenId || ''}
                        onChange={e => setEditingUser({ ...editingUser, citizenId: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Ngày sinh
                      </label>
                      <input
                        type="date"
                        value={editingUser.dob || ''}
                        onChange={e => setEditingUser({ ...editingUser, dob: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Giới tính
                      </label>
                      <select
                        value={editingUser.gender || 'Nam'}
                        onChange={e => setEditingUser({ ...editingUser, gender: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Địa chỉ chi tiết
                      </label>
                      <input
                        type="text"
                        value={editingUser.address || ''}
                        onChange={e => setEditingUser({ ...editingUser, address: e.target.value })}
                        placeholder="Số nhà, khóm/ấp..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Admin Lock / Unlock Control for Identity Info */}
                  {editingUser.role === 'super_admin' || isBootstrapAdminEmail(editingUser.email) ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                          <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Quyền chỉnh sửa &amp; thao tác của Super Admin</span>
                        </div>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                          Super Admin luôn ở trạng thái Đang mở toàn bộ — không có ngoại lệ khóa hay giới hạn thao tác.
                        </p>
                      </div>
                      <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold shrink-0 bg-emerald-600 text-white">
                        Đang mở
                      </span>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                          {editingUser.allowIdentityEditByAdmin ? (
                            <Unlock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span>Cho phép người dùng tự chỉnh sửa thông tin định danh</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {editingUser.allowIdentityEditByAdmin
                            ? 'Đang MỞ: Người dùng có thể chỉnh sửa tất cả thông tin định danh, kể cả Số CCCD/VNeID, SĐT, Họ tên, Ngày sinh, Giới tính, Địa chỉ.'
                            : editingUser.identityVerifiedFromDatabase || editingUser.citizenIdVerified
                            ? 'Đang KHÓA: Toàn bộ thông tin định danh (CCCD, Họ tên, Ngày sinh, Giới tính, Địa chỉ...) được khóa không cho người dùng tự chỉnh sửa.'
                            : 'Tài khoản chưa khóa CCCD. Bật để chủ động cho phép chỉnh sửa toàn bộ ngay cả khi xác minh.'}
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[11px] font-bold ${
                            editingUser.allowIdentityEditByAdmin
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {editingUser.allowIdentityEditByAdmin ? 'Đang MỞ' : 'Đang KHÓA'}
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!!editingUser.allowIdentityEditByAdmin}
                          aria-label="Cho phép người dùng tự chỉnh sửa thông tin định danh"
                          onClick={() =>
                            setEditingUser({
                              ...editingUser,
                              allowIdentityEditByAdmin: !editingUser.allowIdentityEditByAdmin,
                            })
                          }
                          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                            editingUser.allowIdentityEditByAdmin ? 'bg-emerald-600' : 'bg-rose-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                              editingUser.allowIdentityEditByAdmin ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Vai trò &amp; Loại tài khoản (Unified Role) *
                    </label>
                    <select
                      value={editingUser.role || editingUser.accountType || 'user'}
                      onChange={e => {
                        const val = e.target.value as any;
                        setEditingUser({ ...editingUser, role: val, accountType: val });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="user">User (Người dùng cá nhân)</option>
                      <option value="organization">Doanh nghiệp / Tổ chức</option>
                      <option value="admin">Admin (Quản trị viên)</option>
                      <option value="super_admin">Super Admin (Quản trị tối cao)</option>
                      <option value="other">Khác (Tài khoản khác)</option>
                    </select>
                  </div>

                  {(editingUser.role === 'organization' || editingUser.accountType === 'organization') && (
                    <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 space-y-3">
                      <div className="font-bold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-sky-600" />
                        <span>Thông tin Doanh nghiệp / Tổ chức liên kết</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Tên Doanh nghiệp / Tổ chức
                          </label>
                          <input
                            type="text"
                            value={editingUser.organizationName || ''}
                            onChange={e => setEditingUser({ ...editingUser, organizationName: e.target.value })}
                            placeholder="Công ty TNHH / Phòng khám / Nhà thuốc..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Loại hình
                          </label>
                          <select
                            value={editingUser.organizationType || 'enterprise'}
                            onChange={e => setEditingUser({ ...editingUser, organizationType: e.target.value as any })}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          >
                            <option value="enterprise">Doanh nghiệp</option>
                            <option value="clinic">Phòng khám</option>
                            <option value="pharmacy">Nhà thuốc</option>
                            <option value="school">Trường học</option>
                            <option value="agency">Cơ quan nhà nước</option>
                            <option value="other">Khác</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Mã số thuế (MST)
                          </label>
                          <input
                            type="text"
                            value={editingUser.taxCode || ''}
                            onChange={e => setEditingUser({ ...editingUser, taxCode: e.target.value })}
                            placeholder="Mã số thuế"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Hotline tổ chức
                          </label>
                          <input
                            type="text"
                            value={editingUser.organizationPhone || ''}
                            onChange={e => setEditingUser({ ...editingUser, organizationPhone: e.target.value })}
                            placeholder="Số điện thoại đơn vị"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Địa chỉ trụ sở
                          </label>
                          <input
                            type="text"
                            value={editingUser.organizationAddress || ''}
                            onChange={e => setEditingUser({ ...editingUser, organizationAddress: e.target.value })}
                            placeholder="Địa chỉ trụ sở"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Khoa / Phòng / Đơn vị phụ trách
                    </label>
                    {isNonAdminHealthStaffAccount(editingUser.accountType, editingUser.role) ? (
                      (() => {
                        const deptOptions = getStationDepartmentOptions(
                          settings.orgChart,
                          editingUser.department
                        );
                        const selectedDeptValue = resolveDepartmentOptionValue(
                          editingUser.department,
                          deptOptions
                        );
                        return (
                          <>
                            <select
                              value={selectedDeptValue}
                              onChange={e =>
                                setEditingUser({ ...editingUser, department: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            >
                              <option value="">-- Chọn Khoa / Phòng / Đơn vị thuộc Trạm --</option>
                              {deptOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
                              Chọn trực tiếp từ danh sách Khoa / Phòng thuộc nhân lực của Trạm Y tế.
                            </p>
                          </>
                        );
                      })()
                    ) : (
                      <input
                        type="text"
                        value={editingUser.department || ''}
                        onChange={e => setEditingUser({ ...editingUser, department: e.target.value })}
                        placeholder="Khoa Khám bệnh, Tổ Tiêm chủng..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Chức vụ
                      </label>
                      <input
                        type="text"
                        value={editingUser.position || ''}
                        onChange={e => setEditingUser({ ...editingUser, position: e.target.value })}
                        placeholder="Trưởng trạm, Y sĩ..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Chức danh chuyên môn
                      </label>
                      <input
                        type="text"
                        value={editingUser.qualification || ''}
                        onChange={e => setEditingUser({ ...editingUser, qualification: e.target.value })}
                        placeholder="Bác sĩ CKI, Cử nhân ĐD..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Trạng thái hoạt động
                      </label>
                      <select
                        value={editingUser.status}
                        onChange={e => {
                          const nextStatus = e.target.value as UserProfile['status'];
                          if (nextStatus === 'banned') {
                            const defaultUntilMs =
                              editingUser.bannedUntilMs && editingUser.bannedUntilMs > Date.now()
                                ? editingUser.bannedUntilMs
                                : Date.now() + 24 * 60 * 60 * 1000;
                            setEditingUser({
                              ...editingUser,
                              status: 'banned',
                              banType: editingUser.banType || 'temporary',
                              bannedUntilMs:
                                (editingUser.banType || 'temporary') === 'temporary'
                                  ? defaultUntilMs
                                  : undefined,
                              bannedUntil:
                                (editingUser.banType || 'temporary') === 'temporary'
                                  ? new Date(defaultUntilMs).toISOString()
                                  : undefined,
                            });
                          } else {
                            setEditingUser({ ...editingUser, status: nextStatus });
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="active">Đang hoạt động</option>
                        <option value="pending_approval">Chờ duyệt</option>
                        <option value="suspended">Tạm khóa</option>
                        <option
                          value="banned"
                          disabled={
                            editingUser.uid === currentUser.uid ||
                            isProtectedSuperAdminProfile(editingUser)
                          }
                        >
                          Bị Ban (Khóa truy cập)
                        </option>
                      </select>
                    </div>
                  </div>

                  {editingUser.status === 'banned' &&
                    editingUser.uid !== currentUser.uid &&
                    !isProtectedSuperAdminProfile(editingUser) && (
                      <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-bold text-rose-800 dark:text-rose-200 flex items-center gap-1.5">
                            <Ban className="w-4 h-4 shrink-0" />
                            <span>Cấu hình Ban tài khoản</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnbanUser(editingUser)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Unlock className="w-3 h-3" />
                            <span>Gỡ Ban ngay</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block font-semibold text-rose-900 dark:text-rose-200 mb-1">
                              Hình thức Ban
                            </label>
                            <select
                              value={editingUser.banType || 'temporary'}
                              onChange={e => {
                                const mode = e.target.value as 'temporary' | 'permanent';
                                const nextMs =
                                  editingUser.bannedUntilMs && editingUser.bannedUntilMs > Date.now()
                                    ? editingUser.bannedUntilMs
                                    : Date.now() + 24 * 60 * 60 * 1000;
                                setEditingUser({
                                  ...editingUser,
                                  banType: mode,
                                  bannedUntilMs: mode === 'temporary' ? nextMs : undefined,
                                  bannedUntil:
                                    mode === 'temporary' ? new Date(nextMs).toISOString() : undefined,
                                });
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                            >
                              <option value="temporary">Ban có thời hạn</option>
                              <option value="permanent">Ban vô thời hạn</option>
                            </select>
                          </div>

                          {(editingUser.banType || 'temporary') === 'temporary' && (
                            <div>
                              <label className="block font-semibold text-rose-900 dark:text-rose-200 mb-1">
                                Thời điểm tự mở khóa
                              </label>
                              <input
                                type="datetime-local"
                                value={
                                  editingUser.bannedUntilMs
                                    ? toLocalDateTimeInputValue(editingUser.bannedUntilMs)
                                    : editingUser.bannedUntil
                                    ? toLocalDateTimeInputValue(new Date(editingUser.bannedUntil).getTime())
                                    : toLocalDateTimeInputValue(Date.now() + 24 * 60 * 60 * 1000)
                                }
                                onChange={e => {
                                  const ms = new Date(e.target.value).getTime();
                                  if (Number.isFinite(ms)) {
                                    setEditingUser({
                                      ...editingUser,
                                      bannedUntilMs: ms,
                                      bannedUntil: new Date(ms).toISOString(),
                                    });
                                  }
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block font-semibold text-rose-900 dark:text-rose-200 mb-1">
                            Lý do Ban
                          </label>
                          <input
                            type="text"
                            value={editingUser.banReason || ''}
                            onChange={e => setEditingUser({ ...editingUser, banReason: e.target.value })}
                            placeholder="Nhập lý do tạm ngừng quyền truy cập..."
                            className="w-full px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                      </div>
                    )}

                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingUser(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                    >
                      Huỷ bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={savingUser}
                      className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition"
                    >
                      {savingUser ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Ban User Modal */}
          {banModalUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/60 shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                    <Ban className="w-5 h-5" />
                    <span>Ban tài khoản người dùng</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setBanModalUser(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700 text-xs space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {banModalUser.displayName || 'Chưa đặt tên'}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 truncate">
                    {banModalUser.email}
                  </div>
                </div>

                <form onSubmit={handleConfirmBanUser} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      Hình thức Ban
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBanMode('temporary')}
                        className={`p-2.5 rounded-xl border font-semibold text-left transition cursor-pointer ${
                          banMode === 'temporary'
                            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-400 text-rose-800 dark:text-rose-200'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Có thời hạn</span>
                        </div>
                        <p className="text-[10px] font-normal opacity-80 mt-0.5">
                          Tự động mở khóa khi hết hạn
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBanMode('permanent')}
                        className={`p-2.5 rounded-xl border font-semibold text-left transition cursor-pointer ${
                          banMode === 'permanent'
                            ? 'bg-rose-600 border-rose-600 text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Ban className="w-3.5 h-3.5" />
                          <span>Vô thời hạn</span>
                        </div>
                        <p className="text-[10px] font-normal opacity-80 mt-0.5">
                          Khóa vĩnh viễn tới khi Admin gỡ
                        </p>
                      </button>
                    </div>
                  </div>

                  {banMode === 'temporary' && (
                    <div className="space-y-2.5">
                      <label className="block font-semibold text-slate-700 dark:text-slate-300">
                        Chọn thời gian Ban
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {BAN_DURATION_PRESETS.map(preset => (
                          <button
                            key={preset.key}
                            type="button"
                            onClick={() => setBanPreset(preset.key)}
                            className={`px-2.5 py-2 rounded-xl border text-[11px] font-semibold transition cursor-pointer ${
                              banPreset === preset.key
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {banPreset === 'custom' ? (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Chọn ngày &amp; giờ mở khóa
                          </label>
                          <input
                            type="datetime-local"
                            required
                            value={banCustomUntil}
                            onChange={e => setBanCustomUntil(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500"
                          />
                        </div>
                      ) : (
                        <div className="px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-200">
                          Dự kiến tự mở khóa lúc:{' '}
                          <span className="font-bold">
                            {formatBanTimestampVi(
                              Date.now() +
                                (BAN_DURATION_PRESETS.find(p => p.key === banPreset)?.durationMs ||
                                  24 * 60 * 60 * 1000)
                            )}
                          </span>{' '}
                          ({formatBanRemainingVi(
                            Date.now() +
                              (BAN_DURATION_PRESETS.find(p => p.key === banPreset)?.durationMs ||
                                24 * 60 * 60 * 1000)
                          )})
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-slate-700 dark:text-slate-300">
                      Lý do Ban
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Spam / Gửi nội dung không phù hợp',
                        'Mạo danh thông tin công dân / cán bộ',
                        'Vi phạm quy định sử dụng cổng y tế',
                      ].map(sample => (
                        <button
                          key={sample}
                          type="button"
                          onClick={() => setBanReasonInput(sample)}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          {sample}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={3}
                      value={banReasonInput}
                      onChange={e => setBanReasonInput(e.target.value)}
                      placeholder="Nhập lý do khóa truy cập hiển thị cho người dùng..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setBanModalUser(null)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Huỷ bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={submittingBan}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>{submittingBan ? 'Đang xử lý...' : 'Xác nhận Ban'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Đối chiếu & Xác nhận User sau Di trú Firebase Mới */}
          {isAdmin && (
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/60 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                    <span>Đối Chiếu Dữ Liệu User Sau Chuyển Firebase Mới</span>
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Khi khôi phục hệ thống trừ bảng User sang Firebase mới, bật chế độ này để nhắc người dùng đăng nhập kiểm tra &amp; xác nhận dữ liệu cũ.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={loadingMigrationData}
                    onClick={() => void fetchMigrationData()}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMigrationData ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                  </button>

                  <button
                    type="button"
                    disabled={migrationToggleSaving}
                    onClick={async () => {
                      setMigrationToggleSaving(true);
                      try {
                        const nextVal = !settings.migrationReconciliationActive;
                        await updateSystemSettings({
                          migrationReconciliationActive: nextVal,
                          migrationBannerNote: migrationBannerNoteInput.trim(),
                          updatedAt: new Date().toISOString(),
                        });
                        showToast(
                          'success',
                          nextVal
                            ? 'Đã bật nhắc User đối chiếu dữ liệu di trú'
                            : 'Đã tắt nhắc User đối chiếu dữ liệu di trú'
                        );
                      } catch {
                        showToast('error', 'Không thể cập nhật trạng thái đối chiếu');
                      } finally {
                        setMigrationToggleSaving(false);
                      }
                    }}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white transition cursor-pointer whitespace-nowrap ${
                      settings.migrationReconciliationActive
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-amber-600 hover:bg-amber-700'
                    }`}
                  >
                    {settings.migrationReconciliationActive
                      ? 'Đang BẬT đối chiếu User'
                      : 'Bật nhắc đối chiếu User'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="text-slate-500 dark:text-slate-400">Hồ sơ cũ chờ đối chiếu</div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {legacySnapshots.filter(s => s.claimStatus === 'pending').length} / {legacySnapshots.length}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                  <div className="text-rose-700 dark:text-rose-300 font-semibold">Yêu cầu điều chỉnh sai/thiếu</div>
                  <div className="text-lg font-extrabold text-rose-800 dark:text-rose-200 tabular-nums mt-0.5">
                    {migrationClaims.filter(c => c.status === 'disputed' || c.status === 'pending').length}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-emerald-700 dark:text-emerald-300 font-semibold">Đã xác nhận / Hoàn tất</div>
                  <div className="text-lg font-extrabold text-emerald-800 dark:text-emerald-200 tabular-nums mt-0.5">
                    {migrationClaims.filter(c => c.status === 'confirmed' || c.status === 'resolved').length}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 text-xs">
                <input
                  type="text"
                  value={migrationBannerNoteInput}
                  onChange={e => setMigrationBannerNoteInput(e.target.value)}
                  placeholder="Ghi chú hiển thị cho người dân khi đăng nhập kiểm tra dữ liệu di trú..."
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  disabled={migrationToggleSaving}
                  onClick={async () => {
                    setMigrationToggleSaving(true);
                    try {
                      await updateSystemSettings({
                        migrationBannerNote: migrationBannerNoteInput.trim(),
                        updatedAt: new Date().toISOString(),
                      });
                      showToast('success', 'Đã lưu ghi chú thông báo di trú');
                    } catch {
                      showToast('error', 'Lưu ghi chú thất bại');
                    } finally {
                      setMigrationToggleSaving(false);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold whitespace-nowrap cursor-pointer"
                >
                  Lưu ghi chú
                </button>
              </div>

              {migrationClaims.length === 0 ? (
                <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 text-center">
                  Chưa có yêu cầu xác nhận hoặc điều chỉnh nào từ người dùng.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase whitespace-nowrap">
                        <th className="py-2.5 px-3">Người dùng</th>
                        <th className="py-2.5 px-3">Trạng thái</th>
                        <th className="py-2.5 px-3">Mục báo sai/thiếu</th>
                        <th className="py-2.5 px-3">Nội dung phản hồi</th>
                        <th className="py-2.5 px-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {migrationClaims.map(claim => {
                        const isPending = claim.status === 'disputed' || claim.status === 'pending';
                        return (
                          <tr key={claim.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 dark:text-white">
                                {claim.displayName || 'Chưa cập nhật'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">{claim.email}</div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isPending
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : claim.status === 'rejected'
                                    ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                }`}
                              >
                                {claim.status === 'disputed'
                                  ? 'Báo sai / thiếu'
                                  : claim.status === 'pending'
                                  ? 'Chờ Admin duyệt'
                                  : claim.status === 'rejected'
                                  ? 'Từ chối'
                                  : claim.status === 'resolved'
                                  ? 'Đã điều chỉnh'
                                  : 'Đã xác nhận'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {(claim.disputedFields || []).length > 0
                                ? claim.disputedFields!.join(', ')
                                : '—'}
                            </td>
                            <td className="py-2.5 px-3 max-w-[260px]">
                              <p className="line-clamp-2 text-slate-700 dark:text-slate-300">
                                {claim.userNote || claim.adminNote || '—'}
                              </p>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const liveUser = users.find(u => u.uid === claim.uid);
                                  setResolvingClaim(claim);
                                    setClaimEditValues({
                                      displayName: liveUser?.displayName || claim.displayName || '',
                                      phoneNumber: liveUser?.phoneNumber || liveUser?.verifiedPhone || '',
                                      citizenId: liveUser?.citizenId || '',
                                      department: liveUser?.department || '',
                                      position: liveUser?.position || '',
                                      role: liveUser?.role || 'user',
                                      accountType: liveUser?.accountType || 'user',
                                    });
                                    setAdminClaimNote(claim.adminNote || '');
                                  }}
                                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                {isPending ? 'Kiểm tra & Điều chỉnh' : 'Xem chi tiết'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Modal Admin Resolve Migration Claim */}
          {resolvingClaim && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl md:max-w-3xl w-full p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Điều Chỉnh Hồ Sơ Di Trú
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono">{resolvingClaim.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResolvingClaim(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {(resolvingClaim.userNote || (resolvingClaim.disputedFields || []).length > 0) && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 space-y-1">
                    <div className="font-bold">Ghi chú từ người dùng:</div>
                    {resolvingClaim.userNote && <p>{resolvingClaim.userNote}</p>}
                    {(resolvingClaim.disputedFields || []).length > 0 && (
                      <div className="text-[11px] font-semibold pt-1">
                        Mục báo sai/thiếu: {resolvingClaim.disputedFields!.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Họ và tên</label>
                    <input
                      type="text"
                      value={claimEditValues.displayName}
                      onChange={e => setClaimEditValues(p => ({ ...p, displayName: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Số điện thoại</label>
                    <input
                      type="text"
                      value={claimEditValues.phoneNumber}
                      onChange={e => setClaimEditValues(p => ({ ...p, phoneNumber: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Số CCCD</label>
                    <input
                      type="text"
                      value={claimEditValues.citizenId}
                      onChange={e => setClaimEditValues(p => ({ ...p, citizenId: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Khoa / Phòng</label>
                    {isNonAdminHealthStaffAccount(
                      claimEditValues.accountType,
                      claimEditValues.role
                    ) ? (
                      (() => {
                        const deptOptions = getStationDepartmentOptions(
                          settings.orgChart,
                          claimEditValues.department
                        );
                        const selectedDeptValue = resolveDepartmentOptionValue(
                          claimEditValues.department,
                          deptOptions
                        );
                        return (
                          <select
                            value={selectedDeptValue}
                            onChange={e =>
                              setClaimEditValues(p => ({ ...p, department: e.target.value }))
                            }
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                          >
                            <option value="">-- Chọn Khoa / Phòng / Đơn vị thuộc Trạm --</option>
                            {deptOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        );
                      })()
                    ) : (
                      <input
                        type="text"
                        value={claimEditValues.department}
                        onChange={e => setClaimEditValues(p => ({ ...p, department: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Chức vụ</label>
                    <input
                      type="text"
                      value={claimEditValues.position}
                      onChange={e => setClaimEditValues(p => ({ ...p, position: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Vai trò tài khoản (Role)</label>
                    <select
                      value={claimEditValues.role || claimEditValues.accountType || 'user'}
                      onChange={e => {
                        const val = e.target.value as any;
                        setClaimEditValues(p => ({ ...p, role: val, accountType: val }));
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                    >
                      <option value="user">User (Người dùng)</option>
                      <option value="organization">Doanh nghiệp / Tổ chức</option>
                      <option value="admin">Admin (Quản trị viên)</option>
                      {canManageSuperAdminTier && <option value="super_admin">Super Admin (Quản trị tối cao)</option>}
                      <option value="other">Khác (Tài khoản khác)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Phản hồi của Quản trị viên</label>
                  <textarea
                    rows={2}
                    value={adminClaimNote}
                    onChange={e => setAdminClaimNote(e.target.value)}
                    placeholder="Ghi chú xác nhận hoặc hướng dẫn cho người dùng..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 resize-none"
                  />
                </div>

                <div className={getBalancedMobileGridClass(3, 'pt-3 border-t border-slate-100 dark:border-slate-800 sm:justify-end')}>
                  <button
                    type="button"
                    disabled={savingClaimResolution}
                    onClick={() => setResolvingClaim(null)}
                    className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    disabled={savingClaimResolution}
                    onClick={async () => {
                      setSavingClaimResolution(true);
                      try {
                        await resolveUserMigrationClaim({
                          claim: resolvingClaim,
                          action: 'reject',
                          adminUid: currentUser?.uid || 'admin',
                          adminName: userProfile?.displayName || currentUser?.email || PRIMARY_ADMIN_EMAIL,
                          adminNote: adminClaimNote.trim() || 'Không tìm thấy sai lệch dữ liệu.',
                        });
                        showToast('info', 'Đã từ chối yêu cầu điều chỉnh');
                        setResolvingClaim(null);
                        void fetchMigrationData();
                        onRefreshData();
                      } catch (err: any) {
                        showToast('error', 'Thao tác thất bại', err?.message);
                      } finally {
                        setSavingClaimResolution(false);
                      }
                    }}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold cursor-pointer"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    disabled={savingClaimResolution}
                    onClick={async () => {
                      setSavingClaimResolution(true);
                      try {
                        await resolveUserMigrationClaim({
                          claim: resolvingClaim,
                          action: 'resolve',
                          adminUid: currentUser?.uid || 'admin',
                          adminName: userProfile?.displayName || currentUser?.email || PRIMARY_ADMIN_EMAIL,
                          adminNote: adminClaimNote.trim() || 'Đã đối chiếu & cập nhật hồ sơ đầy đủ.',
                          updatedUserFields: claimEditValues,
                        });
                        showToast('success', 'Đã cập nhật & hoàn tất đối chiếu cho tài khoản');
                        setResolvingClaim(null);
                        void fetchMigrationData();
                        onRefreshData();
                      } catch (err: any) {
                        showToast('error', 'Không thể lưu cập nhật', err?.message);
                      } finally {
                        setSavingClaimResolution(false);
                      }
                    }}
                    className={`${getBalancedMobileItemSpan(2, 3)} min-h-[40px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer`}
                  >
                    {savingClaimResolution ? 'Đang lưu...' : 'Áp dụng & Hoàn tất'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtab: Link & Mã Giới Thiệu Theo 2 Đối Tượng (Super Admin & Admin) */}
      {subTab === 'referral_codes' && isAdmin && (() => {
        const superAdminCodes = referralCodes.filter(
          item => (item.issuerTier || 'super_admin') === 'super_admin'
        );
        const adminCodes = referralCodes.filter(item => item.issuerTier === 'admin');
        const activeCount = referralCodes.filter(item => item.active).length;
        const totalUsedCount = referralCodes.reduce((sum, item) => sum + (item.usedCount || 0), 0);
        const visibleTiers: ReferralIssuerTier[] =
          referralTierFilter === 'all' ? ['super_admin', 'admin'] : [referralTierFilter];

        return (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/60 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-emerald-600" />
                    <span>Link &amp; Mã Giới Thiệu Theo 2 Đối Tượng (Super Admin &amp; Admin)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Phân tách rõ 2 luồng mời: <strong>Đối tượng Super Admin</strong> (có thể mời Admin Trạm hoặc Cán bộ Y tế) và <strong>Đối tượng Admin</strong> (mời Cán bộ Y tế).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void refreshReferralCodesList()}
                  disabled={loadingReferrals}
                  className="self-start sm:self-auto px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingReferrals ? 'animate-spin text-emerald-600' : ''}`} />
                  <span>Làm mới</span>
                </button>
              </div>

              {/* Summary + Tier Filter */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tổng mã mời</div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums mt-0.5">
                    {referralCodes.length}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60">
                  <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Super Admin</div>
                  <div className="text-lg font-extrabold text-amber-900 dark:text-amber-200 tabular-nums mt-0.5">
                    {superAdminCodes.length}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
                  <div className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">Admin Trạm</div>
                  <div className="text-lg font-extrabold text-emerald-900 dark:text-emerald-200 tabular-nums mt-0.5">
                    {adminCodes.length}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60">
                  <div className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">Đang bật / Đã dùng</div>
                  <div className="text-lg font-extrabold text-blue-900 dark:text-blue-200 tabular-nums mt-0.5">
                    {activeCount} <span className="text-xs font-semibold opacity-75">/ {totalUsedCount} lượt</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReferralTierFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    referralTierFilter === 'all'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Tất cả ({referralCodes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReferralTierFilter('super_admin')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    referralTierFilter === 'super_admin'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/50'
                  }`}
                >
                  Đối tượng Super Admin ({superAdminCodes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReferralTierFilter('admin')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    referralTierFilter === 'admin'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/50'
                  }`}
                >
                  Đối tượng Admin ({adminCodes.length})
                </button>
              </div>

              {/* Create Form */}
              <form onSubmit={handleCreateReferralCode} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="sm:col-span-2">
                  <select
                    value={canManageSuperAdminTier ? newRefIssuerTier : 'admin'}
                    disabled={!canManageSuperAdminTier}
                    onChange={e => {
                      const nextTier = e.target.value as ReferralIssuerTier;
                      setNewRefIssuerTier(nextTier);
                      if (nextTier !== 'super_admin' && newRefRole === 'admin') {
                        setNewRefRole('organization');
                        setNewRefTargetAccountType('organization');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-70"
                  >
                    {canManageSuperAdminTier && (
                      <option value="super_admin">Cấp phát: Super Admin</option>
                    )}
                    <option value="admin">Cấp phát: Admin</option>
                  </select>
                </div>

                <div className="sm:col-span-3">
                  <select
                    value={newRefRole}
                    onChange={e => {
                      const nextRole = e.target.value as RoleType;
                      setNewRefRole(nextRole);
                      setNewRefTargetAccountType(nextRole);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="organization">Vai trò cấp: Doanh nghiệp / Tổ chức</option>
                    <option value="user">Vai trò cấp: User (Người dùng)</option>
                    {canManageSuperAdminTier && newRefIssuerTier === 'super_admin' && (
                      <option value="admin">Vai trò cấp: Admin</option>
                    )}
                    <option value="other">Vai trò cấp: Khác</option>
                  </select>
                </div>

                <div className="sm:col-span-3 flex gap-1.5">
                  <input
                    type="text"
                    value={newRefCodeInput}
                    onChange={e => setNewRefCodeInput(e.target.value.toUpperCase())}
                    placeholder="Mã tự nhập (hoặc bỏ trống)"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setNewRefCodeInput(
                        generateRandomReferralCode(
                          newRefRole === 'admin'
                            ? 'ADM'
                            : newRefRole === 'organization'
                            ? 'ORG'
                            : newRefRole === 'other'
                            ? 'OTH'
                            : 'REF'
                        )
                      )
                    }
                    className="px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
                    title="Tạo mã ngẫu nhiên"
                  >
                    Ngẫu nhiên
                  </button>
                </div>

                <input
                  type="text"
                  value={newRefLabelInput}
                  onChange={e => setNewRefLabelInput(e.target.value)}
                  placeholder="Ghi chú (VD: Doanh nghiệp đối tác)"
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                <button
                  type="submit"
                  disabled={creatingRef}
                  className="sm:col-span-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creatingRef ? 'Đang tạo...' : 'Tạo mã mời'}</span>
                </button>
              </form>

              {loadingReferrals ? (
                <div className="text-xs text-slate-400 py-6 text-center">Đang tải danh sách mã giới thiệu...</div>
              ) : (
                <div className="space-y-5">
                  {visibleTiers.map(tierKey => {
                    const tierList = tierKey === 'super_admin' ? superAdminCodes : adminCodes;
                    const isSuperTier = tierKey === 'super_admin';
                    const canModifyTier = isSuperTier ? canManageSuperAdminTier : isAdmin;

                    return (
                      <div key={tierKey} className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                isSuperTier
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              }`}
                            >
                              {isSuperTier ? 'Đối tượng Super Admin' : 'Đối tượng Admin'}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 font-normal">
                              ({tierList.length} mã{isSuperTier && !canManageSuperAdminTier ? ' · Chỉ xem' : ''})
                            </span>
                          </div>
                        </div>

                        {tierList.length === 0 ? (
                          <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 text-center">
                            Chưa có mã giới thiệu thuộc đối tượng {isSuperTier ? 'Super Admin' : 'Admin'}.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                  <th className="py-2.5 px-3">Mã giới thiệu</th>
                                  <th className="py-2.5 px-3">Vai trò cấp</th>
                                  <th className="py-2.5 px-3">Ghi chú</th>
                                  <th className="py-2.5 px-3 text-center">Đã dùng</th>
                                  <th className="py-2.5 px-3">Trạng thái</th>
                                  <th className="py-2.5 px-3">Đường dẫn mời</th>
                                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                                {tierList.map(item => {
                                  const inviteUrl =
                                    typeof window !== 'undefined'
                                      ? `${window.location.origin}/?ref=${item.code}#tai-khoan`
                                      : `/?ref=${item.code}#tai-khoan`;
                                  const roleLabel = getUserRoleLabel(
                                    item.targetRole || item.targetAccountType || 'user'
                                  );
                                  return (
                                    <tr key={item.code} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                                      <td className="py-2.5 px-3 whitespace-nowrap">
                                        <code className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-mono font-bold">
                                          {item.code}
                                        </code>
                                      </td>
                                      <td className="py-2.5 px-3 whitespace-nowrap font-semibold text-slate-700 dark:text-slate-300">
                                        {roleLabel}
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-[160px] truncate" title={item.label || ''}>
                                        {item.label || '—'}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-semibold text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                                        {item.usedCount || 0}
                                      </td>
                                      <td className="py-2.5 px-3 whitespace-nowrap">
                                        <span
                                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            item.active
                                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                          }`}
                                        >
                                          {item.active ? 'Đang bật' : 'Tạm khóa'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 max-w-[240px]">
                                        <span className="block font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate" title={inviteUrl}>
                                          {inviteUrl}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <div className="inline-flex items-center justify-end gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleCopyReferralValue(item.code, `code_${item.code}`, 'mã giới thiệu')}
                                            className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                            title="Sao chép mã"
                                          >
                                            {copiedRefText === `code_${item.code}` ? (
                                              <Check className="w-3 h-3 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3 h-3 text-slate-500" />
                                            )}
                                            <span>Mã</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyReferralValue(inviteUrl, `link_${item.code}`, 'đường dẫn giới thiệu')}
                                            className="px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                                            title="Sao chép đường dẫn giới thiệu"
                                          >
                                            {copiedRefText === `link_${item.code}` ? (
                                              <Check className="w-3 h-3 text-emerald-600" />
                                            ) : (
                                              <Link2 className="w-3 h-3" />
                                            )}
                                            <span>Link</span>
                                          </button>
                                          {canModifyTier && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => handleToggleReferralCode(item)}
                                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold cursor-pointer"
                                              >
                                                {item.active ? 'Khóa' : 'Mở'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteReferralCode(item)}
                                                className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                                title="Xóa mã giới thiệu"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Subtab 3: Feedback Processing */}
      {subTab === 'feedback' && (() => {
        const isFbWithdrawn = (fb: FeedbackItem) => fb.status === 'withdrawn';
        const isFbAnswered = (fb: FeedbackItem) =>
          !isFbWithdrawn(fb) && (
            Boolean(fb.response?.trim()) ||
            fb.status === 'resolved' ||
            fb.status === 'responded' ||
            fb.status === 'rejected'
          );
        const unansweredCount = feedbackList.filter(fb => !isFbWithdrawn(fb) && !isFbAnswered(fb)).length;
        const answeredCount = feedbackList.filter(fb => isFbAnswered(fb)).length;
        const withdrawnCount = feedbackList.filter(fb => isFbWithdrawn(fb)).length;
        const searchQuery = feedbackSearch.trim().toLowerCase();
        const filteredFeedbackList = feedbackList.filter(fb => {
          if (feedbackFilter === 'unanswered' && (isFbWithdrawn(fb) || isFbAnswered(fb))) return false;
          if (feedbackFilter === 'answered' && !isFbAnswered(fb)) return false;
          if (feedbackFilter === 'withdrawn' && !isFbWithdrawn(fb)) return false;
          if (searchQuery) {
            return (fb.ticketCode || '').toLowerCase().includes(searchQuery);
          }
          return true;
        });

        return (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-teal-600" />
                    Tiếp Nhận &amp; Xử Lý Ý Kiến Phản Ánh Công Dân ({feedbackList.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Phân loại phản ánh chưa trả lời / đã trả lời / công dân đã thu hồi, tìm nhanh theo mã phản ánh và ban hành văn bản trả lời.
                  </p>
                </div>

                {/* Search bar for ticketCode */}
                <div className="relative w-full md:w-72 shrink-0">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={feedbackSearch}
                    onChange={e => setFeedbackSearch(e.target.value)}
                    placeholder="Tìm mã phản ánh..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  {feedbackSearch && (
                    <button
                      type="button"
                      onClick={() => setFeedbackSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setFeedbackFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    feedbackFilter === 'all'
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tất cả ({feedbackList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackFilter('unanswered')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    feedbackFilter === 'unanswered'
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-100'
                  }`}
                >
                  Chưa trả lời ({unansweredCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackFilter('answered')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    feedbackFilter === 'answered'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                  }`}
                >
                  Đã trả lời ({answeredCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackFilter('withdrawn')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                    feedbackFilter === 'withdrawn'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/60 hover:bg-rose-100'
                  }`}
                >
                  Đã thu hồi ({withdrawnCount})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3 px-4">Mã phản ánh</th>
                    <th className="py-3 px-3">Nội dung phản ánh</th>
                    <th className="py-3 px-3">Người gửi</th>
                    <th className="py-3 px-3">SĐT</th>
                    <th className="py-3 px-3">Thời gian</th>
                    <th className="py-3 px-3">Trạng thái</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredFeedbackList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        {feedbackList.length === 0
                          ? 'Chưa có ý kiến phản ánh nào từ công dân.'
                          : searchQuery
                          ? `Không tìm thấy phản ánh có mã "${feedbackSearch.trim()}".`
                          : 'Không có phản ánh nào trong bộ lọc này.'}
                      </td>
                    </tr>
                  ) : (
                    filteredFeedbackList.map(fb => {
                      const withdrawn = isFbWithdrawn(fb);
                      const answered = isFbAnswered(fb);
                      const statusLabel = withdrawn
                        ? 'Đã thu hồi'
                        : fb.status === 'rejected'
                        ? 'Không thuộc thẩm quyền'
                        : answered
                        ? 'Đã trả lời'
                        : fb.status === 'forwarded'
                        ? 'Đợi kết quả (B4)'
                        : fb.status === 'processing'
                        ? 'Đã tiếp nhận (B3)'
                        : 'Chờ tiếp nhận (B2)';

                      return (
                        <tr key={fb.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-teal-700 dark:text-teal-400">
                            {fb.ticketCode}
                          </td>

                          <td className="py-3 px-3 max-w-md">
                            <p
                              className="text-slate-700 dark:text-slate-300 line-clamp-2 leading-relaxed"
                              title={fb.content}
                            >
                              {fb.content}
                            </p>
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200">
                            {fb.fullName || '—'}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {fb.phone || '—'}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {fb.createdAt || '—'}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                withdrawn
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300'
                                  : answered
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : fb.status === 'forwarded'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                  : fb.status === 'processing'
                                  ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {!withdrawn && !answered && fb.status !== 'processing' && fb.status !== 'forwarded' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceFeedbackStage(fb, 'processing', 'Bước 3: Đã tiếp nhận')}
                                  className="px-2 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 border border-sky-200 dark:border-sky-800 rounded-lg transition cursor-pointer"
                                  title="Chuyển sang Bước 3: Đã tiếp nhận"
                                >
                                  B3
                                </button>
                              )}
                              {!withdrawn && !answered && fb.status !== 'forwarded' && (
                                <button
                                  type="button"
                                  onClick={() => handleAdvanceFeedbackStage(fb, 'forwarded', 'Bước 4: Đợi kết quả')}
                                  className="px-2 py-1 text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-lg transition cursor-pointer"
                                  title="Chuyển sang Bước 4: Đợi kết quả"
                                >
                                  B4
                                </button>
                              )}
                              {!withdrawn && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFb(fb);
                                    setFbReply(fb.response || '');
                                    setFbDept(fb.assignedDepartment || 'Khoa Khám bệnh');
                                    setFbOutcomeStatus(fb.status === 'rejected' ? 'rejected' : 'resolved');
                                  }}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition cursor-pointer"
                                >
                                  {answered ? 'Xem / Sửa' : 'Trả lời'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteFeedback(fb)}
                                className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                                title="Xóa phản ánh"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          {/* Feedback Reply Dialog */}
          {selectedFb && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Kết Quả Phản Ánh (Bước 5 - Kết thúc): {selectedFb.ticketCode}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedFb(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-white block mb-0.5">
                      Nội dung ý kiến của {selectedFb.fullName}:
                    </span>
                    "{selectedFb.content}"
                  </div>
                  <FeedbackAttachmentViewer
                    attachments={selectedFb.attachments}
                    githubBackupUrl={selectedFb.githubBackupUrl}
                    githubConfig={settings.githubConfig}
                  />
                </div>

                <form onSubmit={handleSendFeedbackReply} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Trạng thái kết thúc tại Bước 5
                    </label>
                    <select
                      value={fbOutcomeStatus}
                      onChange={e => setFbOutcomeStatus(e.target.value as 'resolved' | 'rejected')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="resolved">Đã giải quyết &amp; trả lời (Kết thúc Bước 5)</option>
                      <option value="rejected">Không thuộc thẩm quyền giải quyết (Kết thúc Bước 5)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Đơn vị / Khoa phòng thẩm tra
                    </label>
                    <input
                      type="text"
                      required
                      value={fbDept}
                      onChange={e => setFbDept(e.target.value)}
                      placeholder="Khoa Khám bệnh, Tổ Dược..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Nội dung văn bản trả lời công dân *
                    </label>
                    <textarea
                      rows={4}
                      required
                      value={fbReply}
                      onChange={e => setFbReply(e.target.value)}
                      placeholder="Căn cứ quy định... Trạm Y tế xin trả lời quý công dân như sau..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedFb(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                    >
                      Huỷ
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReply}
                      className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md transition"
                    >
                      {submittingReply ? 'Đang gửi...' : 'Ban hành trả lời'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          </div>
        );
      })()}

      {/* Subtab: Quản lý Đánh giá Trải nghiệm & Dịch vụ (Star Ratings) */}
      {subTab === 'ratings' && (() => {
        const filteredRatings = serviceRatings.filter(r => {
          if (ratingCategoryFilter !== 'all' && r.category !== ratingCategoryFilter) return false;
          if (ratingStarFilter > 0 && r.score !== ratingStarFilter) return false;
          return true;
        });
        const total = serviceRatings.length;
        const avg =
          total > 0
            ? serviceRatings.reduce((acc, r) => acc + (Number(r.score) || 0), 0) / total
            : 0;

        return (
          <div className="space-y-5">
            <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-400 shrink-0" />
                    <span>Quản Lý Đánh Giá Trải Nghiệm &amp; Dịch Vụ</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tổng hợp đánh giá sao và nhận xét của người dân từ cuối trang Cổng thông tin.
                  </p>
                </div>

                <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 shrink-0">
                  <div className="text-2xl font-extrabold text-amber-700 dark:text-amber-300 tabular-nums">
                    {avg.toFixed(1)}★
                  </div>
                  <div className="text-[11px] text-amber-800 dark:text-amber-200">
                    <div className="font-bold">{total} lượt đánh giá</div>
                    <div>
                      {total > 0
                        ? `${Math.round((serviceRatings.filter(r => r.score >= 4).length / total) * 100)}% hài lòng (4–5★)`
                        : 'Chưa có dữ liệu'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className={getBalancedMobileGridClass(5)}>
                  {(['all', 'giao_dien', 'thai_do', 'chuyen_mon', 'tien_ich'] as const).map(
                    (catKey, idx) => (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setRatingCategoryFilter(catKey)}
                        className={`${getBalancedMobileItemSpan(idx, 5)} min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                          ratingCategoryFilter === catKey
                            ? 'bg-emerald-700 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {catKey === 'all' ? 'Tất cả mục' : SERVICE_RATING_CATEGORY_LABELS[catKey]}
                      </button>
                    )
                  )}
                </div>

                <select
                  value={ratingStarFilter}
                  onChange={e => setRatingStarFilter(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                >
                  <option value={0}>Mọi mức sao</option>
                  <option value={5}>5 sao</option>
                  <option value={4}>4 sao</option>
                  <option value={3}>3 sao</option>
                  <option value={2}>2 sao</option>
                  <option value={1}>1 sao</option>
                </select>
              </div>
            </div>

            {filteredRatings.length === 0 ? (
              <div className="p-10 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-400">
                Không có đánh giá nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRatings.map(item => (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            src={item.raterAvatarUrl}
                            name={item.raterName || 'Người dân'}
                            size={34}
                            rounded="full"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {item.raterName || 'Người dân'}
                            </div>
                            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                              {SERVICE_RATING_CATEGORY_LABELS[item.category] || item.category}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < item.score ? 'fill-amber-400 text-amber-500' : 'text-slate-300 dark:text-slate-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {item.comment?.trim() ? item.comment : <span className="italic text-slate-400">Chỉ chấm điểm sao (không kèm nhận xét)</span>}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                      <span className="tabular-nums">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : ''}
                        {item.pageView ? ` · Trang: ${item.pageView}` : ''}
                      </span>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            showConfirm({
                              title: 'Xóa đánh giá này?',
                              message: `Xóa đánh giá ${item.score} sao từ "${item.raterName || 'Người dân'}"?`,
                              confirmText: 'Xóa',
                              cancelText: 'Hủy',
                              isDangerous: true,
                              onConfirm: async () => {
                                try {
                                  await deleteServiceRating(item.id);
                                  showToast('success', 'Đã xóa đánh giá');
                                } catch (err: any) {
                                  showToast('error', 'Không thể xóa', err?.message);
                                }
                              },
                            });
                          }}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          title="Xóa đánh giá"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Subtab 4: GitHub File Storage Manager */}
      {subTab === 'github_storage' && isAdmin && (
        <GitHubFileManager
          config={settings.githubConfig}
          onSaveConfig={handleSaveGitHubConfig}
          uploaderName={userProfile?.displayName || currentUser.email || 'Admin'}
        />
      )}

      {/* Subtab 5: Backup & Versioning */}
      {subTab === 'backup' && isAdmin && (
        <BackupManager
          userEmail={currentUser.email || PRIMARY_ADMIN_EMAIL}
          lastBackupAt={settings.lastBackupAt}
          githubConfig={settings.githubConfig}
          settings={settings}
          onDataRestored={onRefreshData}
        />
      )}

      {/* Subtab 6: Audit Logs */}
      {subTab === 'audit' && isAdmin && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              Nhật Ký Kiểm Toán An Ninh Hệ Thống (Audit Logs)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ghi vết bất biến các thao tác quản trị, thay đổi phân quyền và tiếp nhận hồ sơ y tế.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-3">Tác nhân</th>
                  <th className="py-3 px-3">Hành động</th>
                  <th className="py-3 px-3">Phân hệ</th>
                  <th className="py-3 px-4">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 font-sans text-xs">
                      Chưa có sự kiện kiểm toán nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-500">{log.timestamp}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">{log.userName}</td>
                      <td className="py-3 px-3 text-emerald-700 dark:text-emerald-400 font-bold">{log.action}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{log.module}</td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-xs">{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 7: Maintenance Mode & Sidebar Tab Visibility Control */}
      {subTab === 'system_control' && isAdmin && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-amber-600" />
                  Chế Độ Bảo Trì Hệ Thống &amp; Ẩn/Hiện Tab Sidebar
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Kiểm soát bảo trì toàn cổng thông tin hoặc từng phân hệ riêng lẻ, và bật/tắt hiển thị các tab trên thanh điều hướng Sidebar. Quản trị viên vẫn luôn truy cập được Bảng Quản Trị.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveSystemControl}
                disabled={savingSystemControl}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md transition inline-flex items-center gap-2 self-start sm:self-auto cursor-pointer"
              >
                {savingSystemControl ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Lưu cấu hình bảo trì &amp; tab</span>
              </button>
            </div>

            {/* Global Maintenance Mode */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-amber-950 dark:text-amber-200 text-sm">
                    Bảo trì toàn bộ Cổng thông tin
                  </div>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                    Khi bật, người dân truy cập bất kỳ trang nào sẽ thấy thông báo bảo trì cùng danh sách số Cấp cứu 24/7.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2.5 shrink-0 select-none">
                  <span
                    className={`text-[11px] font-bold ${
                      maintenanceMode
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {maintenanceMode ? 'Đang bật bảo trì' : 'Đang tắt'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={maintenanceMode}
                    aria-label="Bật hoặc tắt chế độ bảo trì toàn bộ Cổng thông tin"
                    onClick={() => void handleToggleMaintenanceImmediate(!maintenanceMode)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      maintenanceMode ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-amber-950 dark:text-amber-200 mb-1">
                  Nội dung thông báo bảo trì hiển thị cho người dân
                </label>
                <textarea
                  rows={2}
                  value={maintenanceMessage}
                  onChange={e => setMaintenanceMessage(e.target.value)}
                  placeholder="Hệ thống Cổng thông tin điện tử Trạm Y tế đang được bảo trì..."
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs"
                />
              </div>
            </div>

            {/* Citizen CCCD Lookup Security Toggle */}
            <div className="p-4 sm:p-5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/70 space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-sky-950 dark:text-sky-200 text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>Tra cứu CCCD (Bảo mật dữ liệu dân cư)</span>
                  </div>
                  <p className="text-[11px] text-sky-900/80 dark:text-sky-300/80 leading-relaxed">
                    Khi <strong>Bật</strong>, người dùng nhập 10 hoặc 12 số CCCD sẽ tự động quét/tra cứu đối chiếu từ kho dữ liệu dân cư. Khi <strong>Tắt</strong>, hệ thống khóa hoàn toàn API tra cứu &amp; không tự động quét — người dùng tự điền thông tin thủ công để đảm bảo an toàn bảo mật tệp dữ liệu người dân.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2.5 shrink-0 select-none">
                  <span
                    className={`text-[11px] font-bold ${
                      cccdLookupEnabled
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {cccdLookupEnabled ? 'Đang bật tra cứu' : 'Đã tắt (Điền thủ công)'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={cccdLookupEnabled}
                    aria-label="Bật hoặc tắt tính năng tra cứu CCCD từ dữ liệu dân cư"
                    onClick={() => void handleToggleCccdLookupImmediate(!cccdLookupEnabled)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      cccdLookupEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        cccdLookupEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Epidemic Map Button Visibility Toggle (For All Users) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800/70 space-y-2.5 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-rose-950 dark:text-rose-200 text-sm flex items-center gap-2">
                    <Radar className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span>Hiện / Ẩn nút "Xem bản đồ dịch bệnh" cho tất cả đối tượng</span>
                  </div>
                  <p className="text-[11px] text-rose-900/80 dark:text-rose-300/80 leading-relaxed">
                    Khi <strong>Hiện</strong>, người dân, khách, cán bộ y tế và quản trị viên đều thấy dấu tick "Xem bản đồ dịch bệnh" (Sốt xuất huyết &amp; vùng khoanh mét) trên Bản đồ. Khi <strong>Ẩn</strong>, nút và lớp bản đồ dịch bệnh được ẩn với tất cả đối tượng.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2.5 shrink-0 select-none">
                  <span
                    className={`text-[11px] font-bold ${
                      epidemicMapButtonVisible
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {epidemicMapButtonVisible ? 'Đang HIỆN cho tất cả' : 'Đang ẨN với tất cả'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={epidemicMapButtonVisible}
                    aria-label="Hiện hoặc ẩn nút Xem bản đồ dịch bệnh cho tất cả đối tượng"
                    onClick={() => void handleToggleEpidemicMapButtonImmediate(!epidemicMapButtonVisible)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      epidemicMapButtonVisible ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        epidemicMapButtonVisible ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* WiFi IP Restriction Configuration */}
            <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/70 space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-teal-950 dark:text-teal-200 text-sm">
                    Giới hạn truy cập theo IP / WiFi nội bộ
                  </div>
                  <p className="text-[11px] text-teal-800/80 dark:text-teal-300/80 mt-0.5">
                    Khi bật, chỉ các thiết bị kết nối đúng dải IP / WiFi nội bộ được phép truy cập site; người dùng ngoài mạng sẽ bị chặn (trừ Quản trị viên).
                  </p>
                </div>

                <div className="inline-flex items-center gap-2.5 shrink-0 select-none">
                  <span
                    className={`text-[11px] font-bold ${
                      wifiRestrictionEnabled
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {wifiRestrictionEnabled ? 'Đang bật' : 'Đã tắt'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={wifiRestrictionEnabled}
                    onClick={() => void handleSaveWifiRestriction(!wifiRestrictionEnabled, wifiAllowedIpsText, wifiRestrictionMessage)}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                      wifiRestrictionEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        wifiRestrictionEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-teal-200/60 dark:border-teal-900/60">
                <div className="flex items-center justify-between">
                  <label className="block font-semibold text-teal-950 dark:text-teal-200">
                    Danh sách IP hoặc dải mạng được phép (phân cách bằng dấu phẩy)
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch('https://api.ipify.org?format=json');
                        const data = await res.json();
                        if (data?.ip) {
                          const current = wifiAllowedIpsText.trim();
                          const nextText = current ? `${current}, ${data.ip}` : data.ip;
                          setWifiAllowedIpsText(nextText);
                          showToast('success', `Đã lấy IP hiện tại của bạn: ${data.ip}`);
                        }
                      } catch {
                        showToast('error', 'Không thể lấy IP hiện tại');
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-bold transition cursor-pointer"
                  >
                    + Lấy IP hiện tại của tôi
                  </button>
                </div>
                <input
                  type="text"
                  value={wifiAllowedIpsText}
                  onChange={e => setWifiAllowedIpsText(e.target.value)}
                  placeholder="VD: 192.168.1., 14.160.20., 127.0.0.1"
                  className="w-full px-3 py-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-teal-950 dark:text-teal-200 mb-1">
                  Thông báo hiển thị khi người dùng ngoài mạng truy cập
                </label>
                <textarea
                  rows={2}
                  value={wifiRestrictionMessage}
                  onChange={e => setWifiRestrictionMessage(e.target.value)}
                  placeholder="Hệ thống chỉ cho phép truy cập từ mạng WiFi nội bộ của Trạm Y Tế..."
                  className="w-full px-3 py-2 rounded-xl border border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 text-xs"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => void handleSaveWifiRestriction(wifiRestrictionEnabled, wifiAllowedIpsText, wifiRestrictionMessage)}
                  className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  Lưu cấu hình WiFi
                </button>
              </div>
            </div>

            {/* Device, OS & Browser Access Blocking Toggles */}
            {(() => {
              const currentEnv = detectClientEnvironment();
              const platformItems = ACCESS_RESTRICTION_ITEMS.filter(i => i.category === 'platform');
              const browserItems = ACCESS_RESTRICTION_ITEMS.filter(i => i.category === 'browser');
              const activeBlockCount = Object.values(accessRules).filter(Boolean).length;

              const matchesCurrentEnv = (key: keyof AccessRestrictionRules): boolean => {
                switch (key) {
                  case 'disableIos': return currentEnv.isIos;
                  case 'disableAndroid': return currentEnv.isAndroid;
                  case 'disableMobile': return currentEnv.isMobile;
                  case 'disableIpad': return currentEnv.isIpad;
                  case 'disablePc': return currentEnv.isPc;
                  case 'disableChrome': return currentEnv.isChrome;
                  case 'disableCocCoc': return currentEnv.isCocCoc;
                  case 'disableSafari': return currentEnv.isSafari;
                  case 'disableEdge': return currentEnv.isEdge;
                  case 'disableFirefox': return currentEnv.isFirefox;
                  case 'disableInAppBrowser': return currentEnv.isInAppBrowser;
                  default: return false;
                }
              };

              const renderToggleRow = (item: (typeof ACCESS_RESTRICTION_ITEMS)[number]) => {
                const isDisabledAccess = Boolean(accessRules[item.key]);
                const isSelfEnv = matchesCurrentEnv(item.key);
                return (
                  <div
                    key={item.key}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                      isDisabledAccess
                        ? 'bg-rose-50/80 dark:bg-rose-950/35 border-rose-200 dark:border-rose-800/80'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">
                          {item.label}
                        </span>
                        {isSelfEnv && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Đang dùng trên máy bạn
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                        {item.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isDisabledAccess
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                        }`}
                      >
                        {isDisabledAccess ? 'Vô hiệu hóa' : 'Cho phép'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isDisabledAccess}
                        aria-label={`Vô hiệu hóa truy cập ${item.shortLabel}`}
                        onClick={() => void handleToggleAccessRuleImmediate(item.key, item.shortLabel)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          isDisabledAccess ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                            isDisabledAccess ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              };

              return (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-rose-200/80 dark:border-rose-900/60 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Ban className="w-4 h-4 text-rose-600" />
                        <span>Vô Hiệu Hóa Truy Cập Theo Thiết Bị, Hệ Điều Hành &amp; Trình Duyệt</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Bật công tắc để <strong>chặn (vô hiệu hóa)</strong> truy cập cổng trên nền tảng hoặc trình duyệt tương ứng. Thiết bị hiện tại của bạn: <strong>{currentEnv.osLabel} · {currentEnv.deviceTypeLabel} · {currentEnv.browserLabel}</strong>.
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold shrink-0 self-start sm:self-auto ${
                        activeBlockCount > 0
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      {activeBlockCount > 0 ? `Đang chặn ${activeBlockCount} đối tượng` : 'Không chặn thiết bị nào'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        <MonitorSmartphone className="w-3.5 h-3.5 text-rose-600" />
                        <span>Hệ Điều Hành &amp; Thiết Bị (iOS, Android, Mobile, iPad, PC)</span>
                      </div>
                      <div className="space-y-2">
                        {platformItems.map(renderToggleRow)}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        <Globe className="w-3.5 h-3.5 text-rose-600" />
                        <span>Trình Duyệt Web (Google Chrome, Cốc Cốc, Safari, Edge, Firefox...)</span>
                      </div>
                      <div className="space-y-2">
                        {browserItems.map(renderToggleRow)}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          Miễn trừ Quản trị viên đã đăng nhập
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Cho phép Quản trị viên đăng nhập để mở khóa &amp; cấu hình lại ngay cả khi thiết bị hiện tại đang nằm trong danh sách bị vô hiệu hóa.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={accessExemptAdmins}
                        onClick={() => void handleToggleAccessExemptAdminsImmediate()}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                          accessExemptAdmins ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                            accessExemptAdmins ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Thông báo hiển thị khi thiết bị / trình duyệt bị vô hiệu hóa
                      </label>
                      <textarea
                        rows={2}
                        value={accessCustomMessage}
                        onChange={e => setAccessCustomMessage(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={savingAccessControl}
                        onClick={() => void handleSaveAccessControlDetails()}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                      >
                        {savingAccessControl ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        <span>Lưu thông báo &amp; miễn trừ chặn</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Phân Quyền Theo Từng Đối Tượng (Super Admin · Admin · User · Khách) */}
            {(() => {
              const roleTabs: Array<{ id: 'super_admin' | 'admin' | 'user' | 'organization' | 'guest'; label: string; desc: string }> = [
                { id: 'super_admin', label: 'Super Admin (Full quyền)', desc: 'Toàn quyền tuyệt đối, không bị giới hạn' },
                { id: 'admin', label: 'Admin', desc: 'Cấu hình thủ công & Preset nhanh' },
                { id: 'user', label: 'User (Đã đăng nhập)', desc: 'Cán bộ & Công dân có tài khoản' },
                { id: 'organization', label: 'Tổ chức / Doanh nghiệp', desc: 'Phòng khám, nhà thuốc, trường học địa bàn' },
                { id: 'guest', label: 'Khách (Chưa đăng nhập)', desc: 'Chỉ định site bắt buộc đăng nhập' },
              ];

              const currentPolicy: RolePermissionPolicy =
                activeRoleConfigTab === 'admin'
                  ? rolePermissions.admin
                  : activeRoleConfigTab === 'organization'
                  ? (rolePermissions.organization || DEFAULT_ROLE_PERMISSIONS.organization!)
                  : activeRoleConfigTab === 'user'
                  ? rolePermissions.user
                  : rolePermissions.guest;

              const updateEditablePolicy = (updater: (prev: RolePermissionPolicy) => RolePermissionPolicy, summary: string) => {
                if (activeRoleConfigTab === 'super_admin') return;
                const next = {
                  ...rolePermissions,
                  [activeRoleConfigTab]: updater(currentPolicy),
                };
                void handleSaveRolePermissions(next, summary);
              };

              const toggleArrayField = (field: 'blockedTabs' | 'requireLoginForTabs', tabId: string, tabLabel: string) => {
                updateEditablePolicy(prev => {
                  const arr = prev[field] || [];
                  const exists = arr.includes(tabId);
                  return {
                    ...prev,
                    [field]: exists ? arr.filter(id => id !== tabId) : [...arr, tabId],
                  };
                }, `${activeRoleConfigTab} · ${field === 'blockedTabs' ? 'Chặn tab' : 'Yêu cầu đăng nhập'}: ${tabLabel}`);
              };

              const featureFlags: Array<{ key: keyof RolePermissionPolicy; label: string; adminOnly?: boolean }> = [
                { key: 'canSubmitFeedback', label: 'Gửi phản ánh / kiến nghị' },
                { key: 'canUseApps', label: 'Truy cập Menu Ứng dụng' },
                { key: 'canSendRescueSos', label: 'Gửi tín hiệu Cứu hộ SOS' },
                { key: 'canViewPersonnelDirectory', label: 'Xem danh bạ nhân lực chi tiết' },
                { key: 'canManageContent', label: 'Quản trị bài viết, thông báo, sự kiện', adminOnly: true },
                { key: 'canManageSchedules', label: 'Quản trị lịch trực & lịch tiêm', adminOnly: true },
                { key: 'canAttendanceCheckin', label: 'Chấm công nhanh nhân sự', adminOnly: true },
                { key: 'canManageUsers', label: 'Quản lý tài khoản & mã giới thiệu Admin', adminOnly: true },
                { key: 'canManageSystem', label: 'Cấu hình bảo trì & chặn thiết bị', adminOnly: true },
              ];

              const presetsForRole =
                activeRoleConfigTab === 'admin'
                  ? Object.entries(ROLE_PERMISSION_PRESETS.admin)
                  : activeRoleConfigTab === 'organization'
                  ? Object.entries(ROLE_PERMISSION_PRESETS.organization)
                  : activeRoleConfigTab === 'user'
                  ? Object.entries(ROLE_PERMISSION_PRESETS.user)
                  : activeRoleConfigTab === 'guest'
                  ? Object.entries(ROLE_PERMISSION_PRESETS.guest)
                  : [];

              return (
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Cấu Hình Quyền Theo Đối Tượng (Super Admin · Admin · User · Khách)</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Thiết lập quyền sử dụng chức năng, ẩn tab hoặc chỉ định trang bắt buộc đăng nhập đối với từng nhóm người dùng.
                      </p>
                    </div>
                    {savingRolePerms && (
                      <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Đang lưu...</span>
                      </span>
                    )}
                  </div>

                  {/* Role selector tabs */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                    {roleTabs.map(rt => {
                      const active = activeRoleConfigTab === rt.id;
                      return (
                        <button
                          key={rt.id}
                          type="button"
                          onClick={() => setActiveRoleConfigTab(rt.id)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                            active
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="text-xs font-extrabold">{rt.label}</div>
                          <div className={`text-[10px] mt-0.5 ${active ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'}`}>
                            {rt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {activeRoleConfigTab === 'super_admin' ? (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 space-y-1">
                      <div className="font-extrabold flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Super Admin: Full quyền (Cố định &amp; Không thể khóa)</span>
                      </div>
                      <p className="leading-relaxed">
                        Tài khoản Super Admin luôn có quyền truy cập toàn bộ phân hệ, cấu hình bảo mật, mã mời đối tượng Super Admin/Admin và miễn trừ mọi chế độ bảo trì hoặc chặn truy cập thiết bị.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Presets ("Cấu hình nhanh phù hợp") */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                          <span>Cấu hình nhanh phù hợp ({roleTabs.find(t => t.id === activeRoleConfigTab)?.label}):</span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleSaveRolePermissions(
                                {
                                  ...rolePermissions,
                                  [activeRoleConfigTab]: { ...DEFAULT_ROLE_PERMISSIONS[activeRoleConfigTab] },
                                },
                                `Khôi phục mặc định cho ${activeRoleConfigTab}`
                              )
                            }
                            className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            Khôi phục mặc định
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {presetsForRole.map(([presetKey, preset]) => (
                            <button
                              key={presetKey}
                              type="button"
                              onClick={() =>
                                void handleSaveRolePermissions(
                                  {
                                    ...rolePermissions,
                                    [activeRoleConfigTab]: { ...preset.policy },
                                  },
                                  `Áp dụng preset "${preset.label}" cho ${activeRoleConfigTab}`
                                )
                              }
                              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs font-semibold cursor-pointer transition"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Feature capability switches */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Quyền thao tác chức năng (Cấu hình thủ công):
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {featureFlags
                            .filter(f => (activeRoleConfigTab === 'admin' ? true : !f.adminOnly))
                            .map(flag => {
                              const checked = Boolean(currentPolicy[flag.key]);
                              return (
                                <div
                                  key={flag.key}
                                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-xs"
                                >
                                  <span className="font-semibold text-slate-700 dark:text-slate-200">{flag.label}</span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={checked}
                                    aria-label={flag.label}
                                    onClick={() =>
                                      updateEditablePolicy(
                                        prev => ({ ...prev, [flag.key]: !checked }),
                                        `${activeRoleConfigTab} · ${flag.label}: ${!checked ? 'Bật' : 'Tắt'}`
                                      )
                                    }
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                      checked ? 'bg-emerald-600' : 'bg-rose-600'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                        checked ? 'translate-x-4.5' : 'translate-x-0.5'
                                      }`}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      </div>

                      {/* Guest Only: Require login before opening specific site/feature */}
                      {activeRoleConfigTab === 'guest' && (
                        <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/70 space-y-2.5">
                          <div>
                            <div className="text-xs font-bold text-amber-950 dark:text-amber-200">
                              Chỉ định chức năng / site bắt buộc Khách phải đăng nhập mới sử dụng được:
                            </div>
                            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                              Các tab được bật công tắc sẽ hiển thị nhãn “Đăng nhập” trên Sidebar; khi Khách bấm vào sẽ yêu cầu đăng nhập tài khoản trước khi sử dụng.
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {CONTROLLABLE_SIDEBAR_TABS.filter(t => t.id !== 'portal').map(tab => {
                              const required = Boolean(currentPolicy.requireLoginForTabs?.includes(tab.id));
                              return (
                                <div
                                  key={`req_${tab.id}`}
                                  className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs transition ${
                                    required
                                      ? 'bg-amber-100/80 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-200 font-bold'
                                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  <span className="truncate">{tab.label}</span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={required}
                                    aria-label={`Yêu cầu đăng nhập cho ${tab.label}`}
                                    onClick={() => toggleArrayField('requireLoginForTabs', tab.id, tab.label)}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                      required ? 'bg-emerald-600' : 'bg-rose-600'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                        required ? 'translate-x-4.5' : 'translate-x-0.5'
                                      }`}
                                    />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Blocked Tabs for this Role */}
                      <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                          Ẩn / Chặn hoàn toàn phân hệ đối với đối tượng này:
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {CONTROLLABLE_SIDEBAR_TABS.filter(t => t.id !== 'portal').map(tab => {
                            const blocked = Boolean(currentPolicy.blockedTabs?.includes(tab.id));
                            return (
                              <div
                                key={`blk_${tab.id}`}
                                className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs transition ${
                                  blocked
                                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 font-bold'
                                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <span className="truncate">{tab.label}</span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={blocked}
                                  aria-label={`Ẩn hoặc chặn ${tab.label}`}
                                  onClick={() => toggleArrayField('blockedTabs', tab.id, tab.label)}
                                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                    blocked ? 'bg-emerald-600' : 'bg-rose-600'
                                  }`}
                                >
                                  <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                      blocked ? 'translate-x-4.5' : 'translate-x-0.5'
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Sidebar Color Configuration (Public vs Admin independent) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-emerald-600" />
                    <span>Cấu hình Màu sắc Sidebar (Riêng biệt Thông thường &amp; Admin)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Khi mở, mỗi nhóm tab lớn trên thanh Sidebar sẽ hiển thị gam màu riêng biệt; khi tắt, giao diện trở về màu mặc định ban đầu.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                    publicSidebarColored
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">
                      Sidebar Cổng Thông Tin (Thông thường)
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {publicSidebarColored
                        ? 'Đang bật màu sắc phân biệt theo từng nhóm tab.'
                        : 'Đang tắt — sử dụng giao diện màu mặc định ban đầu.'}
                    </p>
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Tổng quan" />
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500" title="Lịch & Tin" />
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500" title="Bản đồ" />
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-500" title="Công dân" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Truyền thông" />
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" title="Hệ thống" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        publicSidebarColored
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {publicSidebarColored ? 'Mở màu' : 'Mặc định'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={publicSidebarColored}
                      aria-label="Bật hoặc tắt màu sắc Sidebar Cổng thông tin"
                      onClick={() => void handleToggleSidebarColorImmediate('public')}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        publicSidebarColored ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                          publicSidebarColored ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition ${
                    adminSidebarColored
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white">
                      Sidebar Trang Quản Trị (Admin)
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {adminSidebarColored
                        ? 'Đang bật màu sắc phân biệt cho từng nhóm quản trị.'
                        : 'Đang tắt — sử dụng giao diện màu mặc định ban đầu.'}
                    </p>
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Tổng quan" />
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-500" title="Vận hành" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Lịch công tác" />
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500" title="Nhân sự" />
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-500" title="Công dân" />
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" title="Sao lưu" />
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" title="Hệ thống" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${
                        adminSidebarColored
                          ? 'bg-emerald-600 text-white'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {adminSidebarColored ? 'Mở màu' : 'Mặc định'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={adminSidebarColored}
                      aria-label="Bật hoặc tắt màu sắc Sidebar Admin"
                      onClick={() => void handleToggleSidebarColorImmediate('admin')}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        adminSidebarColored ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                          adminSidebarColored ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Authentication Providers Enable / Disable / Maintenance Matrix */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-800 space-y-4">
              {(() => {
                const values = Object.values(authProvidersMap);
                const enabledCount = values.filter(v => v === 'enabled').length;
                const maintCount = values.filter(v => v === 'maintenance').length;
                const disabledCount = values.filter(v => v === 'disabled').length;
                return (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <KeyRound className="w-4 h-4 text-emerald-600" />
                        <span>Cấu hình Nhà cung cấp &amp; Phương thức Đăng nhập ({AUTH_PROVIDER_CATALOG.length})</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Bật để hiển thị trên cổng đăng nhập; Tắt để ẩn hoàn toàn; Bảo trì để vẫn hiển thị nhưng làm mờ và khóa không cho bấm.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold shrink-0">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Bật: {enabledCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        Bảo trì: {maintCount}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        Tắt: {disabledCount}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5 min-w-0">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-bold text-amber-950 dark:text-amber-200">
                      Nhắc nhở quan trọng khi Bật nhà cung cấp đăng nhập
                    </div>
                    <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                      Khi bật các phương thức (Google, Facebook, Phone, Email/Mật khẩu, GitHub, Microsoft...), vui lòng truy cập <strong>Firebase Authentication → Phương thức đăng nhập (Sign-in method)</strong> để bật kích hoạt tương ứng trên Firebase Console.
                    </p>
                    <div className="font-mono text-[10px] text-amber-700 dark:text-amber-400 truncate">
                      {firebaseAuthProvidersUrl}
                    </div>
                  </div>
                </div>
                <a
                  href={firebaseAuthProvidersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] inline-flex items-center gap-1.5 shrink-0 transition shadow-xs whitespace-nowrap"
                >
                  <span>Mở Firebase Sign-in Providers</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="space-y-4">
                {AUTH_PROVIDER_CATEGORIES.map(category => {
                  const items = AUTH_PROVIDER_CATALOG.filter(i => i.category === category.id);
                  return (
                    <div key={category.id} className="space-y-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          {category.title} ({items.length})
                        </span>
                        <span className="text-[11px] text-slate-400">{category.subtitle}</span>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 text-xs">
                        {items.map(item => {
                          const status = authProvidersMap[item.id];
                          const isEnabled = status !== 'disabled';
                          const isMaintenance = status === 'maintenance';
                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                                status === 'enabled'
                                  ? 'bg-white dark:bg-slate-900 border-emerald-200/80 dark:border-emerald-800/60 shadow-xs'
                                  : status === 'maintenance'
                                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300/80 dark:border-amber-800/70'
                                  : 'bg-slate-100/80 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-80'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                  <AuthProviderIcon providerId={item.id} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900 dark:text-white truncate">
                                      {item.label}
                                    </span>
                                    {status === 'enabled' ? (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                        Hoạt động
                                      </span>
                                    ) : status === 'maintenance' ? (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                        Bảo trì
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                                        Đã tắt (Ẩn)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                    {item.description}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                                {/* Công tắc Bật/Tắt chính */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                    {isEnabled ? (
                                      <span className="text-emerald-700 dark:text-emerald-400">Bật</span>
                                    ) : (
                                      <span className="text-rose-600 dark:text-rose-400">Tắt</span>
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isEnabled}
                                    aria-label={`Bật hoặc tắt phương thức ${item.label}`}
                                    onClick={() => {
                                      const next = isEnabled ? 'disabled' : (isMaintenance ? 'maintenance' : 'enabled');
                                      void handleSetAuthProviderStatusImmediate(item.id, next);
                                    }}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                      isEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                        isEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                                      }`}
                                    />
                                  </button>
                                </div>

                                {/* Công tắc Bảo trì hoạt động riêng */}
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                  <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    Bảo trì:
                                  </span>
                                  <span className="text-[11px] font-bold">
                                    {isMaintenance ? (
                                      <span className="text-emerald-700 dark:text-emerald-400">Bật</span>
                                    ) : (
                                      <span className="text-rose-600 dark:text-rose-400">Tắt</span>
                                    )}
                                  </span>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={isMaintenance}
                                    aria-label={`Bật hoặc tắt chế độ bảo trì cho ${item.label}`}
                                    onClick={() => {
                                      const next = isMaintenance ? 'enabled' : 'maintenance';
                                      void handleSetAuthProviderStatusImmediate(item.id, next);
                                    }}
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                      isMaintenance ? 'bg-emerald-600' : 'bg-rose-600'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                        isMaintenance ? 'translate-x-4.5' : 'translate-x-0.5'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Per-Tab Visibility & Maintenance Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Quản lý từng Tab trên Sidebar ({CONTROLLABLE_SIDEBAR_TABS.length} phân hệ)
                </h4>
                <span className="text-[11px] text-slate-400">
                  Đang ẩn: {hiddenTabs.length} • Bảo trì lẻ: {Object.values(tabMaintenance).filter(Boolean).length}
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Tên phân hệ (Tab)</th>
                      <th className="py-3 px-3">Nhóm menu</th>
                      <th className="py-3 px-3 text-center">Hiển thị Sidebar</th>
                      <th className="py-3 px-4 text-center">Bảo trì lẻ phân hệ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {CONTROLLABLE_SIDEBAR_TABS.map(tab => {
                      const isHidden = hiddenTabs.includes(tab.id);
                      const isMaint = !!tabMaintenance[tab.id];
                      return (
                        <tr key={tab.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{tab.label}</div>
                            <div className="text-[10px] font-mono text-slate-400">{tab.hash}</div>
                          </td>
                          <td className="py-3 px-3 text-[11px] text-slate-500">{tab.group}</td>
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex items-center gap-2 justify-center">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={!isHidden}
                                aria-label={`Hiển thị tab ${tab.label}`}
                                onClick={() => void handleToggleHiddenTabImmediate(tab.id, tab.label)}
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                  !isHidden ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                    !isHidden ? 'translate-x-4.5' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                              <span
                                className={`text-[11px] font-semibold ${
                                  !isHidden ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isHidden ? 'Đang ẩn' : 'Đang hiện'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-2 justify-center">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={isMaint}
                                aria-label={`Bảo trì lẻ tab ${tab.label}`}
                                onClick={() => void handleToggleTabMaintenanceImmediate(tab.id, tab.label)}
                                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                  isMaint ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}
                              >
                                <span
                                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                                    isMaint ? 'translate-x-4.5' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                              <span
                                className={`text-[11px] font-semibold ${
                                  isMaint ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isMaint ? 'Đang bật' : 'Đang tắt'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 8: BHXH API Configuration & Live Test Console (CV 366/BHXH-CNTT & nâng cấp 2024 CV 1923/BHXH-CNTT) */}
      {subTab === 'bhxh_api' && isAdmin && (
        <div className="space-y-5">
          {/* Card 1: Compact Configuration Form */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="space-y-0.5">
                <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Cấu hình API BHXH (Chuẩn 2024 · KQNhanLichSuKCB2024)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Theo Công văn 1923/BHXH-CNTT &amp; 366/BHXH-CNTT: cần tài khoản CSKCB, mật khẩu MD5 IN HOA và thông tin cán bộ tra cứu (<span className="font-mono">hoTenCb</span>, <span className="font-mono">cccdCb</span>).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <a
                  href="https://gdbhyt.baohiemxahoi.gov.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 font-semibold text-xs inline-flex items-center gap-1.5 whitespace-nowrap transition"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Cổng GĐ BHYT (CV 1923/366)</span>
                  <ExternalLink className="w-3 h-3 opacity-60" />
                </a>

                <div className="inline-flex items-center gap-2 select-none pl-1">
                  <span
                    className={`text-xs font-bold ${
                      bhxhEnabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {bhxhEnabled ? 'Đang bật tra cứu' : 'Đang tắt'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bhxhEnabled}
                    disabled={bhxhLoadingConfig || savingBhxhConfig}
                    onClick={() => void handleToggleBhxhSettingImmediate('enabled')}
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 ${
                      bhxhEnabled ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                        bhxhEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <details className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
              <summary className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                Hướng dẫn lấy Tài khoản, Mật khẩu &amp; đăng ký Cán bộ/IP tại BHXH (theo CV 1923/BHXH-CNTT)
              </summary>
              <ol className="mt-2.5 space-y-1.5 list-decimal list-inside leading-relaxed">
                <li>
                  <strong>Đăng ký IP tĩnh:</strong> Gửi văn bản <strong>Mẫu 01/dk-ip-ctn</strong> cho BHXH tỉnh/huyện để mở địa chỉ IP cố định của máy chủ kết nối.
                </li>
                <li>
                  <strong>Đăng nhập Cổng Giám định BHYT:</strong> Truy cập <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">https://gdbhyt.baohiemxahoi.gov.vn</span> bằng tài khoản gốc <strong>MãCSKCB_BV</strong> đã được cấp (vd: <span className="font-mono">95050_BV</span>).
                </li>
                <li>
                  <strong>Đăng ký cán bộ &amp; phân quyền:</strong> Vào <em>Quản lý khám chữa bệnh → Đăng ký thông tin người sử dụng</em>, nhập Họ tên, <strong>Số CCCD (12 số)</strong>, Email và chọn quyền <span className="font-mono font-semibold">TC; LS</span> (kèm gửi <strong>Mẫu 01/dk-ctn</strong> cho BHXH).
                </li>
                <li>
                  <strong>Nhận tài khoản &amp; mật khẩu:</strong> Khi BHXH duyệt, hệ thống tự động gửi <strong>tên đăng nhập &amp; mật khẩu riêng về Email của cán bộ</strong>. Dùng tài khoản này (hoặc <span className="font-mono">MãCSKCB_BV</span>) điền vào cấu hình; trường <span className="font-mono">hoTenCb</span> và <span className="font-mono">cccdCb</span> phải khớp đúng cán bộ đã duyệt (nếu sai sẽ báo lỗi <span className="font-mono">054</span>/<span className="font-mono">055</span>).
                </li>
              </ol>
            </details>

            {bhxhLoadingConfig ? (
              <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Đang tải cấu hình...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveBhxhConfig} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      URL Gateway BHXH *
                    </label>
                    <input
                      type="url"
                      required
                      value={bhxhBaseUrl}
                      onChange={e => setBhxhBaseUrl(e.target.value)}
                      placeholder="https://egw.baohiemxahoi.gov.vn"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Hàm API tra cứu thẻ (Endpoint) *
                    </label>
                    <select
                      value={bhxhLookupEndpoint}
                      onChange={e => setBhxhLookupEndpoint(e.target.value as BhxhLookupEndpoint)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-semibold"
                    >
                      <option value="KQNhanLichSuKCB2024">KQNhanLichSuKCB2024 (Chuẩn BHXH 2024 - Mặc định)</option>
                      <option value="NhanLichSuKCB2024">NhanLichSuKCB2024 (Tên hàm 2024)</option>
                      <option value="NhanLichSuKCB2018">NhanLichSuKCB2018 (Chuẩn cũ 2018)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Tên đăng nhập (<span className="font-mono">username</span>)
                    </label>
                    <input
                      type="text"
                      value={bhxhUsername}
                      onChange={e => setBhxhUsername(e.target.value)}
                      placeholder="VD: 01001_BV"
                      autoComplete="off"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mã CSKCB (<span className="font-mono">macskcb</span>)
                    </label>
                    <input
                      type="text"
                      value={bhxhDefaultMaCskcb}
                      onChange={e => setBhxhDefaultMaCskcb(e.target.value.toUpperCase())}
                      placeholder="VD: 01001"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Họ tên cán bộ tra cứu (<span className="font-mono">hoTenCb</span>) *
                    </label>
                    <input
                      type="text"
                      value={bhxhDefaultHoTenCb}
                      onChange={e => setBhxhDefaultHoTenCb(e.target.value)}
                      placeholder="VD: Nguyễn Văn A (cán bộ đăng ký trên cổng BHXH)"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Số CCCD cán bộ tra cứu (<span className="font-mono">cccdCb</span> · 12 số) *
                    </label>
                    <input
                      type="text"
                      value={bhxhDefaultCccdCb}
                      onChange={e => setBhxhDefaultCccdCb(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="VD: 001090001234"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tabular-nums"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mật khẩu (<span className="font-mono">password</span>)</span>
                      </label>
                      <span
                        className={`text-[11px] font-semibold ${
                          bhxhHasPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {bhxhHasPassword ? 'Đã lưu MD5 trên server' : 'Chưa có mật khẩu'}
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        type={bhxhShowPassword ? 'text' : 'password'}
                        value={bhxhPassword}
                        onChange={e => {
                          setBhxhPassword(e.target.value);
                          if (e.target.value) setBhxhClearPassword(false);
                        }}
                        placeholder={
                          bhxhHasPassword
                            ? 'Để trống nếu giữ nguyên...'
                            : bhxhPasswordMode === 'plain'
                            ? 'Nhập mật khẩu gốc (tự băm MD5 IN HOA)...'
                            : 'Nhập chuỗi MD5 32 ký tự hex IN HOA...'
                        }
                        autoComplete="new-password"
                        className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setBhxhShowPassword(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={bhxhShowPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                      >
                        {bhxhShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="inline-flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="bhxhPasswordMode"
                            checked={bhxhPasswordMode === 'plain'}
                            onChange={() => setBhxhPasswordMode('plain')}
                            className="text-emerald-600"
                          />
                          <span className="text-slate-600 dark:text-slate-300">Gốc (tự MD5 IN HOA)</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="bhxhPasswordMode"
                            checked={bhxhPasswordMode === 'md5'}
                            onChange={() => setBhxhPasswordMode('md5')}
                            className="text-emerald-600"
                          />
                          <span className="text-slate-600 dark:text-slate-300">Đã băm MD5</span>
                        </label>
                      </div>

                      {bhxhHasPassword && (
                        <label className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bhxhClearPassword}
                            onChange={e => {
                              setBhxhClearPassword(e.target.checked);
                              if (e.target.checked) setBhxhPassword('');
                            }}
                            className="rounded border-rose-300 text-rose-600"
                          />
                          <span>Xóa mật khẩu</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={bhxhAutoLookupFacility}
                        aria-label="Tự động lấy tên CSKCB ban đầu"
                        disabled={bhxhLoadingConfig || savingBhxhConfig}
                        onClick={() => void handleToggleBhxhSettingImmediate('autoLookupFacilityName')}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 ${
                          bhxhAutoLookupFacility ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                            bhxhAutoLookupFacility ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Tự động lấy tên CSKCB ban đầu
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={bhxhShowHistoryKcb}
                        aria-label="Hiển thị lịch sử KCB"
                        disabled={bhxhLoadingConfig || savingBhxhConfig}
                        onClick={() => void handleToggleBhxhSettingImmediate('showHistoryKcb')}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 ${
                          bhxhShowHistoryKcb ? 'bg-emerald-600' : 'bg-rose-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                            bhxhShowHistoryKcb ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Hiển thị lịch sử KCB
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingBhxhConfig}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60 transition"
                  >
                    {savingBhxhConfig ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Lưu cấu hình</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Card 2: Unified Compact API Tester & Call Result Viewer */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Kiểm tra (Test) &amp; Kết quả Call API BHXH</span>
              </h4>

              <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setBhxhTestMode('token')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    bhxhTestMode === 'token'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  1. Token
                </button>
                <button
                  type="button"
                  onClick={() => setBhxhTestMode('cskcb')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    bhxhTestMode === 'cskcb'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  2. Cơ sở KCB
                </button>
                <button
                  type="button"
                  onClick={() => setBhxhTestMode('card')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    bhxhTestMode === 'card'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  3. Thẻ BHYT / CCCD
                </button>
              </div>
            </div>

            {/* Active Test Input Form */}
            {bhxhTestMode === 'token' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <span className="text-slate-600 dark:text-slate-400 font-mono">
                  POST /api/token/take (username + password MD5 IN HOA)
                </span>
                <button
                  type="button"
                  disabled={testingBhxhApi}
                  onClick={() => void handleTestBhxhToken()}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 hover:opacity-90 text-white font-bold text-xs inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-60 shrink-0"
                >
                  {testingBhxhApi ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>Gọi API lấy Token</span>
                </button>
              </div>
            )}

            {bhxhTestMode === 'cskcb' && (
              <form onSubmit={handleTestBhxhCskcb} className="flex flex-col sm:flex-row gap-2.5 text-xs">
                <input
                  type="text"
                  value={testMaCskcb}
                  onChange={e => setTestMaCskcb(e.target.value.toUpperCase())}
                  placeholder={bhxhDefaultMaCskcb || 'Nhập macskcb (VD: 01001)'}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                />
                <button
                  type="submit"
                  disabled={testingBhxhApi}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60 shrink-0"
                >
                  {testingBhxhApi ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Hospital className="w-3.5 h-3.5" />
                  )}
                  <span>Gọi API NhanThongTinCSKCB</span>
                </button>
              </form>
            )}

            {bhxhTestMode === 'card' && (
              <form onSubmit={handleTestBhxhCardLookup} className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={testCardMaThe}
                    onChange={e => setTestCardMaThe(e.target.value.toUpperCase())}
                    placeholder="Số CCCD hoặc Mã thẻ BHYT *"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono uppercase"
                  />
                  <input
                    type="text"
                    required
                    value={testCardHoTen}
                    onChange={e => setTestCardHoTen(e.target.value)}
                    placeholder="Họ và tên chủ thẻ *"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    required
                    value={testCardNgaySinh}
                    onChange={e => setTestCardNgaySinh(e.target.value)}
                    placeholder="Ngày sinh (DD/MM/YYYY hoặc YYYY) *"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tabular-nums"
                  />
                </div>
                {(bhxhLookupEndpoint === 'KQNhanLichSuKCB2024' || bhxhLookupEndpoint === 'NhanLichSuKCB2024') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={testCardHoTenCb}
                      onChange={e => setTestCardHoTenCb(e.target.value)}
                      placeholder={bhxhDefaultHoTenCb ? `Họ tên cán bộ: ${bhxhDefaultHoTenCb}` : 'Họ tên cán bộ tra cứu (hoTenCb) *'}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      value={testCardCccdCb}
                      onChange={e => setTestCardCccdCb(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder={bhxhDefaultCccdCb ? `CCCD cán bộ: ${bhxhDefaultCccdCb}` : 'CCCD cán bộ 12 số (cccdCb) *'}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono tabular-nums"
                    />
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={testingBhxhApi}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-60"
                  >
                    {testingBhxhApi ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Gọi API {bhxhLookupEndpoint}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Live API Call Response Viewer */}
            {bhxhApiCallResult && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span
                      className={`font-bold inline-flex items-center gap-1 ${
                        bhxhApiCallResult.ok
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {bhxhApiCallResult.ok ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{bhxhApiCallResult.ok ? 'THÀNH CÔNG' : 'LỖI'}</span>
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 truncate">
                      {bhxhApiCallResult.endpoint}
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {bhxhApiCallResult.durationMs} ms · {bhxhApiCallResult.calledAt}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          ?.writeText(JSON.stringify(bhxhApiCallResult.payload, null, 2))
                          .then(() => showToast('success', 'Đã sao chép JSON kết quả'));
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBhxhApiCallResult(null)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                <div
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    bhxhApiCallResult.ok
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100'
                      : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100'
                  }`}
                >
                  <div className="font-bold">{bhxhApiCallResult.summaryTitle}</div>
                  {bhxhApiCallResult.summaryDetails.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono opacity-90">
                      {bhxhApiCallResult.summaryDetails.map((line, i) => (
                        <span key={i}>{line}</span>
                      ))}
                    </div>
                  )}
                </div>

                <pre className="p-3.5 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-auto max-h-72 leading-relaxed border border-slate-800">
                  {JSON.stringify(bhxhApiCallResult.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Epidemic Case Mark / Edit Modal from Admin Console */}
      <EpidemicCaseModal
        isOpen={showEpidemicCaseModal}
        initialCase={editingAdminEpidemicCase}
        stationDefaultAddress={address}
        onClose={() => {
          setShowEpidemicCaseModal(false);
          setEditingAdminEpidemicCase(null);
        }}
      />

      {/* Add Map Location Modal */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Thêm Điểm / Phân Trạm Lên Bản Đồ
              </h3>
              <button
                type="button"
                onClick={() => setShowAddLocationModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLocation} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên điểm / cơ sở y tế *
                </label>
                <input
                  type="text"
                  required
                  value={newLocName}
                  onChange={e => setNewLocName(e.target.value)}
                  placeholder="Phân trạm y tế cơ sở 2, Điểm tiêm chủng..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Địa chỉ chi tiết *
                </label>
                <input
                  type="text"
                  required
                  value={newLocAddress}
                  onChange={e => setNewLocAddress(e.target.value)}
                  placeholder="Số nhà, tên đường, khu phố, ấp..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vĩ độ (Latitude) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newLocLat}
                    onChange={e => setNewLocLat(e.target.value)}
                    placeholder="10.7516"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kinh độ (Longitude) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newLocLng}
                    onChange={e => setNewLocLng(e.target.value)}
                    placeholder="106.7024"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewLocLat('10.7516');
                    setNewLocLng('106.7024');
                  }}
                  className="text-[11px] text-emerald-600 hover:underline"
                >
                  Gợi ý tọa độ TP.HCM
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => {
                    setNewLocLat('21.0285');
                    setNewLocLng('105.8542');
                  }}
                  className="text-[11px] text-emerald-600 hover:underline"
                >
                  Gợi ý tọa độ Hà Nội
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    value={newLocPhone}
                    onChange={e => setNewLocPhone(e.target.value)}
                    placeholder="02xx xxxx xxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Giờ tiếp nhận
                  </label>
                  <input
                    type="text"
                    value={newLocHours}
                    onChange={e => setNewLocHours(e.target.value)}
                    placeholder="07:00 - 11:00 | 13:00 - 17:00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Người đứng đầu / Trưởng điểm trạm
                </label>
                <input
                  type="text"
                  value={newLocHeadName}
                  onChange={e => setNewLocHeadName(e.target.value)}
                  placeholder="BS. Nguyễn Văn A..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú chuyên môn
                </label>
                <input
                  type="text"
                  value={newLocNotes}
                  onChange={e => setNewLocNotes(e.target.value)}
                  placeholder="Khám thai, tư vấn dinh dưỡng, tiêm chủng mở rộng..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={newLocIsPrimary}
                  aria-label="Đặt làm Trụ sở chính của Trạm Y tế"
                  onClick={() => setNewLocIsPrimary(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    newLocIsPrimary ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                      newLocIsPrimary ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Đặt làm Trụ sở chính của Trạm Y tế
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddLocationModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition"
                >
                  Lưu điểm mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Quick Link Modal */}
      {showAddQuickLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Globe className="w-5 h-5 text-emerald-600" />
                Thêm Liên Kết Nhanh Footer
              </h3>
              <button
                type="button"
                onClick={() => setShowAddQuickLinkModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddQuickLink} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên liên kết / Cổng thông tin *
                </label>
                <input
                  type="text"
                  required
                  value={newLinkTitle}
                  onChange={e => setNewLinkTitle(e.target.value)}
                  placeholder="ví dụ: Bảo Hiểm Xã Hội Việt Nam..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Địa chỉ URL (https://...) *
                </label>
                <input
                  type="url"
                  required
                  value={newLinkUrl}
                  onChange={e => setNewLinkUrl(e.target.value)}
                  placeholder="https://baohiemxahoi.gov.vn"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Mô tả tóm tắt
                </label>
                <input
                  type="text"
                  value={newLinkDesc}
                  onChange={e => setNewLinkDesc(e.target.value)}
                  placeholder="Tra cứu thẻ BHYT & Sổ BHXH điện tử VssID..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nhãn / Badge hiển thị
                </label>
                <input
                  type="text"
                  value={newLinkBadge}
                  onChange={e => setNewLinkBadge(e.target.value)}
                  placeholder="ví dụ: BHYT, Chính phủ, Quốc gia..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddQuickLinkModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition"
                >
                  Lưu liên kết
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Map Location Modal */}
      {editingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Chỉnh Sửa Thông Tin Điểm Y Tế & Tọa Độ
              </h3>
              <button
                type="button"
                onClick={() => setEditingLocation(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateLocation} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Tên điểm / cơ sở y tế *
                </label>
                <input
                  type="text"
                  required
                  value={newLocName}
                  onChange={e => setNewLocName(e.target.value)}
                  placeholder="Phân trạm y tế cơ sở 2..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Địa chỉ chi tiết *
                </label>
                <input
                  type="text"
                  required
                  value={newLocAddress}
                  onChange={e => setNewLocAddress(e.target.value)}
                  placeholder="Số nhà, tên đường, khu phố..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vĩ độ (Latitude) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newLocLat}
                    onChange={e => setNewLocLat(e.target.value)}
                    placeholder="10.7516"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Kinh độ (Longitude) *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={newLocLng}
                    onChange={e => setNewLocLng(e.target.value)}
                    placeholder="106.7024"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    value={newLocPhone}
                    onChange={e => setNewLocPhone(e.target.value)}
                    placeholder="02xx xxxx xxxx"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Giờ tiếp nhận
                  </label>
                  <input
                    type="text"
                    value={newLocHours}
                    onChange={e => setNewLocHours(e.target.value)}
                    placeholder="07:00 - 11:00 | 13:00 - 17:00"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Người đứng đầu / Trưởng điểm trạm
                </label>
                <input
                  type="text"
                  value={newLocHeadName}
                  onChange={e => setNewLocHeadName(e.target.value)}
                  placeholder="BS. Nguyễn Văn A..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Ghi chú chuyên môn
                </label>
                <input
                  type="text"
                  value={newLocNotes}
                  onChange={e => setNewLocNotes(e.target.value)}
                  placeholder="Khám thai, tư vấn dinh dưỡng..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  role="switch"
                  aria-checked={newLocIsPrimary}
                  aria-label="Đặt làm Trụ sở chính của Trạm Y tế"
                  onClick={() => setNewLocIsPrimary(v => !v)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    newLocIsPrimary ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                      newLocIsPrimary ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Đặt làm Trụ sở chính của Trạm Y tế
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLocation(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Vaccination Schedule Modal */}
      {showVaccinationModal && (() => {
        const stationOptions = getStationLocationOptions();
        const isMultiDay = Boolean(vacEndDate && vacEndDate > vacDate);
        const previewStatus = resolveVaccinationLifecycle({
          date: vacDate,
          endDate: isMultiDay ? vacEndDate : undefined,
          startTime: vacStartTime || DEFAULT_VACCINATION_START_TIME,
          endTime: vacEndTime || DEFAULT_VACCINATION_END_TIME,
          timeRange: `${vacStartTime || DEFAULT_VACCINATION_START_TIME} - ${vacEndTime || DEFAULT_VACCINATION_END_TIME}`,
          status: vacStatus === 'postponed' ? 'postponed' : 'upcoming',
        }).effectiveStatus;

        const previewLabel =
          previewStatus === 'ongoing'
            ? 'Đang triển khai'
            : previewStatus === 'upcoming'
            ? 'Sắp diễn ra'
            : previewStatus === 'postponed'
            ? 'Tạm hoãn'
            : 'Đã kết thúc';

        const previewClass =
          previewStatus === 'ongoing'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : previewStatus === 'upcoming'
            ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
            : previewStatus === 'postponed'
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Syringe className="w-5 h-5 text-emerald-600" />
                  <span>
                    {editingVaccination ? 'Cập Nhật Lịch Tiêm Chủng' : 'Thiết Lập Lịch Tiêm Chủng'}
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowVaccinationModal(false);
                    setEditingVaccination(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/70 text-xs text-teal-900 dark:text-teal-200 flex items-start gap-2.5">
                <Building2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <span>
                  Mỗi lịch thiết lập riêng cho <strong>1 điểm tiêm</strong>. Sau khi lưu, bấm{' '}
                  <strong>&quot;Sao chép điểm tiếp&quot;</strong> để cấu hình nhanh cho điểm tiếp theo.
                </span>
              </div>

              <form onSubmit={handleSaveVaccinationSchedule} className="space-y-3.5 text-xs">
                {/* 1. Location Option Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Chọn điểm tiêm (thiết lập riêng cho điểm này) *
                  </label>
                  <select
                    value={vacCustomLocationMode ? '__custom__' : vacLocation}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '__custom__') {
                        setVacCustomLocationMode(true);
                        setVacLocation('');
                      } else {
                        setVacCustomLocationMode(false);
                        setVacLocation(val);
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    {stationOptions.map(opt => (
                      <option key={opt.id} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    <option value="__custom__">+ Nhập tên điểm tiêm khác...</option>
                  </select>

                  {vacCustomLocationMode && (
                    <input
                      type="text"
                      required
                      value={vacLocation}
                      onChange={e => setVacLocation(e.target.value)}
                      placeholder="Nhập tên và địa chỉ điểm tiêm..."
                      className="mt-2 w-full px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  )}
                </div>

                {/* 2. Title */}
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tiêu đề lịch tiêm chủng *
                  </label>
                  <input
                    type="text"
                    required
                    value={vacTitle}
                    onChange={e => setVacTitle(e.target.value)}
                    placeholder="Ví dụ: Lịch Tiêm Chủng Mở Rộng Định Kỳ"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                </div>

                {/* 3. Program Type & Auto Status Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Chương trình *
                    </label>
                    <select
                      value={vacProgramType}
                      onChange={e =>
                        setVacProgramType(e.target.value as VaccinationScheduleItem['programType'])
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="expanded">Tiêm chủng mở rộng (Miễn phí)</option>
                      <option value="campaign">Chiến dịch tiêm chủng bổ sung</option>
                      <option value="service">Tiêm chủng dịch vụ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Trạng thái (tự động theo ngày giờ)
                    </label>
                    <div className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${previewClass}`}>
                        {previewLabel}
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={vacStatus === 'postponed'}
                          onChange={e => setVacStatus(e.target.checked ? 'postponed' : 'upcoming')}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-amber-600"
                        />
                        <span>Tạm hoãn</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 4. Date Range */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Từ ngày *
                    </label>
                    <input
                      type="date"
                      required
                      value={vacDate}
                      onChange={e => {
                        const nextStart = e.target.value;
                        setVacDate(nextStart);
                        if (!vacEndDate || vacEndDate < nextStart) {
                          setVacEndDate(nextStart);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Đến ngày (nếu kéo dài nhiều ngày)
                    </label>
                    <input
                      type="date"
                      min={vacDate}
                      value={vacEndDate}
                      onChange={e => setVacEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                {!editingVaccination && vacEndDate > vacDate && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/70 space-y-2">
                    <div className="text-[11px] font-bold text-emerald-900 dark:text-emerald-300">
                      Khoảng nhiều ngày ({formatIsoDateVN(vacDate)} - {formatIsoDateVN(vacEndDate)} ·{' '}
                      {enumerateDateRange(vacDate, vacEndDate, 31).length} ngày):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className="flex items-start gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 cursor-pointer">
                        <input
                          type="radio"
                          name="vacCreateMode"
                          checked={vacCreateMode === 'range'}
                          onChange={() => setVacCreateMode('range')}
                          className="mt-0.5 text-emerald-600"
                        />
                        <span className="leading-snug">
                          <strong className="block text-slate-900 dark:text-white">
                            Gộp 1 lịch nhiều ngày
                          </strong>
                          <span className="text-[11px] text-slate-500">
                            Hiển thị {formatIsoDateVN(vacDate)} - {formatIsoDateVN(vacEndDate)}
                          </span>
                        </span>
                      </label>

                      <label className="flex items-start gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 cursor-pointer">
                        <input
                          type="radio"
                          name="vacCreateMode"
                          checked={vacCreateMode === 'daily_split'}
                          onChange={() => setVacCreateMode('daily_split')}
                          className="mt-0.5 text-emerald-600"
                        />
                        <span className="leading-snug">
                          <strong className="block text-slate-900 dark:text-white">
                            Tạo {enumerateDateRange(vacDate, vacEndDate, 31).length} lịch riêng
                          </strong>
                          <span className="text-[11px] text-slate-500">
                            Tạo 1 thẻ lịch cho từng ngày
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* 5. Start & End Time (Default 07:00 - 11:00) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Giờ bắt đầu (mặc định 07:00) *
                    </label>
                    <input
                      type="time"
                      required
                      value={vacStartTime}
                      onChange={e => setVacStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Giờ kết thúc (mặc định 11:00) *
                    </label>
                    <input
                      type="time"
                      required
                      value={vacEndTime}
                      onChange={e => setVacEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-semibold"
                    />
                  </div>
                </div>

                {/* Default policy notice */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                  Vắc xin, đối tượng tiêm và lưu ý theo chuẩn Chương trình Tiêm chủng mở rộng được áp dụng tự động mặc định.
                </div>

                <div className="flex flex-wrap items-center gap-5 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={vacIsPinned}
                      aria-label="Ghim ưu tiên hàng đầu"
                      onClick={() => setVacIsPinned(v => !v)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        vacIsPinned ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                          vacIsPinned ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Ghim ưu tiên hàng đầu
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={vacIsActive}
                      aria-label="Hiển thị công khai"
                      onClick={() => setVacIsActive(v => !v)}
                      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                        vacIsActive ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform ${
                          vacIsActive ? 'translate-x-4.5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Hiển thị công khai
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setShowVaccinationModal(false);
                      setEditingVaccination(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={savingVaccination}
                    className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {savingVaccination ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>{editingVaccination ? 'Lưu thay đổi' : 'Xuất bản lịch tiêm'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Send Notification Modal */}
      <SendNotificationModal
        isOpen={showSendNotifModal}
        onClose={() => setShowSendNotifModal(false)}
        onSuccess={onRefreshData}
      />

      {/* Cover Image Crop Modal */}
      <ImageCropModal
        isOpen={Boolean(coverCropSource)}
        imageSrc={coverCropSource?.src || null}
        mode="cover"
        fileName={coverCropSource?.fileName}
        isSubmitting={uploadingCoverImage}
        onCancel={() => {
          if (!uploadingCoverImage) setCoverCropSource(null);
        }}
        onConfirm={async (result: ImageCropResult) => {
          setUploadingCoverImage(true);
          setCoverPreviewError(false);
          setCoverUseProxy(false);
          try {
            let privateGitHubRepo = false;
            const gh = settings.githubConfig;
            if (gh?.token?.trim() && gh?.owner?.trim() && gh?.repo?.trim()) {
              try {
                const ext = result.blob.type.includes('webp') ? 'webp' : 'jpg';
                const croppedFile = new File(
                  [result.blob],
                  `station-cover-${Date.now()}.${ext}`,
                  { type: result.blob.type || 'image/jpeg' }
                );
                const res = await GitHubService.uploadFile(
                  gh,
                  croppedFile,
                  userProfile?.displayName || 'Admin'
                );
                if (res.success && res.isPrivate) {
                  privateGitHubRepo = true;
                } else if (res.success && res.fileItem?.downloadUrl && !res.isPrivate) {
                  const rawUrl = GitHubService.toRawGitHubUrl(res.fileItem.downloadUrl).split('?')[0];
                  setCoverImageUrl(rawUrl);
                  setCoverCropSource(null);
                  showToast(
                    'success',
                    'Đã cắt và tải ảnh bìa lên kho lưu trữ',
                    'Nhấn "Lưu cấu hình đơn vị" để áp dụng lên trang chủ.'
                  );
                  return;
                }
              } catch {
                // Fallback to compressed cropped data URI
              }
            }

            if (result.dataUrl.length > 460000) {
              throw new Error(
                'Ảnh bìa sau khi cắt vẫn quá lớn (>450KB). Vui lòng chọn vùng cắt nhỏ hơn hoặc dùng URL ảnh.'
              );
            }
            setCoverImageUrl(result.dataUrl);
            setCoverCropSource(null);
            showToast(
              'success',
              privateGitHubRepo
                ? 'Đã cắt & lưu trực tiếp ảnh bìa (kho GitHub đang Riêng tư)'
                : 'Đã cắt & nạp ảnh bìa',
              'Nhấn "Lưu cấu hình đơn vị" để áp dụng lên trang chủ.'
            );
          } catch (err: any) {
            showToast('error', 'Không thể áp dụng ảnh bìa', err?.message || 'Vui lòng thử lại.');
          } finally {
            setUploadingCoverImage(false);
          }
        }}
      />
    </div>
  );
};
