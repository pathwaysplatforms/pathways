interface MapCardProps {
  originCity?: string;
  destinationCity?: string;
  destinationCountry?: string;
  destinationFlag?: string;
  estimatedDate?: string;
}

/**
 * Always-present full-bleed SVG world map card.
 * Default route: Mumbai → Toronto.
 * No external map library — inline SVG only.
 */
export function MapCard({
  originCity = 'Mumbai',
  destinationCity = 'Toronto',
  destinationCountry = 'Canada',
  destinationFlag = '🇨🇦',
  estimatedDate = '2026',
}: MapCardProps) {
  return (
    <div className="flex-1 min-h-0 rounded-card overflow-hidden relative">
      {/* SVG fills the entire card — it IS the background */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="50 58 380 190"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        aria-hidden="true"
      >
        <defs>
          {/* Ocean radial gradient */}
          <radialGradient id="ocean" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#d0d0ee" />
            <stop offset="100%" stopColor="#a8a8d4" />
          </radialGradient>
          {/* Accent flight arc dash marker */}
          <marker id="arrowTip" markerWidth="0" markerHeight="0" refX="0" refY="0" />
        </defs>

        {/* Ocean background */}
        <rect x="0" y="0" width="500" height="300" fill="url(#ocean)" />

        {/* ── Graticule lines ───────────────────────────────────── */}
        <g stroke="rgba(255,255,255,0.25)" strokeWidth="0.4" fill="none">
          {/* Horizontals (latitudes) */}
          <line x1="0" y1="75"  x2="500" y2="75" />
          <line x1="0" y1="95"  x2="500" y2="95" />
          <line x1="0" y1="112" x2="500" y2="112" />
          <line x1="0" y1="129" x2="500" y2="129" />
          <line x1="0" y1="146" x2="500" y2="146" />
          <line x1="0" y1="163" x2="500" y2="163" />
          <line x1="0" y1="180" x2="500" y2="180" />
          <line x1="0" y1="200" x2="500" y2="200" />
          <line x1="0" y1="220" x2="500" y2="220" />
          {/* Verticals (longitudes) */}
          <line x1="80"  y1="0" x2="80"  y2="300" />
          <line x1="110" y1="0" x2="110" y2="300" />
          <line x1="140" y1="0" x2="140" y2="300" />
          <line x1="170" y1="0" x2="170" y2="300" />
          <line x1="200" y1="0" x2="200" y2="300" />
          <line x1="230" y1="0" x2="230" y2="300" />
          <line x1="260" y1="0" x2="260" y2="300" />
          <line x1="290" y1="0" x2="290" y2="300" />
          <line x1="320" y1="0" x2="320" y2="300" />
          <line x1="350" y1="0" x2="350" y2="300" />
          <line x1="380" y1="0" x2="380" y2="300" />
          {/* Equator (thicker) */}
          <line x1="0" y1="163" x2="500" y2="163" stroke="rgba(255,255,255,0.40)" strokeWidth="0.7" />
          {/* Ellipses (tropics / polar circles) */}
          <ellipse cx="230" cy="163" rx="185" ry="24" stroke="rgba(255,255,255,0.20)" strokeWidth="0.5" />
          <ellipse cx="230" cy="163" rx="185" ry="55" stroke="rgba(255,255,255,0.15)" strokeWidth="0.4" />
        </g>

        {/* ── Continents ────────────────────────────────────────── */}
        <g fill="rgba(255,255,255,0.52)" stroke="rgba(255,255,255,0.30)" strokeWidth="0.5">

          {/* North America */}
          <path d="
            M 62,100 C 63,94 65,88 68,84
            L 74,76 L 84,68 L 100,65 L 110,68
            L 120,66 L 132,73 L 148,83
            L 166,104 L 158,108 L 152,109
            L 145,108 L 142,114 L 136,117
            L 132,125 L 127,137 L 125,143
            L 131,155 L 121,161 L 109,162
            L 98,155 L 88,148 L 82,140
            L 75,127 L 68,118 L 64,109
            Z
          " />

          {/* Greenland */}
          <path d="
            M 155,71 L 166,66 L 176,64
            L 184,67 L 180,76 L 172,83
            L 163,85 L 157,80 Z
          " />

          {/* South America (northern portion) */}
          <path d="
            M 128,158 C 140,162 156,165 168,162
            L 181,160 L 185,167 L 176,176
            L 168,186 L 163,196 L 156,205
            L 149,218 L 147,234 L 143,240
            L 136,238 L 132,224 L 131,210
            L 133,193 L 131,175 L 128,163 Z
          " />

          {/* Europe */}
          <path d="
            M 242,79 C 246,74 255,72 264,71
            L 276,70 L 282,73 L 278,80
            L 272,84 L 274,92 L 267,97
            L 256,98 L 249,93 L 244,86 Z
          " />

          {/* UK */}
          <path d="
            M 238,80 C 235,76 233,80 234,88
            L 237,91 L 241,89 L 242,83 Z
          " />

          {/* Scandinavia */}
          <path d="
            M 265,65 L 270,63 L 274,66
            L 272,74 L 268,79 L 264,77
            L 262,70 Z
          " />

          {/* Africa */}
          <path d="
            M 248,104 C 255,100 270,100 284,103
            L 298,109 L 308,116 L 313,128
            L 315,142 L 313,158 L 310,172
            L 303,188 L 293,202 L 279,216
            L 270,224 L 262,220 L 257,208
            L 250,194 L 244,178 L 242,162
            L 242,147 L 245,132 L 248,118 Z
          " />

          {/* Horn of Africa */}
          <path d="
            M 310,172 L 318,168 L 322,174
            L 318,180 L 310,180 Z
          " />

          {/* Arabian Peninsula */}
          <path d="
            M 306,130 C 318,126 334,129 344,142
            L 347,156 L 341,159 L 326,156
            L 312,148 L 308,138 Z
          " />

          {/* Indian Subcontinent */}
          <path d="
            M 346,127 C 358,124 372,127 382,138
            L 386,150 L 382,160 L 375,168
            L 366,168 L 358,162 L 352,152
            L 347,140 Z
          " />

          {/* Southeast Asia (partial) */}
          <path d="
            M 389,147 C 396,144 400,152 399,163
            L 396,170 L 391,167 L 389,158 Z
          " />

          {/* Eastern Europe / Turkey */}
          <path d="
            M 282,90 C 292,88 305,90 312,97
            L 314,107 L 307,110 L 296,108
            L 284,102 L 280,95 Z
          " />
        </g>

        {/* ── Flight arc: Mumbai → Toronto ─────────────────────── */}
        {/* Cubic bezier control point Q280,48 */}
        <path
          d="M 375,152 Q 280,48 128,112"
          fill="none"
          stroke="#0FA896"
          strokeWidth="2"
          strokeDasharray="5 4"
          opacity="0.9"
        />

        {/* ── Mumbai origin marker ──────────────────────────────── */}
        <circle cx="375" cy="152" r="10" fill="#0FA896" opacity="0.30" />
        <circle cx="375" cy="152" r="5"  fill="#0FA896" />
        {/* Mumbai city label — anchored left of pin to avoid right-edge clipping */}
        <text
          x="368"
          y="148"
          fontSize="7"
          textAnchor="end"
          fill="rgba(0,0,80,0.65)"
          fontFamily="Urbanist, sans-serif"
          fontWeight="600"
        >
          Mumbai
        </text>

        {/* ── Toronto destination pin ───────────────────────────── */}
        <circle cx="128" cy="112" r="12" fill="#0FA896" opacity="0.25" />
        <circle cx="128" cy="112" r="6"  fill="#0FA896" />
        {/* Pin stem */}
        <line x1="128" y1="118" x2="128" y2="134" stroke="#0FA896" strokeWidth="1.5" opacity="0.8" />
        {/* Downward triangle */}
        <polygon points="123,134 133,134 128,140" fill="#0FA896" opacity="0.75" />
        {/* Toronto city label */}
        <text
          x="100"
          y="110"
          fontSize="7"
          fill="rgba(0,0,80,0.65)"
          fontFamily="Urbanist, sans-serif"
          fontWeight="600"
        >
          Toronto
        </text>
      </svg>

      {/* ── Overlay labels ─────────────────────────────────────── */}

      {/* Bottom-left: route label */}
      <div className="absolute bottom-[14px] left-[16px] pointer-events-none">
        <p
          className="text-text-primary leading-tight"
          style={{ fontSize: '11px', fontWeight: 800 }}
        >
          {originCity} → {destinationCity}
        </p>
        <p className="text-text-tertiary" style={{ fontSize: '9px', fontWeight: 400 }}>
          Immigration destination
        </p>
      </div>

      {/* Bottom-right: frosted glass destination pill */}
      <div
        className="absolute bottom-[14px] right-[16px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-light pointer-events-none"
        style={{
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ fontSize: '13px' }}>{destinationFlag}</span>
        <div>
          <p className="text-text-primary leading-none" style={{ fontSize: '9px', fontWeight: 600 }}>
            {destinationCountry}
          </p>
          <p className="text-text-tertiary leading-none mt-0.5" style={{ fontSize: '8px' }}>
            Est. {estimatedDate}
          </p>
        </div>
      </div>
    </div>
  );
}
