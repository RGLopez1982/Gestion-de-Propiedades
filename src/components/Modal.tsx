import React from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={cn(
          "relative bg-white rounded-xl shadow-2xl border border-outline-variant/20 max-h-[90vh] flex flex-col",
          "transform transition-all",
          size === 'sm' && 'max-w-sm w-full mx-4',
          size === 'md' && 'max-w-md w-full mx-4',
          size === 'lg' && 'max-w-2xl w-full mx-4'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
          <h2 className="font-display text-xl font-bold text-on-surface">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-container rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-outline" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
