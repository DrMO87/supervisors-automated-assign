'use client';

import React from 'react';

// ============================================================================
// 1. DYNAMIC INTERACTIVE CLASSROOM BLUEPRINT SVG
// ============================================================================
interface ClassroomBlueprintSvgProps {
  studentCount: number;
  headSupervisors: number;
  invigilators: number;
  tierName?: string;
}

export function ClassroomBlueprintSvg({
  studentCount,
  headSupervisors,
  invigilators,
  tierName,
}: ClassroomBlueprintSvgProps) {
  // Generate a realistic grid of exam desks (5 columns x rows based on student count, up to 30 visible desks)
  const visibleDesks = Math.min(30, Math.max(6, Math.round(studentCount / 2)));
  const cols = 6;
  const rows = Math.ceil(visibleDesks / cols);

  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#00142e] via-[#002147] to-[#011633] p-4 text-white shadow-2xl border border-blue-500/20">
      {/* Background blueprint grid lines */}
      <svg className="w-full h-72 sm:h-80 select-none" viewBox="0 0 680 340" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Blueprint Grid Pattern */}
          <pattern id="blueprint-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#2563eb" strokeWidth="0.5" strokeOpacity="0.15" />
          </pattern>
          <linearGradient id="podiumGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="goldGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD31A" />
            <stop offset="100%" stopColor="#FFB81C" />
          </linearGradient>
          <linearGradient id="deskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          <linearGradient id="deskActive" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Blueprint background grid */}
        <rect width="680" height="340" fill="url(#blueprint-grid)" rx="16" />

        {/* Room boundary walls */}
        <rect x="25" y="20" width="630" height="300" rx="12" stroke="#3b82f6" strokeWidth="2" strokeOpacity="0.4" strokeDasharray="6 3" />
        <rect x="30" y="25" width="620" height="290" rx="10" stroke="#1d4ed8" strokeWidth="1" strokeOpacity="0.25" />

        {/* Room Header & Compass */}
        <text x="45" y="45" fill="#93c5fd" fontSize="11" fontWeight="700" letterSpacing="1.2">
          HUE EXAM HALL BLUEPRINT • CAPACITY SIMULATOR
        </text>
        <text x="635" y="45" fill="#facc15" fontSize="10" fontWeight="600" textAnchor="end">
          {studentCount} STUDENTS REGISTERED
        </text>

        {/* ── PODIUM & HEAD SUPERVISOR ── */}
        <g transform="translate(180, 55)">
          {/* Main Stage / Podium */}
          <rect x="0" y="0" width="320" height="42" rx="8" fill="url(#podiumGrad)" stroke="#3b82f6" strokeWidth="1.5" />
          {/* Lectern */}
          <rect x="135" y="8" width="50" height="26" rx="4" fill="#0f172a" stroke="#60a5fa" strokeWidth="1" />
          <line x1="145" y1="14" x2="175" y2="14" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="150" y1="20" x2="170" y2="20" stroke="#93c5fd" strokeWidth="1" strokeLinecap="round" />

          {/* Head Supervisor Avatar */}
          <circle cx="160" cy="-6" r="12" fill="url(#goldGlow)" filter="url(#neonGlow)" />
          {/* Head Icon / Shield */}
          <path d="M156 -8 L160 -12 L164 -8 L164 -3 C164 1 160 3 160 3 C160 3 156 1 156 -3 Z" fill="#002147" />

          <text x="160" y="32" fill="#e2e8f0" fontSize="10" fontWeight="700" textAnchor="middle" letterSpacing="0.8">
            HEAD EXAM SUPERVISOR ({headSupervisors})
          </text>
          <text x="160" y="40" fill="#94a3b8" fontSize="8" textAnchor="middle">
            (Teaching Assistant / Senior Faculty)
          </text>
        </g>

        {/* ── AISLE LANES & PATROLLING INVIGILATORS ── */}
        {/* Left Aisle */}
        <line x1="100" y1="115" x2="100" y2="295" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />
        {/* Right Aisle */}
        <line x1="580" y1="115" x2="580" y2="295" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />
        {/* Center Aisle */}
        <line x1="340" y1="115" x2="340" y2="295" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" strokeOpacity="0.4" />

        {/* Dynamic Invigilator Patrollers */}
        {Array.from({ length: invigilators }).map((_, i) => {
          // Distribute along left, right, and center aisles
          const positions = [
            { x: 100, y: 190, label: 'Invigilator 1' },
            { x: 580, y: 190, label: 'Invigilator 2' },
            { x: 340, y: 240, label: 'Invigilator 3' },
            { x: 340, y: 140, label: 'Invigilator 4' },
          ];
          const pos = positions[i % positions.length];

          return (
            <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
              {/* Surveillance cone / sightline */}
              <path
                d="M 0 0 L -25 35 L 25 35 Z"
                fill="#f59e0b"
                fillOpacity="0.12"
                stroke="#f59e0b"
                strokeWidth="0.5"
                strokeOpacity="0.3"
              />
              {/* Badge halo */}
              <circle cx="0" cy="0" r="14" fill="#78350f" stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="10" fill="#f59e0b" filter="url(#neonGlow)" />
              {/* Person Icon */}
              <circle cx="0" cy="-3" r="3" fill="#451a03" />
              <path d="M -5 5 C -5 1, 5 1, 5 5 Z" fill="#451a03" />
              {/* Label Tag */}
              <rect x="-34" y="16" width="68" height="15" rx="3" fill="#0f172a" stroke="#f59e0b" strokeWidth="0.8" />
              <text x="0" y="27" fill="#fde68a" fontSize="8" fontWeight="700" textAnchor="middle">
                INVIGILATOR #{i + 1}
              </text>
            </g>
          );
        })}

        {/* ── STUDENT DESKS MATRIX ── */}
        <g transform="translate(130, 120)">
          {Array.from({ length: visibleDesks }).map((_, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            // leave gap in middle for center aisle
            const xOffset = col >= 3 ? 35 : 0;
            const x = col * 65 + xOffset;
            const y = row * 38;

            return (
              <g key={idx} transform={`translate(${x}, ${y})`}>
                {/* Desk Surface */}
                <rect
                  x="0"
                  y="0"
                  width="44"
                  height="22"
                  rx="4"
                  fill="url(#deskGrad)"
                  stroke="#475569"
                  strokeWidth="1"
                />
                {/* Exam Booklet / Sheet on desk */}
                <rect x="6" y="4" width="14" height="14" rx="1.5" fill="#f8fafc" fillOpacity="0.85" />
                <line x1="9" y1="8" x2="17" y2="8" stroke="#64748b" strokeWidth="1" />
                <line x1="9" y1="12" x2="15" y2="12" stroke="#64748b" strokeWidth="1" />

                {/* Desk Number Badge */}
                <circle cx="34" cy="11" r="5" fill="#0f172a" stroke="#3b82f6" strokeWidth="0.8" />
                <text x="34" y="13.5" fill="#93c5fd" fontSize="6" fontWeight="700" textAnchor="middle">
                  {idx + 1}
                </text>

                {/* Chair */}
                <rect x="12" y="24" width="20" height="5" rx="2" fill="#1e293b" stroke="#334155" strokeWidth="0.8" />
              </g>
            );
          })}
        </g>

        {/* ── RATIO TIER STATUS FOOTER PILL ── */}
        <g transform="translate(190, 305)">
          <rect x="0" y="0" width="300" height="24" rx="12" fill="#0f172a" stroke="#3b82f6" strokeWidth="1" />
          <circle cx="14" cy="12" r="4" fill="#10b981" />
          <text x="26" y="16" fill="#e2e8f0" fontSize="9" fontWeight="600">
            Current Tier Rule: {headSupervisors} Head Supervisor + {invigilators} Invigilators
          </text>
        </g>
      </svg>
    </div>
  );
}

