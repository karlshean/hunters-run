import React, { useState, useEffect } from 'react';

interface AuditVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrderId: string;
  ticketId?: string;
}

interface AuditVerification {
  valid: boolean;
  eventsCount: number;
  headHash: string;
}

export function AuditVerifyModal({ isOpen, onClose, workOrderId, ticketId }: AuditVerifyModalProps) {
  const [verification, setVerification] = useState<AuditVerification | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && workOrderId) {
      verifyAudit();
    }
  }, [isOpen, workOrderId]);

  const verifyAudit = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/maintenance/work-orders/${workOrderId}/audit/validate`, {
        headers: {
          'x-org-id': '00000000-0000-4000-8000-000000000001'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to verify audit');
      }
      
      const data = await response.json();
      setVerification(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAuditLog = () => {
    const auditUrl = `/api/audit/entity/work_order/${workOrderId}?x-org-id=00000000-0000-4000-8000-000000000001`;
    window.open(auditUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 audit-modal">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Audit Verification
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {ticketId && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Ticket ID:</span> {ticketId}
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Verifying audit chain...</span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <span className="text-red-600 text-2xl mr-2">❌</span>
              <div>
                <p className="text-red-800 font-medium">Verification Failed</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {verification && (
          <div className="space-y-4">
            {/* Verification Status */}
            <div className={`p-4 rounded-lg border ${
              verification.valid 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center">
                <span className="text-2xl mr-3">
                  {verification.valid ? '✅' : '❌'}
                </span>
                <div>
                  <p className={`font-medium ${
                    verification.valid ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {verification.valid ? 'Audit Chain Valid' : 'Audit Chain Invalid'}
                  </p>
                  <p className={`text-sm ${
                    verification.valid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {verification.valid 
                      ? 'All audit events verified successfully' 
                      : 'Audit chain integrity compromised'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Verification Details */}
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">Verification Time</span>
                <span className="text-sm text-gray-600">
                  {new Date().toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">Events Count</span>
                <span className="text-sm text-gray-600">
                  {verification.eventsCount}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-2 border-b border-gray-200">
                <span className="text-sm font-medium text-gray-700">Head Hash</span>
                <span className="text-sm text-gray-600 font-mono">
                  {verification.headHash.substring(0, 10)}...
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleViewAuditLog}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Audit Log
              </button>
              <button
                onClick={verifyAudit}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Re-verify
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 text-sm font-medium hover:text-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}