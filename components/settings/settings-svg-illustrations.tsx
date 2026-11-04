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

  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#00142e] via-[#002147] to-[#011633] p-5 text-white shadow-2xl border border-blue-500/30">
      {/* Background blueprint grid lines */}
      <svg className="w-full h-80 sm:h-96 select-none" viewBox="0 0 760 400" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Blueprint Grid Pattern */}
          <pattern id="blueprint-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#2563eb" strokeWidth="0.6" strokeOpacity="0.2" />
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
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Blueprint background grid */}
        <rect width="760" height="400" fill="url(#blueprint-grid)" rx="16" />

        {/* Room boundary walls */}
        <rect x="25" y="20" width="710" height="360" rx="14" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.45" strokeDasharray="8 4" />
        <rect x="30" y="25" width="700" height="350" rx="12" stroke="#1d4ed8" strokeWidth="1.2" strokeOpacity="0.3" />

        {/* Room Header & Compass */}
        <text x="50" y="52" fill="#bfdbfe" fontSize="14" fontWeight="800" letterSpacing="1.2">
          HUE EXAM HALL BLUEPRINT • CAPACITY SIMULATOR
        </text>
        <text x="710" y="52" fill="#facc15" fontSize="13" fontWeight="800" textAnchor="end">
          {studentCount} STUDENTS REGISTERED
        </text>

        {/* ── PODIUM & HEAD SUPERVISOR ── */}
        <g transform="translate(195, 66)">
          {/* Main Stage / Podium */}
          <rect x="0" y="0" width="370" height="56" rx="12" fill="url(#podiumGrad)" stroke="#3b82f6" strokeWidth="2" />
          {/* Lectern */}
          <rect x="155" y="10" width="60" height="34" rx="6" fill="#0f172a" stroke="#60a5fa" strokeWidth="1.2" />
          <line x1="167" y1="18" x2="203" y2="18" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />
          <line x1="172" y1="26" x2="198" y2="26" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" />

          {/* Head Supervisor Avatar */}
          <circle cx="185" cy="-9" r="15" fill="url(#goldGlow)" filter="url(#neonGlow)" />
          {/* Head Icon / Shield */}
          <path d="M180 -12 L185 -17 L190 -12 L190 -5 C190 0 185 3 185 3 C185 3 180 0 180 -5 Z" fill="#002147" />

          <text x="185" y="32" fill="#ffffff" fontSize="13.5" fontWeight="900" textAnchor="middle" letterSpacing="0.8">
            HEAD EXAM SUPERVISOR ({headSupervisors})
          </text>
          <text x="185" y="48" fill="#cbd5e1" fontSize="11" fontWeight="700" textAnchor="middle">
            (Teaching Assistant / Senior Faculty)
          </text>
        </g>

        {/* ── AISLE LANES & PATROLLING INVIGILATORS ── */}
        {/* Left Aisle */}
        <line x1="105" y1="135" x2="105" y2="335" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5 5" strokeOpacity="0.45" />
        {/* Right Aisle */}
        <line x1="655" y1="135" x2="655" y2="335" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5 5" strokeOpacity="0.45" />
        {/* Center Aisle */}
        <line x1="380" y1="135" x2="380" y2="335" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="5 5" strokeOpacity="0.45" />

        {/* Dynamic Invigilator Patrollers */}
        {Array.from({ length: invigilators }).map((_, i) => {
          const positions = [
            { x: 105, y: 225 },
            { x: 655, y: 225 },
            { x: 380, y: 280 },
            { x: 380, y: 165 },
          ];
          const pos = positions[i % positions.length];

          return (
            <g key={i} transform={`translate(${pos.x}, ${pos.y})`}>
              {/* Surveillance cone / sightline */}
              <path
                d="M 0 0 L -34 46 L 34 46 Z"
                fill="#f59e0b"
                fillOpacity="0.15"
                stroke="#f59e0b"
                strokeWidth="1.2"
                strokeOpacity="0.45"
              />
              {/* Badge halo */}
              <circle cx="0" cy="0" r="16" fill="#78350f" stroke="#f59e0b" strokeWidth="2" />
              <circle cx="0" cy="0" r="12" fill="#f59e0b" filter="url(#neonGlow)" />
              {/* Person Icon */}
              <circle cx="0" cy="-3.5" r="3.5" fill="#451a03" />
              <path d="M -6 6 C -6 1.5, 6 1.5, 6 6 Z" fill="#451a03" />
              {/* Label Tag Box */}
              <rect x="-52" y="18" width="104" height="26" rx="6" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="0" y="35" fill="#fef08a" fontSize="11.5" fontWeight="900" textAnchor="middle">
                INVIGILATOR #{i + 1}
              </text>
            </g>
          );
        })}

        {/* ── STUDENT DESKS MATRIX ── */}
        <g transform="translate(140, 140)">
          {Array.from({ length: visibleDesks }).map((_, idx) => {
            const col = idx % cols;
            const row = Math.floor(idx / cols);
            // leave gap in middle for center aisle
            const xOffset = col >= 3 ? 45 : 0;
            const x = col * 72 + xOffset;
            const y = row * 44;

            return (
              <g key={idx} transform={`translate(${x}, ${y})`}>
                {/* Desk Surface */}
                <rect
                  x="0"
                  y="0"
                  width="50"
                  height="26"
                  rx="5"
                  fill="url(#deskGrad)"
                  stroke="#475569"
                  strokeWidth="1.2"
                />
                {/* Exam Booklet / Sheet on desk */}
                <rect x="7" y="5" width="16" height="16" rx="2" fill="#f8fafc" fillOpacity="0.9" />
                <line x1="10" y1="9" x2="20" y2="9" stroke="#64748b" strokeWidth="1.2" />
                <line x1="10" y1="14" x2="18" y2="14" stroke="#64748b" strokeWidth="1.2" />

                {/* Desk Number Badge */}
                <circle cx="39" cy="13" r="7" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.2" />
                <text x="39" y="16.5" fill="#bfdbfe" fontSize="9" fontWeight="900" textAnchor="middle">
                  {idx + 1}
                </text>

                {/* Chair */}
                <rect x="14" y="28" width="22" height="6" rx="2.5" fill="#1e293b" stroke="#334155" strokeWidth="1" />
              </g>
            );
          })}
        </g>

        {/* ── RATIO TIER STATUS FOOTER PILL ── */}
        <g transform="translate(155, 342)">
          <rect x="0" y="0" width="450" height="36" rx="18" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.8" />
          <circle cx="20" cy="18" r="6" fill="#10b981" />
          <text x="38" y="23" fill="#ffffff" fontSize="12.5" fontWeight="800">
            Active Tier Allocation: {headSupervisors} Head Supervisor + {invigilators} Invigilators
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
    <svg className="w-full h-36 select-none" viewBox="0 0 380 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="padlockGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      {/* Background card */}
      <rect width="380" height="160" rx="14" fill={active ? '#eff6ff' : '#f8fafc'} stroke={active ? '#2563eb' : '#cbd5e1'} strokeWidth={active ? 2 : 1.2} />

      {/* Week Calendar strip (Sun to Thu) */}
      <g transform="translate(20, 22)">
        {/* Working Day: Sun */}
        <rect x="0" y="0" width="56" height="66" rx="8" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.5" />
        <text x="28" y="20" fill="#1e3a8a" fontSize="12" fontWeight="800" textAnchor="middle">SUN</text>
        <circle cx="28" cy="42" r="11" fill="#dbeafe" />
        <path d="M23 42 L26 45 L33 37" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" />

        {/* Working Day: Mon */}
        <rect x="66" y="0" width="56" height="66" rx="8" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.5" />
        <text x="94" y="20" fill="#1e3a8a" fontSize="12" fontWeight="800" textAnchor="middle">MON</text>
        <circle cx="94" cy="42" r="11" fill="#dbeafe" />
        <path d="M89 42 L92 45 L99 37" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" />

        {/* Working Day: Tue */}
        <rect x="132" y="0" width="56" height="66" rx="8" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.5" />
        <text x="160" y="20" fill="#1e3a8a" fontSize="12" fontWeight="800" textAnchor="middle">TUE</text>
        <circle cx="160" cy="42" r="11" fill="#dbeafe" />
        <path d="M155 42 L158 45 L165 37" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round" />

        {/* Contractual Day-Off (Thu) - Padlocked */}
        <rect x="198" y="0" width="70" height="66" rx="8" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2" />
        <text x="233" y="18" fill="#92400e" fontSize="11" fontWeight="800" textAnchor="middle">THU (OFF)</text>
        {/* Padlock */}
        <path d="M227 34 L227 30 C227 26 239 26 239 30 L239 34" stroke="#d97706" strokeWidth="2" fill="none" />
        <rect x="223" y="34" width="20" height="16" rx="3" fill="url(#padlockGrad)" />
        <circle cx="233" cy="42" r="2" fill="#78350f" />

        {/* Approved Leave (Fri) - Shielded */}
        <rect x="278" y="0" width="62" height="66" rx="8" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.8" />
        <text x="309" y="18" fill="#991b1b" fontSize="11" fontWeight="800" textAnchor="middle">LEAVE</text>
        <path d="M301 32 L309 28 L317 32 L317 40 C317 45 309 49 309 49 C309 49 301 45 301 40 Z" fill="#ef4444" />
        <path d="M305 38 L313 38" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
      </g>

      {/* Guarantee Banner */}
      <rect x="20" y="104" width="340" height="36" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5" />
      <path d="M36 122 L40 126 L48 117" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" />
      <text x="56" y="126" fill="#14532d" fontSize="12" fontWeight="800">
        Contract Off-Days &amp; Leave 100% Protected
      </text>
    </svg>
  );
}

