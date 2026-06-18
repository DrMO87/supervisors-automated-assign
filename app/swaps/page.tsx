'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { SwapRequestWithRelations } from '@/types/database.types';
import { Loader2, CheckCircle2, XCircle, Clock, ArrowRight, Calendar as CalendarIcon, User, RefreshCw, ArrowLeft, Download } from 'lucide-react';
import { format } from 'date-fns';
import { exportSwapsToExcel, downloadFile } from '@/lib/utils/csv-helpers';
import { useRouter } from 'next/navigation';

export default function SwapsPage() {
  const [requests, setRequests] = useState<SwapRequestWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();

  const fetchRequests = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('swap_requests')
        .select(`
          *,
          room:rooms(*),
          original_staff:staff!original_staff_id(*),
          replacement_staff:staff!replacement_staff_id(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    setActionLoading(id);
    setError(null);
    try {
      const res = await fetch('/api/assignments/approve-swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id, action })
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      await fetchRequests(); // Refresh the list
    } catch (err: any) {
      setError(err.message);
      // Remove loading state only if error, otherwise refresh handles it
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <button 
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
          <RefreshCw className="w-6 h-6 text-primary-600" />
          Swap Requests
          {pendingCount > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {pendingCount} Pending
            </span>
          )}
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <p className="text-gray-500">Review and manage shift replacement requests from staff.</p>
          {requests.length > 0 && (
            <button
              onClick={() => {
                const blob = exportSwapsToExcel(requests);
                downloadFile(blob, `swaps_export_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-semibold transition-colors border border-gray-300 shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export Swaps (Excel)
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No swap requests found.
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {requests.map(req => (
              <div key={req.id} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                        ${req.status === 'pending' ? 'bg-amber-100 text-amber-800' : 
                          req.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-800'}`}
                      >
                        {req.status === 'pending' && <Clock className="w-3.5 h-3.5" />}
                        {req.status === 'approved' && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {req.status === 'rejected' && <XCircle className="w-3.5 h-3.5" />}
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">
                        Requested on {format(new Date(req.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-700">
                      <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                        <CalendarIcon className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{format(new Date(req.exam_date), 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">Period {req.period}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded">
                        <span className="font-medium">{req.room?.room_name || 'Unknown Room'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-2 p-2 bg-red-50 text-red-900 rounded-lg border border-red-100 min-w-[200px]">
                        <User className="w-4 h-4 text-red-500" />
                        <span className="font-semibold">{req.original_staff?.name || 'Unknown'}</span>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="flex items-center gap-2 p-2 bg-green-50 text-green-900 rounded-lg border border-green-100 min-w-[200px]">
                        <User className="w-4 h-4 text-green-500" />
                        <span className="font-semibold">{req.replacement_staff?.name || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 md:flex-col md:items-end">
                      <button
                        onClick={() => handleAction(req.id, 'approve')}
                        disabled={actionLoading === req.id}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'reject')}
                        disabled={actionLoading === req.id}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading === req.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Reject
                      </button>
                    </div>
                  )}
                  {req.resolved_at && (
                    <div className="text-xs text-gray-400 text-right">
                      Resolved {format(new Date(req.resolved_at), 'MMM d, h:mm a')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
