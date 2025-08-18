import { Request, Response } from "express";
import User from "../Models/user.model";
import catchError from "../Utils/Errors/catchError";
import AppError from "../Utils/Errors/AppError";
import { firebaseAdmin } from "../Config/firebase";
import { FirebaseAppError } from "firebase-admin/app";

const adminController = {
  getAllUsers: catchError(async (req: Request, res: Response) => {
    const { page = 1, limit = 10 } = req.query;
    if (limit && isNaN(Number(limit))) {
      throw new AppError("Limit must be a number", 400);
    }
    const users = await User.find()
      .select("-password -__v")
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    res.status(200).json({
      message: "Users retrieved successfully",
      data: {
        users,
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
    const deletedUser = await User.findOneAndDelete(
      { _id: userId },
    );
    const firebaseReponse: any = await firebaseAdmin
      .auth()
      .deleteUser(user?.firebaseUid || "");
    if (
      firebaseReponse instanceof FirebaseAppError &&
      firebaseReponse.code === "auth/user-not-found"
    ) {
      throw new AppError("Failed to delete user from Firebase", 500);
    }
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
  
};
export default adminController;
