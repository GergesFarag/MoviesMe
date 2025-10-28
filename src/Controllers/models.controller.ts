import Model from '../Models/ai.model';
import AppError from '../Utils/Errors/AppError';
import { HTTP_STATUS_CODE } from '../Enums/error.enum';
import catchError from '../Utils/Errors/catchError';
import User from '../Models/user.model';
import Job from '../Models/job.model';
import { getCachedModel, getCachedUser } from '../Utils/Cache/caching';
import {
  createQueueJobData,
  processModelJobAsync
} from '../Services/applyModel.service';
import {
  getModelsByType,
  getTrendingModels,
} from '../Services/modelFetch.service';
import { TModelFetchQuery } from '../types';
import IAiModel from '../Interfaces/aiModel.interface';
import { translationService } from '../Services/translation.service';
import {
  MODEL_FILTER_TYPE,
  QUERY_TYPE_TO_FILTER,
} from '../Constants/modelConstants';
import { UserWithId } from '../types/modelProcessing.types';
import { taskQueue } from '../Queues/model.queue';
import { Types } from 'mongoose';
import { QUEUE_NAMES } from '../Queues/Constants/queueConstants';
import { CreditService } from '../Services/credits.service';
import { NotificationService } from '../Services/notification.service';
import { ModelRepository } from '../Repositories/ModelRepository';
import { UserRepository } from '../Repositories/UserRepository';
import { JobRepository } from '../Repositories/JobRepository';

const modelRepository = ModelRepository.getInstance();
const userRepository = UserRepository.getInstance();
const jobRepository = JobRepository.getInstance();