// ============================================================================
// 2. AVAILABILITY POLICY SVGs
// ============================================================================

/** SVG 1: Strict Off-Days */
export function StrictOffDaysSvg({ active = false }: { active?: boolean }) {
  return (
    <svg className="w-full h-28 select-none" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="padlockGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Background card */}
      <rect width="240" height="110" rx="10" fill={active ? '#eff6ff' : '#f8fafc'} stroke={active ? '#2563eb' : '#cbd5e1'} strokeWidth={active ? 1.5 : 1} />

      {/* Week Calendar strip (Sun to Thu) */}
      <g transform="translate(15, 20)">
        {/* Working Day: Sun */}
        <rect x="0" y="0" width="34" height="42" rx="6" fill="#ffffff" stroke="#93c5fd" strokeWidth="1" />
        <text x="17" y="14" fill="#1e3a8a" fontSize="8" fontWeight="700" textAnchor="middle">SUN</text>
        <circle cx="17" cy="27" r="7" fill="#dbeafe" />
        <path d="M14 27 L16 29 L20 24" stroke="#1d4ed8" strokeWidth="1.5" strokeLinecap="round" />

        {/* Working Day: Mon */}
        <rect x="42" y="0" width="34" height="42" rx="6" fill="#ffffff" stroke="#93c5fd" strokeWidth="1" />
        <text x="59" y="14" fill="#1e3a8a" fontSize="8" fontWeight="700" textAnchor="middle">MON</text>
        <circle cx="59" cy="27" r="7" fill="#dbeafe" />
        <path d="M56 27 L58 29 L62 24" stroke="#1d4ed8" strokeWidth="1.5" strokeLinecap="round" />

        {/* Working Day: Tue */}
        <rect x="84" y="0" width="34" height="42" rx="6" fill="#ffffff" stroke="#93c5fd" strokeWidth="1" />
        <text x="101" y="14" fill="#1e3a8a" fontSize="8" fontWeight="700" textAnchor="middle">TUE</text>
        <circle cx="101" cy="27" r="7" fill="#dbeafe" />
        <path d="M98 27 L100 29 L104 24" stroke="#1d4ed8" strokeWidth="1.5" strokeLinecap="round" />

        {/* Contractual Day-Off (Thu) - Padlocked */}
        <rect x="126" y="0" width="40" height="42" rx="6" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1.5" />
        <text x="146" y="13" fill="#92400e" fontSize="8" fontWeight="700" textAnchor="middle">THU (OFF)</text>
        {/* Padlock */}
        <path d="M142 22 L142 19 C142 16.5 149 16.5 149 19 L149 22" stroke="#d97706" strokeWidth="1.5" fill="none" />
        <rect x="140" y="22" width="12" height="9" rx="2" fill="url(#padlockGrad)" />
        <circle cx="146" cy="26" r="1" fill="#78350f" />

        {/* Approved Leave (Fri) - Shielded */}
        <rect x="174" y="0" width="36" height="42" rx="6" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.2" />
        <text x="192" y="13" fill="#991b1b" fontSize="7.5" fontWeight="700" textAnchor="middle">LEAVE</text>
        <path d="M187 23 L192 20 L197 23 L197 28 C197 31 192 33 192 33 C192 33 187 31 187 28 Z" fill="#ef4444" />
        <path d="M190 26 L194 26" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
      </g>

      {/* Guarantee Banner */}
      <rect x="15" y="74" width="210" height="22" rx="6" fill="#f0fdf4" stroke="#86efac" strokeWidth="1" />
      <path d="M26 85 L29 88 L34 82" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" />
      <text x="40" y="88" fill="#166534" fontSize="8.5" fontWeight="700">
        Contract Off-Days &amp; Leave 100% Protected
      </text>
    </svg>
  );
}

