export type ElephantType = 'tusker' | 'elephant'; // tusker = ඇතා, elephant = අලියා
export type Gender = 'male' | 'female'; // male = පිරිමි, female = ගැහැණු

export interface ElephantSource {
  title: string;
  url?: string;
  publisher?: string;
  verifiedDate?: string;
}

export interface Elephant {
  id?: string;
  name: string; // Primary name (e.g., "Indiraja" / "ඉන්දිරාජා")
  sinhalaName?: string; // Sinhala script name
  otherNames?: string[]; // Aliases or previous names
  gender: Gender;
  type: ElephantType;
  dateOfBirth?: string; // If verified, otherwise null/empty
  age?: number | string; // Age in years or text if verified
  /** Date of death — required when status is memorial */
  dateOfDeath?: string;
  location: string; // e.g., "Kandy", "Colombo", "Kegalle", "Kataragama"
  organization: string; // e.g., "Sri Dalada Maligawa (ශ්‍රී දළදා මාළිගාව)", "Bellanwila Raja Maha Viharaya", "Pinnawala Elephant Orphanage"
  mahout?: string; // Publicly available & verified mahout info
  tusks?: string; // Description of tusks (e.g. "Twin symmetrical tusks (දළ යුගල)", "Nil-dath", "N/A")
  physicalCharacteristics?: string; // Height, back slope, ear shape, temporal marking
  description: string; // Comprehensive background, sacred perahera history, guardianship
  peraheraParticipation?: string[]; // Festivals (e.g., "Kandy Esala Perahera", "Kelaniya Duruthu Perahera")
  photos: string[]; // URLs of authentic photos (gallery)
  /** Dedicated profile / avatar image shown in feed headers, story tray, directories */
  profilePhoto?: string;
  cloudinaryPhotos?: { url: string; publicId: string }[];
  coverPhotoIndex?: number;
  sources: ElephantSource[]; // Verified references and documentation
  verified: boolean; // Verification badge
  status?: 'living' | 'memorial'; // Living or legendary/historical memorial
  isFeatured?: boolean; // Featured in top stories / spotlight
  isLive?: boolean; // Currently active/live badge
  /** YouTube / Facebook / Twitch / direct HLS or embeddable stream URL */
  liveStreamUrl?: string;
  customBadge?: string; // e.g. "National Treasure", "Chief Casket Bearer"
  followerCount?: number; // Total followers
  /** Heart likes (persisted under elephant_likes in RTDB) */
  likesCount?: number;
  likedBy?: string[];
  createdAt?: any;
  updatedAt?: any;
}

/** Preferred display aspect for community photos: 1:1 square, 3:4 portrait, 9:16 story/tall */
export type PhotoAspectRatio = '1:1' | '3:4' | '9:16' | '4:3' | 'other';

export interface ElephantPost {
  id?: string;
  elephantId?: string; // Optional linked elephant (community posts may omit)
  elephantName?: string; // Elephant name when tagged
  elephantSinhalaName?: string;
  photoUrl: string; // Image URL (Data URL or hosted URL)
  caption: string; // Post description/caption
  authorUid?: string; // User UID
  authorName: string; // Author full name (e.g. "Malaka Fernando")
  authorUsername: string; // Author handle (e.g. "@malaka")
  authorPhotoURL?: string; // Author avatar
  /** True when posted by official Ali Media team (forced display + verified badge) */
  authorIsAliMedia?: boolean;
  likesCount?: number;
  likedBy?: string[];
  isStory?: boolean; // Auto shared to story
  isStoryOnly?: boolean; // Story only (not shown in regular feed)
  /** Detected / chosen aspect so feed can show the full image without crop */
  aspectRatio?: PhotoAspectRatio;
  /** True when this post was reshared from another user's post */
  isReshare?: boolean;
  originalPostId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CulturalEvent {
  id?: string;
  title: string;
  sinhalaTitle?: string;
  description: string;
  location: string;
  date: string;
  type: 'perahera' | 'ceremony' | 'conservation' | 'general' | 'update' | 'alert' | 'news' | 'other';
  participatingElephants?: string[];
  isActive: boolean;
  coverImage?: string;
  /** Live stream for Perahara / ceremony sessions (not individual elephants) */
  isLive?: boolean;
  /** YouTube / Facebook / Twitch / HLS / direct stream URL */
  liveStreamUrl?: string;
  /** Live session like count (real-time) */
  likesCount?: number;
  likedBy?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface FilterOptions {
  type: string;
  gender: string;
  location: string;
  organization: string;
  status: string;
  verifiedOnly: boolean;
  searchQuery: string;
  sortBy: 'name' | 'age' | 'recent';
}