const modelsController = {
  getVideoModels: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers['accept-language'] || 'en';

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.VIDEO,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: 'Models retrieved successfully',
      data: result,
    });
  }),

  getImageModels: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers['accept-language'] || 'en';

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.IMAGE,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: 'Models retrieved successfully',
      data: result,
    });
  }),

  getTrendingModels: catchError(async (req, res) => {
    const {
      limit,
      page,
      sortBy,
      types,
      category,
    }: TModelFetchQuery & { types?: string } = req.query;

    const locale = req.headers['accept-language'] || 'en';

    const result = await getTrendingModels({
      filterType: MODEL_FILTER_TYPE.TRENDING,
      limit,
      page,
      sortBy,
      category,
      locale,
      types,
    });

    res.status(200).json({
      message: 'Models retrieved successfully',
      data: result,
    });
  }),

  getCharacterEffects: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers['accept-language'] || 'en';

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.CHARACTER,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: 'Models retrieved successfully',
      data: result,
    });
  }),

  getAITools: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers['accept-language'] || 'en';

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.AI_TOOL,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: 'Models retrieved successfully',
      data: result,
    });
  }),

  getAI3DTools: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers['accept-language'] || 'en';

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.AI_3D_TOOL,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: 'Models retrieved successfully',
      data: result,
    });
  }),

  getMarketingTools: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers['accept-language'] || 'en';

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.MARKETING_TOOL,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: 'Models retrieved successfully',
      data: result,
    });
  }),

  getModelsCategories: catchError(async (req, res) => {
    const { types, isTrending } = req.query;

    let query: Record<string, boolean | string> = {};

    if (types && QUERY_TYPE_TO_FILTER[types as string]) {
      query[QUERY_TYPE_TO_FILTER[types as string]] = true;
    }

    if (isTrending !== undefined) {
      query[MODEL_FILTER_TYPE.TRENDING] = isTrending === 'true';
    }

    console.log('Query:', query);
    const categories = (await Model.distinct('category').where(
      query
    )) as string[];
    const locale = req.headers['accept-language'] || 'en';
    const translatedCategories = translationService.translateCategories(
      categories,
      locale
    );
    res.status(200).json({
      message: 'Categories retrieved successfully',
      data: translatedCategories,
    });
  }),

  addModel: catchError(async (req, res) => {
    const newModel = await modelRepository.create(req.body);
    res
      .status(201)
      .json({ message: 'Model added successfully', data: newModel });
  }),

  deleteModel: catchError(async (req, res) => {
    const { id } = req.params;
    if (!id) {
      throw new AppError('Model ID is required', 400);
    }
    const deletedModel = await modelRepository.delete(id);
    if (!deletedModel) {
      throw new AppError('Model not found', 404);
    }
    res
      .status(200)
      .json({ message: 'Model deleted successfully', data: deletedModel });
  }),

  updateModel: catchError(async (req, res) => {
    const { id } = req.params;
    const existingModel = await modelRepository.findById(id);
    if (!existingModel) {
      throw new AppError('Model not found', 404);
    }
    const model = { ...existingModel, ...req.body };
    const updatedModel = await modelRepository.updateModel(id, model);
    res
      .status(200)
      .json({ message: 'Model updated successfully', data: updatedModel });
  }),

  applyModel: catchError(async (req, res) => {
    const { modelId, payload } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!modelId || !files || files.length === 0) {
      throw new AppError('Model ID and at least one image are required', 400);
    }

    const [user, model] = await Promise.all([
      getCachedUser(req.user!.id, User),
      getCachedModel(modelId),
    ]);

    if (!user) {
      throw new AppError('User not found', 404);
    }
    if (!model) {
      throw new AppError('Model data not found', 404);
    }
    const creditService = CreditService.getInstance();
    const notificationService = NotificationService.getInstance();
    const hasSufficientCredits = await creditService.hasSufficientCredits(
      req.user!.id,
      model.credits
    );
    if (!hasSufficientCredits) {
      throw new AppError(
        'Insufficient credits to apply this model',
        HTTP_STATUS_CODE.PAYMENT_REQUIRED
      );
    } else {
      const deductCredits = await creditService.deductCredits(
        req.user?.id,
        Number(model.credits)
      );
      if (!deductCredits) {
        console.error(`❌ Failed to deduct credits for user ${req.user?.id}`);
        return;
      }
      const transactionNotificationData = {
        userCredits: await creditService.getCredits(req.user?.id),
        consumedCredits: model.credits,
      };
      await notificationService.sendTransactionalSocketNotification(
        req.user?.id,
        transactionNotificationData
      );
    }
    const jobId = new Types.ObjectId().toString();

    res.status(202).json({
      message: 'Model processing request accepted',
      jobId,
      status: 'accepted',
    });

    try {
      const result = processModelJobAsync({
        user: user as UserWithId,
        model: model as IAiModel,
        modelId: modelId,
        payload,
        images: files,
        jobId
      });
      console.log(`Model processing initiated for job ${jobId}:`, {result});
    } catch (error) {
      console.error(`Unexpected error in model processing:`, error);
    }
  }),

  retryEffectJob: catchError(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!jobId) {
      throw new AppError('Job ID is required', 400);
    }

    if (!userId) {
      throw new AppError('User authentication required', 401);
    }

    const user = await userRepository.findById(userId, 'effectsLib FCMToken');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    const effectItem = user.effectsLib?.find((item) => item.jobId === jobId);
    if (!effectItem) {
      throw new AppError('Effect item not found for the given Job ID', 404);
    }
    const existingModelJob = await taskQueue.getJob(effectItem.jobId);

    if (
      existingModelJob &&
      !['completed', 'failed'].includes(
        existingModelJob.finishedOn ? 'completed' : 'failed'
      )
    ) {
      throw new AppError(
        `Job ${effectItem.jobId} is already being processed`,
        409
      );
    }
    const model = (await modelRepository.findById(
      effectItem.data.modelId
    )) as IAiModel;
    const creditService = CreditService.getInstance();
    const notificationService = NotificationService.getInstance();
    const hasSufficientCredits = await creditService.hasSufficientCredits(
      req.user!.id,
      +model.credits
    );
    if (!hasSufficientCredits) {
      throw new AppError(
        'Insufficient credits to create story',
        HTTP_STATUS_CODE.PAYMENT_REQUIRED
      );
    } else {
      const deductCredits = await creditService.deductCredits(
        userId,
        Number(model.credits)
      );
      if (!deductCredits) {
        console.error(`❌ Failed to deduct credits for user ${userId}`);
        return;
      }
      const transactionNotificationData = {
        userCredits: await creditService.getCredits(userId),
        consumedCredits: model.credits,
      };
      await notificationService.sendTransactionalSocketNotification(
        userId,
        transactionNotificationData
      );
    }
    try {
      const key =
        effectItem.data.images && effectItem.data.images.length > 1
          ? 'images'
          : 'image';
      const queueJobData = createQueueJobData(
        model,
        user._id.toString(),
        {
          [key]:
            effectItem.data.images.length > 1
              ? effectItem.data.images
              : effectItem.data.images[0],
        },
        user.FCMToken || undefined
      );

      const job = await taskQueue.add(queueJobData, {
        jobId,
        removeOnComplete: true,
        removeOnFail: true,
      });

      await jobRepository.updateJobStatus(String(effectItem.jobId), 'pending');

      res.status(200).json({
        message: 'Effect job successfully added back to queue',
        data: {
          jobId: job.id,
          status: 'pending',
          queueType: 'model',
        },
      });
    } catch (queueError) {
      console.error('Error adding model job to queue:', queueError);
      throw new AppError('Failed to add model job to processing queue', 500);
    }
  }),
};
export default modelsController;
