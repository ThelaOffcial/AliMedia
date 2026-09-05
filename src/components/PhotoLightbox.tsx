import React from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface PhotoLightboxProps {
  photoUrl: string;
  onClose: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ photoUrl, onClose }) => {
  if (!photoUrl || typeof photoUrl !== 'string' || photoUrl.trim().length === 0) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-fadeIn">
      {/* Top action bar */}
      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        <a
          href={photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title="Open original"
        >
          <Download className="w-5 h-5" />
        </a>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="relative max-w-4xl max-h-[85vh] w-full flex items-center justify-center">
        <img
          src={photoUrl}
          alt="Elephant Photography"
          className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl"
        />
      </div>
    </div>
  );
};
