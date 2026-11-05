'use client';

import { useMemo } from 'react';
import { X, PersonStanding, Building2, Clock, ArrowRight } from 'lucide-react';
import { ExamSessionWithRelations } from '@/types/database.types';
import { getSessionGapMinutes } from '@/lib/algorithms/auto-assignment';

export interface RunningInstance {
  staffId: string;
  staffName: string;
  staffJob: string;
  fromSession: ExamSessionWithRelations;
  toSession: ExamSessionWithRelations;
  gapMinutes: number;
  fromRoom: string;
  toRoom: string;
  fromBuilding: string;
  toBuilding: string;
  date: string;
  isCrossBuilding: boolean;
}

interface StaffRunningModalProps {
  isOpen: boolean;
  onClose: () => void;
  instances: RunningInstance[];
}

export function StaffRunningModal({ isOpen, onClose, instances }: StaffRunningModalProps) {
  if (!isOpen) return null;

  const crossBuilding = instances.filter(i => i.isCrossBuilding);
  const sameBuilding = instances.filter(i => !i.isCrossBuilding);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-amber-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-xl">
              <PersonStanding className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Staff Running Instances</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Staff assigned to back-to-back sessions in different rooms with no transit gap
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Chips */}
        <div className="flex gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50 flex-wrap">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${instances.length === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            <span className="font-bold text-sm">{instances.length}</span>
            Total Instance{instances.length !== 1 ? 's' : ''}
          </div>
          {crossBuilding.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
              <span className="font-bold text-sm">{crossBuilding.length}</span>
              Cross-Building (Critical)
            </div>
          )}
          {sameBuilding.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              <span className="font-bold text-sm">{sameBuilding.length}</span>
              Same-Building Room Change
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {instances.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 bg-green-100 rounded-full mb-4">
                <PersonStanding className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-base font-bold text-green-800">Zero Running Instances!</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs">
                Every staff member has adequate transit time between consecutive assignments. 
                The auto-assignment rule is working correctly.
              </p>
            </div>
          ) : (
            <>
              {crossBuilding.length > 0 && (
                <div className="mb-1">
                  <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Cross-Building — Requires Immediate Attention
                  </p>
                  <div className="space-y-2">
                    {crossBuilding.map((inst, idx) => (
                      <RunningCard key={idx} instance={inst} />
                    ))}
                  </div>
                </div>
              )}
              {sameBuilding.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Same-Building Room Changes
                  </p>
                  <div className="space-y-2">
                    {sameBuilding.map((inst, idx) => (
                      <RunningCard key={idx} instance={inst} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            {instances.length === 0
              ? '✅ No running instances detected this week.'
              : `ℹ️ A "run" = consecutive sessions with gap ≤ 15 min in different rooms. Resolve manually via the session cards.`}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-semibold hover:bg-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function RunningCard({ instance }: { instance: RunningInstance }) {
  const dateLabel = new Date(`${instance.date}T12:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });

  return (
    <div className={`rounded-xl border p-3.5 ${instance.isCrossBuilding
      ? 'border-red-200 bg-red-50'
      : 'border-amber-200 bg-amber-50'
    }`}>
      {/* Staff name + date */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${instance.isCrossBuilding ? 'bg-red-100' : 'bg-amber-100'}`}>
            <PersonStanding className={`w-3.5 h-3.5 ${instance.isCrossBuilding ? 'text-red-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-900">{instance.staffName}</p>
            <p className="text-[10px] text-gray-500">{instance.staffJob}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            instance.gapMinutes === 0
              ? 'bg-red-200 text-red-800'
              : 'bg-orange-200 text-orange-800'
          }`}>
            {instance.gapMinutes === 0 ? 'Overlap / 0 min gap' : `${instance.gapMinutes} min gap`}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">{dateLabel}</span>
        </div>
      </div>

      {/* From → To rooms */}
      <div className="flex items-center gap-2 text-xs mt-1">
        <div className="flex-1 bg-white/70 rounded-lg p-2 border border-gray-200/60">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">From</p>
          <p className="font-semibold text-gray-800 leading-tight truncate">{instance.fromSession.subject_name}</p>
          <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
            <Building2 className="w-2.5 h-2.5" />
            {instance.fromRoom}
            {instance.fromBuilding && instance.fromBuilding !== 'UNKNOWN' && (
              <span className="text-gray-400">· Bld {instance.fromBuilding}</span>
            )}
          </p>
        </div>
        <ArrowRight className={`w-4 h-4 flex-shrink-0 ${instance.isCrossBuilding ? 'text-red-500' : 'text-amber-500'}`} />
        <div className="flex-1 bg-white/70 rounded-lg p-2 border border-gray-200/60">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider mb-0.5">To</p>
          <p className="font-semibold text-gray-800 leading-tight truncate">{instance.toSession.subject_name}</p>
          <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
            <Building2 className="w-2.5 h-2.5" />
            {instance.toRoom}
            {instance.toBuilding && instance.toBuilding !== 'UNKNOWN' && (
              <span className="text-gray-400">· Bld {instance.toBuilding}</span>
            )}
          </p>
        </div>
      </div>

      {/* Critical badge */}
      {instance.isCrossBuilding && (
        <p className="text-[10px] text-red-700 font-semibold mt-2 flex items-center gap-1">
          ⚠️ Cross-building sprint — staff cannot physically reach this room in time.
        </p>
      )}
    </div>
  );
}
