'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { ExamForm } from './exam-form';
import type { ExamSession, ExamSessionFormData, Room } from '@/types/database.types';

interface ExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam?: ExamSession | null;
  rooms: Room[];
  onSubmit: (data: ExamSessionFormData) => Promise<void>;
  isLoading?: boolean;
}

export function ExamModal({ isOpen, onClose, exam, rooms, onSubmit, isLoading }: ExamModalProps) {
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-xl bg-white p-6 shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-gray-900">
                    {exam ? 'Edit Exam Session' : 'Add New Exam Session'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-1 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <ExamForm
                  exam={exam}
                  rooms={rooms}
                  onSubmit={onSubmit}
                  onCancel={onClose}
                  isLoading={isLoading}
                />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

