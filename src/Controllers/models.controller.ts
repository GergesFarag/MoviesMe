import Model from "../Models/ai.model.ts";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import User from "../Models/user.model";
import { getCachedModel, getCachedUser } from "../Utils/Cache/caching";
import {
  processModelJobAsync,
  processMultiImageJobAsync,
} from "../Services/applyModel.service";
import { Sorting } from "../Utils/Sorting/sorting";
import paginator from "../Utils/Pagination/paginator";
import { TModelFetchQuery } from "../types";
import IAiModel from "../Interfaces/aiModel.interface";
import { translationService } from "../Services/translation.service";

const modelsController = {
  getVideoModels: catchError(async (req, res) => {
    const {
      limit = 5,
      page = 1,
      sortBy = "newest",
      category = "all",
    }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";
    const categoryKey = translationService.getCategoryKey(category, locale);

    let query: Record<string, boolean | string> = { isVideoEffect: true };
    if (categoryKey !== "all") {
      query.category = categoryKey;
    }
    const models = await Model.find(query).select("-__v");
    const sortedModels = Sorting.sortItems(models, sortBy);
    const paginatedModels = paginator(
      sortedModels,
      Number(page),
      Number(limit)
    );
    const translatedModels = translationService.translateModels(
      paginatedModels,
      req.headers["accept-language"] || "en"
    );
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models: translatedModels,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments(query),
        },
      },
    });
  }),

  getImageModels: catchError(async (req, res) => {
    const {
      limit = 5,
      page = 1,
      sortBy = "newest",
      category = "all",
    }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";
    const categoryKey = translationService.getCategoryKey(category, locale);

    let query: Record<string, boolean | string> = { isImageEffect: true };
    if (categoryKey !== "all") {
      query.category = categoryKey;
    }
    const models = await Model.find(query).select("-__v");

    if (!models) {
      throw new AppError("No models found", 404);
    }

    const sortedModels = Sorting.sortItems(models, sortBy);
    const paginatedModels = paginator(
      sortedModels,
      Number(page),
      Number(limit)
    );
    const translatedModels = translationService.translateModels(
      paginatedModels,
      req.headers["accept-language"] || "en"
    );
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models: translatedModels,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments(query),
        },
      },
    });
  }),

  getTrendingModels: catchError(async (req, res) => {
    const {
      limit = 5,
      page = 1,
      sortBy = "newest",
      type = "all",
      category = "all",
    }: TModelFetchQuery & { type?: string } = req.query;

    const locale = req.headers["accept-language"] || "en";
    const categoryKey = translationService.getCategoryKey(category, locale);

    const query: Record<string, boolean | string> = { isTrending: true };
    const filter: Record<string, string> = {
      video: "isVideoEffect",
      image: "isImageEffect",
    };

    if (type !== "all") {
      query[filter[type]] = true;
    }
    if (categoryKey !== "all") {
      query.category = categoryKey;
    }
    const models = await Model.find(query).select("-__v");
    if (!models) {
      throw new AppError("No models found", 404);
    }
    const sortedModels = Sorting.sortItems(models, sortBy);
    const paginatedModels = paginator(
      sortedModels,
      Number(page),
      Number(limit)
    );
    const translatedModels = translationService.translateModels(
      paginatedModels,
      req.headers["accept-language"] || "en"
    );
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models: translatedModels,
        paginationData: {
          page,
          limit,
          total: await Model.countDocuments(query),
        },
      },
    });
  }),

  getCharacterEffects: catchError(async (req, res) => {
    const {
      limit = 5,
      page = 1,
      sortBy = "newest",
      category = "all",
    }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";
    const categoryKey = translationService.getCategoryKey(category, locale);

    let query: Record<string, boolean | string> = { isCharacterEffect: true };
    if (categoryKey !== "all") {
      query.category = categoryKey;
    }
    const models = await Model.find(query).select("-__v");

    const sortedModels = Sorting.sortItems(models, sortBy);
    const paginatedModels = paginator(
      sortedModels,
      Number(page),
      Number(limit)
    );

    if (!models) {
      throw new AppError("No models found", 404);
    }
    const translatedModels = translationService.translateModels(
      paginatedModels,
      req.headers["accept-language"] || "en"
    );
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models: translatedModels,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments(query),
        },
      },
    });
  }),

  getAITools: catchError(async (req, res) => {
    const {
      limit = 5,
      page = 1,
      sortBy = "newest",
      category = "all",
    }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";
    const categoryKey = translationService.getCategoryKey(category, locale);

    let query: Record<string, boolean | string> = { isAITool: true };
    if (categoryKey !== "all") {
      query.category = categoryKey;
    }
    const models = await Model.find(query).select("-__v");
    if (!models) {
      throw new AppError("No models found", 404);
    }

    const sortedModels = Sorting.sortItems(models, sortBy);
    const paginatedModels = paginator(
      sortedModels,
      Number(page),
      Number(limit)
    );
    const translatedModels = translationService.translateModels(
      paginatedModels,
      req.headers["accept-language"] || "en"
    );
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models: translatedModels,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments(query),
        },
      },
    });
  }),

  getAI3DTools: catchError(async (req, res) => {
    const {
      limit = 5,
      page = 1,
      sortBy = "newest",
      category = "all",
    }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";
    const categoryKey = translationService.getCategoryKey(category, locale);

    let query: Record<string, boolean | string> = { isAI3DTool: true };
    if (categoryKey !== "all") {
      query.category = categoryKey;
    }
    const models = await Model.find(query).select("-__v");

    const sortedModels = Sorting.sortItems(models, sortBy);
    const paginatedModels = paginator(
      sortedModels,
      Number(page),
      Number(limit)
    );
    const translatedModels = translationService.translateModels(
      paginatedModels,
      req.headers["accept-language"] || "en"
    );
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models: translatedModels,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments(query),
        },
      },
    });
  }),

  getMarketingTools: catchError(async (req, res) => {
    const {
      limit = 5,
      page = 1,
      sortBy = "newest",
      category = "all",
    }: TModelFetchQuery = req.query;

    const locale = req.headers["accept-language"] || "en";
    const categoryKey = translationService.getCategoryKey(category, locale);

    let query: Record<string, boolean | string> = { isMarketingTool: true };
    if (categoryKey !== "all") {
      query.category = categoryKey;
    }

    const models = await Model.find(query).select("-__v");

    const sortedModels = Sorting.sortItems(models, sortBy);
    const paginatedModels = paginator(
      sortedModels,
      Number(page),
      Number(limit)
    );
    const translatedModels = translationService.translateModels(
      paginatedModels,
      req.headers["accept-language"] || "en"
    );
    if (!models) {
      throw new AppError("No models found", 404);
    }
    res.status(200).json({
      message: "Models retrieved successfully",
      data: {
        models: translatedModels,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await Model.countDocuments(query),
        },
      },
    });
  }),

  getModelsCategories: catchError(async (req, res) => {
    const { type, isTrending } = req.query;
    console.log("isTrending:", isTrending);
    const filter: Record<string, string> = {
      video: "isVideoEffect",
      image: "isImageEffect",
      character: "isCharacterEffect",
      aitool: "isAITool",
      ai3dtool: "isAI3DTool",
      marketingtool: "isMarketingTool",
    };
    let query: Record<string, boolean | string> = {};
    if (type && filter[type as keyof typeof filter]) {
      query[filter[type as keyof typeof filter]] = true;
    }
    if (isTrending !== undefined) {
      query["isTrending"] = isTrending === "true";
    }
    console.log("Query:", query);
    const categories = (await Model.distinct("category").where(query)) as string[];
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
    let images: Express.Multer.File[] = [];
    let image: Express.Multer.File = {} as Express.Multer.File;
    if (files && files.length > 1) {
      images = files;
    } else {
      image = files[0];
    }
    if (!modelId || (!image && images.length === 0)) {
      throw new AppError("Model ID and images are required", 400);
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
    const jobId = `${modelId}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 9)}`;

    res.status(202).json({
      message: "Model processing request accepted",
      jobId: jobId,
      status: "accepted",
    });

    try {
      if (image && !images.length) {
        const result = await processModelJobAsync({
          user,
          model,
          modelId,
          image,
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
      } else if (images && images.length > 0) {
        const result = await processMultiImageJobAsync({
          user,
          model,
          modelId,
          images,
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
};
export default modelsController;
