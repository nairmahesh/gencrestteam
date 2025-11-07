import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface NotificationProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Notification: React.FC<NotificationProps> = ({
  message,
  type,
  onClose,
  duration = 3000
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const bgColor = type === 'success' ? 'bg-green-50 border-green-500' : type === 'error' ? 'bg-red-50 border-red-500' : 'bg-blue-50 border-blue-500';
  const textColor = type === 'success' ? 'text-green-800' : type === 'error' ? 'text-red-800' : 'text-blue-800';
  const iconColor = type === 'success' ? 'text-green-600' : type === 'error' ? 'text-red-600' : 'text-blue-600';
  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
      <div className={`${bgColor} border-l-4 rounded-lg shadow-2xl p-4 min-w-[320px] max-w-md`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-6 h-6 flex-shrink-0 ${iconColor}`} />
          <div className={`flex-1 ${textColor} text-sm font-medium leading-relaxed`}>
            {message}
          </div>
          <button
            onClick={onClose}
            className={`flex-shrink-0 ${textColor} hover:opacity-70 transition-opacity`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
