import { createContext, useContext, type ReactNode } from 'react';
import toast from 'react-hot-toast';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const showToast = (
    type: ToastType,
    title: string,
    message?: string,
    duration: number = 4000
  ) => {
    const content = message ? `${title}\n${message}` : title;
    
    switch (type) {
      case 'success':
        toast.success(content, { duration });
        break;
      case 'error':
        toast.error(content, { duration });
        break;
      case 'info':
        toast(content, { duration });
        break;
    }
  };

  const success = (title: string, message?: string, duration?: number) => {
    showToast('success', title, message, duration);
  };

  const error = (title: string, message?: string, duration?: number) => {
    showToast('error', title, message, duration);
  };

  const info = (title: string, message?: string, duration?: number) => {
    showToast('info', title, message, duration);
  };

  return (
    <ToastContext.Provider value={{ showToast, success, error, info }}>
      {children}
    </ToastContext.Provider>
  );
}
