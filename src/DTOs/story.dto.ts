import { IStory } from "../Interfaces/story.interface";
interface IStoryDTO {
  _id: string;
  title: string;
  prompt: string;
  status: string;
  thumbnail: string;
  isFav: boolean;
  videoUrl: string;
  duration: number;
  style: string;
  location: string;
  genre: string;
  scenes: { description: string; image: string }[];
  jobId: string;
  voiceOver?: {
    sound: string;
    text: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}
interface IStoryAbstactDTO {
  _id: string;
  title: string;
  prompt: string;
  status: string;
  jobId: string;
  isFav: boolean;
  thumbnail: string;
  numOfScenes: number;
}

interface IStoryMapper {
  toDTO(story: IStory): IStoryDTO;
  toAbstractDTO(story: IStory): IStoryAbstactDTO;
}

class StoryDTO implements IStoryMapper {
  private story: IStory;

  constructor(story: IStory) {
    this.story = story;
  }

  toAbstractDTO(): IStoryAbstactDTO {
    return {
      _id: (this.story._id as any).toString(),
      title: this.story.title,
      prompt: this.story.prompt,
      status: this.story.status,
      jobId: this.story.jobId,
      isFav: this.story.isFav,
      thumbnail: this.story.thumbnail,
      numOfScenes: this.story.scenes.length,
    };
  }

  toDTO(): IStoryDTO {
    return {
      _id: (this.story._id as any).toString(),
      title: this.story.title,
      prompt: this.story.prompt,
      status: this.story.status,
      thumbnail: this.story.thumbnail,
      isFav: this.story.isFav,
      videoUrl: this.story.videoUrl,
      duration: this.story.duration,
      style: this.story.style,
      location: this.story.location,
      genre: this.story.genre,
      scenes: this.story.scenes.map((scene) => ({
        description: scene.sceneDescription,
        image: scene.image as string,
      })),
      jobId: this.story.jobId,
      voiceOver: {
        sound: this.story.voiceOver?.sound || "",
        text: this.story.voiceOver?.text || "",
      },
    };
  }

  static toDTO(story: IStory): IStoryDTO {
    return new StoryDTO(story).toDTO();
  }
  static toAbstractDTO(story: IStory): IStoryAbstactDTO {
    return new StoryDTO(story).toAbstractDTO();
  }
}

export { StoryDTO, IStoryDTO };
