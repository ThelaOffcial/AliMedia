import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { gajaKulaList, elephantWelfareGuidelines } from '../data/initialData';
import { BookOpen, ShieldCheck, Sparkles, Award, Scale, CheckCircle2, HeartHandshake } from 'lucide-react';

export const GajaShastraView: React.FC = () => {
  const { lang, t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      
      {/* Header */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold uppercase mb-3.5 shadow-xs">
          <BookOpen className="w-4 h-4 text-amber-700" />
          <span>හස්ති ශාස්ත්‍රය හා සුබසාධනය • Ancient Treatises & Law</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 font-display tracking-tight mb-3">
          හස්ති ශාස්ත්‍රය සහ දස හස්ති කුල විස්තරය
        </h2>
        <p className="text-slate-700 text-base sm:text-lg leading-relaxed font-medium">
          පුරාණ ලක්දිව රාජකීය වංශකතා සහ ආයුර්වේද හස්ති ශාස්ත්‍ර ග්‍රන්ථයන්ට අනුව අලි ඇතුන් කුල දහයකට (දස හස්ති කුල) වර්ගීකරණය කොට ඔවුන්ගේ කාය ව්‍යුහය, චර්යාව සහ මංගල ලක්ෂණ දක්වා ඇත.
        </p>
      </div>

      {/* The 10 Castes Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2 text-xl font-extrabold text-slate-900 font-display">
          <Sparkles className="w-5 h-5 text-amber-600" />
          <span>දස හස්ති කුල (The Ten Noble Castes)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {gajaKulaList.map((kula, idx) => (
            <div
              key={kula.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-amber-800 uppercase tracking-wider bg-amber-100 px-2.5 py-1 rounded border border-amber-200">
                    කුලය 0{idx + 1}
                  </span>
                  <span className="text-xs text-slate-600 font-bold">
                    {kula.reverence}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900 font-display">
                    {kula.name}
                  </h3>
                  <div className="text-base font-extrabold text-amber-800 font-sinhala mt-0.5">
                    {kula.sinhalaName}
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed font-normal">
                  {kula.characteristics}
                </p>

                <div className="text-xs text-slate-800 font-sinhala bg-slate-50 p-3.5 rounded-xl border border-slate-200 leading-relaxed font-medium">
                  {kula.sinhalaCharacteristics}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Auspicious Anatomy & Regalia Section */}
      <section className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-2 text-xl font-extrabold text-slate-900 font-display">
          <Award className="w-5 h-5 text-amber-600" />
          <span>හස්ති මංගල ලක්ෂණ හා ඇඳුම් කට්ටලය (Auspicious Regalia)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2 shadow-xs">
            <h4 className="font-bold text-amber-800 uppercase tracking-wider text-xs">
              1. නිය විස්ස හා භූමිස්පර්ශ දළ
            </h4>
            <p className="text-slate-700 text-xs leading-relaxed font-normal">
              සාම්ප්‍රදායික ශාස්ත්‍රයට අනුව පාද සතරෙහිම නිය 5 බැගින් (සම්පූර්ණ නිය විස්ස) පිහිටි ඇතුන් උතුම් මංගල ලක්ෂණයෙන් යුක්ත වේ. සිරස නමන විට භූමිය ස්පර්ශ වන සමබර දළ <em className="text-amber-800 font-bold">භූමිස්පර්ශ දළ</em> ලෙස හැඳින්වේ.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2 shadow-xs">
            <h4 className="font-bold text-amber-800 uppercase tracking-wider text-xs">
              2. නළල් පටිය හා කස්තුරි ආලේපය
            </h4>
            <p className="text-slate-700 text-xs leading-relaxed font-normal">
              පෙරහැර මංගල්‍යයේදී පළඳවන <em className="text-amber-800 font-bold">නළල් පටිය</em> සාම්ප්‍රදායික උඩරට රන් රිදී නූල් හා මුතු කැට වලින් අතින් සරසා ඇත. ශාන්තභාවය පිණිස කන් පිටුපස සුවඳ සඳුන් ආලේප කෙරේ.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-2 shadow-xs">
            <h4 className="font-bold text-amber-800 uppercase tracking-wider text-xs">
              3. පාවඩ මත ගමන (Pavada Tradition)
            </h4>
            <p className="text-slate-700 text-xs leading-relaxed font-normal">
              සධාතුක කරඬුව වඩමවන ප්‍රධාන ඇත් රජුන්ගේ පාද පොළොවේ නොගැටෙන සේ පවිත්‍ර ධවල <em className="text-amber-800 font-bold">පාවඩ</em> එලනු ලබන්නේ පරම පූජනීය ගෞරවය උදෙසාය.
            </p>
          </div>

        </div>
      </section>

      {/* Gazette Welfare Code */}
      <section className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-950 text-xs font-bold uppercase mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>ශ්‍රී ලංකා වනජීවී සුබසාධන නීතිමය රාමුව</span>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 font-display">
            {elephantWelfareGuidelines.titleSinhala}
          </h3>
          <p className="text-xs text-slate-600 mt-1 font-mono font-semibold">
            {elephantWelfareGuidelines.gazette}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {elephantWelfareGuidelines.rules.map((rule, idx) => (
            <div key={idx} className="bg-white border border-emerald-100 rounded-xl p-4 space-y-2 shadow-xs">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    {rule.titleSi}
                  </h4>
                  <div className="text-xs font-medium text-slate-500">
                    {rule.titleEn}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed pl-6 font-sinhala font-medium">
                {rule.descSi}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed pl-6 font-sans">
                {rule.descEn}
              </p>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
};
