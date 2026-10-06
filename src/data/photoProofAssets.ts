/**
 * Curated Accessibility Photo Proof Assets
 * Contains realistic accessibility verification photos as high-fidelity SVG data URIs.
 * These load instantly offline without external network dependencies.
 */

export interface PhotoProofAsset {
  id: string;
  title: string;
  category: 'ramp' | 'lift' | 'barrier' | 'entrance';
  dataUri: string;
  capturedDate: string;
  auditor: string;
  aiTag: string;
  aiConfidence: number;
}

// 1. Accessible Wheelchair Ramp (Clean Incline + Stainless Handrails)
const RAMP_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="concrete" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
    <linearGradient id="rail" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
  </defs>
  <!-- Background building wall -->
  <rect width="600" height="400" fill="url(#sky)"/>
  <rect x="0" y="0" width="600" height="240" fill="#1e293b" opacity="0.9"/>
  <!-- Windows / architectural lines -->
  <line x1="0" y1="120" x2="600" y2="120" stroke="#334155" stroke-width="2"/>
  <line x1="200" y1="0" x2="200" y2="240" stroke="#334155" stroke-width="2"/>
  <line x1="400" y1="0" x2="400" y2="240" stroke="#334155" stroke-width="2"/>
  
  <!-- Ramp Structure (Incline 3.5%) -->
  <polygon points="40,360 560,220 560,400 40,400" fill="url(#concrete)"/>
  <!-- Tactile yellow warning strip at bottom & top -->
  <polygon points="40,360 120,340 120,370 40,390" fill="#eab308"/>
  <polygon points="480,240 560,220 560,250 480,270" fill="#eab308"/>
  
  <!-- Handrails (Dual stainless steel rails) -->
  <!-- Top rail -->
  <line x1="40" y1="280" x2="560" y2="140" stroke="url(#rail)" stroke-width="8" stroke-linecap="round"/>
  <!-- Mid rail -->
  <line x1="40" y1="310" x2="560" y2="170" stroke="url(#rail)" stroke-width="6" stroke-linecap="round"/>
  <!-- Support posts -->
  <line x1="80" y1="350" x2="80" y2="270" stroke="url(#rail)" stroke-width="6"/>
  <line x1="200" y1="320" x2="200" y2="240" stroke="url(#rail)" stroke-width="6"/>
  <line x1="320" y1="290" x2="320" y2="210" stroke="url(#rail)" stroke-width="6"/>
  <line x1="440" y1="260" x2="440" y2="180" stroke="url(#rail)" stroke-width="6"/>
  <line x1="540" y1="230" x2="540" y2="150" stroke="url(#rail)" stroke-width="6"/>
  
  <!-- Stamp Overlay Badge -->
  <rect x="20" y="20" width="220" height="42" rx="8" fill="#0f172a" fill-opacity="0.85" stroke="#10b981" stroke-width="1.5"/>
  <text x="35" y="46" fill="#10b981" font-family="system-ui, sans-serif" font-size="14" font-weight="bold">PHOTO PROOF: RAMP VERIFIED</text>
  <rect x="20" y="68" width="180" height="24" rx="6" fill="#10b981" fill-opacity="0.2"/>
  <text x="28" y="84" fill="#34d399" font-family="system-ui, sans-serif" font-size="11" font-weight="600">Slope: 3.5% (WCAG AAA)</text>
</svg>
`)}`;

// 2. Accessible Elevator Lobby (Wide Doors + Braille Panel)
const ELEVATOR_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="doors" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#94a3b8"/>
      <stop offset="50%" stop-color="#cbd5e1"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
  </defs>
  <!-- Lobby Background -->
  <rect width="600" height="400" fill="url(#wall)"/>
  <rect x="0" y="340" width="600" height="60" fill="#0f172a"/>
  
  <!-- Elevator Frame -->
  <rect x="150" y="60" width="300" height="280" fill="#0f172a" stroke="#64748b" stroke-width="6"/>
  <!-- Elevator Sliding Doors -->
  <rect x="160" y="70" width="135" height="270" fill="url(#doors)"/>
  <rect x="305" y="70" width="135" height="270" fill="url(#doors)"/>
  <line x1="300" y1="70" x2="300" y2="340" stroke="#475569" stroke-width="3"/>
  
  <!-- Floor Indicator Screen above doors -->
  <rect x="250" y="20" width="100" height="30" rx="4" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/>
  <text x="300" y="42" text-anchor="middle" fill="#38bdf8" font-family="monospace" font-size="18" font-weight="bold">▲ 3</text>
  
  <!-- Low Accessible Call Station (Braille & Button at 100cm height) -->
  <rect x="475" y="190" width="50" height="90" rx="8" fill="#1e293b" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="500" cy="215" r="10" fill="#38bdf8"/>
  <circle cx="500" cy="250" r="10" fill="#e2e8f0"/>
  <!-- Braille tactile dots representation -->
  <circle cx="488" cy="272" r="2" fill="#e2e8f0"/>
  <circle cx="495" cy="272" r="2" fill="#e2e8f0"/>
  <circle cx="502" cy="272" r="2" fill="#e2e8f0"/>
  
  <!-- Stamp Overlay Badge -->
  <rect x="20" y="20" width="210" height="42" rx="8" fill="#0f172a" fill-opacity="0.85" stroke="#38bdf8" stroke-width="1.5"/>
  <text x="35" y="46" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="14" font-weight="bold">PHOTO PROOF: LIFT HUB</text>
  <rect x="20" y="68" width="200" height="24" rx="6" fill="#38bdf8" fill-opacity="0.2"/>
  <text x="28" y="84" fill="#7dd3fc" font-family="system-ui, sans-serif" font-size="11" font-weight="600">Braille Height: 100cm • Wide 110cm</text>
