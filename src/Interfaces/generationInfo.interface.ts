export interface generatinInfo {
  location: {
    name: string;
    image: string;
  };
  style: {
    name: string;
    image: string;
  };
  genres: string[];
  estimatedTimePerSecond: number;
  languages: [string];
  voiceOverCredits: number;
  generationCredits: number;
  createdAt: Date;
  updatedAt: Date;
}
