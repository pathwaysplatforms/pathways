'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  pathwayId: string;
}

/** Client component: POSTs to /api/pathways/select and redirects on success. */
export function SelectPathwayButton({ pathwayId }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const handleSelect = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/pathways/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathway_id: pathwayId }),
      });
      const data = await res.json() as { application_id?: string; error?: { message: string } };
      if (!res.ok || !data.application_id) {
        throw new Error(data.error?.message ?? 'Failed to select pathway');
      }
      router.push(`/applications/${data.application_id}`);
    } catch (err) {
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleSelect}
        disabled={state === 'loading'}
        className={`btn-primary ${state === 'loading' ? 'opacity-70 cursor-not-allowed' : ''}`}
        style={{ fontSize: '14px' }}
      >
        {state === 'loading' ? 'Selecting…' : 'Select this pathway →'}
      </button>
      {state === 'error' && (
        <p className="text-text-tertiary" style={{ fontSize: '12px', color: '#EF4444' }}>
          {errorMsg}
        </p>
      )}
    </div>
  );
}
