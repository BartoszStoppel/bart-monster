export interface BggSearchResult {
  id: number;
  name: string;
  yearPublished: number | null;
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
}
