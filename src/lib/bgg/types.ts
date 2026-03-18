export interface BggSearchResult {
  id: number;
  name: string;
  yearPublished: number | null;
  thumbnailUrl?: string;
  minPlayers?: number;
  maxPlayers?: number;
}

export interface BggPlayerCountPoll {
  numPlayers: string;
  best: number;
  recommended: number;
  notRecommended: number;
}

export interface BggExpansion {
  id: number;
  name: string;
}

export interface BggGameDetails {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  thumbnailUrl: string;
  yearPublished: number;
  minPlayers: number;
  maxPlayers: number;
  playingTime: number;
  minPlayTime: number;
  maxPlayTime: number;
  minAge: number;
  bggRating: number;
  bggWeight: number;
  categories: string[];
  mechanics: string[];
  designers: string[];
  artists: string[];
  publishers: string[];
  expansions: BggExpansion[];
  suggestedPlayers: BggPlayerCountPoll[];
  suggestedAge: number | null;
  languageDependence: string | null;
  bggUsersRated: number;
  bggStdDev: number;
  bggOwned: number;
  bggWanting: number;
  bggWishing: number;
  bggNumWeights: number;
  alternateNames: string[];
}
