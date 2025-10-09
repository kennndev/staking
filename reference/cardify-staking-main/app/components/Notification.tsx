'use client';

import { useState, useEffect } from 'react';

export interface NotificationProps {
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  onClose?: () => void;
}

export default function Notification({ 
  type, 
  title, 
  message, 
  duration = 5000, 
  onClose 
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose?.(), 300); // Wait for animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose?.(), 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return 'ℹ️';
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'from-green-500/20 to-emerald-500/20',
          border: 'border-green-500/50',
          text: 'text-green-300',
          icon: 'text-green-400'
        };
      case 'error':
        return {
          bg: 'from-red-500/20 to-rose-500/20',
          border: 'border-red-500/50',
          text: 'text-red-300',
          icon: 'text-red-400'
        };
      case 'warning':
        return {
          bg: 'from-yellow-500/20 to-orange-500/20',
          border: 'border-yellow-500/50',
          text: 'text-yellow-300',
          icon: 'text-yellow-400'
        };
      case 'info':
        return {
          bg: 'from-blue-500/20 to-cyan-500/20',
          border: 'border-blue-500/50',
          text: 'text-blue-300',
          icon: 'text-blue-400'
        };
      default:
        return {
          bg: 'from-gray-500/20 to-slate-500/20',
          border: 'border-gray-500/50',
          text: 'text-gray-300',
          icon: 'text-gray-400'
        };
    }
  };

  const colors = getColors();

  if (!isVisible) return null;

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm w-full transform transition-all duration-300 ${
      isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
    }`}>
      <div className={`bg-gradient-to-r ${colors.bg} backdrop-blur-sm border ${colors.border} rounded-xl p-4 shadow-2xl`}>
        <div className="flex items-start space-x-3">
          <div className={`text-xl ${colors.icon} flex-shrink-0`}>
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className={`font-semibold text-sm ${colors.text} mb-1`}>
              {title}
            </h4>
            <p className={`text-sm ${colors.text} opacity-90`}>
              {message}
            </p>
          </div>
          <button
            onClick={handleClose}
            className={`${colors.text} hover:opacity-70 transition-opacity flex-shrink-0`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Notification Manager Hook
export function useNotifications() {
  const [notifications, setNotifications] = useState<Array<NotificationProps & { id: string }>>([]);

  const addNotification = (notification: Omit<NotificationProps, 'onClose'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNotification = {
      ...notification,
      id,
      onClose: () => removeNotification(id)
    };
    setNotifications(prev => [...prev, newNotification]);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const showSuccess = (title: string, message: string, duration?: number) => {
    addNotification({ type: 'success', title, message, duration });
  };

  const showError = (title: string, message: string, duration?: number) => {
    addNotification({ type: 'error', title, message, duration });
  };

  const showWarning = (title: string, message: string, duration?: number) => {
    addNotification({ type: 'warning', title, message, duration });
  };

  const showInfo = (title: string, message: string, duration?: number) => {
    addNotification({ type: 'info', title, message, duration });
  };

  return {
    notifications,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    removeNotification
  };
}