/** SVG 2: Flexible Availability (Cap Days/Wk) */
export function FlexibleCapDaysSvg({ active = false, customDays = 5 }: { active?: boolean; customDays?: number }) {
  return (
    <svg className="w-full h-28 select-none" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="110" rx="10" fill={active ? '#fffbeb' : '#f8fafc'} stroke={active ? '#f59e0b' : '#cbd5e1'} strokeWidth={active ? 1.5 : 1} />

      {/* Week Slot Battery / Energy Gauge */}
      <g transform="translate(15, 20)">
        <text x="0" y="8" fill="#78350f" fontSize="8" fontWeight="700" letterSpacing="0.5">
          WEEKLY ACTIVE SLOTS CAPACITY: {customDays} / 7 DAYS MAX
        </text>

        {/* 7 Day Blocks */}
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => {
          const isFilled = i < customDays;
          return (
            <g key={day} transform={`translate(${i * 30}, 16)`}>
              <rect
                x="0"
                y="0"
                width="26"
                height="32"
                rx="4"
                fill={isFilled ? '#fef3c7' : '#f1f5f9'}
                stroke={isFilled ? '#f59e0b' : '#cbd5e1'}
                strokeWidth={isFilled ? 1.2 : 1}
              />
              <text x="13" y="12" fill={isFilled ? '#92400e' : '#94a3b8'} fontSize="7" fontWeight="700" textAnchor="middle">
                {day}
              </text>
              {isFilled ? (
                <path d="M13 16 L10 23 L14 23 L12 28 L17 21 L13 21 Z" fill="#d97706" />
              ) : (
                <circle cx="13" cy="22" r="3" fill="#cbd5e1" />
              )}
            </g>
          );
        })}
      </g>

      {/* Cap explanation banner */}
      <rect x="15" y="74" width="210" height="22" rx="6" fill="#fff7ed" stroke="#fdba74" strokeWidth="1" />
      <circle cx="28" cy="85" r="5" fill="#f97316" />
      <text x="28" y="88" fill="#ffffff" fontSize="7" fontWeight="800" textAnchor="middle">!</text>
      <text x="40" y="88" fill="#9a3412" fontSize="8.5" fontWeight="700">
        Mobilizes days-off, but stops exactly at {customDays} active days
      </text>
    </svg>
  );
}

/** SVG 3: Smart Dates Priority */
export function SmartDatesPrioritySvg({ active = false }: { active?: boolean }) {
  return (
    <svg className="w-full h-28 select-none" viewBox="0 0 240 110" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="110" rx="10" fill={active ? '#f5f3ff' : '#f8fafc'} stroke={active ? '#7c3aed' : '#cbd5e1'} strokeWidth={active ? 1.5 : 1} />

      <g transform="translate(18, 18)">
        {/* Calendar sheet */}
        <rect x="0" y="0" width="75" height="48" rx="6" fill="#ffffff" stroke="#c4b5fd" strokeWidth="1.2" />
        <rect x="0" y="0" width="75" height="14" rx="4" fill="#7c3aed" />
        <text x="37" y="10" fill="#ffffff" fontSize="7" fontWeight="700" textAnchor="middle">JUNE CALENDAR</text>
        <circle cx="20" cy="26" r="6" fill="#f1f5f9" />
        <text x="20" y="28.5" fill="#64748b" fontSize="7" textAnchor="middle">14</text>
        {/* Specific targeted leave */}
        <circle cx="50" cy="26" r="8" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.2" />
        <text x="50" y="29" fill="#b91c1c" fontSize="7.5" fontWeight="800" textAnchor="middle">15*</text>
        <text x="37" y="43" fill="#6d28d9" fontSize="6.5" fontWeight="700" textAnchor="middle">15th = Explicit Leave</text>

        {/* Priority Arrow */}
        <path d="M 85 24 L 115 24" stroke="#7c3aed" strokeWidth="2" strokeDasharray="3 3" />
        <path d="M 112 20 L 118 24 L 112 28" fill="#7c3aed" />

        {/* Target Result */}
        <g transform="translate(125, 2)">
          <rect x="0" y="0" width="78" height="44" rx="6" fill="#ffffff" stroke="#c4b5fd" strokeWidth="1" />
          <text x="8" y="14" fill="#1e1b4b" fontSize="7" fontWeight="700">ENGINE RESULT:</text>
          <text x="8" y="25" fill="#dc2626" fontSize="7" fontWeight="600">❌ June 15: Blocked</text>
          <text x="8" y="36" fill="#16a34a" fontSize="7" fontWeight="600">✓ Other Days: Open</text>
        </g>
      </g>

      <rect x="15" y="74" width="210" height="22" rx="6" fill="#fdf4ff" stroke="#f0abfc" strokeWidth="1" />
      <text x="26" y="88" fill="#86198f" fontSize="8.5" fontWeight="700">
        Explicit leave dates supersede recurring weekly contracts
      </text>
    </svg>
  );
}

// ============================================================================
// 3. CONSECUTIVE SHIFTS SVGs
// ============================================================================

