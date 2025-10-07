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
  ModelFilterType, 
  QueryType,
  MODEL_FILTER_TYPE,
  QUERY_TYPE_TO_FILTER
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

  const models = await Model.find(query).lean();

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
  config: ModelQueryConfig & { types?: string }
): Promise<ModelFetchResult> => {
  const {
    limit = PAGINATION_DEFAULTS.LIMIT,
    page = PAGINATION_DEFAULTS.PAGE,
    sortBy = SORT_DEFAULTS.SORT_BY,
    category = CATEGORY_DEFAULTS.ALL,
    locale,
    types = CATEGORY_DEFAULTS.ALL,
  } = config;

  const categoryKey = translationService.getCategoryKey(category, locale);

  const query: Record<string, boolean | string> = { isTrending: true };
  const typesList = types.split(",").map(type => type.trim());

  if (categoryKey !== CATEGORY_DEFAULTS.ALL) {
    query.category = categoryKey;
  }
  const models = await Model.find(query).select("-__v +isVideoEffect +isImageEffect +isCharacterEffect +isAITool +isAI3DTool +isMarketingTool").lean();
  const filteredModels = typesList[0].toLowerCase() === CATEGORY_DEFAULTS.ALL ? models : models.filter(model => {
    const hasMatchingType = typesList.some((type) => {
      const filterKey = QUERY_TYPE_TO_FILTER[type];
      const hasType = filterKey && (model as any)[filterKey] === true;
      return hasType;
    });
    return hasMatchingType;
  });
  const sanitizedKeysModels = filteredModels.map((model) => {
    const sanitizedModel = model
    Object.values(MODEL_FILTER_TYPE).forEach((key) => {
      if (sanitizedModel.hasOwnProperty(key)) {
        delete (sanitizedModel as any)[key];
      }
    });
    return sanitizedModel;
  });
  const sortedModels = Sorting.sortItems(sanitizedKeysModels, sortBy as TSort);
  const paginatedModels = paginator(
    sortedModels,
    Number(page),
    Number(limit)
  );

  const translatedModels = translationService.translateModels(
    paginatedModels,
    locale
  );


  return {
    items: translatedModels,
    paginationData: {
      page: Number(page),
      limit: Number(limit),
      total : filteredModels.length,
    },
  };
};