/** SVG 2: Flexible Availability (Cap Days/Wk) */
export function FlexibleCapDaysSvg({ active = false, customDays = 5 }: { active?: boolean; customDays?: number }) {
  return (
    <svg className="w-full h-36 select-none" viewBox="0 0 380 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="380" height="160" rx="14" fill={active ? '#fffbeb' : '#f8fafc'} stroke={active ? '#f59e0b' : '#cbd5e1'} strokeWidth={active ? 2 : 1.2} />

      {/* Week Slot Battery / Energy Gauge */}
      <g transform="translate(20, 20)">
        <text x="0" y="12" fill="#78350f" fontSize="12" fontWeight="800" letterSpacing="0.5">
          WEEKLY ACTIVE SLOTS: {customDays} / 7 DAYS MAX CAP
        </text>

        {/* 7 Day Blocks */}
        {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, i) => {
          const isFilled = i < customDays;
          return (
            <g key={day} transform={`translate(${i * 49}, 22)`}>
              <rect
                x="0"
                y="0"
                width="42"
                height="50"
                rx="6"
                fill={isFilled ? '#fef3c7' : '#f1f5f9'}
                stroke={isFilled ? '#f59e0b' : '#cbd5e1'}
                strokeWidth={isFilled ? 1.8 : 1}
              />
              <text x="21" y="18" fill={isFilled ? '#92400e' : '#64748b'} fontSize="11" fontWeight="800" textAnchor="middle">
                {day}
              </text>
              {isFilled ? (
                <path d="M21 24 L16 33 L22 33 L19 41 L27 30 L21 30 Z" fill="#d97706" />
              ) : (
                <circle cx="21" cy="33" r="5" fill="#cbd5e1" />
              )}
            </g>
          );
        })}
      </g>

      {/* Cap explanation banner */}
      <rect x="20" y="104" width="340" height="36" rx="8" fill="#fff7ed" stroke="#fdba74" strokeWidth="1.5" />
      <circle cx="36" cy="122" r="7" fill="#f97316" />
      <text x="36" y="126" fill="#ffffff" fontSize="10" fontWeight="900" textAnchor="middle">!</text>
      <text x="52" y="126" fill="#7c2d12" fontSize="12" fontWeight="800">
        Mobilizes days-off, but stops strictly at {customDays} active days
      </text>
    </svg>
  );
}

