import {
  userProfileResponse,
  UserProfileResponseDataKeys,
} from "../Interfaces/response.interface";
import User, { IUser } from "../Models/user.model";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import {
  ModelType,
  modelTypeMapper,
  reverseModelTypeMapper,
} from "../Utils/Format/filterModelType";
import paginator from "../Utils/Pagination/paginator";

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
    const user = await User.findById(req.user!.id).select(fieldsToSelect);
    res.status(200).json({
      message: "User profile retrieved successfully",
      data: user,
    } as userProfileResponse);
  }),

  updateProfile: catchError(async (req, res) => {
    const { id } = req.user!;
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

  getUserLibrary: catchError(async (req, res) => {
    const userId = req.user!.id;
    const modelType = req.query.modelType as string;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const status = req.query.status as string;

    if (isNaN(page) || page <= 0) {
      throw new AppError("Invalid page number", 400);
    }
    if (isNaN(limit) || limit <= 0) {
      throw new AppError("Invalid limit", 400);
    }

    if (!modelType) {
      throw new AppError("Model type is required", 400);
    }

    let filteringArr = modelType.split(",").map((item) => item.trim());
    filteringArr = filteringArr.map((type) => {
      return modelTypeMapper[type as ModelType] || type;
    });
    console.log("FilteringArr" , filteringArr);
    const user = await User.findById(userId).lean();

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }
    let userLib: any[] = [];
    let paginatedItems: any[] = [];
    if (user.items) {
      userLib = user?.items?.filter(
        (item) =>
          filteringArr.includes(item.modelType!) && item.status === status
      );
      paginatedItems = paginator(userLib, page, limit);
      paginatedItems = paginatedItems?.map((item: any) => {
        return {
          ...item,
          modelType:
            reverseModelTypeMapper[
              item.modelType as keyof typeof reverseModelTypeMapper
            ] || item.modelType,
        };
      });
    }

    res.status(200).json({
      message: "User items retrieved successfully",
      data: {
        items: paginatedItems,
        paginationData: {
          page,
          limit,
          total: userLib?.length || 0,
        },
      },
    });
  }),
};

export default userController;
