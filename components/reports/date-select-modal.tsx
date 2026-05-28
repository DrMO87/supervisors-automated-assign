'use client';

import { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X, Calendar } from 'lucide-react';

interface DateSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (date: string) => void;
  title: string;
  availableDates?: string[];
}

export function DateSelectModal({ isOpen, onClose, onSelect, title, availableDates }: DateSelectModalProps) {
  const [selectedDate, setSelectedDate] = useState('');

  const handleSubmit = () => {
    if (selectedDate) {
      onSelect(selectedDate);
      onClose();
      setSelectedDate('');
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
                    <Calendar className="w-5 h-5 text-primary-600" />
                    {title}
                  </Dialog.Title>
                  <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-100">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="mb-6">
                  {availableDates && availableDates.length > 0 ? (
                    <div>
                      <label className="label mb-2 block">Select from available dates:</label>
                      <select
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="input w-full"
                      >
                        <option value="">Choose a date...</option>
                        {availableDates.map(date => (
                          <option key={date} value={date}>{date}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="label mb-2 block">Select date:</label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={onClose} className="btn btn-secondary px-4 py-2">Cancel</button>
                  <button onClick={handleSubmit} className="btn btn-primary px-4 py-2" disabled={!selectedDate}>
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

