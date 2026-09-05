import React from 'react';
import { Crown, ShieldCheck, Heart, Sparkles } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface FooterProps {
  language: Language;
}

export const Footer: React.FC<FooterProps> = ({ language }) => {
  const t = translations[language];

  return (
    <footer className="bg-zinc-950 text-zinc-400 border-t border-zinc-900 mt-20 pt-12 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-zinc-900">
          {/* Brand Col */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white">
              <Crown className="w-5 h-5 text-amber-400" />
              <span className="text-xl font-bold">AliMedia</span>
              <span className="text-xs text-amber-400 font-sinhala">අලිමීඩියා</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {language === 'si'
                ? 'ශ්‍රී ලාංකීය සංස්කෘතික උරුමය හා බැඳි පූජනීය හීලෑ අලි සහ ඇතුන් පිළිබඳ ඩිජිටල් තොරතුරු සහ ගවේෂණ වේදිකාව.'
                : 'A dedicated exploration registry documenting Sri Lanka’s domesticated elephants and ceremonial tuskers with verified facts and photographic archives.'}
            </p>
          </div>

          {/* Core Rules & Verification */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-zinc-200 uppercase tracking-wider">
              {language === 'si' ? 'දත්ත විශ්වසනීයත්වය හා ප්‍රතිපත්ති' : 'Data Integrity & Rules'}</h4>
            <ul className="space-y-1.5 text-zinc-400">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Domesticated elephants only (හීලෑ අලි/ඇත්තු පමණි)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Unverified details marked strictly as "තොරතුරු නොමැත"</span>
              </li>
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verified sources & public registry references</span>
              </li>
            </ul>
          </div>

          {/* Cultural Heritage Note */}
          <div className="space-y-2 text-xs">
            <h4 className="font-bold text-zinc-200 uppercase tracking-wider">
              {language === 'si' ? 'සංස්කෘතික ගෞරවය' : 'Cultural Heritage'}
            </h4>
            <p className="text-zinc-400 leading-relaxed">
              {language === 'si'
                ? 'ශ්‍රී දළදා මාලිගාවේ ඇසළ පෙරහැර ඇතුළු ඓතිහාසික පෙරහැර මංගල්‍යයන්ට දායක වන සියලුම හීලෑ ගජමිතුරන්ගේ සත්කාරය සහ සංරක්ෂණය අගය කරමු.'
                : 'Honoring the sacred role of captive elephants in Sri Lanka’s centuries-old religious pageants, advocating for ethical stewardship, high veterinary standards, and humane care.'}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            © {new Date().getFullYear()} AliMedia. Dedicated to Sri Lankan Domesticated Elephants & Tuskers.
          </div>
          <div className="flex items-center gap-1">
            <span>Powered by Firebase Realtime Database & React</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
