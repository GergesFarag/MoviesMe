export type TSort = "newest" | "oldest" | "cheap" | "expensive";
export type TModelFetchQuery = {
  limit?: number;
  page?: number;
  sortBy?: TSort;
};
export type TPaginationQuery = {
  limit?: number;
  page?: number;
};
export type TUserLibraryQuery = TPaginationQuery & {
  modelType?: string;
  status?: string;
  isFav?: string;
  sortBy?: TSort;
};
