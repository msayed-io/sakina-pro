import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
  startTransition,
  lazy,
  Suspense,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import AuthScreen from "@/components/AuthScreen";
import SakeenahLineSpinner from "@/components/SakeenahLineSpinner";
import ProgressiveBlur from "@/components/ProgressiveBlur";
import HijriMonthScreen, { preloadHijriHero } from "@/features/hijri-month/HijriMonthScreen";
import { DEFAULT_HIJRI_OFFSET, formatHijriDate, getHijriOffset, localCivilDay, subscribeHijriOffset, upcomingHijriOccasions } from "@/services/hijri-calendar";
import type { AuthUser } from "@/services/auth-service";
import {
  getCurrentSession,
  handleAuthCallback,
  listenForNativeAuthCallback,
  listenForNativeSharedConversationLink,
  subscribeToAuthState,
  signOut,
} from "@/services/auth-service";
import { dailyHadithData } from "@/data/dailyHadithData";
import SharedSakeenahConversationPage from "@/components/SharedSakeenahConversationPage";
import { getPublicShareTokenFromPath, forkSakeenahSharedConversation } from "@/services/sakeenah-sharing";
import {
  detectCalcMethodByLocation,
  detectAsrSchoolByLocation,
} from "@/utils/locationDetection";
import type { CalculationMethod, AsrSchool } from "@/utils/locationDetection";
import {
  calculatePrayerTimes,
  toCalculationMethodId,
  splitFormattedPrayerTime,
} from "@/utils/prayerTimes";
import type { PrayerItem } from "@/utils/prayerTimes";
import type { HadithAttachmentContext, HadithItem } from "@/types/hadith.types";
import {
  autoDetectLocation,
  performSilentResumeLocationRefresh,
  getLastSavedLocation,
  saveSavedLocation,
  guessTimezone,
  LOCATION_ACTIONABLE_ERROR_MESSAGE,
} from "@/lib/gps-location";
import { getPrayerTimeline } from "@/lib/prayer-times";
import type { PrayerLocation } from "@/lib/prayer-config";
import ManualLocationDialog from "@/components/ManualLocationDialog";
import LocationSheet from "@/components/settings/LocationSheet";
import QcfVerse from "@/components/QcfVerse";
import { prefetchQcfFont } from "@/hooks/useQcfFont";
import { PRELOAD_QCF_PAGES } from "@/constants/appVerses";

const loadAzkar = () => import("@/components/AzkarTabScreen");
const loadCounter = () => import("@/features/azkar-reference/AzkarReferenceScreen");
const loadQuran = () => import("@/components/QuranTabScreen");
const loadHadith = () => import("@/components/HadithBooksScreen");
const loadLibrary = () => import("@/components/SakinaLibraryScreen");
const loadAi = () => import("@/components/SakeenahAIScreen");
const loadAsma = () => import("@/components/AsmaAlHusnaScreen");
// الشاشة الجديدة الموحّدة (الصفحتان + الورقتان) — القديمة تُركّب مستبعدة أدناه.
const loadSettings = () => import("@/components/settings/SettingsExperience");
const loadPrayerSettings = () => import("@/components/PrayerSettingsScreen").then((m) => ({ default: m.PrayerSettingsScreen }));
const LazyAzkar = lazy(loadAzkar), LazyCounter = lazy(loadCounter), LazyQuran = lazy(loadQuran);
const LazyHadith = lazy(loadHadith), LazyLibrary = lazy(loadLibrary), LazyAi = lazy(loadAi);
const LazyAsma = lazy(loadAsma), LazySettings = lazy(loadSettings), LazyPrayerSettings = lazy(loadPrayerSettings);

// Prepare screen code during the existing splash without mounting screens or
// starting their data-fetching effects. Android modules are bundled locally.
const preparedScreens: {
  azkar?: Awaited<ReturnType<typeof loadAzkar>>["default"];
  counter?: Awaited<ReturnType<typeof loadCounter>>["default"];
  quran?: Awaited<ReturnType<typeof loadQuran>>["default"];
  hadith?: Awaited<ReturnType<typeof loadHadith>>["default"];
  library?: Awaited<ReturnType<typeof loadLibrary>>["default"];
  ai?: Awaited<ReturnType<typeof loadAi>>["default"];
  asma?: Awaited<ReturnType<typeof loadAsma>>["default"];
  settings?: Awaited<ReturnType<typeof loadSettings>>["default"];
  prayerSettings?: Awaited<ReturnType<typeof loadPrayerSettings>>["default"];
} = {};

export async function prepareScreens(): Promise<void> {
  // Public conversation links don't mount the main application's screens.
  if (getPublicShareTokenFromPath()) return;
  // Keep this temporary object separate: late imports must never change a
  // mounted component type and discard a screen's state.
  const ready: typeof preparedScreens = {};
  const jobs = Promise.allSettled([
    loadAzkar().then((m) => { ready.azkar = m.default; }),
    loadCounter().then((m) => { ready.counter = m.default; }),
    loadQuran().then((m) => { ready.quran = m.default; }),
    loadHadith().then((m) => { ready.hadith = m.default; }),
    loadLibrary().then((m) => { ready.library = m.default; }),
    loadAi().then((m) => { ready.ai = m.default; }),
    loadAsma().then((m) => { ready.asma = m.default; }),
    loadSettings().then((m) => { ready.settings = m.default; }),
    loadPrayerSettings().then((m) => { ready.prayerSettings = m.default; }),
  ]);
  // A stalled network or damaged bundle must not block the whole app forever.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 4000); });
  const results = await Promise.race([jobs, deadline]);
  clearTimeout(timer);
  Object.assign(preparedScreens, ready);
  if (!results) console.warn("Screen preparation timed out; remaining screens will load on demand.");
  else results.forEach((result) => {
    if (result.status === "rejected") console.warn("Unable to prepare a screen:", result.reason);
  });
}

import { PrayerCardSpeakerIcon } from "@/components/PrayerCardSpeakerIcon";
import { WeatherDisplay } from "@/components/WeatherDisplay";
import { HadithCard } from "@/components/HadithCard";
import { PrayerNotificationsService } from "@/services/PrayerNotificationsService";
import { PrayerAlarmService } from "@/services/PrayerAlarmService";
import { syncSakeenahClarity } from "@/services/sakeenah-clarity";
import {
  createAndroidUsageSignalTransport,
  setAndroidUsageSignalTransport,
  trackAndroidUsageSignal,
} from "@/services/android-usage-signals";
import {
  createPrayerReminderEvent,
  getReminderRemainingSeconds,
  getReminderState,
} from "@/services/prayer-reminder-state";
import BatteryOptimizationModal from "@/components/BatteryOptimizationModal";
import type { AllPrayersPreferences, PrayerSettingsId } from "@/types/prayer-settings";
import { loadPrayerPreferences, savePrayerPreferences, prayerKeyToSettingsId } from "@/types/prayer-settings";

import { BookOpenText, ChevronDown, Library, Sparkles } from "lucide-react";
import {
  PrayerKey,
  TabType,
  AzkarCounterType,
  WeatherData,
} from "@/types/app.types";
import {
  backgrounds,
  prayerReflections,
  calcMethodLabels,
  asrSchoolLabels,
} from "@/constants/prayerContent";
import {
  ringRadius,
  ringLength,
  TOTAL_SLIDES,
  SWIPE_THRESHOLD_PX,
  SWIPE_VELOCITY_PX,
  DIRECTION_LOCK_PX,
  EDGE_RESISTANCE,
} from "@/constants/uiConstants";
// timeHelpers (getDayOfYear/getCurrentPrayerIndex/getCountdownSeconds/
// formatCountdown) لم تعد مستخدمة: العدّاد التنازلي والحالة الحالية يأتيان
// الآن من getPrayerTimeline في المنظومة المرجعية.
import {
  SettingsIcon,
  HomeIcon,
  AdhkarIcon,
  PrayerIcon,
  ClockTiny,
  PlayTiny,
  LocationPin,
  ArrowLeftIcon,
} from "@/components/icons/AppIcons";

function UserIdentityIcon({ user }: { user: AuthUser | null }) {
  if (!user) return <SettingsIcon />;
  const avatarUrl = user.user_metadata?.avatar_url;
  const label = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "س");

  if (avatarUrl) {
    return <img src={String(avatarUrl)} alt="" className="h-full w-full rounded-full object-cover" referrerPolicy="no-referrer" />;
  }

  return <span className="text-[15px] font-black text-[var(--sk-accent)]">{label.charAt(0).toUpperCase()}</span>;
}

/* ════════════════════════════════════════════════════════════════════════
   STATIC DATA
   ════════════════════════════════════════════════════════════════════════ */

