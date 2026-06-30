'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import type { DocumentRequirement } from '@/modules/pathways/types';
import { completeStep } from '@/app/applications/actions';
import { DocumentUploadModal } from '../modals/DocumentUploadModal';

interface Props {
  document: DocumentRequirement;
  applicationId: string;
  stepId: string;
}

/** Upload CTA for a document_upload step — triggers DocumentUploadModal on click. */
export function DocumentUploadStep({ document, applicationId, stepId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isUploaded, setIsUploaded] = useState(document.satisfied ?? false);

  return (
    <div>
      {/* Document info row */}
      <div
        className="flex items-start gap-3 rounded-card border border-border-light bg-bg-subtle p-4"
      >
        <div
          className="flex items-center justify-center rounded-icon bg-accent-50 flex-shrink-0"
          style={{ width: 40, height: 40 }}
        >
          <FileText size={18} className="text-accent-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-text-primary font-semibold" style={{ fontSize: '14px' }}>
            {document.name}
          </p>
          <p className="text-text-tertiary mt-0.5" style={{ fontSize: '12px' }}>
            {document.accepted_formats.join(', ')} · Max {document.max_size_mb} MB
            {document.validity_period && ` · Valid for ${document.validity_period}`}
          </p>
        </div>
        <span className={`badge flex-shrink-0 ${isUploaded ? 'badge-success' : 'badge-warning'}`}>
          {isUploaded ? 'Uploaded' : 'Required'}
        </span>
      </div>

      {/* CTA */}
      <div className="mt-4">
        {isUploaded ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="btn-secondary"
              style={{ fontSize: '13px' }}
            >
              Replace document
            </button>
            <p className="text-text-tertiary" style={{ fontSize: '12px' }}>
              ✓ {document.name} uploaded
            </p>
          </div>
        ) : (
          <button
            onClick={() => setModalOpen(true)}
            className="btn-primary"
            style={{ fontSize: '14px' }}
          >
            Upload {document.name} →
          </button>
        )}
      </div>

      {modalOpen && (
        <DocumentUploadModal
          document={document}
          onClose={() => setModalOpen(false)}
          onSuccess={async () => {
            setIsUploaded(true);
            setModalOpen(false);
            await completeStep(applicationId, stepId);
          }}
        />
      )}
    </div>
  );
}
