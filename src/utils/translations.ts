export type Language = 'en' | 'si';

export interface ElephantNameInfo {
  name: string;
  sinhalaName?: string;
}

/** True when name is a real tagged elephant (not empty / "Unknown Elephant"). */
export function isRealElephantName(name?: string | null): boolean {
  const n = (name || '').trim();
  if (!n) return false;
  return !/^unknown\s+elephant$/i.test(n);
}

const ELEPHANT_PHOTO_FALLBACK =
  'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=400&q=80';

/**
 * Elephant avatar for feed headers / story tray / directory.
 * Prefers dedicated profilePhoto, then first gallery photo — never a community post image.
 */
export function getElephantProfilePhoto(elephant?: {
  profilePhoto?: string | null;
  photos?: (string | null | undefined)[] | null;
} | null): string {
  const profile = (elephant?.profilePhoto || '').trim();
  if (profile) return profile;
  const gallery = (elephant?.photos || []).find((p) => typeof p === 'string' && p.trim().length > 0);
  if (gallery) return gallery.trim();
  return ELEPHANT_PHOTO_FALLBACK;
}

/**
 * Returns elephant name in BOTH languages (Sinhala & English)
 * If English mode: "Indiraja (ඉන්දිරාජා)"
 * If Sinhala mode: "ඉන්දිරාජා (Indiraja)"
 * Returns '' for missing or placeholder names (e.g. "Unknown Elephant").
 */
export function formatBilingualElephantName(
  elephant: ElephantNameInfo | undefined | null,
  language: Language
): string {
  if (!elephant) return '';
  const engRaw = elephant.name ? elephant.name.trim() : '';
  const sin = elephant.sinhalaName ? elephant.sinhalaName.trim() : '';
  // Drop legacy "Unknown Elephant" placeholder so UI falls back to author profile
  const eng = isRealElephantName(engRaw) ? engRaw : '';

  if (!sin && !eng) return '';
  if (!sin) return eng;
  if (!eng) return sin;
  if (eng.toLowerCase() === sin.toLowerCase()) return eng;

  if (language === 'si') {
    return `${sin} (${eng})`;
  } else {
    return `${eng} (${sin})`;
  }
}

export function getElephantPrimarySecondaryNames(
  elephant: ElephantNameInfo | undefined | null,
  language: Language
): { primary: string; secondary: string } {
  if (!elephant) return { primary: '', secondary: '' };
  const eng = elephant.name ? elephant.name.trim() : '';
  const sin = elephant.sinhalaName ? elephant.sinhalaName.trim() : '';

  if (language === 'si') {
    const primary = sin || eng;
    const secondary = sin && eng && sin !== eng ? eng : '';
    return { primary, secondary };
  } else {
    const primary = eng || sin;
    const secondary = sin && eng && sin !== eng ? sin : '';
    return { primary, secondary };
  }
}

