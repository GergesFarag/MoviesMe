export type TSort = "newest" | "oldest" | "cheap" | "expensive";
export type TModelFetchQuery = {
  limit?: number;
  page?: number;
  sortBy?: TSort;
  category?:string;
};

export type TPaginationQuery = {
  limit?: number;
  page?: number;
};

export type TUserLibraryQuery = TPaginationQuery & {
  types?: string;
  status?: string;
  isFav?: string;
  sortBy?: TSort;
};

export type TNotificationCategory = 'systemUpdates' | 'activities' | 'transactions' | 'promotions';