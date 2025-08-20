import React from 'react';

type Status = 'new' | 'triaged' | 'assigned' | 'in_progress' | 'completed' | 'closed' | 'reopened';

interface StatusChipProps {
  status: Status;
  className?: string;
}

export function StatusChip({ status, className = '' }: StatusChipProps) {
  const getStatusConfig = (status: Status) => {
    switch (status) {
      case 'new':
      case 'triaged':
      case 'reopened':
        return {
          label: status.charAt(0).toUpperCase() + status.slice(1),
          className: 'bg-gray-100 text-gray-800 border-gray-300'
        };
      case 'assigned':
      case 'in_progress':
        return {
          label: status === 'in_progress' ? 'In Progress' : 'Assigned',
          className: 'bg-blue-100 text-blue-800 border-blue-300'
        };
      case 'completed':
      case 'closed':
        return {
          label: status.charAt(0).toUpperCase() + status.slice(1),
          className: 'bg-green-100 text-green-800 border-green-300'
        };
      default:
        return {
          label: status,
          className: 'bg-gray-100 text-gray-800 border-gray-300'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
}