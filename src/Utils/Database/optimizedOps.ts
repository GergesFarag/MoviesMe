import User from '../../Models/user.model';
import Job from '../../Models/job.model';
import { IItem } from '../../Interfaces/item.interface';

export interface JobCreationData {
  jobId: string;
  userId: string;
  modelId: string;
  status: string;
}

export interface ItemData {
  URL: string;
  modelType: string;
  jobId: string;
  status: string;
  modelName: string;
  isVideo: boolean;
  modelThumbnail: string;
  duration: number;
}

export const createJobAndUpdateUser = async (
  userId: string,
  jobData: JobCreationData,
  itemData: ItemData
) => {
  const [createdJob] = await Promise.all([
    Job.create(jobData),
  ]);

  const itemWithTimestamps = {
    ...itemData,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  await User.findByIdAndUpdate(
    userId,
    {
      $push: {
        items: itemWithTimestamps,
        jobs: { _id: createdJob._id, jobId: createdJob.jobId }
      }
    },
    { 
      new: false,
      writeConcern: { w: 1 }
    }
  );

  return createdJob;
};
export const getItemFromUser = async (userId: string, jobId: string): Promise<IItem | null> => {
  const user = await User.findById(userId).lean();
  if (!user) return null;

  const item = user.items?.find((item: IItem) => item.jobId === jobId);
  return item || null;
};

