export type ElephantStatus = 'living' | 'memorial' | 'deceased';
export type ElephantGender = 'male' | 'female';
export type ElephantType = 'tusker' | 'elephant' | 'calve';

export interface ElephantSource {
  title: string;
  publisher: string;
  verifiedDate: string;
  url?: string;
}

export interface Elephant {
  id: string;
  name: string;
  sinhalaName: string;
  otherNames: string[];
  type: ElephantType;
  gender: ElephantGender;
  status: ElephantStatus;
  isLive: boolean;
  age: number | string;
  dateOfBirth?: string;
  location: string;
  organization: string;
  mahout?: string;
  tusks?: string;
  physicalCharacteristics?: string;
  description: string;
  photos: string[];
  peraheraParticipation: string[];
  sources?: ElephantSource[];
  verified: boolean;
  isFeatured?: boolean;
  followerCount?: number;
  customBadge?: string;
  heightFeet?: number;
  tuskLengthFeet?: number;
}

export interface PeraheraEvent {
  id: string;
  title: string;
  sinhalaTitle: string;
  description: string;
  location: string;
  date: string;
  month?: string;
  type: 'perahera' | 'festival';
  participatingElephants: string[]; // Elephant names or IDs
  isActive: boolean;
  sacredRelicBearer?: string;
  bannerImage?: string;
  temple?: string;
}

export interface GalleryPost {
  id: string;
  elephantId: string;
  elephantName: string;
  elephantSinhalaName?: string;
  photoUrl: string;
  caption: string;
  authorUid: string;
  authorName: string;
  authorUsername: string;
  authorPhotoURL?: string;
  likesCount: number;
  likedBy: string[];
  commentsCount?: number;
  isStory: boolean;
  isStoryOnly?: boolean;
  createdAt: string;
  location?: string;
}

export interface Comment {
  id: string;
  postId: string;
  authorName: string;
  authorUsername: string;
  text: string;
  createdAt: string;
}

export type ViewTab = 'registry' | 'memorials' | 'perahera' | 'gallery' | 'lore' | 'compare' | 'admin';

export type Language = 'en' | 'si';
