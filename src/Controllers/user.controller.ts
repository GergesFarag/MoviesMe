import { IEffectItem } from "../Interfaces/effectItem.interface";
import {
  UserProfileNonSelectableFields,
  userProfileResponse,
} from "../Interfaces/response.interface";
import User from "../Models/user.model";
import Story from "../Models/story.model";
import AppError, { HTTP_STATUS_CODE } from "../Utils/Errors/AppError";
import catchError from "../Utils/Errors/catchError";
import { ModelType, modelTypeMapper } from "../Utils/Format/filterModelType";
import paginator from "../Utils/Pagination/paginator";
import Job from "../Models/job.model";
import { UploadApiResponse } from "cloudinary";
import { cloudUpload, generateHashFromBuffer } from "../Utils/APIs/cloudinary";
import { ItemDTO } from "../DTOs/item.dto";
import { IStoryDTO, StoryDTO } from "../DTOs/story.dto";
import { TPaginationQuery, TSort, TUserLibraryQuery } from "../types";
import { Sorting } from "../Utils/Sorting/sorting";
import mongoose, { ObjectId } from "mongoose";
import { IStory } from "../Interfaces/story.interface";
import { GenerationLibService } from "../Services/generationLib.service";
import { translationService } from "../Services/translation.service";
import { NotificationService } from "../Services/notification.service";

