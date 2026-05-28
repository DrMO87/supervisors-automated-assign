'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Staff } from '@/types/database.types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  staff: Staff | null;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
}

export function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  staff, 
  onConfirm, 
  isLoading 
}: DeleteConfirmModalProps) {
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
              <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-red-100 rounded-full">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                    Delete Staff Member
                  </Dialog.Title>
                </div>

                <p className="text-gray-600 mb-6">
                  Are you sure you want to delete <strong>{staff?.name}</strong>? 
                  This action cannot be undone. Any existing assignments for this 
                  staff member will also be removed.
                </p>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={onClose}
                    className="btn btn-secondary px-4 py-2"
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onConfirm}
                    className="btn btn-danger px-4 py-2"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
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

