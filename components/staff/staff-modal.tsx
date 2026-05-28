'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { StaffForm } from './staff-form';
import type { Staff, StaffFormData } from '@/types/database.types';

interface StaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff?: Staff | null;
  onSubmit: (data: StaffFormData) => Promise<void>;
  isLoading?: boolean;
  examDates?: string[];
}

export function StaffModal({ isOpen, onClose, staff, onSubmit, isLoading, examDates = [] }: StaffModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                    {staff ? 'Edit Staff Member' : 'Add New Staff Member'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <StaffForm
                  staff={staff}
                  onSubmit={onSubmit}
                  onCancel={onClose}
                  isLoading={isLoading}
                  examDates={examDates}
                />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

