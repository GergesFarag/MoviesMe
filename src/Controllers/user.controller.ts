import {
  userProfileResponse,
  UserProfileResponseDataKeys,
} from "../Interfaces/response.interface";
import User, { IUser } from "../Models/user.model";
import AppError from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import {
  ModelType,
  modelTypeMapper,
  reverseModelTypeMapper,
} from "../Utils/Format/filterModelType";

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

  getUserVideos: catchError(async (req, res) => {
    //@ts-ignore
    const userId = req.user.id;
    const modelType = req.query.modelType as string;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    if (!modelType) {
      throw new AppError("Model type is required", 400);
    }
    let filteringArr = modelType.split(",").map((item) => item.trim());
    filteringArr = filteringArr.map((type) => {
      return modelTypeMapper[type as ModelType] || type;
    });
    const user = await User.findById(userId)
      .lean()
      .skip((page - 1) * limit)
      .limit(limit);
    let userVideos = user?.videos?.filter((video) =>
      filteringArr.includes(video.modelType)
    );
    userVideos = userVideos?.map((video) => {
      return {
        ...video,
        modelType:
          reverseModelTypeMapper[
            video.modelType as keyof typeof reverseModelTypeMapper
          ] || video.modelType,
      };
    });
    if (!user) {
      throw new AppError("User not found", 404);
    }
    res.status(200).json({
      message: "User videos retrieved successfully",
      data: {
        videos: userVideos,
        paginationData: {
          page,
          limit,
        },
      },
    });
  }),
};

export default userController;
