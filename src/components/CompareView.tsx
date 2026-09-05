import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useRegistry } from '../context/RegistryContext';
import { Scale, X, Plus, ShieldCheck, Landmark, MapPin, Award, ArrowRight } from 'lucide-react';

export const CompareView: React.FC = () => {
  const { lang, t } = useLanguage();
  const { 
    compareList, 
    toggleCompare, 
    clearCompare, 
    elephants, 
    setSelectedElephant,
    setActiveTab 
  } = useRegistry();

  const comparedElephants = elephants.filter(e => compareList.includes(e.id));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold uppercase mb-3.5 shadow-xs">
            <Scale className="w-4 h-4 text-amber-700" />
            <span>හස්ති සංසන්දනය • Architectural Dossier Comparison</span>
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 font-display tracking-tight">
            ඇත් රජුන්ගේ ලක්ෂණ සැසඳීම (Compare)
          </h2>
          <p className="text-slate-700 text-sm sm:text-base mt-1 font-medium">
            දළ යුගලයේ පිහිටීම, උස, පෙරහැර කාර්යභාරය සහ භාරකාරත්වය එකිනෙක සසඳා බලන්න.
          </p>
        </div>

        {comparedElephants.length > 0 && (
          <button
            onClick={clearCompare}
            className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors whitespace-nowrap self-start sm:self-auto cursor-pointer shadow-xs"
          >
            සියල්ල ඉවත් කරන්න ({comparedElephants.length})
          </button>
        )}
      </div>

      {comparedElephants.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center mx-auto text-2xl shadow-xs">
            ⚖️
          </div>
          <h3 className="text-lg font-bold text-slate-900">සංසන්දනය සඳහා තවම කිසිදු ඇතෙකු තෝරාගෙන නොමැත</h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto font-medium">
            ලේඛනාගාරයේ ඕනෑම ඇත් කාඩ්පතක ඇති <strong className="text-amber-800">තබරාදු ලකුණ (⚖️)</strong> ක්ලික් කිරීමෙන් ඇතුන් තිදෙනෙකු දක්වා එකවර සැසඳිය හැක.
          </p>
          <button
            onClick={() => setActiveTab('registry')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-700 transition-colors cursor-pointer shadow-xs"
          >
            <span>ලේඛනාගාරය පිරික්සන්න</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="min-w-[700px] grid grid-cols-1 md:grid-cols-3 gap-6">
            {comparedElephants.map(elephant => {
              const isMemorial = elephant.status === 'memorial' || !elephant.isLive;
              const photo = elephant.photos?.[0] || 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Nadungamuwa_Raja.jpg';

              return (
                <div
                  key={elephant.id}
                  className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col justify-between shadow-xs hover:border-amber-400 hover:shadow-md transition-all"
                >
                  <div>
                    {/* Top Image & Remove */}
                    <div className="relative aspect-[16/10] w-full bg-slate-100">
                      <img 
                        src={photo} 
                        alt={elephant.name} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Nadungamuwa_Raja.jpg';
                        }}
                      />
                      <button
                        onClick={() => toggleCompare(elephant.id)}
                        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white hover:bg-rose-600 transition-colors cursor-pointer shadow-xs"
                        title="Remove from compare"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="absolute bottom-2.5 left-2.5">
                        {isMemorial ? (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-950 border border-purple-300 uppercase shadow-xs">
                            🕊️ දිවංගත (Memorial)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-300 uppercase shadow-xs">
                            ● ජීවමාන (Living)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Name & Titles */}
                    <div className="p-5 space-y-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 font-display">
                          {elephant.name}
                        </h3>
                        {elephant.sinhalaName && (
                          <div className="text-base font-extrabold text-amber-800 font-sinhala">
                            {elephant.sinhalaName}
                          </div>
                        )}
                        {elephant.customBadge && (
                          <div className="mt-1.5 inline-block text-[10px] font-bold bg-amber-600 text-white px-2.5 py-0.5 rounded uppercase shadow-xs">
                            {elephant.customBadge}
                          </div>
                        )}
                      </div>

                      {/* Attributes Matrix */}
                      <div className="space-y-2.5 text-xs">
                        
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-600 block font-bold">දළ ලක්ෂණ (Tusks):</span>
                          <span className="text-amber-900 font-extrabold mt-0.5 block">{elephant.tusks || 'දළ රහිත / සටහන් වී නොමැත'}</span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-600 block font-bold">උස සහ වයස (Height & Age):</span>
                          <span className="text-slate-800 font-semibold mt-0.5 block">
                            {elephant.heightFeet ? `අඩි ${elephant.heightFeet} ක් පමණ` : 'අඩි 9.5 - 10.5'} • {elephant.age ? `වයස අවු ${elephant.age}` : elephant.dateOfBirth || 'සටහන් නැත'}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-600 block font-bold">භාරකාර විහාරස්ථානය / හිමිකරු:</span>
                          <span className="text-slate-800 font-semibold mt-0.5 block">{elephant.organization || 'විහාරස්ථාන භාරකාරත්වය'}</span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-600 block font-bold">ඇත්ගොව්වා සහ ප්‍රදේශය:</span>
                          <span className="text-slate-800 font-semibold mt-0.5 block">{elephant.mahout || 'ඇත්ගොව්වන්'} ({elephant.location})</span>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-600 block font-bold">පෙරහැර සහභාගීත්වය:</span>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {elephant.peraheraParticipation && elephant.peraheraParticipation.length > 0 ? (
                              elephant.peraheraParticipation.map((p, i) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 text-[10px] font-bold">
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-500 text-[11px]">සටහන් වී නොමැත</span>
                            )}
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>

                  {/* Card Footer Button */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200">
                    <button
                      onClick={() => setSelectedElephant(elephant)}
                      className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                      {t('viewDossier')}
                    </button>
                  </div>

                </div>
              );
            })}

            {comparedElephants.length < 3 && (
              <div 
                onClick={() => setActiveTab('registry')}
                className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors group bg-slate-50/50 hover:bg-amber-50/20"
              >
                <div className="w-12 h-12 rounded-xl bg-white group-hover:bg-amber-100 text-slate-500 group-hover:text-amber-700 border border-slate-200 flex items-center justify-center mb-3 transition-colors shadow-xs">
                  <Plus className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 group-hover:text-amber-800">තවත් ඇතෙකු එක් කරන්න</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-[200px] font-medium">
                  ලේඛනාගාරයෙන් තවත් ඇතෙකු තෝරාගෙන සංසන්දනය කරන්න.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
