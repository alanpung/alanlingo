"use client";

export function WordStatusFlow() {
  return (
    <div className="w-full rounded-2xl border-2 border-lingo-border bg-lingo-card px-3 py-3 sm:px-5 sm:py-4 shadow-xs">
      <p className="text-[11px] sm:text-xs font-black text-lingo-text-light uppercase tracking-wider text-center mb-1">
        Status Flow
      </p>

      <div className="w-full flex justify-center">
        <svg
          viewBox="0 0 420 145"
          className="w-full max-w-[460px] h-auto select-none overflow-visible"
        >
          <defs>
            {/* Solid Blue Arrow */}
            <marker
              id="arrow-main"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#64748b" />
            </marker>

            {/* Green Dotted Arrow (Manual Master) */}
            <marker
              id="arrow-green"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
            </marker>

            {/* Rose Dotted Arrow (xMaster) */}
            <marker
              id="arrow-rose"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto"
            >
              <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#f43f5e" />
            </marker>
          </defs>

          {/* ── TOP DOTTED ARC: D / N / L -> M (Manual ✓ Master) ── */}
          <path
            d="M 55 46 C 95 6, 325 6, 362 44"
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="4 3"
            markerEnd="url(#arrow-green)"
          />
          {/* Small branch ticks from N and L into top arc */}
          <path
            d="M 158 46 Q 170 25, 195 19"
            fill="none"
            stroke="#10b981"
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />
          <path
            d="M 262 46 Q 275 26, 298 22"
            fill="none"
            stroke="#10b981"
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />
          <rect x="165" y="2" width="90" height="15" rx="7.5" fill="#d1fae5" />
          <text
            x="210"
            y="12.5"
            textAnchor="middle"
            fill="#047857"
            fontSize="9.5"
            fontWeight="800"
          >
            ✓ Tick Master
          </text>

          {/* ── MAIN HORIZONTAL ARROWS: D -> N -> L -> M ── */}
          {/* D -> N */}
          <line
            x1="80"
            y1="68"
            x2="127"
            y2="68"
            stroke="#64748b"
            strokeWidth="2"
            markerEnd="url(#arrow-main)"
          />
          {/* N -> L */}
          <line
            x1="184"
            y1="68"
            x2="231"
            y2="68"
            stroke="#64748b"
            strokeWidth="2"
            markerEnd="url(#arrow-main)"
          />
          {/* L -> M */}
          <line
            x1="288"
            y1="68"
            x2="335"
            y2="68"
            stroke="#64748b"
            strokeWidth="2"
            markerEnd="url(#arrow-main)"
          />

          {/* ── NODES: (D), (N), (L), (M) ── */}
          {/* Node 1: Dictionary (D) at x=54, y=68 */}
          <circle
            cx="54"
            cy="68"
            r="22"
            fill="#f1f5f9"
            stroke="#94a3b8"
            strokeWidth="2"
          />
          <text
            x="54"
            y="72"
            textAnchor="middle"
            fill="#334155"
            fontSize="13"
            fontWeight="900"
          >
            D
          </text>
          <text
            x="54"
            y="102"
            textAnchor="middle"
            fill="#64748b"
            fontSize="9.5"
            fontWeight="700"
          >
            Dictionary
          </text>

          {/* Node 2: New (N) at x=158, y=68 */}
          <circle
            cx="158"
            cy="68"
            r="22"
            fill="#3b82f6"
            stroke="#2563eb"
            strokeWidth="2"
          />
          <text
            x="158"
            y="72"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="13"
            fontWeight="900"
          >
            N
          </text>
          <text
            x="158"
            y="102"
            textAnchor="middle"
            fill="#2563eb"
            fontSize="9.5"
            fontWeight="700"
          >
            New
          </text>

          {/* Node 3: Learning (L) at x=262, y=68 */}
          <circle
            cx="262"
            cy="68"
            r="22"
            fill="#fbbf24"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          <text
            x="262"
            y="72"
            textAnchor="middle"
            fill="#451a03"
            fontSize="13"
            fontWeight="900"
          >
            L
          </text>
          <text
            x="262"
            y="102"
            textAnchor="middle"
            fill="#d97706"
            fontSize="9.5"
            fontWeight="700"
          >
            Learning
          </text>

          {/* Node 4: Mastered (M) at x=366, y=68 */}
          <circle
            cx="366"
            cy="68"
            r="22"
            fill="#10b981"
            stroke="#059669"
            strokeWidth="2"
          />
          <text
            x="366"
            y="72"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="13"
            fontWeight="900"
          >
            M
          </text>
          <text
            x="366"
            y="102"
            textAnchor="middle"
            fill="#059669"
            fontSize="9.5"
            fontWeight="700"
          >
            Mastered
          </text>

          {/* ── BOTTOM DOTTED ARC: L / M -> D / N (xMastered) ── */}
          <path
            d="M 366 108 C 320 142, 120 142, 62 108"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="2"
            strokeDasharray="4 3"
            markerEnd="url(#arrow-rose)"
          />
          {/* Branch from L into bottom arc */}
          <path
            d="M 262 108 Q 245 125, 220 130"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />
          {/* Branch pointing up to N */}
          <path
            d="M 190 130 Q 170 124, 158 109"
            fill="none"
            stroke="#f43f5e"
            strokeWidth="1.6"
            strokeDasharray="3 3"
            markerEnd="url(#arrow-rose)"
          />
          <rect x="165" y="125" width="90" height="15" rx="7.5" fill="#ffe4e6" />
          <text
            x="210"
            y="135.5"
            textAnchor="middle"
            fill="#be123c"
            fontSize="9.5"
            fontWeight="800"
          >
            ✕ Unmaster
          </text>
        </svg>
      </div>
    </div>
  );
}
