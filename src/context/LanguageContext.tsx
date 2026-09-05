import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';

interface Translations {
  [key: string]: {
    en: string;
    si: string;
  };
}

export const translations: Translations = {
  // Brand & Header
  brandTitle: {
    en: "අලිMedia • Elephant Registry",
    si: "අලිMedia • හීලෑ අලි නාමාවලිය"
  },
  brandSubtitle: {
    en: "Sri Lankan Domesticated Elephants & Tuskers",
    si: "ශ්‍රී ලාංකේය හීලෑ අලි සහ රාජකීය ඇත්තු"
  },
  navDirectory: {
    en: "Registry",
    si: "නාමාවලිය"
  },
  navMemorials: {
    en: "Memorials",
    si: "අභිමානවත් මතක"
  },
  navPerahera: {
    en: "Perahera Pageants",
    si: "පෙරහැර මංගල්‍ය"
  },
  navGallery: {
    en: "Gallery & Stories",
    si: "ඡායාරූප සහ කථා"
  },
  navLore: {
    en: "Gaja Shastra & Lore",
    si: "හස්ති ශාස්ත්‍රය"
  },
  navCompare: {
    en: "Compare",
    si: "සංසන්දනය"
  },
  navAdmin: {
    en: "Admin Portal",
    si: "පරිපාලක පිවිසුම"
  },
  
  // Hero & Search
  heroTitle: {
    en: "Guardians of Sacred Pageantry & Living Heritage",
    si: "ශුද්ධෝත්තම පෙරහැර මංගල්‍යයේ අභිමානවත් හස්තිරාජයෝ"
  },
  heroSubtitle: {
    en: "Explore verified archives, lineage records, tusk anatomy, and cultural histories of Sri Lanka's revered domesticated elephants and majestic ceremonial casket bearers.",
    si: "ශ්‍රී ලංකාවේ පූජනීය හීලෑ අලි ඇතුන්, ධාතු කරඬුව දරණ රාජකීය ඇතුන්ගේ පෙළපත, දළ ලක්ෂණ සහ සංස්කෘතික උරුමය පිළිබඳ සත්‍යාපිත නිල ලේඛනාගාරය."
  },
  searchPlaceholder: {
    en: "Search by elephant name, Sinhala name, temple, or mahout...",
    si: "අලියාගේ නම, සිංහල නම, විහාරස්ථානය හෝ ඇත්ගොව්වා අනුව සොයන්න..."
  },
  all: { en: "All Profiles", si: "සියලු පැතිකඩ" },
  tuskers: { en: "Tuskers (ඇත්තු)", si: "දළ ඇත්තු" },
  elephants: { en: "Elephants (අලි)", si: "අලි / ඇතින්නන්" },
  living: { en: "Living (ජීවත්වන)", si: "ජීවත්වන" },
  memorial: { en: "Memorials (මතකාවර්ජන)", si: "මතකාවර්ජන" },
  casketBearers: { en: "Casket Bearers (කරඬුව දරන්නන්)", si: "කරඬුව දරන ඇත්තු" },
  bookmarkedOnly: { en: "Favorites", si: "ප්‍රියතම" },
  
  // Stats
  statTotal: { en: "Catalogued Elephants", si: "ලියාපදිංචි අලි ඇතුන්" },
  statLivingTuskers: { en: "Active Tuskers", si: "ක්‍රියාකාරී දළ ඇත්තු" },
  statPageants: { en: "Sacred Pageants", si: "වාර්ෂික පෙරහැර" },
  statMemorials: { en: "Historic Legends", si: "ඉතිහාසගත රාජකීයයන්" },
  
  // Card & Detail
  viewDossier: { en: "View Dossier", si: "සම්පූර්ණ තොරතුරු" },
  verifiedRecord: { en: "Verified Custody Record", si: "සත්‍යාපිත ලේඛනය" },
  statusLiving: { en: "Living • Ceremonial", si: "ජීවත්වන • ක්‍රියාකාරී" },
  statusMemorial: { en: "Deceased • National Legend", si: "අභාවප්‍රාප්ත • ජාතික උරුමයක්" },
  custodian: { en: "Custodian / Temple", si: "භාරකාරත්වය / විහාරය" },
  mahout: { en: "Mahout (ඇත්ගොව්වා)", si: "ඇත්ගොව්වා" },
  location: { en: "Location", si: "ස්ථානය" },
  tusks: { en: "Tusk Characteristics", si: "දළ පිහිටීම" },
  characteristics: { en: "Physical Traits", si: "ශාරීරික ලක්ෂණ" },
  peraheraRoles: { en: "Perahera Participation", si: "සහභාගී වූ පෙරහැර" },
  sources: { en: "Verified Citations & Records", si: "සත්‍යාපිත මූලාශ්‍ර සහ ලේඛන" },
  ageYears: { en: "years old", si: "වයස අවුරුදු" },
  born: { en: "Birth / Origin", si: "උපත / සම්භවය" },
  compareAdd: { en: "Compare", si: "සංසන්දනයට" },
  compareRemove: { en: "Remove", si: "ඉවත් කරන්න" },
  share: { en: "Share Dossier", si: "බෙදාගන්න" },
  printProfile: { en: "Print / Save PDF", si: "මුද්‍රණය / PDF" },
  
  // Actions & Buttons
  submitPhoto: { en: "Submit Sighting Photo", si: "ඡායාරූපයක් එක්කරන්න" },
  soundAmbienceOn: { en: "Ceremonial Ambience: On", si: "හේවිසි නාදය: සක්‍රීයයි" },
  soundAmbienceOff: { en: "Ceremonial Ambience: Off", si: "හේවිසි නාදය: අක්‍රීයයි" },
  playTrumpet: { en: "Elephant Call / Trumpet", si: "කුංචනාදය ශ්‍රවණය" },
  resetFilters: { en: "Reset Filters", si: "පෙරහන් ඉවත් කරන්න" },
  
  // Perahera View
  peraheraTitle: { en: "Sacred Perahera Pageants of Sri Lanka", si: "ශ්‍රී ලංකාවේ පූජනීය පෙරහැර මංගල්‍යයන්" },
  peraheraSubtitle: { en: "Discover the historic religious pageants where domesticated tuskers bear the sacred relics with traditional reverence.", si: "පූජනීය ධාතු කරඬුව උතුම් ගෞරවයෙන් වඩමවන ඓතිහාසික පෙරහැර මංගල්‍යයන් සහ ඊට සහභාගී වන රාජකීය ඇතුන්." },
  participatingLineup: { en: "Participating Tusker Lineup", si: "සහභාගී වන රාජකීය ඇතුන්ගේ පෙළගැස්ම" },
  chiefBearer: { en: "Chief Relic Casket Bearer", si: "ප්‍රධාන ධාතු කරඬුව වඩමවන ඇතා" },

  // Admin Portal
  adminTitle: { en: "National Domesticated Elephant Registry Portal", si: "ජාතික හීලෑ අලි ඇතුන් ලේඛනාගාර පරිපාලන පද්ධතිය" },
  adminSubtitle: { en: "Authorized portal for updating elephant custody records, Perahera rosters, and archival photography.", si: "හීලෑ අලි ඇතුන්ගේ තොරතුරු, පෙරහැර සංවිධාන ලේඛන හා ඡායාරූප කළමනාකරණය සඳහා බලයලත් පද්ධතිය." },
  adminLoginTitle: { en: "Admin Authentication", si: "පරිපාලක පිවිසුම" },
  adminLoginDesc: { en: "Enter authorized master PIN or admin password to manage data records.", si: "දත්ත සංස්කරණය කිරීමට බලයලත් PIN අංකය ඇතුළත් කරන්න." },
  pinPlaceholder: { en: "Enter PIN (Default: 1234)", si: "PIN අංකය ඇතුළත් කරන්න (පෙරනිමි: 1234)" },
  loginBtn: { en: "Authenticate & Enter", si: "පිවිසෙන්න" },
  logoutBtn: { en: "Exit Admin", si: "පිටවීම" },
  addNewElephant: { en: "Register New Elephant", si: "නව හස්ති පැතිකඩක් ලියාපදිංචි කරන්න" },
  exportBackup: { en: "Export JSON Backup", si: "දත්ත JSON ලෙස බාගන්න" },
  exportCSV: { en: "Export CSV Sheet", si: "CSV ගොනුවක් ලෙස බාගන්න" },
  restoreData: { en: "Restore JSON Data", si: "දත්ත නැවත පිහිටුවන්න" },
  manageElephants: { en: "Manage Elephant Records", si: "හස්ති වාර්තා කළමනාකරණය" },
  managePeraheras: { en: "Manage Peraheras", si: "පෙරහැර කළමනාකරණය" },
  manageGallery: { en: "Moderate Gallery", si: "ඡායාරූප පාලනය" }
};

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('alimedia_lang');
    return (saved === 'si' || saved === 'en') ? saved : 'si';
  });

  useEffect(() => {
    localStorage.setItem('alimedia_lang', lang);
  }, [lang]);

  const t = (key: string): string => {
    if (translations[key]) {
      return translations[key][lang] || translations[key]['en'] || key;
    }
    return key;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
