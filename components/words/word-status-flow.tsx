"use client";

import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  RotateCcw,
  Check,
  ArrowRight,
  HelpCircle,
  GraduationCap,
  Layers,
} from "lucide-react";

export function WordStatusFlow() {
  return (
    <div className="w-full rounded-2xl border-2 border-lingo-border bg-lingo-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-lingo-border pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-lingo-blue/10 flex items-center justify-center text-lingo-blue shrink-0">
            <Layers className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-lingo-text">
              Word Status Lifecycle & Flow
            </h4>
            <p className="text-[10px] sm:text-xs text-lingo-text-light">
              How words progress from Dictionary to Mastered
            </p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1 rounded-lg bg-lingo-bg px-2 py-1 text-[10px] font-bold text-lingo-text-light border border-lingo-border">
          <Sparkles className="w-3 h-3 text-amber-500" /> Interactive SRS Lifecycle
        </span>
      </div>

      {/* ── Process Flow Chart Diagram (SVG + Nodes) ── */}
      <div className="relative w-full overflow-x-auto py-2">
        <div className="min-w-[620px] max-w-3xl mx-auto space-y-3">
          {/* Main Nodes Row */}
          <div className="grid grid-cols-4 gap-3 relative z-10">
            {/* Step 1: Dictionary (D) */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shadow-xs relative">
              <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center font-black text-xs shadow-xs border border-slate-300 dark:border-slate-700 mb-1.5">
                (D)
              </div>
              <span className="font-black text-xs text-lingo-text">Dictionary</span>
              <span className="text-[10px] text-lingo-text-light mt-0.5 leading-tight">
                Unassigned words in full vocabulary
              </span>
            </div>

            {/* Step 2: New (N) */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl border-2 border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 shadow-xs relative">
              <div className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center font-black text-xs shadow-xs mb-1.5">
                (N)
              </div>
              <span className="font-black text-xs text-blue-700 dark:text-blue-400">New</span>
              <span className="text-[10px] text-lingo-text-light mt-0.5 leading-tight">
                In enrolled Library courses / units
              </span>
            </div>

            {/* Step 3: Learning (L) */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl border-2 border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 shadow-xs relative">
              <div className="w-9 h-9 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center font-black text-xs shadow-xs mb-1.5">
                (L)
              </div>
              <span className="font-black text-xs text-amber-700 dark:text-amber-400">Learning</span>
              <span className="text-[10px] text-lingo-text-light mt-0.5 leading-tight">
                Encountered in lessons / flashcards
              </span>
            </div>

            {/* Step 4: Mastered (M) */}
            <div className="flex flex-col items-center text-center p-3 rounded-xl border-2 border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 shadow-xs relative">
              <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-xs shadow-xs mb-1.5">
                (M)
              </div>
              <span className="font-black text-xs text-emerald-700 dark:text-emerald-400">Mastered</span>
              <span className="text-[10px] text-lingo-text-light mt-0.5 leading-tight">
                ≥3 correct reviews or marked mastered
              </span>
            </div>
          </div>

          {/* Flow Connectors Diagram (SVG) */}
          <div className="w-full bg-lingo-bg/60 rounded-xl p-3 border border-lingo-border">
            <svg
              viewBox="0 0 600 130"
              className="w-full h-auto text-xs font-bold select-none"
              style={{ overflow: "visible" }}
            >
              <defs>
                {/* Standard Solid Arrow Marker */}
                <marker
                  id="arrow-solid"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#3b82f6" />
                </marker>

                {/* Direct Manual Mastery Emerald Arrow Marker */}
                <marker
                  id="arrow-master"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                </marker>

                {/* Unmaster / Reset Rose Arrow Marker */}
                <marker
                  id="arrow-unmaster"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
                </marker>
              </defs>

              {/* ── 1. PRIMARY STUDY FLOW (Solid Blue Line D -> N -> L -> M) ── */}
              {/* D -> N */}
              <path
                d="M 85 45 L 140 45"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                markerEnd="url(#arrow-solid)"
              />
              <text x="112" y="38" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">
                Add to Library
              </text>

              {/* N -> L */}
              <path
                d="M 235 45 L 290 45"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                markerEnd="url(#arrow-solid)"
              />
              <text x="262" y="38" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">
                Start Study
              </text>

              {/* L -> M */}
              <path
                d="M 385 45 L 440 45"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                markerEnd="url(#arrow-solid)"
              />
              <text x="412" y="38" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold">
                ≥3 Correct
              </text>

              {/* ── 2. SPECIAL FLOW: MANUAL DIRECT MASTERY (Emerald Dotted Curve D/N/L -> M) ── */}
              <path
                d="M 75 32 C 120 2, 420 2, 505 32"
                fill="none"
                stroke="#10b981"
                strokeWidth="2.2"
                strokeDasharray="4 3"
                markerEnd="url(#arrow-master)"
              />
              <rect x="225" y="0" width="150" height="15" rx="4" fill="#d1fae5" />
              <text x="300" y="11" textAnchor="middle" fill="#065f46" fontSize="9" fontWeight="900">
                ✓ Manual Mastery (from D, N, or L)
              </text>

              {/* ── 3. SPECIAL FLOW: UNMASTER / RESET (Rose Dotted Curve L/M -> D/N) ── */}
              <path
                d="M 480 58 C 420 115, 180 115, 170 58"
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.2"
                strokeDasharray="4 3"
                markerEnd="url(#arrow-unmaster)"
              />
              <rect x="215" y="102" width="170" height="16" rx="4" fill="#ffe4e6" />
              <text x="300" y="114" textAnchor="middle" fill="#9f1239" fontSize="9" fontWeight="900">
                ↺ xMaster / Reset (Returns to N or D)
              </text>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Flow Legend & Rule Descriptions ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
        {/* Solid Blue Flow Rule */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-xs">
          <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
            ➔
          </div>
          <div>
            <p className="font-bold text-blue-900 dark:text-blue-300">Standard Learning Path</p>
            <p className="text-[11px] text-lingo-text-light mt-0.5 leading-snug">
              Add courses to Library ➔ Words become <strong>(N)</strong> ➔ Practice lessons to enter <strong>(L)</strong> ➔ Reach 3+ correct answers to reach <strong>(M)</strong>.
            </p>
          </div>
        </div>

        {/* Emerald Dotted Flow Rule */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
          <div>
            <p className="font-bold text-emerald-900 dark:text-emerald-300">Manual Direct Mastery</p>
            <p className="text-[11px] text-lingo-text-light mt-0.5 leading-snug">
              Click the <strong>✓ Tick Button</strong> on any word card in the Word Explorer to fast-track directly from <strong>(D)</strong>, <strong>(N)</strong>, or <strong>(L)</strong> into <strong>(M)</strong>.
            </p>
          </div>
        </div>

        {/* Rose Dotted Flow Rule */}
        <div className="flex items-start gap-2 p-2.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-xs">
          <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
            <RotateCcw className="w-3 h-3 stroke-[2.5]" />
          </div>
          <div>
            <p className="font-bold text-rose-900 dark:text-rose-300">Unmaster / Reset (xMaster)</p>
            <p className="text-[11px] text-lingo-text-light mt-0.5 leading-snug">
              Unmastering a word restores it to <strong>(N)</strong> if it is in your Library courses, or clears it back to <strong>(D)</strong> if it is an unassigned dictionary word.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