export const translations = {
  en: {
    appTitle: "AliMedia",
    tagline: "Sri Lankan Domesticated Elephants & Tuskers",
    subTagline: "Verified Cultural Discovery Platform & Heritage Registry",
    feed: "Feed",
    directory: "Elephants",
    profile: "Profile",
    myProfile: "My Profile",
    admin: "Admin",
    explore: "Explore Registry",
    searchPlaceholder: "Search by elephant name, temple, keeper, or location...",
    filterTitle: "Filters",
    clearFilters: "Clear Filters",
    all: "All",
    tuskers: "Tuskers",
    elephants: "Elephants",
    tusker: "Tusker",
    elephant: "Elephant",
    male: "Male",
    female: "Female",
    type: "Type",
    gender: "Gender",
    location: "Location",
    organization: "Temple / Custody",
    status: "Status",
    living: "Living",
    memorial: "Historical / Memorial",
    verifiedOnly: "Verified Records Only",
    verifiedBadge: "Verified Registry Record",
    verified: "Verified",
    notAvailable: "Not available",
    viewProfile: "View Profile",
    view: "View",
    age: "Age",
    years: "years",
    dateOfBirth: "Date of Birth",
    mahout: "Mahout / Keeper",
    tusks: "Tusks Characteristics",
    physicalTraits: "Physical Characteristics",
    physicalCharacteristics: "Physical Characteristics",
    description: "Biography & Cultural History",
    peraheraParticipation: "Procession & Perahera Participation",
    sources: "Verified Sources & References",
    photos: "Photo Gallery",
    share: "Share",
    sharePost: "Share",
    copied: "Link copied to clipboard!",
    close: "Close",
    adminPortal: "Registry Admin",
    seedData: "Load Verified Database",
    seeding: "Loading Verified Records...",
    addNew: "Add Domesticated Elephant",
    editRecord: "Edit Record",
    deleteRecord: "Delete Record",
    deleteConfirm: "Are you sure you want to delete this elephant record from the database?",
    emptyTitle: "No Elephant Records Found",
    emptyDesc: "Try adjusting your filters or search keywords to explore other domesticated elephants.",
    statsDomesticated: "Domesticated Elephants",
    statsTuskers: "Noble Tuskers",
    statsTemples: "Temples & Custodians",
    statsVerified: "Verified Accuracy",
    storiesUpdates: "Stories & Updates",
    followedOnlyStories: "Followed Only",
    noFollowedStoriesTitle: "Follow Elephants to See Stories",
    noFollowedStoriesDesc: "Only stories from elephants you follow appear here. Explore the directory and follow your favorites!",
    viewed: "Viewed",
    newStory: "New",
    addStory: "Add Story",
    addStoryBoxTitle: "Add Story",
    addStoryBoxSub: "Story Only / Post",
    communityPosts: "Community Posts",
    verifiedRegistry: "Verified Elephant Registry",
    topFollowedTrending: "Top 3 Most Followed (Trending)",
    followers: "Followers",
    following: "Following",
    follow: "Follow",
    like: "Like",
    save: "Save",
    saved: "Saved",
    seeMore: "See more",
    seeLess: "See less",
    by: "By",
    community: "Community",
    nationalTreasure: "National Treasure",
    gallery: "Gallery Grid",
    specs: "Details & Specs",
    communitySharedPosts: "Community Shared Posts",
    verifiedGallery: "Photo Gallery",
    addPhoto: "Add Photo",
    resetFilters: "Reset filters",
    noProfilesFound: "No elephant profiles found.",
    registeredElephantsCount: "Verified domesticated Sri Lankan elephants & tuskers",
    elephantDirectoryTitle: "Elephant Directory",
  },
  si: {
    appTitle: "අලිමීඩියා (AliMedia)",
    tagline: "ශ්‍රී ලාංකීය හීලෑ අලි සහ ඇත්තු",
    subTagline: "තහවුරු කරන ලද තොරතුරු සහ ගවේෂණ වේදිකාව",
    feed: "මුල් පිටුව",
    directory: "අලි නාමාවලිය",
    profile: "පැතිකඩ",
    myProfile: "මගේ පැතිකඩ",
    admin: "පරිපාලක",
    explore: "ගවේෂණය කරන්න",
    searchPlaceholder: "නම, විහාරස්ථානය, ඇත්ගොව්වා හෝ ස්ථානය අනුව සොයන්න...",
    filterTitle: "පෙරහන්",
    clearFilters: "සියල්ල ඉවත් කරන්න",
    all: "සියල්ල",
    tuskers: "ඇත්තු",
    elephants: "අලි",
    tusker: "ඇතා",
    elephant: "අලියා",
    male: "පිරිමි",
    female: "ගැහැණු",
    type: "වර්ගය",
    gender: "ස්ත්‍රී / පුරුෂ භාවය",
    location: "ස්ථානය",
    organization: "විහාරස්ථානය / භාරකරු",
    status: "තත්ත්වය",
    living: "ජීවත්වන",
    memorial: "ඓතිහාසික / සමරු",
    verifiedOnly: "තහවුරු කළ වාර්තා පමණක්",
    verifiedBadge: "තහවුරු කළ වාර්තාවක්",
    verified: "සත්‍යාපිතයි",
    notAvailable: "තොරතුරු නොමැත",
    viewProfile: "තොරතුරු බලන්න",
    view: "බලන්න",
    age: "වයස",
    years: "වසර",
    dateOfBirth: "උපන් දිනය",
    mahout: "ඇත්ගොව්වා",
    tusks: "දළ පිහිටීම",
    physicalTraits: "ශාරීරික ලක්ෂණ",
    physicalCharacteristics: "ශාරීරික ලක්ෂණ",
    description: "විස්තරය සහ ඓතිහාසික පසුබිම",
    peraheraParticipation: "පෙරහැර සහභාගීත්වය",
    sources: "මූලාශ්‍ර සහ යොමු සබැඳි",
    photos: "ඡායාරූප ගැලරිය",
    share: "බෙදාගන්න",
    sharePost: "බෙදාගන්න",
    copied: "සබැඳිය පිටපත් කරගන්නා ලදී!",
    close: "වසන්න",
    adminPortal: "පරිපාලක පුවරුව",
    seedData: "තහවුරු කළ දත්ත ඇතුළත් කරන්න",
    seeding: "දත්ත ඇතුළත් වෙමින් පවතී...",
    addNew: "නව අලි/ඇත් වාර්තාවක් එක්කරන්න",
    editRecord: "සංස්කරණය",
    deleteRecord: "ඉවත් කරන්න",
    deleteConfirm: "මෙම අලි/ඇත් වාර්තාව දත්ත සමුදායෙන් ඉවත් කිරීමට ඔබට සහතිකද?",
    emptyTitle: "වාර්තා කිසිවක් හමු නොවීය",
    emptyDesc: "ඔබගේ පෙරහන් හෝ සෙවුම් පද වෙනස් කර නැවත උත්සාහ කරන්න.",
    statsDomesticated: "හීලෑ අලි/ඇත්තු",
    statsTuskers: "ගජමුතු සහිත ඇත්තු",
    statsTemples: "විහාරස්ථාන සහ භාරකරුවන්",
    statsVerified: "තහවුරු කළ නිවැරදිභාවය",
    storiesUpdates: "ඇත් කතා (Stories & Updates)",
    followedOnlyStories: "Follow කළ ඇතුන් පමණි",
    noFollowedStoriesTitle: "Stories නැරඹීමට අලි ඇතුන් Follow කරන්න",
    noFollowedStoriesDesc: "මෙහි දිස්වන්නේ ඔබ Follow කර ඇති අලි ඇතුන්ගේ Stories පමණි. නාමාවලියෙන් කැමති ඇතුන් Follow කරන්න!",
    viewed: "නැරඹූ",
    newStory: "අලුත්",
    addStory: "Story එකක් දාන්න",
    addStoryBoxTitle: "Story එකක් එක් කරන්න",
    addStoryBoxSub: "Story Only / Post",
    communityPosts: "නවතම ප්‍රජා සටහන් (Community Posts)",
    verifiedRegistry: "හීලෑ ඇත් රජවරුන්ගේ ලේඛනාගාරය",
    topFollowedTrending: "වැඩිම Followersලා සිටින ඇතුන් 3 (Trending)",
    followers: "Followers",
    following: "අනුගමනය කරයි",
    follow: "Follow කරන්න",
    like: "Like",
    save: "සුරකින්න",
    saved: "සුරැකිණි",
    seeMore: "තව කියවන්න",
    seeLess: "අඩුවෙන් පෙන්වන්න",
    by: "ඡායාරූපය",
    community: "ප්‍රජා සටහනක්",
    nationalTreasure: "ජාතික වස්තුවක්",
    gallery: "ඡායාරූප (Gallery)",
    specs: "විස්තර (Specs)",
    communitySharedPosts: "පරිශීලකයින් පළකළ ඡායාරූප",
    verifiedGallery: "සත්‍යාපිත ඡායාරූප එකතුව",
    addPhoto: "ඡායාරූපයක් එක්කරන්න",
    resetFilters: "සියලු පෙරහන් ඉවත් කරන්න",
    noProfilesFound: "කිසිදු හීලෑ අලියෙකු හමු නොවීය.",
    registeredElephantsCount: "ශ්‍රී ලංකාවේ ලියාපදිංචි හීලෑ අලි සහ ඇත්තු",
    elephantDirectoryTitle: "හීලෑ අලි නාමාවලිය",
  }
};
