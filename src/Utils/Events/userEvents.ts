import { HydratedDocument, Model, Mongoose } from 'mongoose';
import { IUser } from '../../Interfaces/user.interface';
import { StoryRepository } from '../../Repositories/StoryRepository';
import { UserRepository } from '../../Repositories/UserRepository';
import { JobRepository } from '../../Repositories/JobRepository';
import cloudinary from '../../Config/cloudinary';
import { firebaseAdmin } from '../../Config/firebase';

export class UserEvents {
  public static async onUserDeleted(user: HydratedDocument<IUser>) {
    const userId = user._id as unknown as string;
    console.log(`🗑️ Starting cleanup for user: ${userId}`);

    try {
      const storiesIdsToDelete =
        await UserRepository.getInstance().getUserStoriesIds(userId);
      let userJobsIds = await UserRepository.getInstance().getUserJobsIds(
        userId
      );
      await Promise.all([
        StoryRepository.getInstance().deleteManyByIds(
          userId,
          storiesIdsToDelete
        ),
        JobRepository.getInstance().deleteManyByJobIds(userJobsIds),
      ]);
      try {
        const folderPrefix = `user_${userId}`;
        await cloudinary.api.delete_resources_by_prefix(folderPrefix);
        await cloudinary.api.delete_folder(folderPrefix);
      } catch (cloudinaryError) {
        console.error(
          `Error deleting Cloudinary folder for user ${userId}:`,
          cloudinaryError
        );
      }
      await firebaseAdmin.auth().deleteUser(user.firebaseUid);
      console.log(`Completed cleanup for user: ${userId}`);
    } catch (error) {
      console.error(`Error during user cleanup for ${userId}:`, error);
      throw error;
    }
  }
}

export default UserEvents;
