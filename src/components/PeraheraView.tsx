import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRegistry } from '../context/RegistryContext';
import { Calendar, MapPin, Landmark, Award, ChevronRight, Sparkles, Filter } from 'lucide-react';

export const PeraheraView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { peraheras, elephants, setSelectedElephant } = useRegistry();
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const months = ['all', 'January', 'February', 'July', 'August', 'September'];

  const filteredPeraheras = peraheras.filter(p => {
    if (selectedMonth === 'all') return true;
    return p.month?.toLowerCase() === selectedMonth.toLowerCase() || p.date.toLowerCase().includes(selectedMonth.toLowerCase());
  });

  const findElephantByName = (name: string) => {
    return elephants.find(
      e => e.name.toLowerCase() === name.toLowerCase() || e.otherNames?.some(o => o.toLowerCase() === name.toLowerCase())
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      
      {/* View Header */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold uppercase mb-3.5 shadow-xs">
          <Calendar className="w-4 h-4 text-amber-700" />
          <span>පූජනීය පෙරහැර මංගල්‍යයන් • Sacred Buddhist Pageants</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display tracking-tight mb-3">
          {t('peraheraTitle')}
        </h2>
        <p className="text-slate-700 text-base sm:text-lg leading-relaxed font-medium">
          {t('peraheraSubtitle')}
        </p>
      </div>

      {/* Month Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 shrink-0">
          <Filter className="w-3.5 h-3.5 text-amber-700" /> කාල සීමාව:
        </span>
        {months.map(m => (
          <button
            key={m}
            onClick={() => setSelectedMonth(m)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedMonth === m
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {m === 'all' ? 'සියලු කාල සීමාවන් (All)' : m}
          </button>
        ))}
      </div>

      {/* Perahera Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredPeraheras.map(perahera => (
          <div
            key={perahera.id}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-amber-400 hover:shadow-md transition-all flex flex-col justify-between"
          >
            {/* Banner Image */}
            <div className="relative aspect-[21/9] w-full bg-slate-100 overflow-hidden">
              <img
                src={perahera.bannerImage || 'https://upload.wikimedia.org/wikipedia/commons/9/90/KandyPerahara.jpg'}
                alt={perahera.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://upload.wikimedia.org/wikipedia/commons/9/90/KandyPerahara.jpg';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
              
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 bg-black/70 px-2.5 py-1 rounded border border-amber-400/40">
                    {perahera.date}
                  </span>
                </div>
                {perahera.location && (
                  <div className="flex items-center gap-1 text-xs text-white bg-black/60 px-2.5 py-1 rounded backdrop-blur-xs font-medium">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    <span>{perahera.location}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Perahera Content */}
            <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 font-display">
                    {perahera.title}
                  </h3>
                  {perahera.sinhalaTitle && (
                    <div className="text-base font-extrabold text-amber-800 font-sinhala mt-0.5">
                      {perahera.sinhalaTitle}
                    </div>
                  )}
                </div>

                {perahera.temple && (
                  <div className="flex items-center gap-2 text-xs text-slate-700">
                    <Landmark className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="font-bold">{perahera.temple}</span>
                  </div>
                )}

                <p className="text-sm text-slate-700 leading-relaxed font-sans font-normal">
                  {perahera.description}
                </p>
              </div>

              {/* Chief Relic Bearer Highlight */}
              {perahera.sacredRelicBearer && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center justify-between shadow-xs">
                  <div>
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                      {t('chiefBearer')}
                    </span>
                    <span className="text-sm font-black text-slate-900">
                      👑 {perahera.sacredRelicBearer}
                    </span>
                  </div>
                  {findElephantByName(perahera.sacredRelicBearer) && (
                    <button
                      onClick={() => {
                        const el = findElephantByName(perahera.sacredRelicBearer!);
                        if (el) setSelectedElephant(el);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 transition-colors shadow-xs cursor-pointer"
                    >
                      {t('viewDossier')}
                    </button>
                  )}
                </div>
              )}

              {/* Participating Elephant Lineup */}
              {perahera.participatingElephants && perahera.participatingElephants.length > 0 && (
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                    {t('participatingLineup')}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {perahera.participatingElephants.map((elName, idx) => {
                      const matchedElephant = findElephantByName(elName);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            if (matchedElephant) setSelectedElephant(matchedElephant);
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                            matchedElephant
                              ? 'bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 border border-slate-200 hover:border-amber-300 cursor-pointer shadow-xs'
                              : 'bg-slate-50 text-slate-500 border border-slate-200 cursor-default'
                          }`}
                        >
                          <span>🐘 {elName}</span>
                          {matchedElephant && <ChevronRight className="w-3 h-3 text-amber-700" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </div>
        ))}
      </div>

    </div>
  );
};