/* prayerSchedule is now computed dynamically — see useMemo below */

/* ════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
   MAIN APP
   ════════════════════════════════════════════════════════════════════════ */

function ScreenLoader({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[70] flex w-full items-center justify-center bg-[var(--sk-bg)] text-[var(--sk-label2)]"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <SakeenahLineSpinner size={28} color="var(--sk-accent)" label={label} />
        <span className="text-sm font-bold">{label}</span>
      </div>
    </div>
  );
}

/**
 * تحميل الموقع الأولي من عقد PrayerLocation الموحّد (dar_prayer_location).
 * عند غيابه يُرحَّل من مفاتيح سكينة القديمة (app_cityName/app_cityLat/app_cityLon)
 * مرة واحدة، ثم يُحفظ في العقد الجديد. الافتراضي: القاهرة.
 */
function loadInitialPrayerLocation(): PrayerLocation {
  const saved = getLastSavedLocation();
  if (saved) return saved;

  try {
    const legacyName = localStorage.getItem("app_cityName");
    const legacyLat = parseFloat(localStorage.getItem("app_cityLat") || "");
    const legacyLon = parseFloat(localStorage.getItem("app_cityLon") || "");
    if (legacyName && Number.isFinite(legacyLat) && Number.isFinite(legacyLon)) {
      const migrated: PrayerLocation = {
        latitude: Number(legacyLat.toFixed(6)),
        longitude: Number(legacyLon.toFixed(6)),
        cityName: legacyName,
        cityNameAr: legacyName,
        timezoneId: guessTimezone(legacyLat, legacyLon),
        source: "legacy",
        capturedAt: Date.now(),
      };
      saveSavedLocation(migrated);
      return migrated;
    }
  } catch {
    // تجاهل مفاتيح قديمة تالفة والمتابعة إلى الافتراضي
  }

  return {
    latitude: 30.0444,
    longitude: 31.2357,
    cityName: "القاهرة، مصر",
    cityNameAr: "القاهرة، مصر",
    countryNameAr: "مصر",
    timezoneId: "Africa/Cairo",
    source: "legacy",
    capturedAt: Date.now(),
  };
}

