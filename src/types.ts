/**
 * Character group — legendary (5★) or epic (4★, plus Travelers and Aloy)
 */
export type CharacterGroup = 'legendary' | 'epic';

/**
 * Represents a playable character in Genshin Impact
 */
export interface Character {
  id: string;
  name: string;
  element: 'pyro' | 'hydro' | 'electro' | 'cryo' | 'anemo' | 'geo' | 'dendro';
  rarity: 4 | 5;
  imageUrl: string;
  /** When true, renders the card at 2:1 aspect ratio instead of 1:1 */
  wideIcon?: boolean;
  /** Character group derived from rarity, with explicit override in JSON for special cases */
  group: CharacterGroup;
}

/**
 * Represents user information from Google OAuth
 */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

/**
 * Represents the current state of the tier list
 */
export interface TierList {
  S: Character[];
  A: Character[];
  B: Character[];
  C: Character[];
  D: Character[];
}

/**
 * Union type for tier keys including unassigned pool
 */
export type TierKey = keyof TierList | 'unassigned';

/**
 * Application state shape
 */
export interface AppState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  tierList: TierList;
  allCharacters: Character[];
  isLoading: boolean;
  error: string | null;
}
