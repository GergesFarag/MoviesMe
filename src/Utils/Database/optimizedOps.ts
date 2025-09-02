import User from '../../Models/user.model';
import Job from '../../Models/job.model';

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
  console.log("Items with timestamps:", itemWithTimestamps);
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
