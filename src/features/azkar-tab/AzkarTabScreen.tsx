import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  BookOpen,
  BriefcaseMedical,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  CloudRain,
  Heart,
  Home,
  MapPin,
  Moon,
  MoonStar,
  RefreshCw,
  Search,
  Shield,
  Sun,
  Sunrise,
  User,
  Utensils,
} from "lucide-react";

import { azkarData } from "@/data/azkarData";
import { dailyTracker } from "@/data/dailyTracker";
import { hisnAlMuslimData } from "@/data/hisnAlMuslimData";
import ProgressiveBlur from "@/components/ProgressiveBlur";

import {
  CATEGORY_TASK_MARK,
  DAILY_BANDS,
  HISN_KIND_STYLE,
  HISN_PAGE_SIZE,
  ar,
  countLabel,
  hisnColor,
  hisnIcon,
  hisnKind,
  hisnKindOrder,
  initialBand,
  normalizeSearch,
} from "./azkarTabModel";
import "./azkar-tab.css";

type AzkarType = "morning" | "evening" | "sleep" | "post_prayer";

type Props = {
  onOpenAzkarCounter: (azkarType: AzkarType) => void;
  onOpenHisnCategory: (category: string) => void;
  onOpenAsmaAlHusna: () => void;
};

/* الأيقونات حسب الاسم في الخريطة — نفس مجموعة AzkarTabScreen القديمة */
type IconCmp = React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;

const ICONS: Record<string, IconCmp> = {
  Activity,
  AlertCircle,
  Bell,
  BookOpen,
  BriefcaseMedical,
  Car,
  CloudRain,
  Heart,
  Home,
  MapPin,
  Moon,
  MoonStar,
  Shield,
  Sun,
  Sunrise,
  User,
  Utensils,
};

/**
 * أيقونات lucide مكوّنات `<svg>` كاملة، فلا تُوضع داخل svg يدوي.
 * الحجم والسمك واللون تأتي من CSS (`.azk .i`) لتبقى مطابقة للملف.
 */
function KindIcon({ name, filled }: { name: string; filled?: boolean }) {
  const Cmp = ICONS[name] ?? BookOpen;
  return <Cmp className={filled ? "i fill" : "i"} strokeWidth={1.9} />;
}

/* التوبات الأربعة — النصوص كما في ملف التصميم، والأعداد من azkarData الحقيقية */
const CATEGORIES: {
  title: string;
  subtitle: string;
  type: AzkarType;
  icon: string;
  color: string;
  count: number;
}[] = [
  {
    title: "أذكار الصباح",
    subtitle: "إشراقة يومك",
    type: "morning",
    icon: "Sun",
    color: "var(--sk-accent)",
    count: azkarData.morningAzkar.length,
  },
  {
    title: "أذكار المساء",
    subtitle: "ختام يومك",
    type: "evening",
    icon: "Moon",
    color: "#8F9DB8",
    count: azkarData.eveningAzkar.length,
  },
  {
    title: "أذكار النوم",
    subtitle: "سكينة وراحة",
    type: "sleep",
    icon: "MoonStar",
    color: "#9A86C2",
    count: azkarData.sleepAzkar.length,
  },
  {
    title: "بعد الصلاة",
    subtitle: "تمام العبادة",
    type: "post_prayer",
    icon: "Bell",
    color: "var(--sk-success)",
    count: azkarData.postPrayerAzkar.length,
  },
];