/** SVG 4: Avoid Consecutive Shifts (Soft) */
export function ConsecutiveAvoidSvg({ active = false }: { active?: boolean }) {
  return (
    <svg className="w-full h-32 select-none" viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="120" rx="10" fill={active ? '#eef2ff' : '#f8fafc'} stroke={active ? '#3b82f6' : '#cbd5e1'} strokeWidth={active ? 1.5 : 1} />

      <g transform="translate(15, 18)">
        {/* Period 1 */}
        <rect x="0" y="0" width="62" height="48" rx="6" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.2" />
        <rect x="0" y="0" width="62" height="14" rx="4" fill="#1e40af" />
        <text x="31" y="10" fill="#ffffff" fontSize="7" fontWeight="700" textAnchor="middle">PERIOD 1 (09:00)</text>
        <circle cx="31" cy="26" r="8" fill="#dbeafe" />
        <text x="31" y="29" fill="#1e40af" fontSize="7.5" fontWeight="800" textAnchor="middle">Dr. Sarah</text>
        <text x="31" y="42" fill="#16a34a" fontSize="6.5" fontWeight="700" textAnchor="middle">✓ Assigned</text>

        {/* Transition: Coffee break & soft route */}
        <g transform="translate(68, 12)">
          {/* Coffee cup */}
          <rect x="10" y="6" width="14" height="12" rx="2" fill="#fef3c7" stroke="#d97706" strokeWidth="1" />
          <path d="M 24 9 C 27 9, 27 15, 24 15" stroke="#d97706" strokeWidth="1" fill="none" />
          <path d="M 14 3 C 14 1, 15 1, 15 -1 M 19 3 C 19 1, 20 1, 20 -1" stroke="#b45309" strokeWidth="0.8" />
          <text x="17" y="26" fill="#92400e" fontSize="6" fontWeight="700" textAnchor="middle">Rest Gap</text>
          {/* Curved route arrow */}
          <path d="M -2 12 Q 17 0, 34 12" stroke="#2563eb" strokeWidth="1.2" strokeDasharray="2 2" fill="none" />
        </g>

        {/* Period 2 */}
        <rect x="148" y="0" width="62" height="48" rx="6" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.2" />
        <rect x="148" y="0" width="62" height="14" rx="4" fill="#1e40af" />
        <text x="179" y="10" fill="#ffffff" fontSize="7" fontWeight="700" textAnchor="middle">PERIOD 2 (12:30)</text>
        <circle cx="179" cy="26" r="8" fill="#e0e7ff" />
        <text x="179" y="29" fill="#3730a3" fontSize="7.5" fontWeight="800" textAnchor="middle">Colleague B</text>
        <text x="179" y="42" fill="#2563eb" fontSize="6.5" fontWeight="700" textAnchor="middle">Rotated Peer</text>
      </g>

      <rect x="15" y="80" width="210" height="26" rx="6" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1" />
      <text x="25" y="96" fill="#0369a1" fontSize="8" fontWeight="700">
        Soft Constraint: Rest gap preserved unless severe deficit
      </text>
    </svg>
  );
}

/** SVG 5: Strictly Prevent Consecutive (Hard Lock) */
export function ConsecutiveStrictSvg({ active = false }: { active?: boolean }) {
  return (
    <svg className="w-full h-32 select-none" viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="120" rx="10" fill={active ? '#fff1f2' : '#f8fafc'} stroke={active ? '#e11d48' : '#cbd5e1'} strokeWidth={active ? 1.5 : 1} />

      <g transform="translate(15, 18)">
        {/* Period 1 */}
        <rect x="0" y="0" width="60" height="48" rx="6" fill="#ffffff" stroke="#fecdd3" strokeWidth="1" />
        <rect x="0" y="0" width="60" height="14" rx="4" fill="#9f1239" />
        <text x="30" y="10" fill="#ffffff" fontSize="7" fontWeight="700" textAnchor="middle">PERIOD 1</text>
        <circle cx="30" cy="27" r="7" fill="#ffe4e6" />
        <text x="30" y="30" fill="#881337" fontSize="7" fontWeight="700" textAnchor="middle">Dr. Sarah</text>

        {/* Steel Gate / Laser Barrier */}
        <g transform="translate(68, 6)">
          <rect x="8" y="0" width="18" height="38" rx="3" fill="#ffe4e6" stroke="#e11d48" strokeWidth="1.5" />
          <line x1="8" y1="10" x2="26" y2="10" stroke="#e11d48" strokeWidth="1" />
          <line x1="8" y1="19" x2="26" y2="19" stroke="#e11d48" strokeWidth="1" />
          <line x1="8" y1="28" x2="26" y2="28" stroke="#e11d48" strokeWidth="1" />
          <circle cx="17" cy="19" r="5" fill="#e11d48" />
          <text x="17" y="22" fill="#ffffff" fontSize="7" fontWeight="900" textAnchor="middle">⛔</text>
        </g>

        {/* Period 2 Lockout */}
        <rect x="102" y="0" width="108" height="48" rx="6" fill="#ffffff" stroke="#fecdd3" strokeWidth="1" />
        <rect x="102" y="0" width="108" height="14" rx="4" fill="#881337" />
        <text x="156" y="10" fill="#ffffff" fontSize="7" fontWeight="700" textAnchor="middle">PERIOD 2 (AFTERNOON)</text>
        <text x="156" y="26" fill="#e11d48" fontSize="7.5" fontWeight="800" textAnchor="middle">
          DR. SARAH LOCKED OUT
        </text>
        <text x="156" y="38" fill="#64748b" fontSize="6.5" textAnchor="middle">
          Mandatory Rest Cooldown Enforced
        </text>
      </g>

      <rect x="15" y="80" width="210" height="26" rx="6" fill="#fff1f2" stroke="#fecdd3" strokeWidth="1" />
      <text x="25" y="96" fill="#9f1239" fontSize="8" fontWeight="700">
        Strict Hard Lock: 0% chance of double shift on same day
      </text>
    </svg>
  );
}

/** SVG 6: Allow Freely */
export function ConsecutiveAllowSvg({ active = false }: { active?: boolean }) {
  return (
    <svg className="w-full h-32 select-none" viewBox="0 0 240 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="240" height="120" rx="10" fill={active ? '#ecfdf5' : '#f8fafc'} stroke={active ? '#10b981' : '#cbd5e1'} strokeWidth={active ? 1.5 : 1} />

      <g transform="translate(15, 18)">
        <rect x="0" y="0" width="70" height="48" rx="6" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1" />
        <rect x="0" y="0" width="70" height="14" rx="4" fill="#065f46" />
        <text x="35" y="10" fill="#ffffff" fontSize="7" fontWeight="700" textAnchor="middle">PERIOD 1 (09:00)</text>
        <circle cx="35" cy="28" r="8" fill="#d1fae5" />
        <text x="35" y="31" fill="#047857" fontSize="7.5" fontWeight="800" textAnchor="middle">Dr. Sarah</text>

        {/* Free Pass Infinity Connector */}
        <g transform="translate(76, 12)">
          <path d="M 0 12 C 10 0, 20 24, 30 12" stroke="#10b981" strokeWidth="2.5" fill="none" />
          <path d="M 28 8 L 34 12 L 28 16" fill="#10b981" />
          <text x="15" y="27" fill="#047857" fontSize="6.5" fontWeight="800" textAnchor="middle">EXPRESS 2X</text>
        </g>

        <rect x="140" y="0" width="70" height="48" rx="6" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1" />
        <rect x="140" y="0" width="70" height="14" rx="4" fill="#065f46" />
        <text x="175" y="10" fill="#ffffff" fontSize="7" fontWeight="700" textAnchor="middle">PERIOD 2 (12:30)</text>
        <circle cx="175" cy="28" r="8" fill="#d1fae5" />
        <text x="175" y="31" fill="#047857" fontSize="7.5" fontWeight="800" textAnchor="middle">Dr. Sarah</text>
      </g>

      <rect x="15" y="80" width="210" height="26" rx="6" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1" />
      <text x="25" y="96" fill="#065f46" fontSize="8" fontWeight="700">
        Unrestricted: Double shifts permitted for maximum room throughput
      </text>
    </svg>
  );
}

