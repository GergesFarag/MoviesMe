import { HydratedDocument, Model, Mongoose } from "mongoose";
import { IUser } from "../../Interfaces/user.interface";
import { StoryRepository } from "../../Repositories/StoryRepository";
import { UserRepository } from "../../Repositories/UserRepository";
import { JobRepository } from "../../Repositories/JobRepository";
import cloudinary from "../../Config/cloudinary";

export class UserEvents {
  public static async onUserDeleted(user: HydratedDocument<IUser>) {
    const userId = user._id as unknown as string;
    const storiesIdsToDelete = await UserRepository.getInstance().getUserStoriesIds(userId);
    let userJobsIds = await UserRepository.getInstance().getUserJobsIds(userId);
    await Promise.all([
      StoryRepository.getInstance().deleteManyByIds(userId, storiesIdsToDelete),
      JobRepository.getInstance().deleteManyByJobIds(userJobsIds),
      cloudinary.uploader.destroy(`user_${userId}`)
    ]);
    console.log("All User Stories and Jobs are flushed!");
  }
}

export default UserEvents;