/** SVG 3: Smart Dates Priority */
export function SmartDatesPrioritySvg({ active = false }: { active?: boolean }) {
  return (
    <svg className="w-full h-36 select-none" viewBox="0 0 380 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="380" height="160" rx="14" fill={active ? '#f5f3ff' : '#f8fafc'} stroke={active ? '#7c3aed' : '#cbd5e1'} strokeWidth={active ? 2 : 1.2} />

      <g transform="translate(24, 20)">
        {/* Calendar sheet */}
        <rect x="0" y="0" width="120" height="72" rx="8" fill="#ffffff" stroke="#c4b5fd" strokeWidth="1.5" />
        <rect x="0" y="0" width="120" height="20" rx="6" fill="#7c3aed" />
        <text x="60" y="14" fill="#ffffff" fontSize="10" fontWeight="800" textAnchor="middle">JUNE CALENDAR</text>
        <circle cx="30" cy="38" r="9" fill="#f1f5f9" />
        <text x="30" y="42" fill="#475569" fontSize="11" fontWeight="700" textAnchor="middle">14</text>
        {/* Specific targeted leave */}
        <circle cx="85" cy="38" r="12" fill="#fee2e2" stroke="#ef4444" strokeWidth="1.5" />
        <text x="85" y="42" fill="#b91c1c" fontSize="11" fontWeight="900" textAnchor="middle">15*</text>
        <text x="60" y="64" fill="#6d28d9" fontSize="9.5" fontWeight="700" textAnchor="middle">15th = Explicit Leave</text>

        {/* Priority Arrow */}
        <path d="M 135 36 L 175 36" stroke="#7c3aed" strokeWidth="2.5" strokeDasharray="4 3" />
        <path d="M 172 31 L 180 36 L 172 41" fill="#7c3aed" />

        {/* Target Result */}
        <g transform="translate(190, 0)">
          <rect x="0" y="0" width="140" height="72" rx="8" fill="#ffffff" stroke="#c4b5fd" strokeWidth="1.5" />
          <text x="12" y="20" fill="#1e1b4b" fontSize="10.5" fontWeight="800">ENGINE RESULT:</text>
          <text x="12" y="38" fill="#dc2626" fontSize="11" fontWeight="800">❌ June 15: Blocked</text>
          <text x="12" y="56" fill="#16a34a" fontSize="11" fontWeight="800">✓ Other Days: Open</text>
        </g>
      </g>

      <rect x="20" y="104" width="340" height="36" rx="8" fill="#fdf4ff" stroke="#f0abfc" strokeWidth="1.5" />
      <text x="32" y="126" fill="#701a75" fontSize="12" fontWeight="800">
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
    <svg className="w-full h-44 select-none" viewBox="0 0 380 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="380" height="180" rx="14" fill={active ? '#eef2ff' : '#f8fafc'} stroke={active ? '#3b82f6' : '#cbd5e1'} strokeWidth={active ? 2 : 1.2} />

      <g transform="translate(20, 20)">
        {/* Period 1 */}
        <rect x="0" y="0" width="105" height="80" rx="8" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.5" />
        <rect x="0" y="0" width="105" height="22" rx="6" fill="#1e40af" />
        <text x="52" y="15" fill="#ffffff" fontSize="10.5" fontWeight="800" textAnchor="middle">PERIOD 1 (09:00)</text>
        <circle cx="52" cy="44" r="12" fill="#dbeafe" />
        <text x="52" y="48" fill="#1e40af" fontSize="11.5" fontWeight="900" textAnchor="middle">Dr. Sarah</text>
        <text x="52" y="70" fill="#16a34a" fontSize="10" fontWeight="800" textAnchor="middle">✓ Assigned</text>

        {/* Transition: Coffee break & soft route */}
        <g transform="translate(115, 15)">
          <rect x="20" y="10" width="20" height="16" rx="3" fill="#fef3c7" stroke="#d97706" strokeWidth="1.2" />
          <path d="M 40 14 C 44 14, 44 22, 40 22" stroke="#d97706" strokeWidth="1.2" fill="none" />
          <path d="M 25 5 C 25 3, 27 3, 27 0 M 32 5 C 32 3, 34 3, 34 0" stroke="#b45309" strokeWidth="1" />
          <text x="30" y="38" fill="#92400e" fontSize="9.5" fontWeight="800" textAnchor="middle">Rest Gap</text>
          {/* Curved route arrow */}
          <path d="M -5 18 Q 30 -2, 65 18" stroke="#2563eb" strokeWidth="1.8" strokeDasharray="3 3" fill="none" />
        </g>

        {/* Period 2 */}
        <rect x="235" y="0" width="105" height="80" rx="8" fill="#ffffff" stroke="#93c5fd" strokeWidth="1.5" />
        <rect x="235" y="0" width="105" height="22" rx="6" fill="#1e40af" />
        <text x="287" y="15" fill="#ffffff" fontSize="10.5" fontWeight="800" textAnchor="middle">PERIOD 2 (12:30)</text>
        <circle cx="287" cy="44" r="12" fill="#e0e7ff" />
        <text x="287" y="48" fill="#3730a3" fontSize="11.5" fontWeight="900" textAnchor="middle">Colleague B</text>
        <text x="287" y="70" fill="#2563eb" fontSize="10" fontWeight="800" textAnchor="middle">Rotated Peer</text>
      </g>

      <rect x="20" y="118" width="340" height="42" rx="8" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1.5" />
      <text x="34" y="144" fill="#0369a1" fontSize="11.5" fontWeight="800">
        Soft Constraint: Rest gap preserved unless severe shortage
      </text>
    </svg>
  );
}

