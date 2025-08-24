import { deleteModel, ObjectId } from "mongoose";
import Model from "../Models/aiModel.model";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import IAiModel from "../Interfaces/aiModel.interface";
import { runModel } from "../Utils/APIs/wavespeed_calling";
import { filterModelType } from "../Utils/Format/filterModelType";
import { cloudUpload } from "../Utils/APIs/cloudinary";
import { UploadApiResponse } from "cloudinary";
import modelQueue, { taskQueue } from "../Queues/model.queue";

const modelsController = {
  getVideoModels: catchError(async (req, res) => {
    const { limit = 5, page = 1 }: { limit?: number; page?: number } =
      req.query;
    const models = await Model.find({
      isVideoEffect: true,
    })
      .select("-__v")
      .skip((page - 1) * limit)
      .limit(limit);
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models: models,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments({
            isVideoEffect: true,
          }),
        },
      },
    });
  }),
  getImageModels: catchError(async (req, res) => {
    const { limit = 5, page = 1 }: { limit?: number; page?: number } =
      req.query;
    const models = await Model.find({
      isImageEffect: true,
    })
      .select("-__v")
      .skip((page - 1) * limit)
      .limit(limit);
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments({
            isImageEffect: true,
          }),
        },
      },
    });
  }),

  getTrendingModels: catchError(async (req, res) => {
    const { limit = 5, page = 1 }: { limit?: number; page?: number } =
      req.query;
    const models = await Model.find({ isTrending: true })
      .select("-__v")
      .skip((page - 1) * limit)
      .limit(limit);
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models,
        paginationData: {
          page,
          limit,
          total: await Model.countDocuments({ isTrending: true }),
        },
      },
    });
  }),
  getCharacterEffects: catchError(async (req, res) => {
    const { limit = 5, page = 1 }: { limit?: number; page?: number } =
      req.query;
    const models = await Model.find({ isCharacterEffect: true })
      .select("-__v")
      .skip((page - 1) * limit)
      .limit(limit);
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments({ isCharacterEffect: true }),
        },
      },
    });
  }),
  getAITools: catchError(async (req, res) => {
    const { limit = 5, page = 1 }: { limit?: number; page?: number } =
      req.query;
    const models = await Model.find({ isAITool: true })
      .select("-__v")
      .skip((page - 1) * limit)
      .limit(limit);
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments({ isAITool: true }),
        },
      },
    });
  }),
  getAI3DTools: catchError(async (req, res) => {
    const { limit = 5, page = 1 }: { limit?: number; page?: number } =
      req.query;
    const models = await Model.find({ isAI3DTool: true })
      .select("-__v")
      .skip((page - 1) * limit)
      .limit(limit);
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments({ isAITool: true }),
        },
      },
    });
  }),
  getMarketingTools: catchError(async (req, res) => {
    const { limit = 5, page = 1 }: { limit?: number; page?: number } =
      req.query;
    const models = await Model.find({ isMarketingTool: true })
      .select("-__v")
      .skip((page - 1) * limit)
      .limit(limit);
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments({ isMarketingTool: true }),
        },
      },
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
    const { modelId } = req.body;
    const {...rest} = req.body.payload;
    const image = req.file;
    if (!modelId || !image) {
      throw new AppError("Model ID and image are required", 400);
    }
    const fieldsWithSelectFalse = Object.keys(Model.schema.paths)
      .filter((path) => Model.schema.paths[path].options.select === false)
      .map((path) => `+${path}`);

    const model = await Model.findById(modelId)
      .select(fieldsWithSelectFalse.join(" "))
      .lean();
    if (!model) {
      throw new AppError("Model not found", 404);
    }
    //filter model to its category based on boolean fields
    const modelType = filterModelType(model);
    //upload the streams into cloudinary
    const imageUrl = (await cloudUpload(image.buffer)) as UploadApiResponse;
    //check if imageUrl is valid
    if (!imageUrl || !imageUrl.url) {
      throw new AppError("Image upload failed", 500);
    }
    const job = await taskQueue.add(
      {
        modelName: model.name,
        type: modelType,
        data: { image: imageUrl.url, ...rest },
      },
      {
        jobId: `model_${modelId}_${Date.now()}`,
      }
    );
    res.status(202).json({
      message: "Model processing started",
      jobId: job.id,
    });
  }),

  getJobStatus: catchError(async (req, res) => {
    const { id } = req.params;

    const job = await taskQueue.getJob(id);

    if (!job) {
      throw new AppError("Job not found", 404);
    }
    const progress = job.progress();
    const result = job.returnvalue;
    const failedReason = job.failedReason;
    const customStatus = job.data.status || "unknown";
    const customProgress = job.data.progress || progress;
    const customData = {
      requestId: job.data.requestId,
      resultUrl: job.data.resultUrl,
      error: job.data.error,
      apiStatus: job.data.apiStatus,
      startedAt: job.data.startedAt,
      completedAt: job.data.completedAt,
      failedAt: job.data.failedAt,
    };
    res.json({
      jobId: id,
      status: customStatus,
      progress: customProgress,
      result: {
        success: result ? true : false,
        data: result,
      },
      failedReason,
      timestamp: job.timestamp,
      customData,
    });
  }),
};
export default modelsController;
