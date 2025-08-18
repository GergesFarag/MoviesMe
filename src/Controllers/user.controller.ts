import {
  userProfileResponse,
  UserProfileResponseDataKeys,
} from "../Interfaces/response.interface";
import User, { IUser } from "../Models/user.model";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";

const fieldsToSelect: UserProfileResponseDataKeys[] = [
  "username",
  "email",
  "phoneNumber",
  "credits",
  "userLocation",
  "dob",
  "isMale",
  "profilePicture",
];

const userController = {
  getProfile: catchError(async (req, res) => {
    //@ts-ignore
    const user = await User.findById(req.user.id).select(fieldsToSelect);
    res.status(200).json({
      message: "User profile retrieved successfully",
      data: user,
    } as userProfileResponse);
  }),

  updateProfile: catchError(async (req, res) => {
    //@ts-ignore
    const { id } = req.user;
    const user = await User.findById(id).select(fieldsToSelect);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const updatedData = {
      ...req.body,
    };

    Object.keys(updatedData).forEach((key) => {
      if (key in user && key in updatedData) {
        (user as any)[key] = updatedData[key as keyof typeof updatedData];
      }
    });
    await user.save();

    res.status(200).json({
      message: "User profile updated successfully",
      data: user,
    } as userProfileResponse);
  }),
};

export default userController;
