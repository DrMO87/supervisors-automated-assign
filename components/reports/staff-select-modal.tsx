'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, User } from 'lucide-react';
import type { Staff } from '@/types/database.types';

interface StaffSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (staff: Staff) => void;
  staff: Staff[];
  title: string;
}

export function StaffSelectModal({ isOpen, onClose, onSelect, staff, title }: StaffSelectModalProps) {
  const [selectedId, setSelectedId] = useState('');

  const handleSubmit = () => {
    const selected = staff.find(s => s.id === selectedId);
    if (selected) {
      onSelect(selected);
      onClose();
      setSelectedId('');
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary-600" />
                    {title}
                  </Dialog.Title>
                  <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="mb-6">
                  <label className="label mb-2 block">Select staff member:</label>
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Choose a staff member...</option>
                    {staff.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.job_title})</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={onClose} className="btn btn-secondary px-4 py-2">Cancel</button>
                  <button onClick={handleSubmit} className="btn btn-primary px-4 py-2" disabled={!selectedId}>
                    Generate Report
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

