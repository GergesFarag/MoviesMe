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
    // Add safety checks to prevent undefined errors
    if (!this.story) {
      throw new Error("Story object is undefined or null");
    }

    if (!this.story.scenes || !Array.isArray(this.story.scenes)) {
      throw new Error("Story scenes are undefined, null, or not an array");
    }

    return {
      _id: this.story._id as string,
      title: this.story.title || "",
      prompt: this.story.prompt || "",
      status: this.story.status || "unknown",
      jobId: this.story.jobId || "",
      isFav: this.story.isFav || false,
      thumbnail: this.story.thumbnail || "",
      numOfScenes: this.story.scenes.length,
    };
  }

  toDTO(): IStoryDTO {
    // Add safety checks to prevent undefined errors
    if (!this.story) {
      throw new Error("Story object is undefined or null");
    }

    if (!this.story.scenes || !Array.isArray(this.story.scenes)) {
      throw new Error("Story scenes are undefined, null, or not an array");
    }

    return {
      _id: this.story._id as string,
      title: this.story.title || "",
      prompt: this.story.prompt || "",
      status: this.story.status || "unknown",
      thumbnail: this.story.thumbnail || "",
      isFav: this.story.isFav || false,
      videoUrl: this.story.videoUrl || "",
      duration: this.story.duration || 0,
      style: this.story.style || "",
      location: this.story.location || "",
      genre: this.story.genre || "",
      scenes: this.story.scenes.map((scene) => ({
        description: scene?.sceneDescription || "",
        image: (scene?.image as string) || "",
      })),
      jobId: this.story.jobId || "",
      voiceOver: {
        sound: this.story.voiceOver?.sound || "",
        text: this.story.voiceOver?.text || "",
      },
      createdAt: this.story.createdAt,
      updatedAt: this.story.updatedAt,
    };
  }

  static toDTO(story: IStory): IStoryDTO {
    if (!story) {
      throw new Error("Cannot convert undefined or null story to DTO");
    }
    return new StoryDTO(story).toDTO();
  }
  
  static toAbstractDTO(story: IStory): IStoryAbstactDTO {
    if (!story) {
      throw new Error("Cannot convert undefined or null story to AbstractDTO");
    }
    return new StoryDTO(story).toAbstractDTO();
  }
}

export { StoryDTO, IStoryDTO };