function AuthenticatedApp() {
  const AzkarTabScreen = preparedScreens.azkar ?? LazyAzkar;
  const AzkarCounterScreen = preparedScreens.counter ?? LazyCounter;
  const QuranTabScreen = preparedScreens.quran ?? LazyQuran;
  const HadithBooksScreen = preparedScreens.hadith ?? LazyHadith;
  const SakinaLibraryScreen = preparedScreens.library ?? LazyLibrary;
  const SakeenahAIScreen = preparedScreens.ai ?? LazyAi;
  const AsmaAlHusnaScreen = preparedScreens.asma ?? LazyAsma;
  const SettingsScreen = preparedScreens.settings ?? LazySettings;
  const PrayerSettingsScreen = preparedScreens.prayerSettings ?? LazyPrayerSettings;
  /* ── Existing state ── */
  const [now, setNow] = useState(() => new Date());
  const hijriOffset = useSyncExternalStore(subscribeHijriOffset, getHijriOffset, () => DEFAULT_HIJRI_OFFSET);
  const civilDay = localCivilDay(now);
  const hijriSnapshot = useMemo(() => upcomingHijriOccasions(now, hijriOffset), [civilDay, hijriOffset]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── NEW state ── */
  const [activeTab, setActiveTab] = useState<TabType>("main");
  const [hadithAttachment, setHadithAttachment] = useState<HadithAttachmentContext | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(() => new Set(["main"]));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [nativeAuthError, setNativeAuthError] = useState<string | null>(null);
  const [pendingSharedToken, setPendingSharedToken] = useState<string | null>(() => localStorage.getItem("sakeenah_pending_share_token"));
  const [pendingForkConversationId, setPendingForkConversationId] = useState<string | null>(() => localStorage.getItem("sakeenah_pending_fork_conversation_id"));
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  // الورقة المشتركة الوحيدة لتعديل الموقع — تُفتح من أي شاشة بنفس الدالة.
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showAzkarCounter, setShowAzkarCounter] = useState(false);
  const [showAsmaAlHusna, setShowAsmaAlHusna] = useState(false);
  const [showBatteryModal, setShowBatteryModal] = useState(false);
  const [permissionRevision, setPermissionRevision] = useState(0);
  const [azkarCounterType, setAzkarCounterType] =
    useState<AzkarCounterType>("morning");
  const [hisnCategory, setHisnCategory] = useState<string>("");

  // Track whether to hide bottom floating navigation based on Quran sub-screens (Sheikh profile, Audio player)
  const [quranHideNav, setQuranHideNav] = useState(false);
  const [hadithHideNav, setHadithHideNav] = useState(false);
  const [showSakinaLibrary, setShowSakinaLibrary] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showHijriMonth, setShowHijriMonth] = useState(false);
  const hijriOpening = useRef(false);

  useEffect(() => { void preloadHijriHero(); }, []);
  useEffect(() => {
    const onHistoryChange = (event: PopStateEvent) => setShowHijriMonth(Boolean(event.state?.sakinahHijriMonth));
    window.addEventListener("popstate", onHistoryChange);
    return () => window.removeEventListener("popstate", onHistoryChange);
  }, []);
  const openHijriMonth = useCallback(async () => {
    if (hijriOpening.current) return;
    hijriOpening.current = true;
    try {
      await preloadHijriHero();
      window.history.pushState({ ...window.history.state, sakinahHijriMonth: true }, "");
      setShowHijriMonth(true);
    } finally { hijriOpening.current = false; }
  }, []);
  const closeHijriMonth = useCallback(() => {
    if (window.history.state?.sakinahHijriMonth) window.history.back();
    else setShowHijriMonth(false);
  }, []);

  /* ── Per-Prayer Notification Preferences ── */
  const [prayerPrefs, setPrayerPrefs] = useState<AllPrayersPreferences>(() => loadPrayerPreferences());
  const [activePrayerSettings, setActivePrayerSettings] = useState<PrayerSettingsId | null>(null);
  const [isSecondaryTimesExpanded, setIsSecondaryTimesExpanded] = useState(false);

  const [locationPermissionFlowDone, setLocationPermissionFlowDone] = useState(false);
  const [isAutoLocation, setIsAutoLocation] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("app_isAutoLocation");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  /* ── PrayerLocation: العقد الموحّد من منظومة Dar-Al-Hikayat المرجعية ── */
  const [prayerLocation, setPrayerLocation] = useState<PrayerLocation>(() =>
    loadInitialPrayerLocation(),
  );

  // الاسم التفصيلي الكامل (العزبة/القرية/الحي + المركز + المحافظة) — يُعرض
  // كاملًا دون اقتصاص في الإعدادات ونافذة الموقع.
  const cityName = prayerLocation.cityNameAr ?? prayerLocation.cityName;
  const cityLat = prayerLocation.latitude;
  const cityLon = prayerLocation.longitude;
  const timezoneId = prayerLocation.timezoneId;
  // الكبسولة الخارجية في الصفحة الرئيسية (تحت كبسولة الطقس): اسم المكان
  // الأول فقط — لا العنوان الكامل.
  const placeNameOnly = cityName.split("،")[0]?.trim() || cityName;
  const [calcMethod, setCalcMethod] = useState<CalculationMethod>(() => {
    try {
      const saved = localStorage.getItem("app_calcMethod") as CalculationMethod;
      return saved || "EGYPTIAN";
    } catch {
      return "EGYPTIAN";
    }
  });

  const [asrSchool, setAsrSchool] = useState<AsrSchool>(() => {
    try {
      const saved = localStorage.getItem("app_asrSchool") as AsrSchool;
      return saved || "STANDARD";
    } catch {
      return "STANDARD";
    }
  });

  const [isAutoCalcMethod, setIsAutoCalcMethod] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("app_isAutoCalcMethod");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const [isAutoAsrSchool, setIsAutoAsrSchool] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("app_isAutoAsrSchool");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const [isMulkReminderEnabled, setIsMulkReminderEnabled] = useState<boolean>(
    () => {
      try {
        const saved = localStorage.getItem("app_isMulkReminderEnabled");
        return saved !== null ? saved === "true" : false;
      } catch {
        return false;
      }
    },
  );

  const [mulkReminderTime, setMulkReminderTime] = useState<string>(() => {
    try {
      return localStorage.getItem("app_mulkReminderTime") || "21:00";
    } catch {
      return "21:00";
    }
  });

  const [isBaqarahReminderEnabled, setIsBaqarahReminderEnabled] =
    useState<boolean>(() => {
      try {
        const saved = localStorage.getItem("app_isBaqarahReminderEnabled");
        return saved !== null ? saved === "true" : false;
      } catch {
        return false;
      }
    });

  const [baqarahReminderTime, setBaqarahReminderTime] = useState<string>(() => {
    try {
      return localStorage.getItem("app_baqarahReminderTime") || "20:30";
    } catch {
      return "20:30";
    }
  });

  const [weather, setWeather] = useState<WeatherData | null>(null);

  /* ── Effects ── */

  // Keep visited tabs mounted so returning to them preserves scroll, filters,
  // selected items, and already-loaded data instead of showing a fresh loader.
  useEffect(() => {
    setVisitedTabs((previous) => {
      if (previous.has(activeTab)) return previous;
      const next = new Set(previous);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  // Bootstrap Supabase auth before exposing protected features.
  useEffect(() => {
    let disposed = false;

    const bootstrapAuth = async () => {
      try {
        await handleAuthCallback();
        const session = await getCurrentSession();
        if (!disposed) setCurrentUser(session?.user ?? null);
      } catch (error) {
        console.warn("Auth bootstrap failed:", error);
        if (!disposed) setCurrentUser(null);
      } finally {
        if (!disposed) setIsAuthReady(true);
      }
    };

    void bootstrapAuth();
    const stopNativeCallback = listenForNativeAuthCallback(
      (session) => {
        if (disposed) return;
        setCurrentUser(session?.user ?? null);
        if (session) setNativeAuthError(null);
      },
      () => {
        if (!disposed) {
          setNativeAuthError(
            "تعذر إكمال تسجيل الدخول بعد العودة من Google. أعد المحاولة، وإذا تكررت المشكلة فتحقق من رابط Android في إعدادات Supabase.",
          );
        }
      },
    );
    const stopAuthSubscription = subscribeToAuthState((event, session) => {
      if (!disposed) setCurrentUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session) {
        void trackAndroidUsageSignal("login_success");
      }
    });

    return () => {
      disposed = true;
      stopNativeCallback();
      stopAuthSubscription();
    };
  }, []);

  useEffect(() => {
    void syncSakeenahClarity(activeTab === "sakeenah-ai");
  }, [activeTab]);

  const shouldShowQuranNav = activeTab === "quran" && quranHideNav;
  const shouldShowHadithNav = activeTab === "hadith" && hadithHideNav;

  useEffect(() => {
    const stopSharedLinkListener = listenForNativeSharedConversationLink((token) => {
      localStorage.setItem("sakeenah_pending_share_token", token);
      setPendingSharedToken(token);
    });
    return stopSharedLinkListener;
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    if (pendingSharedToken && !currentUser) {
      setActiveTab("sakeenah-ai");
      return;
    }
    if (pendingForkConversationId && currentUser) {
      setActiveTab("sakeenah-ai");
    }
  }, [currentUser, isAuthReady, pendingForkConversationId, pendingSharedToken]);

  useEffect(() => {
    if (!isAuthReady || !currentUser || !pendingSharedToken) return;
    let cancelled = false;
    void forkSakeenahSharedConversation(pendingSharedToken)
      .then(({ conversationId }) => {
        if (cancelled) return;
        localStorage.removeItem("sakeenah_pending_share_token");
        localStorage.setItem("sakeenah_pending_fork_conversation_id", conversationId);
        setPendingSharedToken(null);
        setPendingForkConversationId(conversationId);
        setActiveTab("sakeenah-ai");
      })
      .catch((error) => {
        console.error("Failed to fork shared Sakeenah conversation", error);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, isAuthReady, pendingSharedToken]);

  // طلب أذونات الصلاة تلقائياً بعد اكتمال إذن الموقع.
  // هذا يضمن أن التطبيق يطلب كل الأذونات اللازمة للإشعارات والأذان
  // بدون انتظار تفاعل المستخدم مع BatteryOptimizationModal.
  useEffect(() => {
    async function requestPrayerPermissions() {
      try {
        if (!locationPermissionFlowDone) return;

        // 1. طلب إذن الإشعارات (POST_NOTIFICATIONS على Android 13+)
        const notificationStatus = await PrayerNotificationsService.getPermissionStatus();
        if (notificationStatus !== 'granted') {
          await PrayerNotificationsService.requestPermission();
        }

        // 2. فحص إذن الجداول الدقيقة (SCHEDULE_EXACT_ALARM على Android 12+)
        const { PrayerAlarmService } = await import('@/services/PrayerAlarmService');
        const exactAlarmAvailable = await PrayerAlarmService.canScheduleExactAlarms();

        // 3. إذا كان إذن الجداول الدقيقة غير متاح، اعرض الـ modal لإرشاد المستخدم
        // (هذا الإذن يتطلب فتح الإعدادات يدوياً — لا يمكن طلبه برمجياً)
        if (!exactAlarmAvailable) {
          setShowBatteryModal(true);
        }

        // 4. تحديث permissionRevision لإعادة فحص الحالة
        setPermissionRevision((prev) => prev + 1);
      } catch (error) {
        console.warn('Prayer permission request failed:', error);
      }
    }

    const timer = setTimeout(requestPrayerPermissions, 2000);
    return () => clearTimeout(timer);
  }, [locationPermissionFlowDone]);

  // Preload QCF fonts for all app verses (splash, home prayer reflections, settings)
  // at startup so verses render instantly with no flash.
  useEffect(() => {
    PRELOAD_QCF_PAGES.forEach((pageNumber) => {
      prefetchQcfFont(pageNumber);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchWeather() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${cityLat}&longitude=${cityLon}&current_weather=true`,
        );
        const data = await res.json();
        if (isMounted && data.current_weather) {
          setWeather({
            temp: Math.round(data.current_weather.temperature),
            conditionCode: data.current_weather.weathercode,
            isDay: data.current_weather.is_day === 1,
          });
        }
      } catch (e) {
        console.warn("Failed to fetch weather", e);
      }
    }
    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, [cityLat, cityLon]);

  /* ── Dynamic prayer schedule (recomputes when location/date changes) ── */
  const prayerSchedule = useMemo<PrayerItem[]>(
    () => calculatePrayerTimes(now, cityLat, cityLon, calcMethod, asrSchool, timezoneId),
    [
      now.getDate(),
      now.getMonth(),
      now.getFullYear(),
      cityLat,
      cityLon,
      calcMethod,
      asrSchool,
      timezoneId,
    ],
  );

  const tomorrowSchedule = useMemo<PrayerItem[]>(
    () => calculatePrayerTimes(new Date(now.getTime() + 24 * 60 * 60 * 1000), cityLat, cityLon, calcMethod, asrSchool, timezoneId),
    [
      now.getDate(),
      now.getMonth(),
      now.getFullYear(),
      cityLat,
      cityLon,
      calcMethod,
      asrSchool,
      timezoneId,
    ],
  );

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeTab]);

  // ملكية التمرير — الطبقة الأولى (scroll-ownership-spec-ar.md):
  // كل تبويب جديد يبدأ من الأعلى. التغيير يحدث داخل commit الخاصة بـ React
  // (useLayoutEffect — بعد بناء DOM وقبل أن يرسمه المتصفح) لا بعد الرسم،
  // ولا يُنفَّذ إلا عند تغيّر المالك فعلياً. لا إعادة ضبط في أي مكان آخر،
  // والرجوع للخلف يتبع المتصفح (لا إعادة ضبط على popstate).
  // إعادة الضبط تخصّ تغيّر التبويب فقط (spec §1: شرط pathname). العدّاد لوحة
  // ثابتة فوق الشجرة — فتحه أو إغلاقه لا يعيد تمرير المستند ولا يقصّه.
  const prevTabRef = useRef<TabType>(activeTab);
  useLayoutEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;

    // إعادة ضبط المستند أثناء الـ commit نفسه — لا رجفة ولا موضع وسيط.
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    // أيضاً اضبط أي حاويات تمرير داخلية (تحوّط — لا تحملها عناصر حالياً).
    const scrollContainers = document.querySelectorAll('[data-scroll-container]');
    scrollContainers.forEach((container) => {
      if (container instanceof HTMLElement) {
        container.scrollTop = 0;
      }
    });
  }, [activeTab]);

  // اللوحات المعتمة كاملة الشاشة: اقفل تمرير المستند خلفها واسترجع القيمة السابقة
  // عند الإغلاق (spec §3 — قاعدة المودال). المواضع تُحفَظ الآن لأن أشجار التبويبات
  // تبقى مركّبة، فلا حاجة لإعادة الضبط — فقط منع التمرير خلف اللوحة.
  const prevBodyOverflowRef = useRef<string>("");
  useEffect(() => {
    if (!(showAzkarCounter || showAsmaAlHusna || showSakinaLibrary || showHijriMonth)) return;
    prevBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflowRef.current;
    };
  }, [showAzkarCounter, showAsmaAlHusna, showSakinaLibrary, showHijriMonth]);

  useEffect(() => {
    let disposed = false;

    const reconcileNotifications = async () => {
      try {
        // Keep permission acquisition separate from location acquisition so
        // Android never receives competing system dialogs.
        const permissionStatus = await PrayerNotificationsService.getPermissionStatus();
        const granted = permissionStatus === 'granted';
        if (disposed) return;

        const prayers = [...prayerSchedule, ...tomorrowSchedule]
          .filter((prayer) => prayer.key !== "sunrise" && prayer.date)
          .map((prayer) => ({
            key: prayer.key,
            name: prayer.name,
            timeMs: prayer.date!.getTime(),
          }))
          .filter((prayer, index, all) => all.findIndex((candidate) => candidate.key === prayer.key && candidate.timeMs === prayer.timeMs) === index);

        /* ═══ الويدجت متّصل بالبطاقة الداخلية (v2.3.35) ══════════════════
           البطاقة الداخلية ترسم `timeline.augmentedSchedule` — نص عربي هندي
           جاهز. كان الويدجت يستقبل epoch ويعيد تنسيقه بنفسه، أي مسار عرض
           ثانٍ قد يختلف عن البطاقة. الآن يُرسَل **نص البطاقة نفسه** مع كل
           ميعاد ويُعرض كما هو بلا أي تحويل. لا حاسبة ثانية ولا خدمة جديدة.
           تُكتب دائمًا قبل بوابة إذن الإشعارات لأن الويدجت لا يحتاج إذنًا.
           تشمل الغد: يبقى الويدجت صحيحًا بعد منتصف الليل حتى لو لم يُفتح
           التطبيق، وهو يختار مواقيت اليوم المحلي بنفسه. */
        const cardLabelByKey = new Map<string, string>(
          timeline.augmentedSchedule.map((prayer) => [
            prayer.key,
            splitFormattedPrayerTime(prayer.timeFormatted).time,
          ]),
        );

        const widgetPayload = {
          sunriseTimeMs: prayerSchedule.find((p) => p.key === "sunrise")?.date?.getTime(),
          cityName: placeNameOnly,
          hijriDate: hijriSnapshot.today ? formatHijriDate(hijriSnapshot.today) : undefined,
          gregorianDate: dateStrings.gregorianDate,
          dayTimes: [
            // اليوم: نص البطاقة الداخلية حرفيًا.
            ...prayerSchedule.map((prayer) => ({
              prayer,
              label: cardLabelByKey.get(prayer.key) ?? prayer.time,
            })),
            // الغد: نفس الصيغة من نفس الدالة (يبقى الويدجت صحيحًا بعد منتصف الليل).
            ...tomorrowSchedule.map((prayer) => ({ prayer, label: prayer.time })),
          ]
            .filter(({ prayer }) => prayer.date)
            .map(({ prayer, label }) => ({
              key: prayer.key,
              name: prayer.name,
              timeMs: prayer.date!.getTime(),
              label,
            }))
            .filter(
              (item, index, all) =>
                all.findIndex(
                  (candidate) => candidate.key === item.key && candidate.timeMs === item.timeMs,
                ) === index,
            ),
        };

        await PrayerAlarmService.updateWidgetData(widgetPayload);

        if (!granted) {
          await PrayerNotificationsService.clearAllScheduled();
          return;
        }

        await PrayerNotificationsService.syncPrayerSchedule({
          prayers,
          prayerPrefs,
          // Prayer notifications and the 10-minute reminder are mandatory app capabilities.
          // The user grants notification permission; there is no settings toggle for them.
          prayerTimeNotificationsEnabled: true,
          prePrayerRemindersEnabled: true,
          secondaryReminders: {
            mulk: isMulkReminderEnabled ? mulkReminderTime : undefined,
            baqarah: isBaqarahReminderEnabled ? baqarahReminderTime : undefined,
          },
          // نفس حِزمة الويدجت المكتوبة أعلاه — تمرير القيم نفسها لمسار
          // المنبّهات حتى لا يوجد مساران بقيمتين مختلفتين. (docs/widget-data-flow.md §2)
          widget: widgetPayload,
        });
      } catch (error) {
        console.warn("Notification scheduling failed:", error);
      }
    };

    void reconcileNotifications();
    return () => {
      disposed = true;
    };
  }, [
    prayerSchedule,
    tomorrowSchedule,
    isMulkReminderEnabled,
    mulkReminderTime,
    isBaqarahReminderEnabled,
    baqarahReminderTime,
    prayerPrefs,
    permissionRevision,
    // بيانات الويدجت — تُرسَل مع نفس النداء، فإعادة الجدولة عند تغيّرها
    // تُحدِّث الويدجت أيضًا دون مسار إضافي.
    placeNameOnly,
    hijriSnapshot.today,
    // التاريخ الميلادي يتغيّر مع civilDay فقط — لا نضيف اعتمادًا جديدًا.
    civilDay,
  ]);

  const dateStrings = useMemo(() => {
    const hijriDate = hijriSnapshot.today
      ? `${formatHijriDate(hijriSnapshot.today)} هـ`
      : "التاريخ الهجري غير متاح";
    const gregorianDate = new Intl.DateTimeFormat("ar-EG", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(now);
    return { hijriDate, gregorianDate };
  }, [civilDay, hijriSnapshot]);

  /* ── Prayer Timeline Engine (منظومة Dar-Al-Hikayat المرجعية) ──
     خط زمني فلكي متصل UTC: عشاء الأمس ← فجر اليوم ← … ← عشاء ← فجر الغد.
     يُعاد حسابه مع now ليبقى العدّاد التنازلي دقيقًا كل ثانية. */
  const timeline = useMemo(
    () =>
      getPrayerTimeline(
        prayerLocation,
        toCalculationMethodId(calcMethod),
        now,
        asrSchool,
      ),
    [prayerLocation, calcMethod, asrSchool, now],
  );

  /* ── Computed state (من الخط الزمني الفلكي المتصل) ── */
  const state = useMemo(() => {
    const current = {
      key: timeline.current.key as PrayerItem["key"],
      name: timeline.current.name,
      date: timeline.current.date,
    };
    const next = {
      key: timeline.next.key as PrayerItem["key"],
      name: timeline.next.name,
      date: timeline.next.date,
    };

    const reminderEvent = createPrayerReminderEvent(next.key, next.date.getTime());
    const reminderState = getReminderState(reminderEvent, now.getTime());
    const reminderRemainingSeconds = getReminderRemainingSeconds(reminderEvent, now.getTime());

    const augmentedSchedule = timeline.augmentedSchedule.map((prayer) => {
      const { time, meridiem } = splitFormattedPrayerTime(prayer.timeFormatted);
      return {
        ...prayer,
        key: prayer.key as PrayerItem["key"],
        time,
        meridiem,
        isActive: prayer.isCurrent,
      };
    });

    return {
      current,
      next,
      progress: timeline.progress,
      countdownLabel: timeline.countdownLabel,
      reminderState,
      reminderRemainingSeconds,
      hijriDate: dateStrings.hijriDate,
      gregorianDate: dateStrings.gregorianDate,
      background: backgrounds[current.key],
      reflection: prayerReflections[current.key],
      heroPrayerName: current.name,
      augmentedSchedule,
    };
  }, [timeline, dateStrings, now]);

  const todayHadith = useMemo(
    () => dailyHadithData.getTodayHadith(),
    [now.getDate()],
  );
  const ringOffset = ringLength * (1 - state.progress);

  const secondaryTimes = useMemo(() => {
    const secondary = timeline.secondaryTimes;
    return {
      duha: splitFormattedPrayerTime(secondary.duha),
      midnight: splitFormattedPrayerTime(secondary.midnight),
      firstThird: splitFormattedPrayerTime(secondary.firstThird),
      lastThird: splitFormattedPrayerTime(secondary.lastThird),
    };
  }, [timeline]);

  /* ── Handlers ── */
  // تطبيق كائن PrayerLocation الناتج من المنظومة المرجعية على الحالة.
  const applyPrayerLocation = useCallback(
    (location: PrayerLocation) => {
      setPrayerLocation(location);
      setLocationError(null);
      if (isAutoCalcMethod) {
        setCalcMethod(detectCalcMethodByLocation(location.latitude, location.longitude));
      }
      if (isAutoAsrSchool) {
        setAsrSchool(detectAsrSchoolByLocation(location.latitude, location.longitude));
      }
    },
    [isAutoCalcMethod, isAutoAsrSchool],
  );

  // اختيار يدوي من الخريطة: بناء عقد PrayerLocation كامل وحفظه في العقد الموحّد.
  const handleCitySelected = useCallback(
    (name: string, lat: number, lon: number) => {
      const location: PrayerLocation = {
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lon.toFixed(6)),
        cityName: name,
        cityNameAr: name,
        timezoneId: guessTimezone(lat, lon),
        isAutoDetected: false,
        source: "manual_map",
        capturedAt: Date.now(),
      };
      saveSavedLocation(location);
      applyPrayerLocation(location);
    },
    [applyPrayerLocation],
  );

  const handleToggleAutoCalcMethod = useCallback(
    (val: boolean) => {
      setIsAutoCalcMethod(val);
      if (val) {
        setCalcMethod(detectCalcMethodByLocation(cityLat, cityLon));
      }
    },
    [cityLat, cityLon],
  );

  const handleToggleAutoAsrSchool = useCallback(
    (val: boolean) => {
      setIsAutoAsrSchool(val);
      if (val) {
        setAsrSchool(detectAsrSchoolByLocation(cityLat, cityLon));
      }
    },
    [cityLat, cityLon],
  );


  const openLocationAppSettings = useCallback(async () => {
    try {
      const { PrayerAlarmService } = await import("@/services/PrayerAlarmService");
      await PrayerAlarmService.openAppSettings();
    } catch (error) {
      console.warn("Unable to open app settings:", error);
    }
  }, []);

  // نقطة الدخول الرسمية الوحيدة لمنظومة الموقع المرجعية: autoDetectLocation()
  // تدير الإذن والدقة العالية (enableHighAccuracy) والإثراء بالهرم الجغرافي
  // والحفظ الفوري في dar_prayer_location — لا دوال فرعية ولا محاولات يدوية.
  const handleAutoDetectLocation = useCallback(async () => {
    setLocationError(null);
    try {
      const location = await autoDetectLocation();
      applyPrayerLocation(location);
    } catch (error) {
      console.warn("Auto location detection failed:", error);
      setIsAutoLocation(false);
      setLocationError(
        error instanceof Error ? error.message : LOCATION_ACTIONABLE_ERROR_MESSAGE,
      );
    }
  }, [applyPrayerLocation]);

  // تحديث هادئ عند العودة من الخلفية عبر طبقة المنظومة المرجعية نفسها.
  const refreshLocationAfterResume = useCallback(async () => {
    const location = await performSilentResumeLocationRefresh();
    if (location) applyPrayerLocation(location);
  }, [applyPrayerLocation]);

  // Location is requested on first launch. Notification permission is handled
  // by the dedicated capability onboarding, not in parallel with GPS.
  useEffect(() => {
    if (!isAutoLocation) {
      setLocationPermissionFlowDone(true);
      return;
    }
    setLocationPermissionFlowDone(false);
    void handleAutoDetectLocation().finally(() => setLocationPermissionFlowDone(true));
  }, [handleAutoDetectLocation, isAutoLocation]);

  // Refresh location after returning from background so travel/timezone changes apply immediately.
  useEffect(() => {
    if (!isAutoLocation || !Capacitor.isNativePlatform()) return;

    let disposed = false;
    let listener: { remove: () => Promise<void> } | null = null;
    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (!disposed && isActive) void refreshLocationAfterResume();
    }).then((handle) => {
      if (disposed) void handle.remove();
      else listener = handle;
    }).catch((error) => {
      console.warn("Unable to listen for app state changes:", error);
    });

    return () => {
      disposed = true;
      if (listener) void listener.remove();
    };
  }, [refreshLocationAfterResume, isAutoLocation]);

  // ملاحظة: المنظومة المرجعية لا تستخدم watchPosition مستمرًا؛ التحديث
  // الهادئ عند العودة من الخلفية (performSilentResumeLocationRefresh) يغطي
  // تغيّر الموقع/المنطقة الزمنية دون استنزاف البطارية.

  useEffect(() => {
    localStorage.setItem("app_isAutoLocation", isAutoLocation.toString());
  }, [isAutoLocation]);

  // حفظ العقد الموحّد dar_prayer_location عند كل تغيير (المصدر الوحيد للحقيقة).
  useEffect(() => {
    saveSavedLocation(prayerLocation);
  }, [prayerLocation]);

  useEffect(() => {
    localStorage.setItem("app_calcMethod", calcMethod);
  }, [calcMethod]);

  useEffect(() => {
    localStorage.setItem("app_asrSchool", asrSchool);
  }, [asrSchool]);

  useEffect(() => {
    localStorage.setItem("app_isAutoCalcMethod", isAutoCalcMethod.toString());
  }, [isAutoCalcMethod]);

  useEffect(() => {
    localStorage.setItem("app_isAutoAsrSchool", isAutoAsrSchool.toString());
  }, [isAutoAsrSchool]);

  useEffect(() => {
    localStorage.setItem(
      "app_isMulkReminderEnabled",
      isMulkReminderEnabled.toString(),
    );
  }, [isMulkReminderEnabled]);

  useEffect(() => {
    localStorage.setItem("app_mulkReminderTime", mulkReminderTime);
  }, [mulkReminderTime]);

  useEffect(() => {
    localStorage.setItem(
      "app_isBaqarahReminderEnabled",
      isBaqarahReminderEnabled.toString(),
    );
  }, [isBaqarahReminderEnabled]);

  useEffect(() => {
    localStorage.setItem("app_baqarahReminderTime", baqarahReminderTime);
  }, [baqarahReminderTime]);

  // Persist prayer preferences on change
  useEffect(() => {
    savePrayerPreferences(prayerPrefs);
  }, [prayerPrefs]);

  const handleOpenAzkarCounter = useCallback(
    (type: "morning" | "evening" | "sleep" | "post_prayer") => {
      setAzkarCounterType(type);
      setShowAzkarCounter(true);
    },
    [],
  );

  const handleOpenSakinaLibrary = useCallback(() => setShowSakinaLibrary(true), []);

  const handleOpenHisnCategory = useCallback((category: string) => {
    setHisnCategory(category);
    setAzkarCounterType("hisn");
    setShowAzkarCounter(true);
  }, []);

  const handleBackToMain = useCallback(() => {
    setHadithAttachment(null);
    startTransition(() => {
      setActiveTab("main");
    });
  }, []);
  const handleAskSakeenahAboutHadith = useCallback((hadith: HadithItem) => {
    const attachment: HadithAttachmentContext = {
      bookTitle: hadith.bookTitle,
      hadithNumber: hadith.hadithnumber,
      arabicNumber: hadith.arabicnumber,
      chapterTitle: hadith.chapterTitle,
      grade: hadith.grade,
      text: hadith.text,
      reference: hadith.reference ? JSON.stringify(hadith.reference) : undefined,
    };
    setHadithAttachment(attachment);
    startTransition(() => setActiveTab("sakeenah-ai"));
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } finally {
      setCurrentUser(null);
      setActiveTab("main");
    }
  }, []);

  const handleOpenAsmaAlHusna = useCallback(() => {
    setShowAsmaAlHusna(true);
  }, []);

  /** نقطة الفتح الوحيدة لورقة تعديل الموقع في المشروع كله. */
  const openLocationSheet = useCallback(() => setShowLocationSheet(true), []);

  const handleChangeLocation = useCallback(() => {
    setShowLocationDialog(true);
  }, []);

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */
  return (
      <div dir="rtl" className="min-h-screen w-full overflow-x-hidden bg-[var(--sk-bg)] text-[var(--sk-label)]">
      {/* ── Battery Optimization Modal ── */}
      {showBatteryModal && (
        <BatteryOptimizationModal
          onDismiss={(refresh = false) => {
            setShowBatteryModal(false);
            if (refresh) setPermissionRevision((revision) => revision + 1);
          }}
        />
      )}

      {/* ── Azkar Counter Overlay (full screen) ── */ }
      {showAzkarCounter && (
        <Suspense fallback={<ScreenLoader label="جارٍ تحميل العداد..." />}>
          <AzkarCounterScreen
            azkarType={azkarCounterType}
            hisnCategory={hisnCategory}
            onClose={() => setShowAzkarCounter(false)}
          />
        </Suspense>
      )}

      {/* ── Asma Al-Husna Overlay (full screen) ── */}
      {showAsmaAlHusna && (
        <Suspense fallback={<ScreenLoader label="جارٍ تحميل أسماء الله الحسنى..." />}>
          <AsmaAlHusnaScreen onClose={() => setShowAsmaAlHusna(false)} />
        </Suspense>
      )}

      {/* ── Location Dialog: صار خطوة الاختيار العميقة (شبكة/خريطة) التي
          تفتحها الورقة المشتركة من صفّ «الموقع المحدد». لا يُفتح من أي زرّ
          آخر — كل مداخل الموقع تمرّ عبر openLocationSheet. ── */}
      <ManualLocationDialog
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
        onCitySelected={handleCitySelected}
        onAutoLocationRequest={() => {
          setIsAutoLocation(true);
          void handleAutoDetectLocation();
        }}
        locationError={locationError}
        onOpenLocationSettings={openLocationAppSettings}
        isAutoLocation={isAutoLocation}
        setIsAutoLocation={setIsAutoLocation}
        currentCityName={cityName}
        currentLat={cityLat}
        currentLon={cityLon}
      />

      {/* ── ورقة تعديل الموقع المشتركة (نسخة واحدة لكل الشاشات) ── */}
      <LocationSheet
        open={showLocationSheet}
        isAutoLocation={isAutoLocation}
        locationLabel={cityName}
        onApply={(auto) => {
          setShowLocationSheet(false);
          setIsAutoLocation(auto);
          if (auto) void handleAutoDetectLocation();
        }}
        onClose={() => setShowLocationSheet(false)}
        onPickLocation={handleChangeLocation}
      />

      {/* ═══════════════════════════════════════════════════════════════
          TAB: MAIN (Prayer Screen)
          ═══════════════════════════════════════════════════════════════ */}
      {/* ── Screens Container ── */}
      <div className="relative w-full min-h-screen">
        {/* TAB: MAIN (Prayer Screen) */}
        <div
          className={
            `home-tab ${activeTab === "main" ? "block" : "hidden"}${activeTab === "main" && showAzkarCounter ? " invisible" : ""}`
          }
        >
          <section className="relative isolate min-h-[72vh] overflow-hidden">
            <img
              src={state.background}
              alt={`خلفية ${state.current.name}`}
              className="hero-image absolute inset-0 h-full w-full object-cover pointer-events-none z-0 will-change-transform [transform:translateZ(0)]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#180d07]/65 via-[#2a170f]/30 to-[var(--sk-bg)] pointer-events-none z-[1] will-change-transform [transform:translateZ(0)]" />

            <div className="relative z-[2] mx-auto w-full max-w-[390px] px-4 pb-7 pt-6">
              <header
                className="mb-8 flex items-center justify-between text-[#fff9f1] transition-all duration-300 ease-in-out"
                style={{
                  opacity: isScrolled ? 0 : 1,
                  pointerEvents: isScrolled ? "none" : "auto",
                  transform: isScrolled
                    ? "translateY(-10px) scale(0.95)"
                    : "translateY(0) scale(1)",
                }}
              >
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
                  aria-label="فتح الإعدادات"
                  onClick={() => setActiveTab("settings")}
                >
                  <UserIdentityIcon user={currentUser} />
                </button>
                <div className="text-left">
                  <p className="text-[10px] tracking-[0.24em] text-white/70">
                    SAKINAH
                  </p>
                  <h1 className="text-[29px] font-display font-black leading-none">
                    سَكِينَة
                  </h1>
                </div>
              </header>

              <div className="flex flex-col text-[#fff9f1]">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col items-start gap-0.5">
                    <WeatherDisplay weather={weather} />
                    <button
                      onClick={openLocationSheet}
                      className="flex items-center gap-1.5 text-xs font-bold text-white/90 hover:text-white transition-colors drop-shadow-sm max-w-[210px]"
                      title={cityName}
                    >
                      <LocationPin />
                      <span className="truncate">{placeNameOnly}</span>
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3 opacity-70"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M6 9L12 15L18 9" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mt-14 mb-2 flex flex-col items-center justify-center text-center">
                  <div className="flex flex-col items-center max-w-[340px] space-y-3">
                    {state.reflection.isQuran && state.reflection.qcf ? (
                      <p
                        className="leading-relaxed drop-shadow-sm text-[20px] sm:text-[22px] text-[#f4ecd8] font-medium"
                        style={{ direction: 'rtl' }}
                      >
                        <QcfVerse
                          verseKey={state.reflection.qcf.verseKey}
                          pageNumber={state.reflection.qcf.pageNumber}
                          wordStart={state.reflection.qcf.wordStart}
                          wordEnd={state.reflection.qcf.wordEnd}
                        />
                      </p>
                    ) : (
                      <p
                        className={`leading-relaxed drop-shadow-sm ${state.reflection.isQuran ? "text-[18px] text-[#f4ecd8] font-medium font-serif" : "text-[15px] text-white/90 font-bold"}`}
                        style={state.reflection.isQuran ? { lineHeight: "1.7" } : {}}
                      >
                        {state.reflection.isQuran
                          ? `﴿ ${state.reflection.text} ﴾`
                          : `« ${state.reflection.text} »`}
                      </p>
                    )}
                    <p className="text-[10px] font-bold text-white/80 tracking-wide bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                      {state.reflection.source}
                    </p>
                  </div>
                </div>
              </div>

              {/* ===== SLIDER ===== */}
              <div
                ref={containerRef}
                className="mt-14 overflow-x-auto snap-x snap-mandatory flex hide-scrollbar pb-8 -mb-8 items-center"
                dir="rtl"
                onScroll={(e) => {
                  const container = e.currentTarget;
                  const scrollLeft = Math.abs(container.scrollLeft);
                  const width = container.clientWidth;
                  if (width > 0) {
                    setCurrentSlide(Math.round(scrollLeft / width));
                  }
                }}
              >
                {/* Slide 0: Prayer Card */}
                <div className="w-full flex-shrink-0 snap-center px-2 flex flex-col justify-start pt-2">
                  <div className="relative overflow-hidden rounded-[28px] cut-crystal-satin p-5 shadow-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-[var(--sk-label2)] mb-1">
                          الصلاة الحالية
                        </p>
                        <p className="text-[28px] font-display font-bold leading-none text-[var(--sk-label)] tracking-tight">
                          {state.current.name}
                        </p>
                        <p className="mt-1.5 text-[11px] font-bold text-[var(--sk-accent)]">
                          التالية: {state.next.name}
                        </p>
                      </div>
                      <div className="relative h-20 w-20 shrink-0 drop-shadow-sm">
                        <svg
                          className="h-full w-full -rotate-90"
                          viewBox="0 0 100 100"
                          role="img"
                          aria-label="مؤشر مرور الوقت"
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r={ringRadius}
                            style={{ stroke: "var(--sk-ring-track)" }}
                            strokeWidth="6"
                            fill="none"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={ringRadius}
                            style={{ stroke: "var(--sk-progress-arc)" }}
                            strokeWidth="6"
                            strokeLinecap="round"
                            fill="none"
                            strokeDasharray={ringLength}
                            strokeDashoffset={ringOffset}
                            className="ring-motion transition-all duration-1000 ease-in-out"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-[var(--sk-label)] mt-0.5">
                          <p className="text-[9px] font-bold text-[var(--sk-label2)] mb-0.5">
                            متبقي
                          </p>
                          <p className="text-[11px] font-bold tabular-nums tracking-tight">
                            {state.countdownLabel}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-[#e6dccf]/60 dark:border-[var(--sk-sep)]/60 pt-3 flex items-center justify-between text-[11px]">
                      <p className="font-bold text-[var(--sk-label2)]">
                        {state.gregorianDate}
                      </p>
                      <p className="relative font-bold text-[var(--sk-label)]">
                        {state.hijriDate}
                        <button type="button" aria-label="فتح صفحة الشهر الهجري" onClick={() => void openHijriMonth()} className="absolute inset-x-0 top-1/2 h-11 -translate-y-1/2 rounded-md active:bg-current/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--sk-accent)]" />
                      </p>
                    </div>
                  </div>
                </div>

                {/* Slide 1: Hadith of the Day */}
                <HadithCard todayHadith={todayHadith} />
              </div>

              {/* Pagination dots */}
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setCurrentSlide(0);
                    if (containerRef.current) {
                      const target = containerRef.current
                        .children[0] as HTMLElement;
                      target.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center",
                      });
                    }
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === 0 ? "w-6 bg-[var(--sk-espresso-fill)]" : "w-1.5 bg-[var(--sk-label4)] hover:bg-[var(--sk-dot-hover)]"}`}
                  aria-label="البطاقة الأولى — الصلاة الحالية"
                />
                <button
                  onClick={() => {
                    setCurrentSlide(1);
                    if (containerRef.current) {
                      const target = containerRef.current
                        .children[1] as HTMLElement;
                      target.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center",
                      });
                    }
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === 1 ? "w-6 bg-[var(--sk-espresso-fill)]" : "w-1.5 bg-[var(--sk-label4)] hover:bg-[var(--sk-dot-hover)]"}`}
                  aria-label="البطاقة الثانية — حديث اليوم"
                />
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[390px] px-4 pb-24 pt-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[26px] font-display font-bold text-[var(--sk-label)]">
                مواقيت اليوم
              </h3>
            </div>

            {/* Redesigned Premium Unified Card containing all Prayer rows */}
            <div className="cut-crystal-panel rounded-[28px] p-4 shadow-md space-y-1">
              {state.augmentedSchedule.map((prayer) => {
                const isHighlighted = prayer.isNext; // Highlight the "Next" prayer on turn ("الصلاة التالية")
                return (
                  <div
                    key={prayer.key}
                    dir="rtl"
                    className={`relative flex items-center justify-between px-5 py-3 rounded-full transition-all duration-300 ${
                      isHighlighted
                        ? "bg-[#b88a4f]/22 dark:bg-[var(--sk-accent)]/22 border border-[#b88a4f]/30 dark:border-[var(--sk-accent)]/30 shadow-[0_4px_16px_rgba(184,138,79,0.06)]"
                        : "bg-transparent border border-transparent hover:bg-[#f7f2ea]/20 dark:hover:bg-[var(--sk-bg2)]/20"
                    }`}
                  >
                    {/* Right Column: Prayer Name */}
                    <div className="w-1/3 flex items-center justify-start">
                      <span
                        className={`text-[15px] transition-colors ${isHighlighted ? "text-[var(--sk-accent)] font-black" : "text-[var(--sk-label)]"}`}
                      >
                        {prayer.name}
                      </span>
                    </div>

                    {/* Centered Column: Elegant Speaker Trigger/State Icon with no background circle */}
                    <div className="w-1/3 flex justify-center items-center">
                      <PrayerCardSpeakerIcon
                        mode={(() => {
                          const sid = prayerKeyToSettingsId(prayer.key);
                          return sid && prayerPrefs[sid] ? prayerPrefs[sid].mode : 'beep';
                        })()}
                        enabled={(() => {
                          const sid = prayerKeyToSettingsId(prayer.key);
                          return sid ? prayerPrefs[sid]?.enabled ?? true : true;
                        })()}
                        isActive={prayer.isActive}
                        onClick={() => {
                          const sid = prayerKeyToSettingsId(prayer.key);
                          if (sid) setActivePrayerSettings(sid);
                        }}
                      />
                    </div>

                    {/* Left Column: Time Display */}
                    <div className="w-1/3 flex items-center justify-end">
                      <p
                        className={`text-[15px] font-bold tabular-nums tracking-tight transition-colors ${isHighlighted ? "text-[var(--sk-accent)]" : "text-[var(--sk-label)]"}`}
                        dir="rtl"
                      >
                        {prayer.time}
                        <span
                          className={`mr-1 text-[11px] font-bold ${isHighlighted ? "text-[var(--sk-accent)]" : "text-[var(--sk-label2)]"}`}
                        >
                          {prayer.meridiem}
                        </span>
                      </p>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Collapsible Separator with Line & Text Directly on the Background */}
            <div className="relative flex items-center justify-center my-6">
              <div
                className="absolute inset-0 flex items-center"
                aria-hidden="true"
              >
                <div className="w-full border-t border-[#e6dccf]/70 dark:border-[var(--sk-sep)]/70"></div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setIsSecondaryTimesExpanded(!isSecondaryTimesExpanded)
                }
                className="relative flex items-center gap-1.5 bg-[var(--sk-bg)] px-4 text-[var(--sk-label2)] hover:text-[var(--sk-label)] transition-colors cursor-pointer text-[13px] font-bold select-none focus:outline-none"
              >
                <span>أوقات أخرى</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-300 text-[var(--sk-label2)] ${
                    isSecondaryTimesExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {/* List of Other Times displayed directly on the background */}
            <AnimatePresence>
              {isSecondaryTimesExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-4 px-4 pb-2 pt-1 text-[var(--sk-label)]">
                    {/* Row 1: Duha */}
                    <div className="flex items-center justify-between">
                      <span className="text-[14.5px] font-bold">الضحى</span>
                      <span className="text-[14.5px] font-bold tabular-nums tracking-tight text-[var(--sk-accent)]">
                        {secondaryTimes.duha.time} {secondaryTimes.duha.meridiem}
                      </span>
                    </div>

                    {/* Row 2: Midnight */}
                    <div className="flex items-center justify-between">
                      <span className="text-[14.5px] font-bold">
                        منتصف الليل
                      </span>
                      <span className="text-[14.5px] font-bold tabular-nums tracking-tight text-[var(--sk-accent)]">
                        {secondaryTimes.midnight.time} {secondaryTimes.midnight.meridiem}
                      </span>
                    </div>

                    {/* Row 3: First third */}
                    <div className="flex items-center justify-between">
                      <span className="text-[14.5px] font-bold">
                        الثلث الأول من الليل
                      </span>
                      <span className="text-[14.5px] font-bold tabular-nums tracking-tight text-[var(--sk-accent)]">
                        {secondaryTimes.firstThird.time} {secondaryTimes.firstThird.meridiem}
                      </span>
                    </div>

                    {/* Row 4: Last third */}
                    <div className="flex items-center justify-between">
                      <span className="text-[14.5px] font-bold">
                        الثلث الأخير من الليل
                      </span>
                      <span className="text-[14.5px] font-bold tabular-nums tracking-tight text-[var(--sk-accent)]">
                        {secondaryTimes.lastThird.time} {secondaryTimes.lastThird.meridiem}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
          {activeTab === "main" && !showAzkarCounter && isScrolled && <ProgressiveBlur />}
          {/* ── Fixed Floating Glassmorphic Header ── */}
          <AnimatePresence>
            {isScrolled && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                className="fixed top-4 left-0 right-0 z-50 mx-auto w-full max-w-[390px] px-4 flex items-center justify-between pointer-events-none"
              >
                {/* Settings button in glassmorphic capsule */}
                <button
                  className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full cut-crystal-capsule sk-rim shadow-md text-[var(--sk-label)] transition-all duration-300 active:scale-95 cursor-pointer"
                  aria-label="فتح الإعدادات"
                  onClick={() => setActiveTab("settings")}
                >
                  <UserIdentityIcon user={currentUser} />
                </button>

                {/* Sakinah text in glassmorphic capsule */}
                <div className="pointer-events-auto cut-crystal-capsule sk-rim px-6 h-10 rounded-full shadow-md flex items-center justify-center text-[var(--sk-label)]">
                  <span className="text-[17px] font-display font-black leading-none pt-[1px]">
                    سَكِينَة
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* TAB: AZKAR */}
        {(visitedTabs.has("azkar") || activeTab === "azkar") && (
          <Suspense fallback={<ScreenLoader label="جارٍ تحميل الأذكار..." />}>
            {activeTab === "azkar" && !showAzkarCounter && !showAsmaAlHusna && <ProgressiveBlur />}
            <div className={`w-full overflow-x-hidden ${activeTab === "azkar" ? "block" : "hidden"}${activeTab === "azkar" && showAzkarCounter ? " invisible" : ""}`}>
              <AzkarTabScreen
                onOpenAzkarCounter={handleOpenAzkarCounter}
                onOpenHisnCategory={handleOpenHisnCategory}
                onOpenAsmaAlHusna={handleOpenAsmaAlHusna}
              />
            </div>
          </Suspense>
        )}

        {/* TAB: QURAN */}
        {(visitedTabs.has("quran") || activeTab === "quran") && (
          <Suspense fallback={<ScreenLoader label="جارٍ تحميل القرآن..." />}>
            {activeTab === "quran" && !showAzkarCounter && <ProgressiveBlur />}
            <div className={`relative h-full min-h-screen w-full ${activeTab === "quran" ? "block" : "hidden"}${activeTab === "quran" && showAzkarCounter ? " invisible" : ""}`}>
              <QuranTabScreen
                isActive={activeTab === "quran" && !showAzkarCounter}
                onBack={handleBackToMain}
                onHideNavChange={setQuranHideNav}
              />
            </div>
          </Suspense>
        )}

        {/* TAB: HADITH BOOKS */}
        {(visitedTabs.has("hadith") || activeTab === "hadith") && (
          <Suspense fallback={<ScreenLoader label="جارٍ تحميل كتب الحديث..." />}>
            {activeTab === "hadith" && !showAzkarCounter && !showSakinaLibrary && <ProgressiveBlur />}
            <div className={`relative min-h-screen w-full overflow-x-hidden ${activeTab === "hadith" ? "block" : "hidden"}${activeTab === "hadith" && showAzkarCounter ? " invisible" : ""}`}>
              <HadithBooksScreen
                isActive={activeTab === "hadith" && !showAzkarCounter}
                onBack={handleBackToMain}
                onHideNavChange={setHadithHideNav}
                onOpenSakinaLibrary={handleOpenSakinaLibrary}
                onAskSakeenah={handleAskSakeenahAboutHadith}
              />
            </div>
          </Suspense>
        )}

        {/* TAB: SAKEENAH AI */}
        {(visitedTabs.has("sakeenah-ai") || activeTab === "sakeenah-ai") && (
          <div
            className={`relative min-h-screen w-full overflow-x-hidden overflow-y-auto ${activeTab === "sakeenah-ai" ? "block" : "hidden"}${activeTab === "sakeenah-ai" && showAzkarCounter ? " invisible" : ""}`}
            data-clarity-mask="true"
            data-sakeenah-ai-surface="true"
          >
            {activeTab === "sakeenah-ai" && !showAzkarCounter && currentUser && isAuthReady && <ProgressiveBlur />}
            {!isAuthReady ? (
              <div className="flex min-h-screen items-center justify-center bg-[var(--sk-bg)] text-sm font-bold text-[var(--sk-label2)]">
                جارٍ التحقق من الجلسة...
              </div>
            ) : currentUser ? (
              <Suspense fallback={<ScreenLoader label="جارٍ تحميل سكينة AI..." />}>
                <SakeenahAIScreen
                  onBack={handleBackToMain}
                  user={currentUser}
                  initialHadithAttachment={hadithAttachment}
                  onHadithAttachmentChange={setHadithAttachment}
                  initialConversationId={pendingForkConversationId}
                  onInitialConversationConsumed={() => {
                    localStorage.removeItem("sakeenah_pending_fork_conversation_id");
                    setPendingForkConversationId(null);
                  }}
                />
              </Suspense>
            ) : (
              <AuthScreen
                onBack={handleBackToMain}
                onAuthenticated={(user) => setCurrentUser(user)}
                nativeCallbackError={nativeAuthError}
                onClearNativeCallbackError={() => setNativeAuthError(null)}
              />
            )}
          </div>
        )}

        {/* TAB: SETTINGS */}
        {(visitedTabs.has("settings") || activeTab === "settings") && (
          <Suspense fallback={<ScreenLoader label="جارٍ تحميل الإعدادات..." />}>
            {activeTab === "settings" && !showAzkarCounter && <ProgressiveBlur />}
            <div className={`${activeTab === "settings" ? "block" : "hidden"}${activeTab === "settings" && showAzkarCounter ? " invisible" : ""}`}>
          <SettingsScreen
            cityName={cityName}
            displayAddress={prayerLocation.displayAddress}
            isAutoLocation={isAutoLocation}
            onToggleAutoLocation={setIsAutoLocation}
            calcMethod={calcMethod}
            asrSchool={asrSchool}
            isAutoCalcMethod={isAutoCalcMethod}
            isAutoAsrSchool={isAutoAsrSchool}
            onToggleAutoCalcMethod={handleToggleAutoCalcMethod}
            onToggleAutoAsrSchool={handleToggleAutoAsrSchool}
            onChangeCalcMethod={setCalcMethod}
            onChangeAsrSchool={setAsrSchool}
            onOpenLocationSheet={openLocationSheet}
            onExit={handleBackToMain}
            currentUser={currentUser}
            onSignOut={handleSignOut}
            isMulkReminderEnabled={isMulkReminderEnabled}
            onToggleMulkReminder={setIsMulkReminderEnabled}
            mulkReminderTime={mulkReminderTime}
            onChangeMulkReminderTime={setMulkReminderTime}
            isBaqarahReminderEnabled={isBaqarahReminderEnabled}
            onToggleBaqarahReminder={setIsBaqarahReminderEnabled}
            baqarahReminderTime={baqarahReminderTime}
            onChangeBaqarahReminderTime={setBaqarahReminderTime}
          />
            </div>
          </Suspense>
        )}
      </div>

      <AnimatePresence>
        {showSakinaLibrary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-[var(--sk-bg)]"
          >
            <Suspense fallback={<ScreenLoader label="جارٍ تحميل مكتبة سكينة..." />}>
              <SakinaLibraryScreen
                onBack={() => setShowSakinaLibrary(false)}
                onHideNavChange={() => undefined}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════
          FLOATING BOTTOM NAVIGATION
          ═══════════════════════════════════════════════════════════════ */}
      {!showHijriMonth &&
        !showAzkarCounter &&
        !shouldShowQuranNav &&
        !shouldShowHadithNav &&
        !showAsmaAlHusna &&
        activeTab !== "settings" &&
        activeTab !== "sakeenah-ai" && (
          <nav className="fixed inset-x-0 bottom-5 z-40 flex justify-center pointer-events-none px-2">
            <div className="pointer-events-auto flex items-center gap-1 rounded-[32px] cut-crystal-capsule sk-rim px-2 py-1.5 shadow-lg max-w-full">
              {[
                { id: "main", label: "الرئيسية", icon: <HomeIcon /> },
                {
                  id: "quran",
                  label: "القرآن",
                  icon: (
                    <BookOpenText
                      className="h-[17px] w-[17px] text-current"
                      strokeWidth={2}
                    />
                  ),
                },
                {
                  id: "hadith",
                  label: "الكتب",
                  icon: <Library className="h-[17px] w-[17px] text-current" strokeWidth={2} />,
                },
                { id: "azkar", label: "الأذكار", icon: <AdhkarIcon /> },
                {
                  id: "sakeenah-ai",
                  label: "سكينة AI",
                  icon: <Sparkles className="h-[17px] w-[17px] text-current" strokeWidth={2} />,
                },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      startTransition(() => {
                        setActiveTab(tab.id as TabType);
                      });
                    }}
                    className={`relative flex items-center gap-1.5 rounded-[22px] transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "px-4 py-2 text-[var(--sk-label)]"
                        : "px-3 py-2 text-[var(--sk-label2)] hover:bg-[#2b1a10]/5 dark:hover:bg-[var(--sk-shade)]/5"
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute inset-0 rounded-[24px] bg-[#2b1a10]/10 dark:bg-[var(--sk-shade)]/10 sk-rim-nested shadow-inner"
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center">
                      {tab.icon}
                    </span>
                    <AnimatePresence mode="popLayout">
                      {isActive && (
                        <motion.div
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 400,
                            damping: 30,
                          }}
                          className="relative z-10 overflow-hidden flex items-center"
                        >
                          <span className="text-xs sm:text-[13px] font-bold whitespace-nowrap pr-0.5">
                            {tab.label}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
            </div>
          </nav>
        )}

      <AnimatePresence>
        {showHijriMonth && (
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
            <HijriMonthScreen data={hijriSnapshot} onBack={closeHijriMonth} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PRAYER SETTINGS INTERNAL SCREEN OVERLAY ── */}
      <AnimatePresence>
        {activePrayerSettings && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-[var(--sk-bg)]"
          >
            {/* بدون Suspense هنا كان الفرع كله يعلو إلى جذر Boot Suspense
                ⇒ unmount كامل للتطبيق لحظة الرسم، وانهيار ارتفاع المستند
                إلى 100dvh ⇒ قفزة التمرير إلى 0. نفس نمط باقي الشاشات. */}
            <Suspense fallback={<ScreenLoader label="جارٍ تحميل إعدادات الصلاة..." />}>
            <PrayerSettingsScreen
              prayerId={activePrayerSettings}
              preferences={prayerPrefs}
              onSave={(prefs) => setPrayerPrefs(prefs)}
              onClose={() => setActivePrayerSettings(null)}
              fajrTime={prayerSchedule.find(p => p.key === 'fajr')?.date}
              maghribTime={prayerSchedule.find(p => p.key === 'maghrib')?.date}
              sunriseTime={prayerSchedule.find(p => p.key === 'sunrise')?.date}
              ishaTime={prayerSchedule.find(p => p.key === 'isha')?.date}
            />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
  );
}


export default function App() {
  const sharedToken = getPublicShareTokenFromPath();

  useEffect(() => {
    const nativeTransport = Capacitor.isNativePlatform()
      ? createAndroidUsageSignalTransport()
      : null;
    setAndroidUsageSignalTransport(nativeTransport);
    void trackAndroidUsageSignal("app_open");

    const handleWindowError = (event: ErrorEvent) => {
      void trackAndroidUsageSignal("app_error", event.error instanceof Error ? event.error.name : "window_error");
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      void trackAndroidUsageSignal("app_error", reason instanceof Error ? reason.name : "unhandled_rejection");
    };

    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      setAndroidUsageSignalTransport(null);
    };
  }, []);

  useEffect(() => {
    if (!sharedToken) return;
    void syncSakeenahClarity(true);
    return () => {
      void syncSakeenahClarity(false);
    };
  }, [sharedToken]);

  if (sharedToken) return <SharedSakeenahConversationPage token={sharedToken} />;
  return <AuthenticatedApp />;
}
