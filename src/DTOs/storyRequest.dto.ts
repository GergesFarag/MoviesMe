import {
  IStoryRequest,
  IVoiceOver,
} from "../Interfaces/storyRequest.interface";

export interface IStoryProcessingDTO {
  prompt: string;
  duration: number;
  numOfScenes: number;
  voiceOver?: IVoiceOver;
  location?: string;
  style?: string;
  title?: string;
  genere?: string;
  image?: string;
  audio?: string;
}
interface IStoryRequestDTOMapper {
  toDTO(style: string, location: string): IStoryProcessingDTO;
}

export class StoryProcessingDTO implements IStoryRequestDTOMapper {
  private story: IStoryRequest;
  constructor(story: IStoryRequest) {
    this.story = story;
  }
  toDTO(style: string | null, location: string | null): IStoryProcessingDTO {
    return {
      prompt: this.story.prompt,
      duration: this.story.storyDuration,
      voiceOver: this.story.voiceOver,
      location: location || undefined,
      style: style || undefined,
      title: this.story.storyTitle,
      genere: this.story.genere,
      numOfScenes: this.story.storyDuration / 5,
      image: this.story.image,
      audio: this.story.audio,
    };
  }
}
