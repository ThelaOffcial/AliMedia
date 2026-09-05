import React, { useEffect, useState } from 'react';
import type { Language } from '../utils/translations';
import { needsTranslation, translateToLanguage } from '../utils/translateContent';

type Props = {
  text: string;
  language: Language;
  /** Optional pre-translated / alternate language version (e.g. sinhalaTitle). Prefer this when matching language. */
  altText?: string;
  /** altText language: if language matches, show altText without API call */
  altLanguage?: Language;
  className?: string;
  as?: 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4';
  /** While translating, show original (default) or a subtle placeholder */
  showOriginalWhileLoading?: boolean;
};

/**
 * Renders text in the current UI language.
 * - If altText is provided for the target language, uses it (no API).
 * - If text is already in the target language script, keeps it.
 * - Otherwise translates via free Google Translate endpoint and caches.
 */
export const TranslatedText: React.FC<Props> = ({
  text,
  language,
  altText,
  altLanguage,
  className,
  as: Tag = 'span',
  showOriginalWhileLoading = true,
}) => {
  const preferred =
    altText && altLanguage && language === altLanguage && altText.trim()
      ? altText.trim()
      : null;

  const source = preferred ?? (text || '');

  const [display, setDisplay] = useState(source);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Prefer explicit bilingual field
    if (preferred) {
      setDisplay(preferred);
      setLoading(false);
      setFailed(false);
      return;
    }

    const raw = text || '';
    if (!raw.trim()) {
      setDisplay('');
      setLoading(false);
      setFailed(false);
      return;
    }

    if (!needsTranslation(raw, language)) {
      setDisplay(raw);
      setLoading(false);
      setFailed(false);
      return;
    }

    setLoading(true);
    setFailed(false);
    if (showOriginalWhileLoading) setDisplay(raw);

    translateToLanguage(raw, language).then((result) => {
      if (!cancelled) {
        setDisplay(result.text);
        setLoading(false);
        setFailed(result.failed);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [text, language, preferred, showOriginalWhileLoading]);

  return (
    <Tag className={className} data-translating={loading ? 'true' : undefined}>
      {display}
      {failed && (
        <span
          className="ml-1 text-amber-500/80 dark:text-amber-400/80 text-[0.85em] align-super cursor-help select-none"
          title={
            language === 'si'
              ? 'පරිවර්තනය තාවකාලිකව ලබා ගත නොහැක — මුල් පිටපත පෙන්වයි'
              : 'Translation temporarily unavailable — showing original text'
          }
        >
          ⚠
        </span>
      )}
    </Tag>
  );
};

/**
 * Hook version for cases where you need the string (e.g. share text, aria labels).
 */
export function useTranslatedText(
  text: string,
  language: Language,
  altText?: string,
  altLanguage?: Language
): string {
  const preferred =
    altText && altLanguage && language === altLanguage && altText.trim()
      ? altText.trim()
      : null;

  const [display, setDisplay] = useState(preferred ?? text ?? '');

  useEffect(() => {
    let cancelled = false;
    if (preferred) {
      setDisplay(preferred);
      return;
    }
    const raw = text || '';
    if (!raw.trim() || !needsTranslation(raw, language)) {
      setDisplay(raw);
      return;
    }
    translateToLanguage(raw, language).then((result) => {
      if (!cancelled) setDisplay(result.text);
    });
    return () => {
      cancelled = true;
    };
  }, [text, language, preferred]);

  return display;
}
