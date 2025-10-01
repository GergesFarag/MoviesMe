import { Request, Response } from "express";
import User from "../Models/user.model";
import catchError from "../Utils/Errors/catchError";
import AppError from "../Utils/Errors/AppError";
import { firebaseAdmin } from "../Config/firebase";
import { FirebaseAppError } from "firebase-admin/app";
import AudioModel from "../Models/audio.model";
import { TPaginationQuery } from "../types";
import paginator from "../Utils/Pagination/paginator";
import { Validator } from "../Services/validation.service";

const adminController = {
  getAllUsers: catchError(async (req: Request, res: Response) => {
    const { page = 1, limit = 10 }: TPaginationQuery = req.query;
    if (limit && isNaN(Number(limit))) {
      throw new AppError("Limit must be a number", 400);
    }
    const users = await User.find().select("-password -__v -items");
    const paginatedUsers = paginator(users, Number(page), Number(limit));
    res.status(200).json({
      message: "Users retrieved successfully",
      data: {
        users: paginatedUsers,
        paginationData: {
          page: Number(page),
          limit: Number(limit),
          total: await User.countDocuments(),
        },
      },
    });
  }),

  getUserById: catchError(async (req: Request, res: Response) => {
    const userId = req.params.id;
    const user = await User.findById(userId).select("-password -__v");
    if (!user) {
      throw new AppError("User not found", 404);
    }
    res
      .status(200)
      .json({ message: "User retrieved successfully", data: user });
  }),

  addUser: catchError(async (req: Request, res: Response) => {
    const newUser = await User.create(req.body);
    res.status(201).json({ message: "User added successfully", data: newUser });
  }),

  deleteUser: catchError(async (req: Request, res: Response) => {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    if (user.isAdmin) {
      throw new AppError("Cannot delete an admin user", 403);
    }
    try {
      await firebaseAdmin.auth().deleteUser(user?.firebaseUid);
    } catch (error) {
      throw new AppError("Failed to delete user from Firebase", 500);
    }
    const deletedUser = await User.findOneAndDelete({ _id: userId });
    res
      .status(200)
      .json({ message: "User deleted successfully", data: deletedUser });
  }),

  updateUser: catchError(async (req: Request, res: Response) => {
    const userId = req.params.id;
    const updatedUser = await User.findByIdAndUpdate(userId, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updatedUser) {
      throw new AppError("User not found", 404);
    }
    res
      .status(200)
      .json({ message: "User updated successfully", data: updatedUser });
  }),

  addModels: catchError(async (req: Request, res: Response) => {
    const {name , gender , language , elevenLabsId ,accent , thumbnail}  = req.body;
    const validator = new Validator();
    if(!name || !gender || !language || !elevenLabsId){
      validator.RequestBodyValidator.validateRequestBody(...Object.keys(req.body));
    }
    const audioModel = await AudioModel.create(req.body);
    res
      .status(201)
      .json({ message: "Audio model added successfully", data: audioModel });
  }),

  getAllModels: catchError(async (req: Request, res: Response) => {
    const models = await AudioModel.find();
    res
      .status(200)
      .json({ message: "Audio models retrieved successfully", data: models });
  }),

};
export default adminController;
