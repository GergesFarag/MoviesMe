import { IJob } from '../Interfaces/job.interface';
import Job from '../Models/job.model';
import { BaseRepository } from './BaseRepository';
import mongoose from 'mongoose';

export interface JobCreationData {
  jobId: string;
  userId: string;
  modelId?: string;
  status: string;
}

export class JobRepository extends BaseRepository<IJob> {
  private static instance: JobRepository;

  private constructor() {
    super(Job);
  }

  public static getInstance(): JobRepository {
    if (!JobRepository.instance) {
      JobRepository.instance = new JobRepository();
    }
    return JobRepository.instance;
  }

  async findByJobId(jobId: string): Promise<IJob | null> {
    return this.findOne({ jobId });
  }

  async updateJobStatus(jobId: string, status: string): Promise<IJob | null> {
    return this.model.findOneAndUpdate(
      { jobId },
      { status, updatedAt: new Date() },
      { new: true }
    );
  }

  async createJobWithData(jobData: JobCreationData): Promise<IJob> {
    const jobToCreate: any = {
      jobId: jobData.jobId,
      userId: jobData.userId,
      status: jobData.status,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (jobData.modelId) {
      jobToCreate.modelId = new mongoose.Types.ObjectId(jobData.modelId);
    }

    return this.create(jobToCreate);
  }

  async createStoryJob(
    userId: string,
    jobId: string,
    modelId?: string
  ): Promise<IJob> {
    const defaultModelId = new mongoose.Types.ObjectId();

    return this.create({
      jobId,
      userId: userId as any,
      modelId: modelId ? new mongoose.Types.ObjectId(modelId) : defaultModelId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
  }
}
