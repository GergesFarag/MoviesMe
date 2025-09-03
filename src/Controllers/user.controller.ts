import { IItem } from "../Interfaces/item.interface";
import {
  userProfileResponse,
  UserProfileResponseDataKeys,
} from "../Interfaces/response.interface";
import User from "../Models/user.model";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import {
  ModelType,
  modelTypeMapper
} from "../Utils/Format/filterModelType";
import paginator from "../Utils/Pagination/paginator";
import Job from "../Models/job.model";
import { UploadApiResponse } from "cloudinary";
import { cloudUpload, generateImageHash } from "../Utils/APIs/cloudinary";
import { ItemDTO } from "../DTOs/item.dto";

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
    const user = await User.findById(req.user!.id).select(fieldsToSelect).select("-items");
    res.status(200).json({
      message: "User profile retrieved successfully",
      data: user,
    } as userProfileResponse);
  }),

  updateProfile: catchError(async (req, res) => {
    const { id } = req.user!;
    const profilePicture = req.file;
    if (
      Object.keys(req.body).includes("profilePicture") &&
      req.body.profilePicture === "null"
    ) {
      req.body.profilePicture = null;
    } else {
      if (profilePicture) {
        const imageHash = generateImageHash(profilePicture.buffer);
        const result = (await cloudUpload(
          profilePicture.buffer,
          imageHash
        )) as UploadApiResponse;
        req.body.profilePicture = result.secure_url;
      }
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
    }
  }),

  getUserLibrary: catchError(async (req, res) => {
    const userId = req.user!.id;
    const modelType = req.query.modelType as string;
    const limit = req.query.limit
      ? parseInt(req.query.limit as string, 10)
      : 20;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const status = req.query.status as string;
    const isFav = req.query.isFav;
    const sortBy = (req.query.sortBy as string) || "newest";
    const sortOrder = sortBy === "oldest" ? 1 : -1;

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
      return modelTypeMapper[type as ModelType];
    });
    const user = await User.findById(userId).lean();

    if (!user) {
      throw new AppError("User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }
    const userItems = user.items?.sort((a, b) => {
      let aTime: number;
      let bTime: number;

      if (a.createdAt && b.createdAt) {
        aTime = new Date(a.createdAt).getTime();
        bTime = new Date(b.createdAt).getTime();
      } else {
        aTime = a._id!.getTimestamp().getTime();
        bTime = b._id!.getTimestamp().getTime();
      }

      return sortOrder === -1 ? bTime - aTime : aTime - bTime;
    }) || [];
    let userLib: IItem[] = userItems;
    let paginatedItems: IItem[] = [];
    if (userItems) {
      userLib = userItems.filter((item: any) => {
        return (
          ((status as string) === "all" ? true : item.status === status) &&
          filteringArr.find((type) => type === item.modelType)
        );
      });
      if (isFav !== undefined) {
        const favStatus = isFav === "true";
        userLib = userLib.filter((item) => item.isFav === favStatus);
      }
      paginatedItems = paginator(userLib, page, limit);
    }
    const itemsDTO = ItemDTO.toListDTO(paginatedItems);
    res.status(200).json({
      message: "User items retrieved successfully",
      data: {
        items: itemsDTO,
        paginationData: {
          page,
          limit,
          total: userLib?.length || 0,
        },
      },
    });
  }),

  toggleFav: catchError(async (req, res) => {
    const userId = req.user!.id;
    const itemId = req.body.itemId;

    if (!itemId) {
      throw new AppError("Item ID is required", 400);
    }

    const user = await User.findById(userId);
    
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const itemIds = user?.items?.map(item => item._id!.toString());
    if (!itemIds!.includes(itemId)) {
      throw new AppError("Item not found", 404);
    }
    user.items?.map((item) => {
      if (item._id!.toString() === itemId) {
        item.isFav = !item.isFav;
      }
    });
    await user.save();
    res.status(HTTP_STATUS_CODE.OK).json({
      message: "User favorites updated successfully",
      data: {
        userFavs: user.items?.filter((item) => item.isFav === true),
      },
    });
  }),

  deleteItem: catchError(async (req, res) => {
    const userId = req.user!.id;
    const itemId = req.params.itemId;

    if (!itemId) {
      throw new AppError("Item ID is required", 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }
    const item = user.items?.find((item) => item._id!.toString() === itemId);
    if (!item) {
      throw new AppError("Item not found", 404);
    }
    user.items = user?.items?.filter((item) => item._id!.toString() !== itemId);
    user.jobs = user?.jobs?.filter((j) => j.jobId !== item.jobId);
    await Job.findOneAndDelete({ jobId: item.jobId });
    await user!.save();
    res.status(HTTP_STATUS_CODE.OK).json({
      message: "User item deleted successfully",
      data: {
        item: ItemDTO.toDTO(item)
      },
    });
  }),

  getNotifications: catchError(async (req, res) => {
    const userId = req.user!.id;

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const notifications = user.notifications || [];
    res.status(200).json({
      message: "User notifications retrieved successfully",
      data: {
        notifications,
      },
    });
  })
};

export default userController;
