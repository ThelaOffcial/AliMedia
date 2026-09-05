import React from 'react';
import { Database, Sparkles, RefreshCw, SlidersHorizontal, AlertCircle } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface EmptyStateProps {
  isDatabaseEmpty: boolean;
  isError?: boolean;
  errorMessage?: string;
  isSeeding?: boolean;
  onSeedData: () => void;
  onResetFilters: () => void;
  onRetry?: () => void;
  language: Language;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  isDatabaseEmpty,
  isError,
  errorMessage,
  isSeeding,
  onSeedData,
  onResetFilters,
  onRetry,
  language,
}) => {
  const t = translations[language];

  if (isError) {
    return (
      <div className="text-center py-16 px-6 max-w-lg mx-auto bg-red-50/50 dark:bg-red-950/20 rounded-3xl border border-red-200 dark:border-red-900/40">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
          {language === 'si' ? 'දත්ත ලබාගැනීම අසාර්ථක විය' : 'Unable to Load Elephant Data'}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 mb-6">
          {errorMessage || (language === 'si' ? 'දත්ත සමුදාය සමග සම්බන්ධ වීමේ දෝෂයක් පවතී. කරුණාකර නැවත උත්සාහ කරන්න.' : 'There was an issue connecting to Realtime Database. Please try again.')}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all shadow-md cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{language === 'si' ? 'නැවත උත්සාහ කරන්න' : 'Retry'}</span>
          </button>
        )}
      </div>
    );
  }

  if (isDatabaseEmpty) {
    return (
      <div className="text-center py-16 px-6 max-w-lg mx-auto bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="w-20 h-20 rounded-3xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-inner">
          <Database className="w-10 h-10" />
        </div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          {t.seedPromptTitle}
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 mb-6 leading-relaxed">
          {t.seedPromptDesc}
        </p>
        <button
          onClick={onSeedData}
          disabled={isSeeding}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-amber-950 font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50 cursor-pointer"
        >
          {isSeeding ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{t.seeding}</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{t.seedData}</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Filter returned no matches
  return (
    <div className="text-center py-16 px-6 max-w-md mx-auto bg-white/40 dark:bg-zinc-900/40 rounded-3xl border border-zinc-200 dark:border-zinc-800">
      <div className="w-16 h-16 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-4">
        <SlidersHorizontal className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
        {t.emptyTitle}
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 mb-6">
        {t.emptyDesc}
      </p>
      <button
        onClick={onResetFilters}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-all cursor-pointer shadow-sm"
      >
        <span>{t.clearFilters}</span>
      </button>
    </div>
  );
};