</svg>
`)}`;

// 3. Elevator Outage Notice / Maintenance Barrier
const ELEVATOR_OUTAGE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
  <defs>
    <linearGradient id="doorsDark" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="50%" stop-color="#64748b"/>
      <stop offset="100%" stop-color="#475569"/>
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="#0f172a"/>
  <!-- Closed Elevator Doors -->
  <rect x="150" y="60" width="300" height="280" fill="#1e293b" stroke="#334155" stroke-width="6"/>
  <rect x="160" y="70" width="280" height="270" fill="url(#doorsDark)"/>
  <line x1="300" y1="70" x2="300" y2="340" stroke="#1e293b" stroke-width="3"/>
  
  <!-- Yellow Hazard Tape across elevator -->
  <polygon points="120,130 480,240 480,280 120,170" fill="#eab308" opacity="0.95"/>
  <text x="300" y="210" text-anchor="middle" fill="#0f172a" font-family="sans-serif" font-size="18" font-weight="900" transform="rotate(17 300 205)">OUT OF SERVICE • UNDER REPAIR</text>
  
  <!-- Out of order paper sign pinned on door -->
  <rect x="230" y="100" width="140" height="110" rx="4" fill="#ffffff" stroke="#ef4444" stroke-width="3"/>
  <text x="300" y="130" text-anchor="middle" fill="#ef4444" font-family="sans-serif" font-size="16" font-weight="bold">⚠️ NOTICE</text>
  <text x="300" y="152" text-anchor="middle" fill="#1e293b" font-family="sans-serif" font-size="11" font-weight="bold">ELEVATOR B OUTAGE</text>
  <text x="300" y="170" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="10">Emergency Maintenance</text>
  <text x="300" y="190" text-anchor="middle" fill="#2563eb" font-family="sans-serif" font-size="10" font-weight="bold">Use South Ramp C</text>
  
  <!-- Stamp Overlay Badge -->
  <rect x="20" y="20" width="230" height="42" rx="8" fill="#0f172a" fill-opacity="0.85" stroke="#ef4444" stroke-width="1.5"/>
  <text x="35" y="46" fill="#ef4444" font-family="system-ui, sans-serif" font-size="14" font-weight="bold">PHOTO PROOF: BARRIER</text>
  <rect x="20" y="68" width="190" height="24" rx="6" fill="#ef4444" fill-opacity="0.2"/>
  <text x="28" y="84" fill="#fca5a5" font-family="system-ui, sans-serif" font-size="11" font-weight="600">Elevator Outage Confirmed</text>
</svg>
`)}`;

// 4. Waterlogged Curb Ramp Obstacle
const WATERLOGGED_RAMP_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
  <defs>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0284c7" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#0369a1" stop-opacity="0.95"/>
    </linearGradient>
  </defs>
  <rect width="600" height="400" fill="#1e293b"/>
  <!-- Asphalt road and curb -->
  <rect x="0" y="200" width="600" height="200" fill="#334155"/>
  <rect x="0" y="160" width="600" height="40" fill="#64748b"/>
  
  <!-- Curb cut ramp dip -->
  <polygon points="150,160 450,160 400,240 200,240" fill="#475569"/>
  <!-- Tactile paving warning -->
  <polygon points="180,170 420,170 400,195 200,195" fill="#eab308"/>
  
  <!-- Large puddle flooding curb cut -->
  <ellipse cx="300" cy="250" rx="180" ry="60" fill="url(#water)"/>
  <ellipse cx="300" cy="245" rx="140" ry="40" fill="#38bdf8" fill-opacity="0.4"/>
  
  <!-- Depth marker indicating 15cm puddle -->
  <line x1="300" y1="210" x2="300" y2="270" stroke="#f59e0b" stroke-width="4"/>
  <text x="315" y="245" fill="#f59e0b" font-family="sans-serif" font-size="14" font-weight="bold">15 cm Water</text>
  
  <!-- Stamp Overlay Badge -->
  <rect x="20" y="20" width="240" height="42" rx="8" fill="#0f172a" fill-opacity="0.85" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="35" y="46" fill="#f59e0b" font-family="system-ui, sans-serif" font-size="14" font-weight="bold">PHOTO PROOF: WATERLOGGING</text>
  <rect x="20" y="68" width="200" height="24" rx="6" fill="#f59e0b" fill-opacity="0.2"/>
  <text x="28" y="84" fill="#fde68a" font-family="system-ui, sans-serif" font-size="11" font-weight="600">Ramp submerged • High Hazard</text>
