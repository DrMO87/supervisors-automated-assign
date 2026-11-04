'use client';

import React from 'react';
import { 
  X, CheckCircle2, AlertTriangle, AlertCircle, Users, Shield, 
  Calendar, Building2, Check, Info, Sparkles, Scale, BookOpen, Layers
} from 'lucide-react';

export interface ScheduleHealthDiagnostics {
  healthScore: number;
  totalSessions: number;
  fullyStaffedSessions: number;
  needsStaffSessions: number;
  sessionsWithConflicts: number;
  totalConflicts: number;
  activeStaffCount: number;
  totalAvailableStaff: number;
  staffUtilization: number;
  actualAssignments: number;
  totalAssignmentsNeeded: number;
  roleBreakdown: {
    examSupervisors: number;
    committeesSupervisors: number;
    assistants: number;
  };
  comments: Array<{
    type: 'success' | 'warning' | 'info';
    title: string;
    description: string;
  }>;
}

interface ScheduleHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: ScheduleHealthDiagnostics;
}

export function ScheduleHealthModal({ isOpen, onClose, diagnostics }: ScheduleHealthModalProps) {
  if (!isOpen) return null;

  const isPerfect = diagnostics.healthScore === 100;
  const isGood = diagnostics.healthScore >= 90;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#00122e] via-[#001f4d] to-[#1527a0] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              isPerfect 
                ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' 
                : isGood 
                  ? 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                  : 'bg-red-500/20 border-red-400/30 text-red-300'
            }`}>
              {isPerfect ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-display font-bold">Schedule Health &amp; Audit Report</h2>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  isPerfect 
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' 
                    : isGood 
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' 
                      : 'bg-red-400/20 text-red-300 border border-red-400/30'
                }`}>
                  {diagnostics.healthScore}% {isPerfect ? 'Optimal' : isGood ? 'Good' : 'Needs Review'}
                </span>
              </div>
              <p className="text-xs text-white/70 mt-0.5">
                Comprehensive quality audit across staffing quotas, conflict clearance, and peer fairness
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Hero Health Banner */}
          <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
            isPerfect
              ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
              : isGood
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-red-50 border-red-200 text-red-950'
          }`}>
            <div className={`p-2 rounded-lg shrink-0 ${
              isPerfect ? 'bg-emerald-100 text-emerald-700' : isGood ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            }`}>
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">
                {isPerfect 
                  ? 'Schedule is in Excellent Health (100%)' 
                  : `Schedule Health Score: ${diagnostics.healthScore}%`}
              </h3>
              <p className="text-xs mt-0.5 leading-relaxed opacity-90">
                {isPerfect 
                  ? `All ${diagnostics.totalSessions} scheduled exam sessions are fully staffed according to university regulations, with 0 room deficiencies and 0 scheduling conflicts.` 
                  : `${diagnostics.needsStaffSessions > 0 ? `${diagnostics.needsStaffSessions} exam sessions require additional staff. ` : ''}${diagnostics.sessionsWithConflicts > 0 ? `${diagnostics.sessionsWithConflicts} sessions have active conflicts that need resolution.` : ''}`}
              </p>
            </div>
          </div>

          {/* 4 Key Pillars Grid */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary-600" />
              Core Health Pillars
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* 1. Staffing Coverage */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Room Staffing</span>
                  <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {diagnostics.fullyStaffedSessions} <span className="text-xs font-normal text-slate-400">/ {diagnostics.totalSessions}</span>
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  {diagnostics.needsStaffSessions === 0 ? '100% Fully Staffed' : `${diagnostics.needsStaffSessions} Need Staff`}
                </div>
              </div>

              {/* 2. Conflicts */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Conflicts</span>
                  <AlertTriangle className={`w-3.5 h-3.5 ${diagnostics.sessionsWithConflicts > 0 ? 'text-red-500' : 'text-slate-400'}`} />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {diagnostics.sessionsWithConflicts}
                </div>
                <div className={`text-[11px] font-semibold mt-0.5 flex items-center gap-1 ${
                  diagnostics.sessionsWithConflicts === 0 ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {diagnostics.sessionsWithConflicts === 0 ? (
                    <>
                      <Check className="w-3 h-3" />
                      Conflict-Free
                    </>
                  ) : (
                    'Action Required'
                  )}
                </div>
              </div>

              {/* 3. Staff Utilization */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Staff Active</span>
                  <Users className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {diagnostics.activeStaffCount} <span className="text-xs font-normal text-slate-400">/ {diagnostics.totalAvailableStaff}</span>
                </div>
                <div className="text-[11px] font-semibold text-blue-600 mt-0.5">
                  {diagnostics.staffUtilization}% Participating
                </div>
              </div>

              {/* 4. Assignments Total */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Assignments</span>
                  <Layers className="w-3.5 h-3.5 text-purple-500" />
                </div>
                <div className="text-lg font-bold text-slate-900">
                  {diagnostics.actualAssignments}
                </div>
                <div className="text-[11px] font-semibold text-slate-600 mt-0.5">
                  Target: {diagnostics.totalAssignmentsNeeded}
                </div>
              </div>
            </div>
          </div>

          {/* Role Fulfillment Breakdown */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Supervisory Role Fulfillment</span>
              <span className="text-[11px] text-slate-400 font-normal lowercase">all roles active</span>
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Exam Supervisors */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Exam Supervisors</span>
                  <span className="text-emerald-700 bg-emerald-100 font-bold px-1.5 py-0.2 rounded text-[10px]">Active</span>
                </div>
                <p className="text-lg font-bold text-slate-900">{diagnostics.roleBreakdown.examSupervisors}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Assigned to individual rooms</p>
              </div>

              {/* Committee Supervisors */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Committee Supervisors</span>
                  <span className="text-emerald-700 bg-emerald-100 font-bold px-1.5 py-0.2 rounded text-[10px]">Active</span>
                </div>
                <p className="text-lg font-bold text-slate-900">{diagnostics.roleBreakdown.committeesSupervisors}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Overseeing building corridors</p>
              </div>

              {/* Invigilators / Assistants */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700">Invigilators (Assistants)</span>
                  <span className="text-emerald-700 bg-emerald-100 font-bold px-1.5 py-0.2 rounded text-[10px]">Active</span>
                </div>
                <p className="text-lg font-bold text-slate-900">{diagnostics.roleBreakdown.assistants}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Based on student capacity ratios</p>
              </div>
            </div>
          </div>

          {/* Audit Comments & Diagnostics Details */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-primary-600" />
              Audit Comments &amp; Quality Checks ({diagnostics.comments.length})
            </h4>

            <div className="space-y-2.5">
              {diagnostics.comments.map((comment, idx) => (
                <div 
                  key={idx} 
                  className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                    comment.type === 'success' 
                      ? 'bg-emerald-50/60 border-emerald-200/80 text-emerald-900' 
                      : comment.type === 'warning'
                        ? 'bg-amber-50/60 border-amber-200/80 text-amber-900'
                        : 'bg-blue-50/60 border-blue-200/80 text-blue-900'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {comment.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {comment.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                    {comment.type === 'info' && <Info className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div>
                    <span className="font-bold block">{comment.title}</span>
                    <span className="text-[11px] opacity-90 leading-relaxed block mt-0.5">{comment.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Health updates automatically when assignments, rooms, or rules change.
          </p>
          <button
            onClick={onClose}
            className="btn btn-primary px-5 py-2 text-xs font-bold rounded-xl"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
