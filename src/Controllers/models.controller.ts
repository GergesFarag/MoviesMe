import { deleteModel } from "mongoose";
import Model from "../Models/aiModel.model";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";

const modelsController = {
  getVideoModels: catchError(async (req, res) => {
    const { limit = 5, page = 1 }: { limit?: number; page?: number } =
      req.query;
    const models = await Model.find({ isVideo: true })
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
          total: await Model.countDocuments({ isVideo: true }),
        },
      },
    });
  }),

  getImageModels: catchError(async (req, res) => {
    const { limit = 5, page = 1 }: { limit?: number; page?: number } =
      req.query;
    const models = await Model.find({ isVideo: false })
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
          total: await Model.countDocuments({ isVideo: false }),
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
};
export default modelsController;