// ============================================================================
// 4. FLOOR ROAMER & COMMITTEES SUPERVISOR BUILDING SVG
// ============================================================================
interface BuildingFloorRoamerSvgProps {
  enabled: boolean;
  maxRooms: number;
  maxFloors: number;
}

export function BuildingFloorRoamerSvg({ enabled, maxRooms, maxFloors }: BuildingFloorRoamerSvgProps) {
  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a] p-4 text-white shadow-xl border border-amber-500/30">
      <svg className="w-full h-56 sm:h-64 select-none" viewBox="0 0 540 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="buildingGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="roamerActive" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>

        {/* Building Frame */}
        <rect x="40" y="20" width="460" height="180" rx="10" fill="url(#buildingGrad)" stroke="#475569" strokeWidth="1.5" />
        <text x="55" y="40" fill="#fbbf24" fontSize="10" fontWeight="800" letterSpacing="1">
          FACULTY BUILDING A • ROVING COMMITTEES ARCHITECTURE
        </text>

        {/* ── FLOOR 3 (Top Floor) ── */}
        <g transform="translate(60, 50)">
          <rect x="0" y="0" width="420" height="38" rx="6" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <text x="12" y="22" fill="#94a3b8" fontSize="9" fontWeight="700">FLOOR 3</text>
          {/* Rooms */}
          <rect x="75" y="8" width="60" height="22" rx="4" fill="#0f172a" stroke="#475569" />
          <text x="105" y="22" fill="#cbd5e1" fontSize="8" textAnchor="middle">Room 301</text>
          <rect x="145" y="8" width="60" height="22" rx="4" fill="#0f172a" stroke="#475569" />
          <text x="175" y="22" fill="#cbd5e1" fontSize="8" textAnchor="middle">Room 302</text>
          <text x="390" y="22" fill="#64748b" fontSize="8" textAnchor="end">Out of single-supervisor radius</text>
        </g>

        {/* ── FLOOR 2 (Active Roaming Core) ── */}
        <g transform="translate(60, 95)">
          {/* Active Roaming Zone Highlight */}
          <rect
            x="0"
            y="0"
            width="420"
            height="42"
            rx="6"
            fill="#78350f"
            fillOpacity="0.25"
            stroke="#f59e0b"
            strokeWidth="1.8"
            strokeDasharray="4 2"
          />
          <text x="12" y="24" fill="#fbbf24" fontSize="9" fontWeight="800">FLOOR 2</text>
          {/* Rooms */}
          <rect x="75" y="10" width="60" height="22" rx="4" fill="#451a03" stroke="#f59e0b" />
          <text x="105" y="24" fill="#fef3c7" fontSize="8" fontWeight="700" textAnchor="middle">Room 201</text>
          <rect x="145" y="10" width="60" height="22" rx="4" fill="#451a03" stroke="#f59e0b" />
          <text x="175" y="24" fill="#fef3c7" fontSize="8" fontWeight="700" textAnchor="middle">Room 202</text>
          <rect x="215" y="10" width="60" height="22" rx="4" fill="#451a03" stroke="#f59e0b" />
          <text x="245" y="24" fill="#fef3c7" fontSize="8" fontWeight="700" textAnchor="middle">Room 203</text>

          {/* Roving Supervisor Icon walking the floor */}
          <g transform="translate(325, 20)">
            <circle cx="0" cy="0" r="12" fill="url(#roamerActive)" />
            <path d="M -4 -3 L 0 -7 L 4 -3 L 4 3 C 4 6 0 8 0 8 C 0 8 -4 6 -4 3 Z" fill="#000" />
            <rect x="18" y="-10" width="70" height="20" rx="4" fill="#0f172a" stroke="#f59e0b" strokeWidth="1" />
            <text x="53" y="3" fill="#fef3c7" fontSize="7.5" fontWeight="800" textAnchor="middle">
              ROAMER #1
            </text>
          </g>
        </g>

        {/* ── FLOOR 1 (Ground Floor) ── */}
        <g transform="translate(60, 145)">
          <rect
            x="0"
            y="0"
            width="420"
            height="38"
            rx="6"
            fill={maxFloors >= 2 ? '#78350f' : '#1e293b'}
            fillOpacity={maxFloors >= 2 ? 0.15 : 1}
            stroke={maxFloors >= 2 ? '#f59e0b' : '#334155'}
            strokeWidth={1}
            strokeDasharray={maxFloors >= 2 ? '3 3' : 'none'}
          />
          <text x="12" y="22" fill={maxFloors >= 2 ? '#fbbf24' : '#94a3b8'} fontSize="9" fontWeight="700">FLOOR 1</text>
          <rect x="75" y="8" width="60" height="22" rx="4" fill="#0f172a" stroke="#475569" />
          <text x="105" y="22" fill="#cbd5e1" fontSize="8" textAnchor="middle">Room 101</text>
          <text x="390" y="22" fill="#f59e0b" fontSize="8" fontWeight="600" textAnchor="end">
            {maxFloors >= 2 ? `✓ Within Roamer #1 vertical capacity (${maxFloors} flrs)` : 'Separate Roamer required'}
          </text>
        </g>
      </svg>
    </div>
  );
}

