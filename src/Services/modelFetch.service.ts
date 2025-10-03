/**
 * Service for fetching and managing AI models
 * Provides reusable functions to eliminate duplication in controllers
 */

import Model from "../Models/ai.model.ts";
import AppError from "../Utils/Errors/AppError";
import { Sorting } from "../Utils/Sorting/sorting";
import paginator from "../Utils/Pagination/paginator";
import { translationService } from "./translation.service";
import IAiModel from "../Interfaces/aiModel.interface";
import { 
  ModelQueryConfig, 
  ModelFetchResult 
} from "../types/modelProcessing.types";
import { 
  PAGINATION_DEFAULTS, 
  SORT_DEFAULTS, 
  CATEGORY_DEFAULTS,
  ModelFilterType 
} from "../Constants/modelConstants";
import { TSort } from "../types";


export const getModelsByType = async (
  config: ModelQueryConfig
): Promise<ModelFetchResult> => {
  const {
    filterType,
    limit = PAGINATION_DEFAULTS.LIMIT,
    page = PAGINATION_DEFAULTS.PAGE,
    sortBy = SORT_DEFAULTS.SORT_BY,
    category = CATEGORY_DEFAULTS.ALL,
    locale,
  } = config;

  const categoryKey = translationService.getCategoryKey(category, locale);

  const query: Record<string, boolean | string> = { [filterType]: true };

  if (categoryKey !== CATEGORY_DEFAULTS.ALL) {
    query.category = categoryKey;
  }

  const models = await Model.find(query).select("-__v");

  const sortedModels = Sorting.sortItems(models, sortBy as TSort);

  const paginatedModels = paginator(
    sortedModels,
    Number(page),
    Number(limit)
  );

  const translatedModels = translationService.translateModels(
    paginatedModels,
    locale
  );

  const total = await Model.countDocuments(query);

  return {
    items: translatedModels,
    paginationData: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  };
};


export const getTrendingModels = async (
  config: ModelQueryConfig & { type?: string }
): Promise<ModelFetchResult> => {
  const {
    limit = PAGINATION_DEFAULTS.LIMIT,
    page = PAGINATION_DEFAULTS.PAGE,
    sortBy = SORT_DEFAULTS.SORT_BY,
    category = CATEGORY_DEFAULTS.ALL,
    locale,
    type = CATEGORY_DEFAULTS.ALL,
  } = config;

  const categoryKey = translationService.getCategoryKey(category, locale);

  const query: Record<string, boolean | string> = { isTrending: true };

  const typeFilterMap: Record<string, string> = {
    video: "isVideoEffect",
    image: "isImageEffect",
  };

  if (type !== CATEGORY_DEFAULTS.ALL && typeFilterMap[type]) {
    query[typeFilterMap[type]] = true;
  }

  if (categoryKey !== CATEGORY_DEFAULTS.ALL) {
    query.category = categoryKey;
  }

  const models = await Model.find(query).select("-__v");

  const sortedModels = Sorting.sortItems(models, sortBy as TSort);
  const paginatedModels = paginator(
    sortedModels,
    Number(page),
    Number(limit)
  );

  const translatedModels = translationService.translateModels(
    paginatedModels,
    locale
  );

  const total = await Model.countDocuments(query);

  return {
    items: translatedModels,
    paginationData: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
  };
};