</svg>
`)}`;

// 5. Construction Scaffolding Obstruction
const SCAFFOLD_OBSTRUCTION_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">
  <rect width="600" height="400" fill="#0f172a"/>
  <!-- Sidewalk -->
  <rect x="0" y="220" width="600" height="180" fill="#475569"/>
  <!-- Construction Scaffolding Pipes -->
  <line x1="120" y1="40" x2="120" y2="340" stroke="#94a3b8" stroke-width="10"/>
  <line x1="280" y1="40" x2="280" y2="340" stroke="#94a3b8" stroke-width="10"/>
  <line x1="440" y1="40" x2="440" y2="340" stroke="#94a3b8" stroke-width="10"/>
  <line x1="80" y1="120" x2="520" y2="120" stroke="#94a3b8" stroke-width="8"/>
  <line x1="80" y1="200" x2="520" y2="200" stroke="#94a3b8" stroke-width="8"/>
  <!-- Cross braces -->
  <line x1="120" y1="120" x2="280" y2="200" stroke="#64748b" stroke-width="6"/>
  <line x1="280" y1="120" x2="120" y2="200" stroke="#64748b" stroke-width="6"/>
  
  <!-- Clearance arrow indicating < 75cm width -->
  <line x1="280" y1="290" x2="440" y2="290" stroke="#ef4444" stroke-width="4" marker-start="url(#dot)" marker-end="url(#dot)"/>
  <rect x="310" y="275" width="100" height="26" rx="4" fill="#ef4444"/>
  <text x="360" y="293" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold">75cm &lt; 90cm</text>
  
  <!-- Stamp Overlay Badge -->
  <rect x="20" y="20" width="240" height="42" rx="8" fill="#0f172a" fill-opacity="0.85" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="35" y="46" fill="#f59e0b" font-family="system-ui, sans-serif" font-size="14" font-weight="bold">PHOTO PROOF: SCAFFOLDING</text>
  <rect x="20" y="68" width="220" height="24" rx="6" fill="#f59e0b" fill-opacity="0.2"/>
  <text x="28" y="84" fill="#fde68a" font-family="system-ui, sans-serif" font-size="11" font-weight="600">Sidewalk Narrowed Below 90cm</text>
</svg>
`)}`;

export const PHOTO_PROOFS = {
  rampClean: RAMP_SVG,
  elevatorLobby: ELEVATOR_SVG,
  elevatorOutage: ELEVATOR_OUTAGE_SVG,
  waterloggedRamp: WATERLOGGED_RAMP_SVG,
  scaffoldObstruction: SCAFFOLD_OBSTRUCTION_SVG,
};

export const DEMO_PHOTO_EVIDENCE_PRESETS = [
  {
    id: 'preset-elevator',
    title: 'Out of Order Elevator Notice',
    category: 'Elevator Outage',
    dataUri: PHOTO_PROOFS.elevatorOutage,
    aiTag: 'Elevator Outage Detected',
    aiConfidence: 98,
    aiDetails: 'Door maintenance tape and out-of-service signage confirmed. Directs to South Ramp C.',
  },
  {
    id: 'preset-waterlog',
    title: 'Waterlogged Curb Cut Ramp',
    category: 'Flooding/Waterlogging',
    dataUri: PHOTO_PROOFS.waterloggedRamp,
    aiTag: 'Ramp Submerged Obstacle',
    aiConfidence: 96,
    aiDetails: '15cm puddle depth obscures curb tactile indicators. Impassable for manual wheelchairs.',
  },
  {
    id: 'preset-scaffold',
    title: 'Construction Scaffold Narrowing',
    category: 'Construction Obstruction',
    dataUri: PHOTO_PROOFS.scaffoldObstruction,
    aiTag: 'Clearance Width < 90cm',
    aiConfidence: 94,
    aiDetails: 'Scaffolding posts reduce passable width to 75cm. Wheelchair turning radius restricted.',
  },
];