const generationLibService = new GenerationLibService();
const NON_SELECTABLE_FIELDS: UserProfileNonSelectableFields[] = [
  "-FCMToken",
  "-__v",
  "-effectsLib",
  "-storiesLib",
  "-generationLib",
  "-jobs",
  "-notifications",
  "-isActive",
  "-isAdmin",
  "-firebaseUid",
  "-preferredLanguage",
];
const userController = {
  getProfile: catchError(async (req, res) => {
    console.log("UserId", req.user!.id);
    if (!req.user?.id) {
      throw new AppError("Unauthorized", HTTP_STATUS_CODE.UNAUTHORIZED);
    }
    const user = await User.findById(req.user!.id)
      .select(NON_SELECTABLE_FIELDS.join(" "))
      .lean();
    if (!user) {
      throw new AppError("User not found", HTTP_STATUS_CODE.NOT_FOUND);
    }
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
        const result = (await cloudUpload(
          profilePicture.buffer,
          `user_${id}/images/profile`,
          "profile_picture",
          { overwrite: true, invalidate: true }
        )) as UploadApiResponse;
        req.body.profilePicture = result.secure_url;
      }
      const user = await User.findById(id).select(
        NON_SELECTABLE_FIELDS.join(" ")
      );

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

  getUserEffectsLib: catchError(async (req, res) => {
    const userId = req.user!.id;
    const query: TUserLibraryQuery = req.query;
    const modelType = query.types;
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

  getUserStoriesLib: catchError(async (req, res) => {
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

    await Promise.all([
      User.findByIdAndUpdate(userId, { $pull: { storiesLib: storyId } }),
      Job.findOneAndDelete({ jobId: story.jobId }),
    ]);

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
    if (!req.query.category) {
      throw new AppError("Category filter is required", 400);
    }
    const filter: string[] = (req.query.category as string)
      .trim()
      .toLowerCase()
      .split(",");
    const user = await User.findById(userId).lean();

    if (!user) {
      throw new AppError("User not found", 404);
    }
    let filteredNotifications = user.notifications || [];
    if (!filter.includes("all")) {
      filteredNotifications = user.notifications!.filter((notification) => {
        return filter.includes(notification.category!);
      });
    }

    const sortedNotifications =
      filteredNotifications.length > 0
        ? Sorting.sortItems(filteredNotifications, "newest")
        : [];

    const validNotifications = sortedNotifications.filter((notification) => {
      if (notification.expiresAt) {
        return new Date(notification.expiresAt) > new Date();
      }
      return true;
    });

    let notificationStatus,
      notificationType = "";
    const userLang = req.headers["accept-language"] || "en";
    const translatedNotifications = validNotifications.map((notification) => {
      ({ status: notificationStatus, type: notificationType } =
        NotificationService.getNotificationStatusAndType(notification));
      console.log(
        "Notificaion Status , and type",
        notificationStatus,
        notificationType
      );
      return {
        ...notification,
        title: translationService.translateText(
          `notifications.${notificationType}.${notificationStatus}`,
          "title",
          userLang
        ),
        message: translationService.translateText(
          `notifications.${notificationType}.${notificationStatus}`,
          "message",
          userLang,
          { credits: (notification.data as any)?.amount || "" }
        ),
      };
    });
    res.status(200).json({
      message: "User notifications retrieved successfully",
      data: {
        notifications: translatedNotifications,
      },
    });
  }),

  getUserGenerationsLib: catchError(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(
        "User not authenticated",
        HTTP_STATUS_CODE.UNAUTHORIZED
      );
    }
    const { page = 1, limit = 10, status, isFav, types } = req.query;
    let generations = [];
    if (!types) {
      throw new AppError("Types parameter is required", 400);
    }
    const typesList = types
      .toString()
      .split(",")
      .map((type) => type.trim());
    console.log("LIST TYPES", typesList);
    console.log("Query parameters:", { status, isFav, types });

    if (typesList[0].toLowerCase() !== "all") {
      if (typesList.includes("videoEffects")) {
        console.log("Fetching video generations...");
        const videoGenerations =
          await generationLibService.getUserVideoGenerations(userId, {
            status: status as string,
            isFav: isFav as string,
          });
        console.log("Video generations found:", videoGenerations.length);
        generations.push(...videoGenerations);
      }
      if (typesList.includes("imageEffects")) {
        const imageGenerations =
          await generationLibService.getUserImageGenerations(userId, {
            status: status as string,
            isFav: isFav as string,
          });
        console.log("Image generations found:", imageGenerations.length);
        generations.push(...imageGenerations);
      }
    } else {
      generations = await generationLibService.getUserGenerations(userId, {
        status: status as string,
        isFav: isFav as string,
      });
      console.log("All generations found:", generations.length);
    }
    console.log("Final generations count:", generations.length);
    console.log("Sample generation:", generations[0]);
    const paginatedGenerations = paginator(
      generations,
      Number(page),
      Number(limit)
    );
    res.status(200).json({
      success: true,
      message: "Generations retrieved successfully",
      data: {
        items: paginatedGenerations,
        paginationData: {
          total: generations.length,
          page: Number(page),
          limit: Number(limit),
        },
      },
    });
  }),

  getGenerationById: catchError(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(
        "User not authenticated",
        HTTP_STATUS_CODE.UNAUTHORIZED
      );
    }

    const { id } = req.params;
    if (!id) {
      throw new AppError("Generation ID is required", 400);
    }

    const generation = await generationLibService.getGenerationById(userId, id);

    res.status(200).json({
      success: true,
      message: "Generation retrieved successfully",
      data: generation,
    });
  }),

  toggleGenerationFav: catchError(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(
        "User not authenticated",
        HTTP_STATUS_CODE.UNAUTHORIZED
      );
    }

    const { generationId } = req.body;

    if (!generationId) {
      throw new AppError("Generation ID is required", 400);
    }

    const updatedGeneration = await generationLibService.updateFavoriteStatus(
      userId,
      generationId
    );

    res.status(200).json({
      success: true,
      message: "Favorite status updated successfully",
      data: updatedGeneration,
    });
  }),

  deleteGeneration: catchError(async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError(
        "User not authenticated",
        HTTP_STATUS_CODE.UNAUTHORIZED
      );
    }

    const { id } = req.params;
    if (!id) {
      throw new AppError("Generation ID is required", 400);
    }

    await generationLibService.deleteGeneration(userId, id);

    res.status(200).json({
      success: true,
      message: "Generation deleted successfully",
    });
  }),

  changeLanguage: catchError(async (req, res) => {
    const userId = req.user?.id;
    const { language } = req.body;
    if (!userId) {
      throw new AppError(
        "User not authenticated",
        HTTP_STATUS_CODE.UNAUTHORIZED
      );
    }
    if (!language || (language.trim() !== "en" && language.trim() !== "ar")) {
      throw new AppError("Language is required with values en or ar", 400);
    }
    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { preferredLanguage: language },
      { new: true }
    );

    if (!user) {
      throw new AppError("User not found", 404);
    }
    res.status(200).json({
      message: "Language updated successfully",
      data: user.preferredLanguage,
    });
  }),
};

export default userController;
