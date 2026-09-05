export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  username: string;
  photoURL: string;
  bio?: string;
  followedElephants: string[]; // Elephant IDs
  /** When true, user cannot post or interact meaningfully */
  suspended?: boolean;
  createdAt?: any;
  updatedAt?: any;
}
