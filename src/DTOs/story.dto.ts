import { IStory } from "../Interfaces/story.interface";
interface IStoryDTO {
  _id: string;
  title: string | null;
  prompt: string | null;
  status: string | null;
  thumbnail: string | null;
  isFav: boolean | null;
  videoUrl: string | null;
  duration: number | null;
  style: string | null;
  location: string | null;
  genre: string | null;
  scenes: { description: string | null; image: string | null }[] | null;
  jobId: string | null;
  voiceOver?: {
    sound: string | null;
    text: string | null;
  } | null;
  createdAt?: Date;
  updatedAt?: Date;
}
interface IStoryAbstactDTO {
  _id: string;
  title: string | null;
  prompt: string | null;
  status: string | null;
  jobId: string | null;
  isFav: boolean | null;
  thumbnail: string | null;
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
      title: this.story.title || null,
      prompt: this.story.prompt || null,
      status: this.story.status || "unknown",
      jobId: this.story.jobId || null,
      isFav: this.story.isFav || false,
      thumbnail: this.story.thumbnail || null,
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
      title: this.story.title || null,
      prompt: this.story.prompt || null,
      status: this.story.status || null,
      thumbnail: this.story.thumbnail || null,
      isFav: this.story.isFav || null,
      videoUrl: this.story.videoUrl || null,
      duration: this.story.duration || null,
      style: this.story.style || null,
      location: this.story.location || null,
      genre: this.story.genre || null,
      scenes: this.story.scenes.map((scene) => ({
        description: scene?.sceneDescription || null,
        image: (scene?.image as string) || null,
      })),
      jobId: this.story.jobId || null,
      voiceOver: this.story.voiceOver ? {
        sound: this.story.voiceOver.sound || null,
        text: this.story.voiceOver.text || null,
      } : null,
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
