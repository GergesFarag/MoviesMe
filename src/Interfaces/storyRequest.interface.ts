export interface IRequestStory {
  prompt: string;
  storyDuration: number;
  voiceOver?: {
    voiceOverLyrics: string;
    voiceLanguageId: string;
    voiceGender: string;
  };
  storyLocationId?: string;
  storyStyleId?: string;
  storyTitle?: string;
  genere?: string;
  image?: string;
}