export default React.memo(function AzkarTabScreen({
  onOpenAzkarCounter,
  onOpenHisnCategory,
  onOpenAsmaAlHusna,
}: Props) {
  /* ---------- يوميات المسلم ---------- */
  const [doneIds, setDoneIds] = useState<Set<number>>(() => new Set());
  const [band, setBand] = useState<number>(() => initialBand(new Date().getHours()));
  const [tasksAnimKey, setTasksAnimKey] = useState(0);

  const syncFromTracker = useCallback(() => {
    const next = new Set<number>();
    for (const task of dailyTracker.tasks) {
      if (dailyTracker.isTaskDone(task.id)) next.add(task.id);
    }
    setDoneIds(next);
  }, []);

  useEffect(() => {
    syncFromTracker();
  }, [syncFromTracker]);

  const total = dailyTracker.tasks.length;
  const doneCount = doneIds.size;

  const bandCounts = useMemo(
    () =>
      DAILY_BANDS.map((b) => {
        let n = 0;
        for (let i = b.start; i < b.end; i += 1) {
          const task = dailyTracker.tasks[i];
          if (task && doneIds.has(task.id)) n += 1;
        }
        return n;
      }),
    [doneIds],
  );

  const toggleTask = (taskId: number) => {
    dailyTracker.toggleTask(taskId);
    syncFromTracker();
  };

  const resetDaily = () => {
    dailyTracker.saveTodayRecords({});
    syncFromTracker();
  };

  /* ---------- حصن المسلم ---------- */
  const hisnCategories = useMemo(() => hisnAlMuslimData.getCategoriesWithCount(), []);
  const chips = useMemo(() => {
    const order = hisnKindOrder(hisnCategories.map(([cat]) => cat));
    return [
      { key: "all", label: "الكل", count: hisnCategories.length },
      ...order.map((kind) => ({
        key: kind,
        label: HISN_KIND_STYLE[kind].label,
        count: hisnCategories.filter(([cat]) => hisnKind(cat) === kind).length,
      })),
    ];
  }, [hisnCategories]);

  const hisnMeta = useMemo(() => {
    let items = 0;
    for (const [cat] of hisnCategories) items += hisnAlMuslimData.getAzkarByCategory(cat).length;
    return `${ar(hisnCategories.length)} بابًا و${ar(items)} ذكرًا`;
  }, [hisnCategories]);

  const [chip, setChip] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const needle = normalizeSearch(query.trim());
    return hisnCategories.filter(([cat]) => {
      if (chip !== "all" && hisnKind(cat) !== chip) return false;
      if (!needle) return true;
      return normalizeSearch(cat).includes(needle);
    });
  }, [hisnCategories, chip, query]);

  const canCollapse = chip === "all" && !query.trim() && hisnCategories.length > HISN_PAGE_SIZE;
  const shown = canCollapse && !expanded ? filtered.slice(0, HISN_PAGE_SIZE) : filtered;

  /* إعادة الظهور عند تغيير القائمة — نفس سلوك الملف */
  const [listAnimKey, setListAnimKey] = useState(0);
  useEffect(() => {
    setListAnimKey((k) => k + 1);
  }, [chip, query, expanded]);

  const progress = total > 0 ? doneCount / total : 0;

  return (
    <>
      {/* التدرج العلوي: مكوّن التطبيق الحقيقي، خلف الكبسولات */}
      <ProgressiveBlur />

      <div dir="rtl" className="azk">
        <header className="top">
          <div className="cap sk-rim ttl">
            <h1>الأذكار</h1>
          </div>
          <button
            type="button"
            className="cap sk-rim ib"
            onClick={resetDaily}
            aria-label="إعادة ضبط يوميات اليوم"
          >
            <RefreshCw className="i" strokeWidth={1.9} />
          </button>
        </header>

        <main className="page">
          {/* أسماء الله الحسنى */}
          <button
            type="button"
            className="satin hero"
            style={{ ["--c" as string]: "#7FA3AA" }}
            onClick={onOpenAsmaAlHusna}
          >
            <span className="ic">
              <KindIcon name="Heart" filled />
            </span>
            <span className="t">
              <b>أسماء الله الحسنى</b>
              <small>تعلّم، تدبّر وتعرّف على معاني الـ ٩٩ اسمًا</small>
            </span>
            <ChevronLeft className="i chev" strokeWidth={1.9} />
          </button>

          {/* التوبات الأربعة */}
          <div className="grid">
            {CATEGORIES.map((cat) => {
              const markIndex = CATEGORY_TASK_MARK[cat.type];
              const markTask = markIndex >= 0 ? dailyTracker.tasks[markIndex] : undefined;
              const isDone = markTask ? doneIds.has(markTask.id) : false;
              return (
                <button
                  type="button"
                  key={cat.type}
                  className={`panel cat${isDone ? " done" : ""}`}
                  style={{ ["--c" as string]: cat.color }}
                  onClick={() => onOpenAzkarCounter(cat.type)}
                >
                  <span className="ic">
                    <KindIcon name={cat.icon} />
                  </span>
                  <b>{cat.title}</b>
                  <small>{cat.subtitle}</small>
                  <span className="n">{countLabel(cat.count)}</span>
                  <span className="ck" aria-hidden="true">
                    <Check className="i" strokeWidth={2.6} />
                  </span>
                </button>
              );
            })}
          </div>

          {/* يوميات المسلم */}
          <section className="sec" aria-labelledby="azk-dh">
            <div className="sh">
              <h2 id="azk-dh">يوميات المسلم</h2>
              <span className="cap sk-rim cnt">
                {ar(doneCount)} من {ar(total)}
              </span>
            </div>

            <div
              className="bar"
              role="progressbar"
              aria-labelledby="azk-dh"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={total}
              style={{ ["--p" as string]: String(progress) }}
            >
              <i />
            </div>

            <div className="cap seg" role="tablist" aria-label="أوقات اليوم">
              <span
                className="thumb sk-rim-nested"
                aria-hidden="true"
                style={{ ["--i" as string]: String(band) }}
              />
              {DAILY_BANDS.map((b, i) => (
                <button
                  type="button"
                  key={b.label}
                  role="tab"
                  aria-selected={i === band}
                  onClick={() => {
                    setBand(i);
                    setTasksAnimKey((k) => k + 1);
                  }}
                >
                  {b.label}
                  <small dir="ltr">
                    {ar(bandCounts[i])}/{ar(b.end - b.start)}
                  </small>
                </button>
              ))}
            </div>

            <div className="satin" role="tabpanel">
              <div className="fade" key={tasksAnimKey}>
                {dailyTracker.tasks
                  .slice(DAILY_BANDS[band].start, DAILY_BANDS[band].end)
                  .map((task) => {
                    const isDone = doneIds.has(task.id);
                    return (
                      <button
                        type="button"
                        key={task.id}
                        className="task"
                        aria-pressed={isDone}
                        onClick={() => toggleTask(task.id)}
                      >
                        <span className="box">
                          <Check className="i" strokeWidth={2.8} />
                        </span>
                        <span className="l">{task.text}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </section>

          {/* حصن المسلم */}
          <section className="sec" aria-labelledby="azk-hh">
            <div className="sh">
              <div>
                <h2 id="azk-hh">حصن المسلم</h2>
                <p>أدعية وأذكار من السنة النبوية</p>
              </div>
              <span className="cap cnt">{hisnMeta}</span>
            </div>

            <label className="cap inp">
              <Search className="i" strokeWidth={1.9} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في الأدعية والأذكار"
                aria-label="ابحث في الأدعية والأذكار"
                autoComplete="off"
              />
            </label>

            <div className="chips" role="group" aria-label="أبواب الحصن">
              {chips.map((c) => (
                <button
                  type="button"
                  key={c.key}
                  className="chip"
                  aria-pressed={chip === c.key}
                  onClick={() => {
                    setChip(c.key);
                    setExpanded(false);
                  }}
                >
                  {c.label}
                  <i>{ar(c.count)}</i>
                </button>
              ))}
            </div>

            <div className="satin">
              <div className="fade" key={listAnimKey}>
                {shown.length > 0 ? (
                  shown.map(([cat, count]) => {
                    return (
                      <button
                        type="button"
                        key={cat}
                        className="row"
                        style={{ ["--c" as string]: hisnColor(cat) }}
                        onClick={() => onOpenHisnCategory(cat)}
                      >
                        <span className="ic sm">
                          <KindIcon name={hisnIcon(cat)} />
                        </span>
                        <span className="t">
                          <b>{cat}</b>
                          <small>{countLabel(count)}</small>
                        </span>
                        <ChevronLeft className="i chev" strokeWidth={1.9} />
                      </button>
                    );
                  })
                ) : (
                  <div className="empty">
                    <b>لا توجد نتائج</b>
                    <small>جرّب كلمة أخرى أو امسح البحث</small>
                  </div>
                )}
              </div>
            </div>

            {canCollapse && (
              <button
                type="button"
                className="cap more"
                aria-expanded={expanded}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded
                  ? "عرض أقل"
                  : `عرض باقي الأبواب (${ar(hisnCategories.length - HISN_PAGE_SIZE)})`}
                <ChevronDown className="i" strokeWidth={1.9} />
              </button>
            )}
          </section>
        </main>
      </div>
    </>
  );
});
