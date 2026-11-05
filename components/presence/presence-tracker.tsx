'use client';

import React from 'react';
import { usePresence } from '@/lib/hooks/use-presence';
import { OnlineUsersModal } from './online-users-modal';

export function PresenceTracker() {
  const { isModalOpen, setIsModalOpen } = usePresence();

  return (
    <>
      <OnlineUsersModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