// ============================================================================
// 5. STANDBY RESERVES & CHEMIST LAB SHIELD SVG
// ============================================================================
interface StandbyReservesSvgProps {
  supervisorsTarget: number;
  assistantsTarget: number;
  deprioritizeChemistsP2: boolean;
  maxWeeklyReserves: number;
}

export function StandbyReservesSvg({
  supervisorsTarget,
  assistantsTarget,
  deprioritizeChemistsP2,
  maxWeeklyReserves,
}: StandbyReservesSvgProps) {
  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#022c22] via-[#064e3b] to-[#022c22] p-4 text-white shadow-xl border border-emerald-500/30">
      <svg className="w-full h-56 select-none" viewBox="0 0 540 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Left: Active Halls Container */}
        <g transform="translate(30, 20)">
          <rect x="0" y="0" width="200" height="160" rx="10" fill="#064e3b" stroke="#10b981" strokeWidth="1.2" />
          <rect x="0" y="0" width="200" height="28" rx="8" fill="#047857" />
          <text x="100" y="18" fill="#ffffff" fontSize="10" fontWeight="800" textAnchor="middle">
            ACTIVE EXAM ROOMS
          </text>

          {/* Active room 1 */}
          <rect x="15" y="40" width="170" height="46" rx="6" fill="#022c22" stroke="#059669" strokeWidth="1" />
          <text x="25" y="58" fill="#a7f3d0" fontSize="9" fontWeight="700">Exam Hall A (60 Students)</text>
          <text x="25" y="74" fill="#6ee7b7" fontSize="8">1 Head Supervisor • 3 Invigilators</text>

          {/* Active room 2 */}
          <rect x="15" y="98" width="170" height="46" rx="6" fill="#022c22" stroke="#059669" strokeWidth="1" />
          <text x="25" y="116" fill="#a7f3d0" fontSize="9" fontWeight="700">Exam Hall B (40 Students)</text>
          <text x="25" y="132" fill="#6ee7b7" fontSize="8">1 Head Supervisor • 2 Invigilators</text>
        </g>

        {/* Center: Rapid Dispatch Bridge */}
        <g transform="translate(240, 80)">
          <path d="M 0 20 L 40 20" stroke="#34d399" strokeWidth="2.5" strokeDasharray="4 3" />
          <path d="M 38 15 L 48 20 L 38 25" fill="#34d399" />
          <text x="25" y="40" fill="#6ee7b7" fontSize="8" fontWeight="800" textAnchor="middle">DISPATCH</text>
          <text x="25" y="50" fill="#a7f3d0" fontSize="7" textAnchor="middle">on emergency absence</text>
        </g>

        {/* Right: Standby Reserve Lounge */}
        <g transform="translate(300, 20)">
          <rect x="0" y="0" width="210" height="160" rx="10" fill="#064e3b" stroke="#34d399" strokeWidth="1.5" />
          <rect x="0" y="0" width="210" height="28" rx="8" fill="#10b981" />
          <text x="105" y="18" fill="#064e3b" fontSize="10" fontWeight="900" textAnchor="middle">
            STANDBY RESERVE LOUNGE
          </text>

          {/* Supervisor Shields */}
          <g transform="translate(20, 42)">
            <rect x="0" y="0" width="80" height="50" rx="6" fill="#022c22" stroke="#34d399" strokeWidth="1" />
            <text x="40" y="20" fill="#34d399" fontSize="18" fontWeight="900" textAnchor="middle">
              {supervisorsTarget}
            </text>
            <text x="40" y="36" fill="#d1fae5" fontSize="7.5" fontWeight="700" textAnchor="middle">
              Head Supervisors
            </text>
          </g>

          {/* Invigilator Shields */}
          <g transform="translate(110, 42)">
            <rect x="0" y="0" width="80" height="50" rx="6" fill="#022c22" stroke="#34d399" strokeWidth="1" />
            <text x="40" y="20" fill="#facc15" fontSize="18" fontWeight="900" textAnchor="middle">
              {assistantsTarget}
            </text>
            <text x="40" y="36" fill="#fef08a" fontSize="7.5" fontWeight="700" textAnchor="middle">
              Invigilators
            </text>
          </g>

          {/* Chemist Afternoon Protection Badge */}
          <g transform="translate(20, 102)">
            <rect
              x="0"
              y="0"
              width="170"
              height="44"
              rx="6"
              fill={deprioritizeChemistsP2 ? '#022c22' : '#047857'}
              stroke="#34d399"
              strokeWidth={1}
            />
            {/* Flask icon */}
            <path d="M 22 14 L 28 14 L 28 20 L 36 32 L 14 32 L 22 20 Z" fill="#34d399" />
            <text x="44" y="22" fill="#ffffff" fontSize="8" fontWeight="800">
              {deprioritizeChemistsP2 ? 'Chemist P2 Shield: ACTIVE' : 'Chemist P2 Shield: OFF'}
            </text>
            <text x="44" y="34" fill="#a7f3d0" fontSize="7">
              {deprioritizeChemistsP2 ? 'Kept free for morning lab exams' : 'Treated equally in all periods'}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

// ============================================================================
// 6. WORKLOAD FAIRNESS EQUALIZER SVG
// ============================================================================
interface WorkloadFairnessSvgProps {
  maxDelta: number;
}

export function WorkloadFairnessSvg({ maxDelta }: WorkloadFairnessSvgProps) {
  const avg = 5.0;
  const ceiling = avg + maxDelta;

  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#18181b] via-[#27272a] to-[#18181b] p-4 text-white shadow-xl border border-zinc-700">
      <svg className="w-full h-44 select-none" viewBox="0 0 540 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        <text x="30" y="25" fill="#f43f5e" fontSize="10" fontWeight="800" letterSpacing="0.8">
          WORKLOAD SPREAD BALANCE • FAIRNESS CEILING GUARANTEE
        </text>

        {/* Base Track */}
        <rect x="50" y="70" width="440" height="14" rx="7" fill="#3f3f46" stroke="#52525b" strokeWidth="1" />
        <rect x="52" y="72" width="436" height="10" rx="5" fill="url(#beamGrad)" fillOpacity="0.85" />

        {/* Low Workload Mark */}
        <g transform="translate(80, 52)">
          <circle cx="0" cy="25" r="5" fill="#10b981" />
          <text x="0" y="0" fill="#a7f3d0" fontSize="8" fontWeight="700" textAnchor="middle">MIN SHIFTS</text>
          <text x="0" y="12" fill="#6ee7b7" fontSize="7" textAnchor="middle">(Prioritized)</text>
        </g>

        {/* Center / Average Pivot Pin */}
        <g transform="translate(270, 40)">
          <rect x="-40" y="-15" width="80" height="22" rx="4" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1" />
          <text x="0" y="0" fill="#ffffff" fontSize="8" fontWeight="800" textAnchor="middle">
            FACULTY AVG: {avg.toFixed(1)}
          </text>
          {/* Pointer needle */}
          <polygon points="0,12 -5,35 5,35" fill="#60a5fa" />
        </g>

        {/* Hard Delta Ceiling Lockout */}
        <g transform="translate(420, 36)">
          <rect x="-48" y="-12" width="96" height="26" rx="5" fill="#991b1b" stroke="#f87171" strokeWidth="1.2" />
          <text x="0" y="1" fill="#fee2e2" fontSize="7.5" fontWeight="900" textAnchor="middle">
            DELTA CEILING (+{maxDelta})
          </text>
          <text x="0" y="10" fill="#fca5a5" fontSize="6.5" textAnchor="middle">
            HARD LOCKOUT AT {ceiling.toFixed(1)}
          </text>
          {/* Stop wall line */}
          <line x1="0" y1="18" x2="0" y2="48" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Explanatory footer */}
        <text x="270" y="130" fill="#a1a1aa" fontSize="8.5" textAnchor="middle">
          Guarantees that no individual is over-scheduled while peers remain available with lower shift counts.
        </text>
      </svg>
    </div>
  );
}

