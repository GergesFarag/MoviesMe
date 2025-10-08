import Model from "../Models/ai.model.ts";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import User from "../Models/user.model";
import Job from "../Models/job.model";
import { getCachedModel, getCachedUser } from "../Utils/Cache/caching";
import {
  createQueueJobData,
  processModelJobAsync,
  processMultiImageJobAsync,
} from "../Services/applyModel.service";
import {
  getModelsByType,
  getTrendingModels,
} from "../Services/modelFetch.service";
import { TModelFetchQuery } from "../types";
import IAiModel from "../Interfaces/aiModel.interface";
import { translationService } from "../Services/translation.service";
import {
  MODEL_FILTER_TYPE,
  QUERY_TYPE_TO_FILTER,
} from "../Constants/modelConstants";
import { UserWithId } from "../types/modelProcessing.types";
import { taskQueue } from "../Queues/model.queue";
import { Types } from "mongoose";
import { QUEUE_NAMES } from "../Queues/Constants/queueConstants";

const modelsController = {
  getVideoModels: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.VIDEO,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: "Models retrieved successfully",
      data: result,
    });
  }),

  getImageModels: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.IMAGE,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: "Models retrieved successfully",
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

    const locale = req.headers["accept-language"] || "en";

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
      message: "Models retrieved successfully",
      data: result,
    });
  }),

  getCharacterEffects: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.CHARACTER,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: "Models retrieved successfully",
      data: result,
    });
  }),

  getAITools: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.AI_TOOL,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: "Models retrieved successfully",
      data: result,
    });
  }),

  getAI3DTools: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.AI_3D_TOOL,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: "Models retrieved successfully",
      data: result,
    });
  }),

  getMarketingTools: catchError(async (req, res) => {
    const { limit, page, sortBy, category }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";

    const result = await getModelsByType({
      filterType: MODEL_FILTER_TYPE.MARKETING_TOOL,
      limit,
      page,
      sortBy,
      category,
      locale,
    });

    res.status(200).json({
      message: "Models retrieved successfully",
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
      query[MODEL_FILTER_TYPE.TRENDING] = isTrending === "true";
    }

    console.log("Query:", query);
    const categories = (await Model.distinct("category").where(
      query
    )) as string[];
    const locale = req.headers["accept-language"] || "en";
    const translatedCategories = translationService.translateCategories(
      categories,
      locale
    );
    res.status(200).json({
      message: "Categories retrieved successfully",
      data: translatedCategories,
    });
  }),

  addModel: catchError(async (req, res) => {
    const newModel = new Model(req.body);
    await newModel.save();
    res
      .status(201)
      .json({ message: "Model added successfully", data: newModel });
  }),

  deleteModel: catchError(async (req, res) => {
    const { id } = req.params;
    if (!id) {
      throw new AppError("Model ID is required", 400);
    }
    const deletedModel = await Model.findByIdAndDelete(id);
    if (!deletedModel) {
      throw new AppError("Model not found", 404);
    }
    res
      .status(200)
      .json({ message: "Model deleted successfully", data: deletedModel });
  }),

  updateModel: catchError(async (req, res) => {
    const { id } = req.params;
    const existingModel = await Model.findById(id);
    if (!existingModel) {
      throw new AppError("Model not found", 404);
    }
    const model = { ...existingModel.toObject(), ...req.body };
    await Model.findByIdAndUpdate(id, model);
    res
      .status(200)
      .json({ message: "Model updated successfully", data: model });
  }),

  applyModel: catchError(async (req, res) => {
    const { modelId, payload } = req.body;
    const files = req.files as Express.Multer.File[];

    if (!modelId || !files || files.length === 0) {
      throw new AppError("Model ID and at least one image are required", 400);
    }

    const [user, model] = await Promise.all([
      getCachedUser(req.user!.id, User),
      getCachedModel(modelId),
    ]);

    if (!user) {
      throw new AppError("User not found", 404);
    }
    if (!model) {
      throw new AppError("Model data not found", 404);
    }

    const jobId = new Types.ObjectId().toString();

    res.status(202).json({
      message: "Model processing request accepted",
      jobId,
      status: "accepted",
    });

    try {
      const isMultiImage = files.length > 1;
      if (isMultiImage) {
        const result = await processMultiImageJobAsync({
          user: user as UserWithId,
          model,
          modelId,
          images: files,
          payload,
          jobId,
        });

        if (result.success) {
          console.log(
            `Model processing started successfully with job ID: ${result.jobId}`
          );
        } else {
          console.error(`Failed to start model processing: ${result.error}`);
        }
      } else {
        const result = await processModelJobAsync({
          user: user as UserWithId,
          model,
          modelId,
          image: files[0],
          payload,
          jobId,
        });

        if (result.success) {
          console.log(
            `Model processing started successfully with job ID: ${result.jobId}`
          );
        } else {
          console.error(`Failed to start model processing: ${result.error}`);
        }
      }
    } catch (error) {
      console.error(`Unexpected error in model processing:`, error);
    }
  }),

  retryEffectJob: catchError(async (req, res) => {
    const { jobId } = req.params;
    const userId = req.user?.id;

    if (!jobId) {
      throw new AppError("Job ID is required", 400);
    }

    if (!userId) {
      throw new AppError("User authentication required", 401);
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const effectItem = user.effectsLib?.find((item) => item.jobId === jobId);
    if (!effectItem) {
      throw new AppError("Effect item not found for the given Job ID", 404);
    }
    const existingModelJob = await taskQueue.getJob(effectItem.jobId);

    if (
      existingModelJob &&
      !["completed", "failed"].includes(
        existingModelJob.finishedOn ? "completed" : "failed"
      )
    ) {
      throw new AppError(
        `Job ${effectItem.jobId} is already being processed`,
        409
      );
    }
    const model = (await Model.findById(
      effectItem.data.modelId
    ).lean()) as IAiModel;
    const key =
      effectItem.data.images && effectItem.data.images.length > 1
        ? "images"
        : "image";
    try {
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

      await Job.findByIdAndUpdate(effectItem.jobId, {
        status: "pending",
        updatedAt: new Date(),
      });

      res.status(200).json({
        message: "Effect job successfully added back to queue",
        data: {
          jobId: job.id,
          status: "pending",
          queueType: "model",
        },
      });
    } catch (queueError) {
      console.error("Error adding model job to queue:", queueError);
      throw new AppError("Failed to add model job to processing queue", 500);
    }
  }),
};
export default modelsController;
