import { IEffectItem } from "../Interfaces/effectItem.interface";
import {
  userProfileResponse,
  UserProfileResponseDataKeys,
} from "../Interfaces/response.interface";
import User from "../Models/user.model";
import Story from "../Models/story.model";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import { ModelType, modelTypeMapper } from "../Utils/Format/filterModelType";
import paginator from "../Utils/Pagination/paginator";
import Job from "../Models/job.model";
import { UploadApiResponse } from "cloudinary";
import { cloudUpload, generateImageHash } from "../Utils/APIs/cloudinary";
import { ItemDTO } from "../DTOs/item.dto";
import { IStoryDTO, StoryDTO } from "../DTOs/story.dto";
import { TPaginationQuery, TSort, TUserLibraryQuery } from "../Types";
import { Sorting } from "../Utils/Sorting/sorting";
import mongoose, { ObjectId } from "mongoose";
import { IStory } from "../Interfaces/story.interface";

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
    const user = await User.findById(req.user!.id)
      .select(fieldsToSelect)
      .select("-items");
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
    const query: TUserLibraryQuery = req.query;
    const modelType = query.modelType;
    const limit = query.limit ? parseInt(query.limit.toString(), 10) : 20;
    const page = query.page ? parseInt(query.page.toString(), 10) : 1;
    const status = query.status;
    const isFav = query.isFav;
    const sortBy: TSort = query.sortBy || "newest";
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

    let filteringArr = modelType.split(",").map((item: string) => item.trim());
    filteringArr = filteringArr.map((type: string) => {
      return modelTypeMapper[type as ModelType];
    });
    const user = await User.findById(userId).lean();
    if (!user) {
      throw new AppError("User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }
    const userItems =
      user.effectsLib?.sort((a, b) => {
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
    let userLib: IEffectItem[] = userItems;
    let paginatedItems: IEffectItem[] = [];
    if (userItems) {
      userLib = userItems.filter((item: IEffectItem) => {
        return (
          ((status as string) === "all" ? true : item.status === status) &&
          filteringArr.find((type: string) => type === item.modelType)
        );
      });
      if (isFav !== undefined) {
        const favStatus = isFav === "true";
        userLib = userLib.filter((item) => item.isFav === favStatus);
      }
      paginatedItems = paginator(userLib, page, limit);
    }
    const itemsDTO = ItemDTO.toListDTO(paginatedItems);
    console.log("Last item", itemsDTO[0]);
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

  getUserStoriesLibrary: catchError(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      isFav,
      status,
      sortBy = "newest",
    }: TUserLibraryQuery = req.query;
    const userId = req.user!.id;

    let filterQuery: any = { userId };

    if (isFav !== undefined) {
      filterQuery.isFav = isFav === "true";
    }

    if (status && status !== "all") {
      filterQuery.status = status;
    }

    const total = await Story.countDocuments(filterQuery);
    const stories = await Story.find(filterQuery).lean();
    const sortedStories = Sorting.sortItems(stories, sortBy);
    const paginatedStories = paginator(
      sortedStories,
      Number(page),
      Number(limit)
    );

    const storiesDTO = paginatedStories.map((story: IStory) =>
      StoryDTO.toAbstractDTO(story)
    );
    console.log("Stories", storiesDTO);
    res.status(200).json({
      message: "Stories Fetched Successfully",
      data: {
        items: storiesDTO,
        paginationData: {
          total,
          page: Number(page),
          limit: Number(limit),
        },
      },
    });
  }),

  getUserStory: catchError(async (req, res) => {
    const userId = req.user?.id;
    const { storyId } = req.params;
    let couldBeDeleted = false;
    if (!storyId) {
      throw new AppError("Story ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      throw new AppError("Invalid story ID format", 400);
    }
    if (userId) {
      const user = await User.findById(userId).select("storiesLib").lean();
      if (user?.storiesLib?.find((s: ObjectId) => s.toString() === storyId)) {
        couldBeDeleted = true;
      }
    }
    const story = await Story.findOne({
      _id: storyId,
    }).lean();

    if (!story) {
      throw new AppError("Story not found", 404);
    }

    res.status(200).json({
      message: "Story Fetched Successfully",
      data: { ...StoryDTO.toDTO(story as IStory), couldBeDeleted },
    });
  }),

  deleteUserStory: catchError(async (req, res) => {
    const userId = req.user!.id;
    const { storyId } = req.params;

    if (!storyId) {
      throw new AppError("Story ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      throw new AppError("Invalid story ID format", 400);
    }

    const story = await Story.findOneAndDelete({
      _id: storyId,
      userId: userId,
    });

    if (!story) {
      throw new AppError("Story not found", 404);
    }

    await User.findByIdAndUpdate(userId, { $pull: { storiesLib: storyId } });

    await Job.findOneAndDelete({ jobId: story.jobId });

    await User.findByIdAndUpdate(userId, {
      $pull: { jobs: { jobId: story.jobId } },
    });

    res.status(200).json({
      message: "Story Deleted Successfully",
      data: StoryDTO.toDTO(story),
    });
  }),

  toggleEffectFav: catchError(async (req, res) => {
    const userId = req.user!.id;
    const itemId = req.body.itemId;

    if (!itemId) {
      throw new AppError("Item ID is required", 400);
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }
    const itemIds = user?.effectsLib?.map((item) => item._id!.toString());
    if (!itemIds!.includes(itemId)) {
      throw new AppError("Item not found", 404);
    }
    user.effectsLib?.map((item) => {
      if (item._id!.toString() === itemId) {
        item.isFav = !item.isFav;
      }
    });
    await user.save();
    res.status(HTTP_STATUS_CODE.OK).json({
      message: "User favorites updated successfully",
      data: {
        userFavs: user.effectsLib?.filter((item) => item.isFav === true),
      },
    });
  }),

  toggleStoryFav: catchError(async (req, res) => {
    const userId = req.user!.id;
    const { storyId } = req.body;

    if (!storyId) {
      throw new AppError("Story ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      throw new AppError("Invalid story ID format", 400);
    }

    const story = await Story.findOne({
      _id: storyId,
      userId: userId,
    });

    if (!story) {
      throw new AppError("Story not found", 404);
    }

    story.isFav = !story.isFav;
    await story.save();

    res.status(HTTP_STATUS_CODE.OK).json({
      message: "Story favorite status updated successfully",
      data: {
        storyId: story._id,
        isFav: story.isFav,
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
    const item = user.effectsLib?.find(
      (item) => item._id!.toString() === itemId
    );
    if (!item) {
      throw new AppError("Item not found", 404);
    }
    user.effectsLib = user?.effectsLib?.filter(
      (item) => item._id!.toString() !== itemId
    );
    user.jobs = user?.jobs?.filter((j) => j.jobId !== item.jobId);
    await Job.findOneAndDelete({ jobId: item.jobId });
    await user!.save();
    res.status(HTTP_STATUS_CODE.OK).json({
      message: "User item deleted successfully",
      data: {
        item: ItemDTO.toDTO(item),
      },
    });
  }),

  getNotifications: catchError(async (req, res) => {
    const userId = req.user!.id;
    const filter: string[] = (req.query.category as string).trim().toLowerCase().split(",");
    if (!filter) {
      throw new AppError("Category filter is required", 400);
    }
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }
    let filteredNotifications = user.notifications!;
    if (!filter.includes('all')) {
      filteredNotifications = user.notifications!.filter((notification) => {
        return filter.includes(notification.category!);
      });
    }

    Sorting.sortItems(filteredNotifications, "newest") || [];

    const validNotifications = filteredNotifications.filter((notification) => {
      if (notification.expiresAt) {
        return new Date(notification.expiresAt) > new Date();
      }
    });

    res.status(200).json({
      message: "User notifications retrieved successfully",
      data: {
        notifications: validNotifications,
      },
    });
  }),
};

export default userController;
