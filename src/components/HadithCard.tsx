import React, { useState } from "react";
import { BookOpenText, Sparkles, Lightbulb, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Assuming we have this exported from the data file now
import { HadithItem } from "../data/dailyHadithData";

interface HadithCardProps {
  todayHadith: HadithItem;
}

export const HadithCard = React.memo(({ todayHadith }: HadithCardProps) => {
  const [expandedSection, setExpandedSection] = useState<
    "explanation" | "benefits" | "action" | null
  >(null);

  const toggleSection = (section: "explanation" | "benefits" | "action") => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  return (
    <div className="w-full flex-shrink-0 snap-center px-2 flex flex-col justify-start pt-2">
      <div className="cut-crystal-panel rounded-[28px] p-5 hover:scale-[1.01] transition-all shadow-md flex flex-col max-h-[85vh] md:max-h-full overflow-hidden">
        {/* Header */}
        <div className="mb-3 flex items-center gap-3 shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-[var(--sk-accent-bright)] to-[var(--sk-accent)] text-[var(--sk-on-espresso)] shadow-sm border border-[var(--sk-accent-variant)]">
            <BookOpenText className="text-white h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[var(--sk-label)]">حديث اليوم</p>
            <p className="text-[10px] font-bold text-[var(--sk-label2)]">إضاءة يومية</p>
          </div>
        </div>

        {/* Hadith Text Area (Scrollable if needed) */}
        <div className="overflow-y-auto no-scrollbar pb-2">
          <p className="text-[14px] md:text-[15px] font-bold leading-relaxed text-[var(--sk-label)] font-serif">
            «{todayHadith.text}»
          </p>

          <div className="mt-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--sk-accent)]"></span>
              <p className="text-[10px] font-bold text-[var(--sk-accent)]">
                {todayHadith.source}
              </p>
            </div>
          </div>

          {/* Accordion Buttons */}
          <div className="mt-4 flex flex-col gap-2">
            {/* Explanation Button */}
            <div className="overflow-hidden rounded-xl border border-[#e6dccf]/60 dark:border-[var(--sk-sep)]/60 bg-white/40">
              <button
                onClick={() => toggleSection("explanation")}
                className="flex w-full items-center justify-between px-3 py-2.5 text-right transition-colors hover:bg-white/50"
              >
                <div className="flex items-center gap-2">
                  <BookOpenText
                    className="h-4 w-4 text-[var(--sk-accent)]"
                    strokeWidth={2.5}
                  />
                  <span className="text-[12px] font-bold text-[var(--sk-label)]">
                    شرح الحديث
                  </span>
                </div>
                <motion.div
                  animate={{
                    rotate: expandedSection === "explanation" ? 180 : 0,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-[var(--sk-label2)]" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {expandedSection === "explanation" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <div className="px-3 pb-3 pt-1 border-t border-[#e6dccf]/30 dark:border-[var(--sk-sep)]/30">
                      <p className="text-[12px] leading-relaxed text-[var(--sk-espresso3)]">
                        {todayHadith.explanation}
                      </p>
                      <p className="mt-2 text-[9px] font-bold text-[var(--sk-dot-hover)]">
                        {todayHadith.explanationSource}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Benefits Button */}
            <div className="overflow-hidden rounded-xl border border-[#e6dccf]/60 dark:border-[var(--sk-sep)]/60 bg-white/40">
              <button
                onClick={() => toggleSection("benefits")}
                className="flex w-full items-center justify-between px-3 py-2.5 text-right transition-colors hover:bg-white/50"
              >
                <div className="flex items-center gap-2">
                  <Sparkles
                    className="h-4 w-4 text-[var(--sk-accent)]"
                    strokeWidth={2.5}
                  />
                  <span className="text-[12px] font-bold text-[var(--sk-label)]">
                    فوائد مستنبطة
                  </span>
                </div>
                <motion.div
                  animate={{ rotate: expandedSection === "benefits" ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-[var(--sk-label2)]" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {expandedSection === "benefits" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <div className="px-3 pb-3 pt-1 border-t border-[#e6dccf]/30 dark:border-[var(--sk-sep)]/30">
                      <ul className="list-disc pr-4 space-y-1">
                        {todayHadith.benefits.map((benefit, index) => (
                          <li
                            key={index}
                            className="text-[12px] leading-relaxed text-[var(--sk-espresso3)]"
                          >
                            {benefit}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Practical Action Button */}
            <div className="overflow-hidden rounded-xl border border-[#e6dccf]/60 dark:border-[var(--sk-sep)]/60 bg-white/40">
              <button
                onClick={() => toggleSection("action")}
                className="flex w-full items-center justify-between px-3 py-2.5 text-right transition-colors hover:bg-white/50"
              >
                <div className="flex items-center gap-2">
                  <Lightbulb
                    className="h-4 w-4 text-[var(--sk-accent-bright)]"
                    strokeWidth={2.5}
                  />
                  <span className="text-[12px] font-bold text-[var(--sk-label)]">
                    كيف تعمل به اليوم؟
                  </span>
                </div>
                <motion.div
                  animate={{ rotate: expandedSection === "action" ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="h-4 w-4 text-[var(--sk-label2)]" />
                </motion.div>
              </button>
              <AnimatePresence initial={false}>
                {expandedSection === "action" && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    <div className="px-3 pb-3 pt-1 border-t border-[#e6dccf]/30 dark:border-[var(--sk-sep)]/30">
                      <ul className="space-y-2">
                        {todayHadith.practicalAction.map((action, index) => (
                          <li key={index} className="flex gap-2">
                            <span className="text-[var(--sk-accent-bright)] mt-0.5 shrink-0">
                              ✦
                            </span>
                            <span className="text-[12px] leading-relaxed text-[var(--sk-espresso3)]">
                              {action}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
