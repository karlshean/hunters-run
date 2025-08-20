import React, { useEffect } from 'react';

export interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export function Toast({ type, title, message, isVisible, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const getToastStyles = () => {
    const baseStyles = "fixed top-4 right-4 max-w-md p-4 rounded-lg shadow-lg z-50 transform transition-all duration-300 ease-in-out";
    
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 border border-green-200 text-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50 border border-red-200 text-red-800`;
      case 'warning':
        return `${baseStyles} bg-yellow-50 border border-yellow-200 text-yellow-800`;
      case 'info':
        return `${baseStyles} bg-blue-50 border border-blue-200 text-blue-800`;
      default:
        return `${baseStyles} bg-gray-50 border border-gray-200 text-gray-800`;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className={`${getToastStyles()} ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <p className="font-semibold text-sm">
            {title}
          </p>
          <p className="text-sm mt-1">
            {message}
          </p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            className="rounded-md inline-flex text-current hover:opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2"
            onClick={onClose}
          >
            <span className="sr-only">Close</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = React.useState<{
    isVisible: boolean;
    type: ToastProps['type'];
    title: string;
    message: string;
  }>({
    isVisible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const showToast = React.useCallback(
    (type: ToastProps['type'], title: string, message: string) => {
      setToast({ isVisible: true, type, title, message });
    },
    []
  );

  const hideToast = React.useCallback(() => {
    setToast(prev => ({ ...prev, isVisible: false }));
  }, []);

  const showSuccess = React.useCallback((title: string, message: string) => {
    showToast('success', title, message);
  }, [showToast]);

  const showError = React.useCallback((title: string, message: string) => {
    showToast('error', title, message);
  }, [showToast]);

  const showWarning = React.useCallback((title: string, message: string) => {
    showToast('warning', title, message);
  }, [showToast]);

  const showInfo = React.useCallback((title: string, message: string) => {
    showToast('info', title, message);
  }, [showToast]);

  const ToastComponent = React.useCallback(() => (
    <Toast
      type={toast.type}
      title={toast.title}
      message={toast.message}
      isVisible={toast.isVisible}
      onClose={hideToast}
    />
  ), [toast, hideToast]);

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    hideToast,
    ToastComponent,
  };
}