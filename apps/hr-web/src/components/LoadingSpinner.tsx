import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'white' | 'gray';
  className?: string;
}

export function LoadingSpinner({ size = 'md', color = 'blue', className = '' }: LoadingSpinnerProps) {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-4 w-4';
      case 'lg':
        return 'h-8 w-8';
      case 'md':
      default:
        return 'h-6 w-6';
    }
  };

  const getColorClasses = () => {
    switch (color) {
      case 'white':
        return 'text-white';
      case 'gray':
        return 'text-gray-500';
      case 'blue':
      default:
        return 'text-blue-600';
    }
  };

  return (
    <svg
      className={`animate-spin ${getSizeClasses()} ${getColorClasses()} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export interface ButtonSpinnerProps {
  isLoading: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function ButtonWithSpinner({
  isLoading,
  children,
  disabled = false,
  className = '',
  onClick,
  type = 'button',
}: ButtonSpinnerProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center space-x-2 ${
        disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      {isLoading && <LoadingSpinner size="sm" color="white" />}
      <span>{children}</span>
    </button>
  );
}