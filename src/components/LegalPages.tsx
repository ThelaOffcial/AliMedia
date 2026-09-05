import React from 'react';
import { ArrowLeft, Mail, MapPin, Shield, Heart, BookOpen, Scale } from 'lucide-react';
import type { Language } from '../utils/translations';

export type LegalPageId = 'about' | 'contact' | 'terms';

/** Bump when terms change so users must re-accept */
export const TERMS_VERSION = '1.0';
export const TERMS_EFFECTIVE_DATE = '31 August 2026';

interface Props {
  page: LegalPageId;
  language: Language;
  onBack: () => void;
  /** Compact mode for embedding inside the terms-acceptance modal */
  embedded?: boolean;
}

export function LegalPages({ page, language, onBack, embedded }: Props) {
  const si = language === 'si';

  const title =
    page === 'about'
      ? si
        ? 'අප ගැන'
        : 'About'
      : page === 'contact'
        ? si
          ? 'අප අමතන්න'
          : 'Contact us'
        : si
          ? 'නියම සහ කොන්දේසි'
          : 'Terms & conditions';

  return (
    <div
      className={
        embedded
          ? 'space-y-4 text-left'
          : 'max-w-lg mx-auto w-full pb-28 pt-2 animate-fadeIn space-y-4'
      }
    >
      {!embedded && (
        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 text-[#062E22] dark:text-white"
            aria-label={si ? 'ආපසු' : 'Back'}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-[#062E22] dark:text-white tracking-tight">{title}</h1>
        </div>
      )}

      <div className="bg-white dark:bg-black rounded-3xl border border-zinc-200 dark:border-white/10 shadow-xs p-5 sm:p-6 space-y-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
        {page === 'about' && <AboutBody si={si} />}
        {page === 'contact' && <ContactBody si={si} />}
        {page === 'terms' && <TermsBody si={si} />}
      </div>
    </div>
  );
}

function AboutBody({ si }: { si: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2 text-[#062E22] dark:text-emerald-300 font-bold text-base">
        <Heart className="w-5 h-5 text-amber-500" />
        AliMedia · අලිමීඩියා
      </div>
      <p>
        {si
          ? 'AliMedia යනු ශ්‍රී ලංකාවේ හීලෑ අලින් සහ උත්සව ඇතුන් පිළිබඳ සත්‍යාපිත තොරතුරු, ඡායාරූප සහ සංස්කෘතික ඉතිහාසය ලේඛනගත කරන ඩිජිටල් ලේඛනාගාරයකි.'
          : 'AliMedia is a digital registry dedicated to documenting verified information, photographs, and cultural history of Sri Lanka’s domesticated elephants and ceremonial tuskers.'}
      </p>
      <p>
        {si
          ? 'අපගේ අරමුණ වන්නේ පෙරහැර සහ ආගමික උත්සවවලට බැඳුණු ගජමිතුරන්ගේ ගෞරවය ආරක්ෂා කරමින්, ප්‍රජාවට විශ්වාසනීය දත්ත ලබා දීමයි. වන අලින් මෙම වේදිකාවේ විෂය නොවේ.'
          : 'Our mission is to honour the elephants linked to peraheras and religious pageants, and to give the community reliable data. Wild elephants are outside the scope of this platform.'}
      </p>
      <ul className="space-y-2 text-xs list-none">
        <li className="flex gap-2">
          <Shield className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          {si
            ? 'හීලෑ / උත්සව අලින් පමණි · සත්‍යාපිත මූලාශ්‍ර'
            : 'Domesticated & ceremonial elephants only · verified sources'}
        </li>
        <li className="flex gap-2">
          <BookOpen className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          {si
            ? 'Stories, posts, සහ live දැනුම්දීම් හරහා ප්‍රජා සහභාගීත්වය'
            : 'Community participation via stories, posts, and live notices'}
        </li>
      </ul>
      <p className="text-xs text-zinc-500">
        {si
          ? 'AliMedia සංස්කෘතික උරුමය සහ සත්ව සුබසාධනය දෙකම අගය කරයි.'
          : 'AliMedia values both cultural heritage and animal welfare.'}
      </p>
    </>
  );
}

function ContactBody({ si }: { si: boolean }) {
  return (
    <>
      <p>
        {si
          ? 'ප්‍රශ්න, දත්ත නිවැරදි කිරීම්, හවුල්කාරිත්වය හෝ මාධ්‍ය විමසීම් සඳහා අප අමතන්න.'
          : 'Reach us for questions, data corrections, partnerships, or media enquiries.'}
      </p>
      <div className="space-y-3 text-xs">
        <a
          href="mailto:hello@alimedia.lk"
          className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:border-emerald-600/40 transition-colors"
        >
          <Mail className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold text-[#062E22] dark:text-white">Email</p>
            <p className="text-zinc-500">hello@alimedia.lk</p>
          </div>
        </a>
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
          <MapPin className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <div>
            <p className="font-bold text-[#062E22] dark:text-white">
              {si ? 'පිහිටීම' : 'Location'}
            </p>
            <p className="text-zinc-500">
              {si ? 'ශ්‍රී ලංකාව · මාර්ගගත සේවාව' : 'Sri Lanka · Online service'}
            </p>
          </div>
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        {si
          ? 'සාමාන්‍යයෙන් ව්‍යාපාරික දින 2–5ක් ඇතුළත ප්‍රතිචාර දක්වන්නෙමු. හදිසි ආරක්ෂක ගැටළු සඳහා ඔබගේ profile හරහා report කරන්න.'
          : 'We usually reply within 2–5 business days. For urgent safety issues, use in-app report tools on posts or comments.'}
      </p>
    </>
  );
}

function TermsBody({ si }: { si: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2 text-[#062E22] dark:text-emerald-300 font-bold text-base">
        <Scale className="w-5 h-5 text-amber-500" />
        {si ? 'නියම සහ කොන්දේසි' : 'Terms & conditions'}
      </div>
      <p className="text-xs text-zinc-500">
        {si ? `බලපත්‍රය: ${TERMS_VERSION} · බලාත්මක වන දිනය: ${TERMS_EFFECTIVE_DATE}` : `Version ${TERMS_VERSION} · Effective ${TERMS_EFFECTIVE_DATE}`}
      </p>

      <Section title={si ? '1. පිළිගැනීම' : '1. Acceptance'}>
        {si
          ? 'AliMedia භාවිතා කිරීමෙන් හෝ Google හරහා ගිණුමක් සෑදීමෙන්, ඔබ මෙම නියම සහ කොන්දේසි කියවා එකඟ වී ඇති බව තහවුරු කරයි. එකඟ නොවන්නේ නම් වේදිකාව භාවිතා නොකරන්න.'
          : 'By using AliMedia or creating an account with Google, you confirm that you have read and agree to these Terms. If you do not agree, do not use the platform.'}
      </Section>

      <Section title={si ? '2. සේවාවේ ස්වභාවය' : '2. Nature of the service'}>
        {si
          ? 'AliMedia හීලෑ සහ උත්සව අලින් පිළිබඳ ලේඛනාගාරයකි. අපි රජයේ ලියාපදිංචි ආයතනයක් නොවන අතර, තොරතුරු හැකි තරම් සත්‍යාපනය කළද සම්පූර්ණත්වය තහවුරු නොකරමු. වන අලි / සංරක්ෂණ නීති උල්ලංඝනය කිරීමට මෙම යෙදුම භාවිතා නොකළ යුතුය.'
          : 'AliMedia is a registry focused on domesticated and ceremonial elephants. We are not a government registry. Information is verified where possible but completeness is not guaranteed. Do not use this app to harm wildlife or break conservation law.'}
      </Section>

      <Section title={si ? '3. ගිණුම් සහ හැසිරීම' : '3. Accounts & conduct'}>
        {si
          ? 'ඔබගේ Google ගිණුමේ ආරක්ෂාව ඔබේ වගකීමයි. හිංසාව, ව්‍යාජ තොරතුරු, අසභ්‍ය අන්තර්ගතය, ස්පෑම්, හෝ අනෙකුත් අයගේ අයිතිවාසිකම් උල්ලංඝනය කිරීම තහනම්ය. උල්ලංඝනය කළහොත් අන්තර්ගතය ඉවත් කිරීම හෝ ගිණුම අත්හිටුවීමට අපට අයිතිය ඇත.'
          : 'You are responsible for your Google account security. Harassment, false information, obscenity, spam, or infringement of others’ rights is prohibited. We may remove content or suspend accounts for violations.'}
      </Section>

      <Section title={si ? '4. ඔබ උඩුගත කරන අන්තර්ගතය' : '4. Your content'}>
        {si
          ? 'Posts, stories, අදහස් සහ ඡායාරූප උඩුගත කිරීමේදී, ඒවා පළ කිරීමට ඔබට අයිතිය ඇති බවත්, අන් අයට හානි නොකරන බවත් තහවුරු කරයි. Story අන්තර්ගතය පොදු ට්‍රේ එකෙන් පැය 24කට පසු ඉවත් විය හැකි අතර, මධ්‍යස්ථතාව සහ ආරක්ෂාව සඳහා පරිපාලක වාර්තා තබා ගත හැක.'
          : 'When you upload posts, stories, comments, or photos, you confirm you have the right to publish them and that they do not harm others. Stories may leave the public tray after 24 hours; admins may retain records for moderation and safety.'}
      </Section>

      <Section title={si ? '5. මධ්‍යස්ථතාව සහ වාර්තා' : '5. Moderation & reports'}>
        {si
          ? 'ඕනෑම පරිශීලකයෙකුට post හෝ comment එකක් report කළ හැක. අවසාන තීරණය පරිපාලක සතුය. ස්වයංක්‍රීය පෙරහන් සහ මානව සමාලෝචනය භාවිතා කළ හැක.'
          : 'Anyone may report a post or comment. Final decisions rest with admins. Automated filters and human review may both be used.'}
      </Section>

      <Section title={si ? '6. රහස්‍යතාව' : '6. Privacy'}>
        {si
          ? 'අපි Google Sign-In හරහා නම, ඊමේල්, සහ profile ඡායාරූපය වැනි මූලික දත්ත ලබා ගනිමු. තල්ලු දැනුම්දීම් සඳහා උපාංග token එකක් සුරැකිය හැක. දත්ත සේවාව පවත්වාගෙන යාමට සහ ආරක්ෂාවට පමණක් භාවිතා වේ.'
          : 'We receive basic data via Google Sign-In (name, email, profile photo). A device token may be stored for push notifications. Data is used to operate the service and for safety.'}
      </Section>

      <Section title={si ? '7. වගකීම් සීමාව' : '7. Limitation of liability'}>
        {si
          ? 'AliMedia "තිබෙන පරිදි" ලබා දේ. සේවාව නවතා දැමීම, දත්ත නොමැතිකම, හෝ පරිශීලක අන්තර්ගතය නිසා ඇතිවන අලාභ සඳහා අප වගකිව යුතු නොවේ. ශ්‍රී ලංකා නීතියට යටත්ව අදාළ උපරිම සීමාව තුළ මෙය ක්‍රියාත්මක වේ.'
          : 'AliMedia is provided “as is”. We are not liable for downtime, missing data, or user-generated content. This applies to the fullest extent permitted under applicable Sri Lankan law.'}
      </Section>

      <Section title={si ? '8. වෙනස්කම්' : '8. Changes'}>
        {si
          ? 'අපට මෙම නියම යාවත්කාලීන කළ හැක. වැදගත් වෙනස්කම්වලදී නව අනුවාදයට නැවත එකඟ වීමට ඉල්ලා සිටිය හැක.'
          : 'We may update these Terms. For material changes we may ask you to accept a new version before continuing.'}
      </Section>

      <Section title={si ? '9. සම්බන්ධ වන්න' : '9. Contact'}>
        {si
          ? 'නීතිමය හෝ රහස්‍යතා විමසීම්: hello@alimedia.lk'
          : 'Legal or privacy questions: hello@alimedia.lk'}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-[#062E22] dark:text-emerald-300">{title}</h3>
      <p className="text-xs sm:text-[13px] text-zinc-600 dark:text-zinc-400 leading-relaxed">{children}</p>
    </div>
  );
}

/** Blocking modal until the user accepts the current terms version */
export function TermsAcceptanceModal({
  language,
  busy,
  onAccept,
  onViewFull,
}: {
  language: Language;
  busy?: boolean;
  onAccept: () => void;
  onViewFull: () => void;
}) {
  const si = language === 'si';
  const [checked, setChecked] = React.useState(false);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55"
      role="dialog"
      aria-modal="true"
      aria-labelledby="terms-accept-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#0f1a16] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/10 max-h-[90vh] flex flex-col">
        <div className="px-5 pt-5 pb-3 border-b border-zinc-100 dark:border-white/10">
          <h2 id="terms-accept-title" className="text-lg font-bold text-[#062E22] dark:text-white">
            {si ? 'නියම සහ කොන්දේසි පිළිගන්න' : 'Agree to our terms'}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {si
              ? 'පළමු වරට ලියාපදිංචි වන / පිවිසෙන පරිශීලකයින් AliMedia භාවිතා කිරීමට පෙර නියමයන්ට එකඟ විය යුතුය.'
              : 'First-time users must accept the Terms & conditions before using AliMedia.'}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 smooth-scroll text-xs">
          <LegalPages page="terms" language={language} onBack={() => {}} embedded />
        </div>
        <div className="px-5 py-4 border-t border-zinc-100 dark:border-white/10 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-zinc-300 text-emerald-800 focus:ring-emerald-700"
            />
            <span className="text-xs text-zinc-700 dark:text-zinc-300 leading-snug">
              {si ? (
                <>
                  මම{' '}
                  <button type="button" onClick={onViewFull} className="text-emerald-800 dark:text-emerald-400 font-bold underline">
                    නියම සහ කොන්දේසි
                  </button>{' '}
                  කියවා එකඟ වෙමි (අනුවාදය {TERMS_VERSION}).
                </>
              ) : (
                <>
                  I have read and agree to the{' '}
                  <button type="button" onClick={onViewFull} className="text-emerald-800 dark:text-emerald-400 font-bold underline">
                    Terms & conditions
                  </button>{' '}
                  (version {TERMS_VERSION}).
                </>
              )}
            </span>
          </label>
          <button
            type="button"
            disabled={!checked || busy}
            onClick={onAccept}
            className="w-full py-3 rounded-2xl bg-[#062E22] text-white text-sm font-bold disabled:opacity-40 hover:bg-emerald-900 transition-colors"
          >
            {busy
              ? si
                ? 'සුරකිමින්…'
                : 'Saving…'
              : si
                ? 'එකඟ වී ඉදිරියට යන්න'
                : 'Agree & continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