// ============================================================================
// 7. ORAL EXAM PIPELINE SVG
// ============================================================================
export function OralPipelineSvg({ mode }: { mode: 'combined' | 'separate' | 'skip' }) {
  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#091e3a] via-[#102a4e] to-[#091e3a] p-4 text-white shadow-xl border border-blue-500/30">
      <svg className="w-full h-36 select-none" viewBox="0 0 540 130" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="25" y="20" fill="#93c5fd" fontSize="10" fontWeight="800" letterSpacing="0.8">
          AUTOMATED ORAL EXAM INTAKE PIPELINE
        </text>

        {/* Input sessions */}
        <g transform="translate(30, 40)">
          <rect x="0" y="0" width="110" height="32" rx="6" fill="#1e293b" stroke="#3b82f6" />
          <text x="55" y="20" fill="#ffffff" fontSize="8.5" fontWeight="700" textAnchor="middle">
            Written Sessions (Halls)
          </text>
        </g>

        <g transform="translate(30, 80)">
          <rect x="0" y="0" width="110" height="32" rx="6" fill="#1e293b" stroke="#f59e0b" />
          <text x="55" y="20" fill="#fef3c7" fontSize="8.5" fontWeight="700" textAnchor="middle">
            Oral Sessions (Clinics)
          </text>
        </g>

        {/* Engine Funnel */}
        {mode === 'combined' ? (
          <g transform="translate(170, 42)">
            <path d="M 0 16 L 60 38 L 0 60 Z" fill="#2563eb" fillOpacity="0.4" stroke="#60a5fa" strokeWidth="1.5" />
            <text x="22" y="42" fill="#ffffff" fontSize="8" fontWeight="800" textAnchor="middle">MERGE</text>
            {/* Unified Output */}
            <rect x="80" y="16" width="240" height="44" rx="8" fill="#1e40af" stroke="#93c5fd" strokeWidth="1.5" />
            <text x="200" y="38" fill="#ffffff" fontSize="9.5" fontWeight="900" textAnchor="middle">
              UNIFIED ENGINE PASS (Written + Oral Synchronized)
            </text>
            <text x="200" y="50" fill="#bfdbfe" fontSize="7.5" textAnchor="middle">
              Staff shifts &amp; rest gaps evaluated holistically across both exam formats
            </text>
          </g>
        ) : mode === 'separate' ? (
          <g transform="translate(160, 40)">
            <rect x="20" y="0" width="150" height="32" rx="6" fill="#1e3a8a" stroke="#60a5fa" />
            <text x="95" y="20" fill="#ffffff" fontSize="8" fontWeight="700" textAnchor="middle">
              Pass 1: Written Exams Pass
            </text>

            <path d="M 180 16 L 220 16 L 220 56 L 240 56" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />

            <rect x="250" y="40" width="150" height="32" rx="6" fill="#78350f" stroke="#f59e0b" />
            <text x="325" y="60" fill="#fef3c7" fontSize="8" fontWeight="700" textAnchor="middle">
              Pass 2: Dedicated Oral Pass
            </text>
          </g>
        ) : (
          <g transform="translate(170, 42)">
            <rect x="20" y="0" width="170" height="32" rx="6" fill="#1e3a8a" stroke="#60a5fa" />
            <text x="105" y="20" fill="#ffffff" fontSize="8" fontWeight="700" textAnchor="middle">
              Pass: Written Exams Only
            </text>

            <path d="M 0 58 L 100 58" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
            <text x="120" y="62" fill="#ef4444" fontSize="9" fontWeight="800">
              ⛔ Oral Exams Skipped (Manual Dept Assignment)
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}


// ============================================================================
// 8. STRICT ROLE MATCHING GATE SVG
// ============================================================================
export function RoleMatchingGateSvg({ enabled }: { enabled: boolean }) {
  return (
    <div className="w-full relative overflow-hidden rounded-xl bg-slate-900 p-3.5 text-white border border-slate-700 shadow-md">
      <svg className="w-full h-24 select-none" viewBox="0 0 460 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="20" y="16" fill="#94a3b8" fontSize="8.5" fontWeight="800" letterSpacing="0.8">
          FACULTY ROLE-BASED INTAKE FILTER
        </text>

        {/* Lane 1: Teaching Assistants -> Exam Supervisors */}
        <g transform="translate(20, 30)">
          <rect x="0" y="0" width="120" height="24" rx="4" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1" />
          <text x="60" y="15" fill="#ffffff" fontSize="8" fontWeight="700" textAnchor="middle">
            Teaching Assistants (TAs)
          </text>

          <path d="M 125 12 L 180 12" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M 178 8 L 186 12 L 178 16" fill="#60a5fa" />

          <rect x="190" y="0" width="130" height="24" rx="4" fill="#0f172a" stroke="#93c5fd" strokeWidth="1" />
          <text x="255" y="15" fill="#93c5fd" fontSize="8" fontWeight="800" textAnchor="middle">
            🛡️ Head Exam Supervisor
          </text>
        </g>

        {/* Lane 2: Demonstrators/Chemists -> Hall Invigilators */}
        <g transform="translate(20, 60)">
          <rect x="0" y="0" width="120" height="24" rx="4" fill="#78350f" stroke="#f59e0b" strokeWidth="1" />
          <text x="60" y="15" fill="#ffffff" fontSize="8" fontWeight="700" textAnchor="middle">
            Demonstrators &amp; Chemists
          </text>

          <path d="M 125 12 L 180 12" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3 3" />
          <path d="M 178 8 L 186 12 L 178 16" fill="#f59e0b" />

          <rect x="190" y="0" width="130" height="24" rx="4" fill="#0f172a" stroke="#fde68a" strokeWidth="1" />
          <text x="255" y="15" fill="#fde68a" fontSize="8" fontWeight="800" textAnchor="middle">
            👥 Hall Invigilator
          </text>
        </g>

        {/* Status Tag on right */}
        <g transform="translate(340, 36)">
          <rect
            x="0"
            y="0"
            width="100"
            height="40"
            rx="6"
            fill={enabled ? '#064e3b' : '#3f3f46'}
            stroke={enabled ? '#10b981' : '#71717a'}
            strokeWidth={1}
          />
          <text x="50" y="18" fill="#ffffff" fontSize="8" fontWeight="900" textAnchor="middle">
            {enabled ? 'STRICT LOCK' : 'FLEXIBLE'}
          </text>
          <text x="50" y="30" fill={enabled ? '#a7f3d0' : '#d4d4d8'} fontSize="7" textAnchor="middle">
            {enabled ? 'Roles Enforced' : 'Cross-Role Allowed'}
          </text>
        </g>
      </svg>
    </div>
  );
}

// ============================================================================
// 9. WEEKLY HOURS COMPARISON FUEL GAUGES SVG
// ============================================================================
interface WeeklyHoursBarComparisonSvgProps {
  ftHours: number;
  ptHours: number;
  chemistHours: number;
}

export function WeeklyHoursBarComparisonSvg({
  ftHours,
  ptHours,
  chemistHours,
}: WeeklyHoursBarComparisonSvgProps) {
  const maxScale = 40;

  return (
    <div className="w-full relative overflow-hidden rounded-xl bg-slate-900 p-4 text-white border border-slate-700 shadow-md">
      <svg className="w-full h-32 select-none" viewBox="0 0 500 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="20" y="18" fill="#94a3b8" fontSize="8.5" fontWeight="800" letterSpacing="0.8">
          WEEKLY CONTRACT HOURS COMPARISON GAUGE
        </text>

        {/* Full-Time Bar */}
        <g transform="translate(20, 32)">
          <text x="0" y="12" fill="#93c5fd" fontSize="8" fontWeight="700">Full-Time (FT)</text>
          <rect x="80" y="2" width="300" height="12" rx="6" fill="#1e293b" />
          <rect x="80" y="2" width={Math.min(300, (ftHours / maxScale) * 300)} height="12" rx="6" fill="#3b82f6" />
          <text x="390" y="12" fill="#ffffff" fontSize="8.5" fontWeight="800">{ftHours} hrs/wk</text>
          <text x="445" y="12" fill="#64748b" fontSize="7">(~{Math.round(ftHours / 2)} slots)</text>
        </g>

        {/* Part-Time Bar */}
        <g transform="translate(20, 60)">
          <text x="0" y="12" fill="#fde68a" fontSize="8" fontWeight="700">Part-Time (PT)</text>
          <rect x="80" y="2" width="300" height="12" rx="6" fill="#1e293b" />
          <rect x="80" y="2" width={Math.min(300, (ptHours / maxScale) * 300)} height="12" rx="6" fill="#f59e0b" />
          <text x="390" y="12" fill="#ffffff" fontSize="8.5" fontWeight="800">{ptHours} hrs/wk</text>
          <text x="445" y="12" fill="#64748b" fontSize="7">(~{Math.round(ptHours / 2)} slots)</text>
        </g>

        {/* Chemists Bar */}
        <g transform="translate(20, 88)">
          <text x="0" y="12" fill="#a7f3d0" fontSize="8" fontWeight="700">Chemists (Lab)</text>
          <rect x="80" y="2" width="300" height="12" rx="6" fill="#1e293b" />
          <rect x="80" y="2" width={Math.min(300, (chemistHours / maxScale) * 300)} height="12" rx="6" fill="#10b981" />
          <text x="390" y="12" fill="#ffffff" fontSize="8.5" fontWeight="800">{chemistHours} hrs/wk</text>
          <text x="445" y="12" fill="#64748b" fontSize="7">(~{Math.round(chemistHours / 2)} slots)</text>
        </g>
      </svg>
    </div>
  );
}