/** SVG 5: Strictly Prevent Consecutive (Hard Lock) */
export function ConsecutiveStrictSvg({ active = false }: { active?: boolean }) {
  return (
    <svg className="w-full h-44 select-none" viewBox="0 0 380 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="380" height="180" rx="14" fill={active ? '#fff1f2' : '#f8fafc'} stroke={active ? '#e11d48' : '#cbd5e1'} strokeWidth={active ? 2 : 1.2} />

      <g transform="translate(20, 20)">
        {/* Period 1 */}
        <rect x="0" y="0" width="95" height="80" rx="8" fill="#ffffff" stroke="#fecdd3" strokeWidth="1.5" />
        <rect x="0" y="0" width="95" height="22" rx="6" fill="#9f1239" />
        <text x="47" y="15" fill="#ffffff" fontSize="10.5" fontWeight="800" textAnchor="middle">PERIOD 1</text>
        <circle cx="47" cy="44" r="11" fill="#ffe4e6" />
        <text x="47" y="48" fill="#881337" fontSize="11" fontWeight="800" textAnchor="middle">Dr. Sarah</text>

        {/* Steel Gate / Laser Barrier */}
        <g transform="translate(108, 12)">
          <rect x="5" y="0" width="26" height="56" rx="4" fill="#ffe4e6" stroke="#e11d48" strokeWidth="2" />
          <line x1="5" y1="14" x2="31" y2="14" stroke="#e11d48" strokeWidth="1.5" />
          <line x1="5" y1="28" x2="31" y2="28" stroke="#e11d48" strokeWidth="1.5" />
          <line x1="5" y1="42" x2="31" y2="42" stroke="#e11d48" strokeWidth="1.5" />
          <circle cx="18" cy="28" r="7" fill="#e11d48" />
          <text x="18" y="32" fill="#ffffff" fontSize="9" fontWeight="900" textAnchor="middle">⛔</text>
        </g>

        {/* Period 2 Lockout */}
        <rect x="145" y="0" width="195" height="80" rx="8" fill="#ffffff" stroke="#fecdd3" strokeWidth="1.5" />
        <rect x="145" y="0" width="195" height="22" rx="6" fill="#881337" />
        <text x="242" y="15" fill="#ffffff" fontSize="10.5" fontWeight="800" textAnchor="middle">PERIOD 2 (AFTERNOON)</text>
        <text x="242" y="44" fill="#e11d48" fontSize="12" fontWeight="900" textAnchor="middle">
          DR. SARAH LOCKED OUT
        </text>
        <text x="242" y="62" fill="#475569" fontSize="10" fontWeight="700" textAnchor="middle">
          Mandatory Rest Cooldown Enforced
        </text>
      </g>

      <rect x="20" y="118" width="340" height="42" rx="8" fill="#fff1f2" stroke="#fecdd3" strokeWidth="1.5" />
      <text x="34" y="144" fill="#881337" fontSize="11.5" fontWeight="800">
        Strict Hard Lock: 0% chance of double shift on same day
      </text>
    </svg>
  );
}

