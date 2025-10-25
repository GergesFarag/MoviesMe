import { IUser } from '../Interfaces/user.interface';
import User from '../Models/user.model';
import { LibraryType } from '../types/libraries';
import { BaseRepository } from './BaseRepository';
import { IEffectItem } from '../Interfaces/effectItem.interface';
import mongoose, { ObjectId } from 'mongoose';

export class UserRepository extends BaseRepository<IUser> {
  private static instance: UserRepository;

  private constructor() {
    super(User);
  }

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  async findByFirebaseUid(uid: string): Promise<IUser | null> {
    return this.findOne({ firebaseUid: uid });
  }

  async getUserProfile(
    userId: string,
    fieldsToExclude: string[]
  ): Promise<IUser | null> {
    return this.findById(userId, fieldsToExclude.join(' '));
  }

  async addToUserLibrary(
    userId: string,
    libraryType: LibraryType,
    item: any
  ): Promise<IUser | null> {
    return this.findByIdAndUpdate(userId, {
      $push: { [libraryType]: item },
    });
  }

  async removeFromUserLibrary(
    userId: string,
    libraryType: LibraryType,
    itemId: string
  ): Promise<IUser | null> {
    return this.findByIdAndUpdate(userId, {
      $pull: { [libraryType]: itemId },
    });
  }

  async addEffectItemAndJob(
    userId: string,
    effectItem: any,
    jobInfo: { _id: ObjectId; jobId: string }
  ): Promise<void> {
    const itemWithTimestamps = {
      ...effectItem,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.findByIdAndUpdate(
      userId,
      {
        $push: {
          effectsLib: itemWithTimestamps,
          jobs: jobInfo,
        },
      },
      {
        new: false,
        writeConcern: { w: 1 } as any,
      }
    );
  }

  async addStoryToLibrary(
    userId: string,
    storyId: ObjectId
  ): Promise<IUser | null> {
    return this.findByIdAndUpdate(
      userId,
      {
        $push: {
          storiesLib: storyId,
        },
      },
      {
        new: false,
        writeConcern: { w: 1 } as any,
      }
    );
  }

  async addJobToUser(
    userId: string,
    jobInfo: { _id: ObjectId; jobId: string }
  ): Promise<IUser | null> {
    return this.findByIdAndUpdate(
      userId,
      {
        $push: {
          jobs: jobInfo,
        },
      },
      {
        new: false,
        writeConcern: { w: 1 } as any,
      }
    );
  }

  async getEffectItem(
    userId: string,
    jobId: string
  ): Promise<IEffectItem | null> {
    const user = await this.findById(userId, 'effectsLib');
    if (!user || !user.effectsLib) return null;

    const item = user.effectsLib.find(
      (item: IEffectItem) => item.jobId === jobId
    );
    return item || null;
  }

  async removeMultipleFromStoriesLib(
    userId: string,
    storyIds: string[]
  ): Promise<IUser | null> {
    return this.findByIdAndUpdate(userId, {
      $pull: { storiesLib: { $in: storyIds } },
    });
  }

  async removeMultipleFromGenerationLib(
    userId: string,
    generationIds: string[]
  ): Promise<IUser | null> {
    const objectIds = generationIds.map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    return this.findByIdAndUpdate(userId, {
      $pull: { generationLib: { _id: { $in: objectIds } } },
    });
  }

  async removeMultipleFromEffectsLib(
    userId: string,
    effectIds: string[]
  ): Promise<IUser | null> {
    const objectIds = effectIds.map((id) => new mongoose.Types.ObjectId(id));
    return this.findByIdAndUpdate(userId, {
      $pull: { effectsLib: { _id: { $in: objectIds } } },
    });
  }

  async removeMultipleJobsByJobIds(
    userId: string,
    jobIds: string[]
  ): Promise<IUser | null> {
    return this.findByIdAndUpdate(userId, {
      $pull: { jobs: { jobId: { $in: jobIds } } },
    });
  }

  async getGenerationsByIds(
    userId: string,
    generationIds: string[]
  ): Promise<any[]> {
    const user = await this.findById(userId, 'generationLib');
    if (!user || !user.generationLib) return [];

    return user.generationLib.filter((item) =>
      generationIds.includes(item._id!.toString())
    );
  }

  async getEffectsByIds(userId: string, effectIds: string[]): Promise<any[]> {
    const user = await this.findById(userId, 'effectsLib');
    if (!user || !user.effectsLib) return [];

    return user.effectsLib.filter((item) =>
      effectIds.includes(item._id!.toString())
    );
  }
}
