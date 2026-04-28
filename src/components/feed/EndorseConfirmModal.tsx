import React from 'react';
import { ConfirmModal } from '@/components/ui/Modal';

interface EndorseConfirmModalProps {
  visible: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  /** Single-candidate mode: name shown in the warning */
  candidateName?: string;
  /** Bulk mode: number of candidates to endorse at once. When set, overrides single mode. */
  candidateCount?: number;
  loading?: boolean;
}

export default function EndorseConfirmModal({
  visible,
  onDismiss,
  onConfirm,
  candidateName,
  candidateCount,
  loading = false,
}: EndorseConfirmModalProps) {
  const isBulk = typeof candidateCount === 'number' && candidateCount > 0;

  const title = isBulk
    ? `Endorse ${candidateCount} candidate${candidateCount === 1 ? '' : 's'}?`
    : 'Endorse this candidate?';

  const subject = candidateName ? candidateName : 'this candidate';
  const message = isBulk
    ? `You are about to endorse ${candidateCount} candidates. Endorsements are final for this round of the contest and cannot be undone. Your bookmarks will remain available for future rounds.`
    : `Once you endorse ${subject}, your endorsement is final for this round of the contest and cannot be undone. Save them as a bookmark instead if you want to decide later.`;

  const confirmLabel = isBulk ? `Endorse all ${candidateCount}` : 'Endorse';

  return (
    <ConfirmModal
      visible={visible}
      onDismiss={onDismiss}
      onConfirm={onConfirm}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      cancelLabel="Cancel"
      loading={loading}
    />
  );
}