/** SVG 6: Allow Freely */
export function ConsecutiveAllowSvg({ active = false }: { active?: boolean }) {
  return (
    <svg className="w-full h-44 select-none" viewBox="0 0 380 180" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="380" height="180" rx="14" fill={active ? '#ecfdf5' : '#f8fafc'} stroke={active ? '#10b981' : '#cbd5e1'} strokeWidth={active ? 2 : 1.2} />

      <g transform="translate(20, 20)">
        <rect x="0" y="0" width="110" height="80" rx="8" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1.5" />
        <rect x="0" y="0" width="110" height="22" rx="6" fill="#065f46" />
        <text x="55" y="15" fill="#ffffff" fontSize="10.5" fontWeight="800" textAnchor="middle">PERIOD 1 (09:00)</text>
        <circle cx="55" cy="44" r="12" fill="#d1fae5" />
        <text x="55" y="48" fill="#047857" fontSize="11.5" fontWeight="900" textAnchor="middle">Dr. Sarah</text>

        {/* Free Pass Infinity Connector */}
        <g transform="translate(122, 18)">
          <path d="M 0 16 C 14 0, 28 32, 42 16" stroke="#10b981" strokeWidth="3" fill="none" />
          <path d="M 40 10 L 48 16 L 40 22" fill="#10b981" />
          <text x="21" y="38" fill="#047857" fontSize="9.5" fontWeight="900" textAnchor="middle">EXPRESS 2X</text>
        </g>

        <rect x="230" y="0" width="110" height="80" rx="8" fill="#ffffff" stroke="#a7f3d0" strokeWidth="1.5" />
        <rect x="230" y="0" width="110" height="22" rx="6" fill="#065f46" />
        <text x="285" y="15" fill="#ffffff" fontSize="10.5" fontWeight="800" textAnchor="middle">PERIOD 2 (12:30)</text>
        <circle cx="285" cy="44" r="12" fill="#d1fae5" />
        <text x="285" y="48" fill="#047857" fontSize="11.5" fontWeight="900" textAnchor="middle">Dr. Sarah</text>
      </g>

      <rect x="20" y="118" width="340" height="42" rx="8" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5" />
      <text x="34" y="144" fill="#064e3b" fontSize="11.5" fontWeight="800">
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
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a] p-5 text-white shadow-xl border border-amber-500/30">
      <svg className="w-full h-64 sm:h-72 select-none" viewBox="0 0 620 260" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        <rect x="30" y="20" width="560" height="220" rx="12" fill="url(#buildingGrad)" stroke="#475569" strokeWidth="1.8" />
        <text x="50" y="44" fill="#fbbf24" fontSize="13" fontWeight="800" letterSpacing="1">
          FACULTY BUILDING A • ROVING COMMITTEES ARCHITECTURE
        </text>

        {/* ── FLOOR 3 (Top Floor) ── */}
        <g transform="translate(50, 58)">
          <rect x="0" y="0" width="520" height="46" rx="8" fill="#1e293b" stroke="#334155" strokeWidth="1.2" />
          <text x="16" y="28" fill="#cbd5e1" fontSize="13" fontWeight="800">FLOOR 3</text>
          {/* Rooms */}
          <rect x="95" y="8" width="85" height="30" rx="5" fill="#0f172a" stroke="#475569" />
          <text x="137" y="28" fill="#e2e8f0" fontSize="12" fontWeight="700" textAnchor="middle">Room 301</text>
          <rect x="190" y="8" width="85" height="30" rx="5" fill="#0f172a" stroke="#475569" />
          <text x="232" y="28" fill="#e2e8f0" fontSize="12" fontWeight="700" textAnchor="middle">Room 302</text>
          <text x="500" y="28" fill="#94a3b8" fontSize="11" fontWeight="600" textAnchor="end">Out of single-supervisor radius</text>
        </g>

        {/* ── FLOOR 2 (Active Roaming Core) ── */}
        <g transform="translate(50, 114)">
          {/* Active Roaming Zone Highlight */}
          <rect
            x="0"
            y="0"
            width="520"
            height="52"
            rx="8"
            fill="#78350f"
            fillOpacity="0.25"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="5 3"
          />
          <text x="16" y="32" fill="#fbbf24" fontSize="13" fontWeight="900">FLOOR 2</text>
          {/* Rooms */}
          <rect x="95" y="10" width="85" height="32" rx="5" fill="#451a03" stroke="#f59e0b" />
          <text x="137" y="30" fill="#fef3c7" fontSize="12" fontWeight="800" textAnchor="middle">Room 201</text>
          <rect x="190" y="10" width="85" height="32" rx="5" fill="#451a03" stroke="#f59e0b" />
          <text x="232" y="30" fill="#fef3c7" fontSize="12" fontWeight="800" textAnchor="middle">Room 202</text>
          <rect x="285" y="10" width="85" height="32" rx="5" fill="#451a03" stroke="#f59e0b" />
          <text x="327" y="30" fill="#fef3c7" fontSize="12" fontWeight="800" textAnchor="middle">Room 203</text>

          {/* Roving Supervisor Icon walking the floor */}
          <g transform="translate(430, 26)">
            <circle cx="0" cy="0" r="14" fill="url(#roamerActive)" />
            <path d="M -5 -4 L 0 -9 L 5 -4 L 5 4 C 5 8 0 10 0 10 C 0 10 -5 8 -5 4 Z" fill="#000" />
            <rect x="20" y="-12" width="115" height="24" rx="5" fill="#0f172a" stroke="#f59e0b" strokeWidth="1.2" />
            <text x="77" y="4" fill="#fef3c7" fontSize="10.5" fontWeight="900" textAnchor="middle">
              ROAMER #1 ZONE
            </text>
          </g>
        </g>

        {/* ── FLOOR 1 (Ground Floor) ── */}
        <g transform="translate(50, 176)">
          <rect
            x="0"
            y="0"
            width="520"
            height="46"
            rx="8"
            fill={maxFloors >= 2 ? '#78350f' : '#1e293b'}
            fillOpacity={maxFloors >= 2 ? 0.15 : 1}
            stroke={maxFloors >= 2 ? '#f59e0b' : '#334155'}
            strokeWidth={1.2}
            strokeDasharray={maxFloors >= 2 ? '4 3' : 'none'}
          />
          <text x="16" y="28" fill={maxFloors >= 2 ? '#fbbf24' : '#cbd5e1'} fontSize="13" fontWeight="800">FLOOR 1</text>
          <rect x="95" y="8" width="85" height="30" rx="5" fill="#0f172a" stroke="#475569" />
          <text x="137" y="28" fill="#e2e8f0" fontSize="12" fontWeight="700" textAnchor="middle">Room 101</text>
          <text x="500" y="28" fill="#f59e0b" fontSize="11" fontWeight="700" textAnchor="end">
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
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#022c22] via-[#064e3b] to-[#022c22] p-5 text-white shadow-xl border border-emerald-500/30">
      <svg className="w-full h-64 select-none" viewBox="0 0 640 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Left: Active Halls Container */}
        <g transform="translate(25, 20)">
          <rect x="0" y="0" width="245" height="200" rx="12" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
          <rect x="0" y="0" width="245" height="34" rx="10" fill="#047857" />
          <text x="122" y="22" fill="#ffffff" fontSize="12" fontWeight="900" textAnchor="middle">
            ACTIVE EXAM ROOMS
          </text>

          {/* Active room 1 */}
          <rect x="15" y="48" width="215" height="60" rx="8" fill="#022c22" stroke="#059669" strokeWidth="1.2" />
          <text x="25" y="72" fill="#a7f3d0" fontSize="12" fontWeight="800">Exam Hall A (60 Students)</text>
          <text x="25" y="94" fill="#6ee7b7" fontSize="11" fontWeight="600">1 Head Supervisor • 3 Invigilators</text>

          {/* Active room 2 */}
          <rect x="15" y="122" width="215" height="60" rx="8" fill="#022c22" stroke="#059669" strokeWidth="1.2" />
          <text x="25" y="146" fill="#a7f3d0" fontSize="12" fontWeight="800">Exam Hall B (40 Students)</text>
          <text x="25" y="168" fill="#6ee7b7" fontSize="11" fontWeight="600">1 Head Supervisor • 2 Invigilators</text>
        </g>

        {/* Center: Rapid Dispatch Bridge */}
        <g transform="translate(285, 95)">
          <path d="M 0 20 L 45 20" stroke="#34d399" strokeWidth="3" strokeDasharray="5 4" />
          <path d="M 43 14 L 54 20 L 43 26" fill="#34d399" />
          <text x="26" y="44" fill="#6ee7b7" fontSize="10.5" fontWeight="900" textAnchor="middle">DISPATCH</text>
          <text x="26" y="58" fill="#a7f3d0" fontSize="9" fontWeight="600" textAnchor="middle">Instant relief</text>
        </g>

        {/* Right: Standby Reserve Lounge */}
        <g transform="translate(350, 20)">
          <rect x="0" y="0" width="265" height="200" rx="12" fill="#064e3b" stroke="#34d399" strokeWidth="1.8" />
          <rect x="0" y="0" width="265" height="34" rx="10" fill="#10b981" />
          <text x="132" y="22" fill="#064e3b" fontSize="12" fontWeight="900" textAnchor="middle">
            STANDBY RESERVE LOUNGE
          </text>

          {/* Supervisor Shields */}
          <g transform="translate(20, 48)">
            <rect x="0" y="0" width="105" height="62" rx="8" fill="#022c22" stroke="#34d399" strokeWidth="1.2" />
            <text x="52" y="28" fill="#34d399" fontSize="24" fontWeight="900" textAnchor="middle">
              {supervisorsTarget}
            </text>
            <text x="52" y="48" fill="#d1fae5" fontSize="10" fontWeight="800" textAnchor="middle">
              Head Supervisors
            </text>
          </g>

          {/* Invigilator Shields */}
          <g transform="translate(140, 48)">
            <rect x="0" y="0" width="105" height="62" rx="8" fill="#022c22" stroke="#34d399" strokeWidth="1.2" />
            <text x="52" y="28" fill="#facc15" fontSize="24" fontWeight="900" textAnchor="middle">
              {assistantsTarget}
            </text>
            <text x="52" y="48" fill="#fef08a" fontSize="10" fontWeight="800" textAnchor="middle">
              Invigilators
            </text>
          </g>

          {/* Chemist Afternoon Protection Badge */}
          <g transform="translate(20, 122)">
            <rect
              x="0"
              y="0"
              width="225"
              height="60"
              rx="8"
              fill={deprioritizeChemistsP2 ? '#022c22' : '#047857'}
              stroke="#34d399"
              strokeWidth={1.5}
            />
            {/* Flask icon */}
            <path d="M 24 18 L 30 18 L 30 25 L 40 40 L 14 40 L 24 25 Z" fill="#34d399" />
            <text x="50" y="32" fill="#ffffff" fontSize="11" fontWeight="800">
              {deprioritizeChemistsP2 ? 'Chemist P2 Shield: ACTIVE' : 'Chemist P2 Shield: OFF'}
            </text>
            <text x="50" y="48" fill="#a7f3d0" fontSize="9.5" fontWeight="600">
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
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#18181b] via-[#27272a] to-[#18181b] p-5 text-white shadow-xl border border-zinc-700">
      <svg className="w-full h-48 select-none" viewBox="0 0 620 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="beamGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>

        <text x="30" y="30" fill="#f43f5e" fontSize="13" fontWeight="800" letterSpacing="0.8">
          WORKLOAD SPREAD BALANCE • FAIRNESS CEILING GUARANTEE
        </text>

        {/* Base Track */}
        <rect x="40" y="80" width="540" height="16" rx="8" fill="#3f3f46" stroke="#52525b" strokeWidth="1.2" />
        <rect x="42" y="82" width="536" height="12" rx="6" fill="url(#beamGrad)" fillOpacity="0.9" />

        {/* Low Workload Mark */}
        <g transform="translate(80, 58)">
          <circle cx="0" cy="30" r="6" fill="#10b981" />
          <text x="0" y="0" fill="#a7f3d0" fontSize="10.5" fontWeight="800" textAnchor="middle">MIN SHIFTS</text>
          <text x="0" y="14" fill="#6ee7b7" fontSize="9.5" fontWeight="600" textAnchor="middle">(Prioritized)</text>
        </g>

        {/* Center / Average Pivot Pin */}
        <g transform="translate(310, 44)">
          <rect x="-55" y="-18" width="110" height="28" rx="6" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.2" />
          <text x="0" y="1" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
            FACULTY AVG: {avg.toFixed(1)}
          </text>
          {/* Pointer needle */}
          <polygon points="0,14 -6,40 6,40" fill="#60a5fa" />
        </g>

        {/* Hard Delta Ceiling Lockout */}
        <g transform="translate(490, 40)">
          <rect x="-65" y="-16" width="130" height="34" rx="6" fill="#991b1b" stroke="#f87171" strokeWidth="1.5" />
          <text x="0" y="0" fill="#fee2e2" fontSize="10.5" fontWeight="900" textAnchor="middle">
            DELTA CEILING (+{maxDelta})
          </text>
          <text x="0" y="12" fill="#fca5a5" fontSize="9" fontWeight="800" textAnchor="middle">
            HARD LOCKOUT AT {ceiling.toFixed(1)}
          </text>
          {/* Stop wall line */}
          <line x1="0" y1="22" x2="0" y2="58" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
        </g>

        {/* Explanatory footer */}
        <text x="310" y="146" fill="#cbd5e1" fontSize="11" fontWeight="600" textAnchor="middle">
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
    <div className="w-full relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#091e3a] via-[#102a4e] to-[#091e3a] p-5 text-white shadow-xl border border-blue-500/30">
      <svg className="w-full h-40 select-none" viewBox="0 0 620 150" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="25" y="24" fill="#93c5fd" fontSize="13" fontWeight="800" letterSpacing="0.8">
          AUTOMATED ORAL EXAM INTAKE PIPELINE
        </text>

        {/* Input sessions */}
        <g transform="translate(30, 48)">
          <rect x="0" y="0" width="140" height="38" rx="8" fill="#1e293b" stroke="#3b82f6" strokeWidth="1.2" />
          <text x="70" y="24" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
            Written Sessions (Halls)
          </text>
        </g>

        <g transform="translate(30, 96)">
          <rect x="0" y="0" width="140" height="38" rx="8" fill="#1e293b" stroke="#f59e0b" strokeWidth="1.2" />
          <text x="70" y="24" fill="#fef3c7" fontSize="11" fontWeight="800" textAnchor="middle">
            Oral Sessions (Clinics)
          </text>
        </g>

        {/* Engine Funnel */}
        {mode === 'combined' ? (
          <g transform="translate(190, 48)">
            <path d="M 0 18 L 65 43 L 0 68 Z" fill="#2563eb" fillOpacity="0.45" stroke="#60a5fa" strokeWidth="1.8" />
            <text x="25" y="47" fill="#ffffff" fontSize="10.5" fontWeight="900" textAnchor="middle">MERGE</text>
            {/* Unified Output */}
            <rect x="85" y="16" width="310" height="54" rx="10" fill="#1e40af" stroke="#93c5fd" strokeWidth="2" />
            <text x="240" y="40" fill="#ffffff" fontSize="12" fontWeight="900" textAnchor="middle">
              UNIFIED ENGINE PASS (Written + Oral Synchronized)
            </text>
            <text x="240" y="56" fill="#bfdbfe" fontSize="9.5" fontWeight="600" textAnchor="middle">
              Staff shifts &amp; rest gaps evaluated holistically across both exam formats
            </text>
          </g>
        ) : mode === 'separate' ? (
          <g transform="translate(190, 48)">
            <rect x="20" y="0" width="180" height="38" rx="8" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.5" />
            <text x="110" y="24" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
              Pass 1: Written Exams Pass
            </text>

            <path d="M 205 19 L 235 19 L 235 67 L 255 67" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" />

            <rect x="260" y="48" width="160" height="38" rx="8" fill="#78350f" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="340" y="72" fill="#fef3c7" fontSize="11" fontWeight="800" textAnchor="middle">
              Pass 2: Dedicated Oral Pass
            </text>
          </g>
        ) : (
          <g transform="translate(200, 48)">
            <rect x="20" y="0" width="190" height="38" rx="8" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.5" />
            <text x="115" y="24" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
              Pass: Written Exams Only
            </text>

            <path d="M 0 67 L 120 67" stroke="#ef4444" strokeWidth="2.5" strokeDasharray="4 3" />
            <text x="135" y="72" fill="#ef4444" fontSize="11.5" fontWeight="900">
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
    <div className="w-full relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white border border-slate-700 shadow-md">
      <svg className="w-full h-28 select-none" viewBox="0 0 560 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="20" y="18" fill="#cbd5e1" fontSize="11.5" fontWeight="800" letterSpacing="0.8">
          FACULTY ROLE-BASED INTAKE FILTER
        </text>

        {/* Lane 1: Teaching Assistants -> Exam Supervisors */}
        <g transform="translate(20, 32)">
          <rect x="0" y="0" width="160" height="28" rx="6" fill="#1e3a8a" stroke="#60a5fa" strokeWidth="1.2" />
          <text x="80" y="18" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
            Teaching Assistants (TAs)
          </text>

          <path d="M 165 14 L 215 14" stroke="#60a5fa" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M 212 10 L 221 14 L 212 18" fill="#60a5fa" />

          <rect x="225" y="0" width="170" height="28" rx="6" fill="#0f172a" stroke="#93c5fd" strokeWidth="1.2" />
          <text x="310" y="18" fill="#93c5fd" fontSize="11.5" fontWeight="900" textAnchor="middle">
            🛡️ Head Exam Supervisor
          </text>
        </g>

        {/* Lane 2: Demonstrators/Chemists -> Hall Invigilators */}
        <g transform="translate(20, 66)">
          <rect x="0" y="0" width="160" height="28" rx="6" fill="#78350f" stroke="#f59e0b" strokeWidth="1.2" />
          <text x="80" y="18" fill="#ffffff" fontSize="11" fontWeight="800" textAnchor="middle">
            Demonstrators &amp; Chemists
          </text>

          <path d="M 165 14 L 215 14" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M 212 10 L 221 14 L 212 18" fill="#f59e0b" />

          <rect x="225" y="0" width="170" height="28" rx="6" fill="#0f172a" stroke="#fde68a" strokeWidth="1.2" />
          <text x="310" y="18" fill="#fde68a" fontSize="11.5" fontWeight="900" textAnchor="middle">
            👥 Hall Invigilator
          </text>
        </g>

        {/* Status Tag on right */}
        <g transform="translate(420, 32)">
          <rect
            x="0"
            y="0"
            width="125"
            height="56"
            rx="10"
            fill={enabled ? '#064e3b' : '#3f3f46'}
            stroke={enabled ? '#10b981' : '#71717a'}
            strokeWidth={1.8}
          />
          <text x="62" y="24" fill="#ffffff" fontSize="11.5" fontWeight="900" textAnchor="middle">
            {enabled ? 'STRICT LOCK' : 'FLEXIBLE'}
          </text>
          <text x="62" y="42" fill={enabled ? '#a7f3d0' : '#d4d4d8'} fontSize="10" fontWeight="700" textAnchor="middle">
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
    <div className="w-full relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white border border-slate-700 shadow-md">
      <svg className="w-full h-36 select-none" viewBox="0 0 560 135" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="20" y="20" fill="#cbd5e1" fontSize="11.5" fontWeight="800" letterSpacing="0.8">
          WEEKLY CONTRACT HOURS COMPARISON GAUGE
        </text>

        {/* Full-Time Bar */}
        <g transform="translate(20, 36)">
          <text x="0" y="14" fill="#93c5fd" fontSize="11.5" fontWeight="800">Full-Time (FT)</text>
          <rect x="100" y="2" width="300" height="16" rx="8" fill="#1e293b" />
          <rect x="100" y="2" width={Math.min(300, (ftHours / maxScale) * 300)} height="16" rx="8" fill="#3b82f6" />
          <text x="415" y="14" fill="#ffffff" fontSize="11.5" fontWeight="900">{ftHours} hrs/wk</text>
          <text x="490" y="14" fill="#94a3b8" fontSize="10" fontWeight="600">(~{Math.round(ftHours / 2)} slots)</text>
        </g>

        {/* Part-Time Bar */}
        <g transform="translate(20, 68)">
          <text x="0" y="14" fill="#fde68a" fontSize="11.5" fontWeight="800">Part-Time (PT)</text>
          <rect x="100" y="2" width="300" height="16" rx="8" fill="#1e293b" />
          <rect x="100" y="2" width={Math.min(300, (ptHours / maxScale) * 300)} height="16" rx="8" fill="#f59e0b" />
          <text x="415" y="14" fill="#ffffff" fontSize="11.5" fontWeight="900">{ptHours} hrs/wk</text>
          <text x="490" y="14" fill="#94a3b8" fontSize="10" fontWeight="600">(~{Math.round(ptHours / 2)} slots)</text>
        </g>

        {/* Chemists Bar */}
        <g transform="translate(20, 100)">
          <text x="0" y="14" fill="#a7f3d0" fontSize="11.5" fontWeight="800">Chemists (Lab)</text>
          <rect x="100" y="2" width="300" height="16" rx="8" fill="#1e293b" />
          <rect x="100" y="2" width={Math.min(300, (chemistHours / maxScale) * 300)} height="16" rx="8" fill="#10b981" />
          <text x="415" y="14" fill="#ffffff" fontSize="11.5" fontWeight="900">{chemistHours} hrs/wk</text>
          <text x="490" y="14" fill="#94a3b8" fontSize="10" fontWeight="600">(~{Math.round(chemistHours / 2)} slots)</text>
        </g>
      </svg>
    </div>
  );
}

// ============================================================================
// 10. CALENDAR RULES & DATE OVERRIDES SVG
// ============================================================================
export function CalendarRuleVisualSvg({
  startDate,
  endDate,
  isUniversalWorkingDay,
  applyCustomRatios,
}: {
  startDate?: string;
  endDate?: string;
  isUniversalWorkingDay?: boolean;
  applyCustomRatios?: boolean;
}) {
  return (
    <div className="w-full relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white border border-indigo-900/50 shadow-md">
      <svg className="w-full h-28 select-none" viewBox="0 0 560 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="20" y="18" fill="#a5b4fc" fontSize="11.5" fontWeight="800" letterSpacing="0.8">
          CALENDAR OVERRIDE TIMELINE ENGINE
        </text>

        {/* Date Window Ribbon */}
        <g transform="translate(20, 30)">
          <rect x="0" y="0" width="195" height="48" rx="8" fill="#1e1b4b" stroke="#6366f1" strokeWidth="1.2" />
          <text x="14" y="20" fill="#c7d2fe" fontSize="10" fontWeight="700">DATE OVERRIDE WINDOW</text>
          <text x="14" y="38" fill="#ffffff" fontSize="12" fontWeight="900">
            {startDate ? `${startDate} → ${endDate || startDate}` : 'Selected Exam Dates'}
          </text>
        </g>

        {/* Transition Arrows */}
        <path d="M 225 54 L 255 54" stroke="#6366f1" strokeWidth="2.5" strokeDasharray="4 3" />
        <path d="M 252 49 L 262 54 L 252 59" fill="#6366f1" />

        {/* Effects Tags */}
        <g transform="translate(270, 30)">
          <rect
            x="0"
            y="0"
            width="130"
            height="48"
            rx="8"
            fill={isUniversalWorkingDay ? '#064e3b' : '#1e293b'}
            stroke={isUniversalWorkingDay ? '#10b981' : '#475569'}
            strokeWidth={1.2}
          />
          <text x="12" y="20" fill={isUniversalWorkingDay ? '#a7f3d0' : '#cbd5e1'} fontSize="9.5" fontWeight="700">
            AVAILABILITY EFFECT
          </text>
          <text x="12" y="38" fill="#ffffff" fontSize="11.5" fontWeight="900">
            {isUniversalWorkingDay ? '⚡ 100% Mobilized' : 'Normal Staff Days'}
          </text>
        </g>

        <g transform="translate(410, 30)">
          <rect
            x="0"
            y="0"
            width="130"
            height="48"
            rx="8"
            fill={applyCustomRatios ? '#78350f' : '#1e293b'}
            stroke={applyCustomRatios ? '#f59e0b' : '#475569'}
            strokeWidth={1.2}
          />
          <text x="12" y="20" fill={applyCustomRatios ? '#fde68a' : '#cbd5e1'} fontSize="9.5" fontWeight="700">
            RATIO EFFECT
          </text>
          <text x="12" y="38" fill="#ffffff" fontSize="11.5" fontWeight="900">
            {applyCustomRatios ? '🛡️ Custom Ratios' : 'Standard Tiers'}
          </text>
        </g>
      </svg>
    </div>
  );
}
