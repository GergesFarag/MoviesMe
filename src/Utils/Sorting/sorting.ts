import { TSort } from "../../types";

export class Sorting {
  public static sortItems<T>(items: T[], sortBy: TSort): T[] {
    if (sortBy === "newest" || sortBy === "oldest") {
      return this.sortByDate(items, sortBy);
    } else if (sortBy === "cheap" || sortBy === "expensive") {
      return this.sortByCost(items, sortBy);
    } else {
      return items;
    }
  }

  private static sortByDate<T>(items: T[], sortBy: "newest" | "oldest"): T[] {
    if (sortBy === "newest") {
      return items.sort(
        (a, b) =>
          (b as any)._id.getTimestamp().getTime() -
          (a as any)._id.getTimestamp().getTime()
      );
    } else {
      return items.sort(
        (a, b) =>
          (a as any)._id.getTimestamp().getTime() -
          (b as any)._id.getTimestamp().getTime()
      );
    }
  }

  private static sortByCost<T>(items: T[], sortBy: "cheap" | "expensive"): T[] {
    if (sortBy === "cheap") {
      return items.sort((a, b) => (a as any).credits - (b as any).credits);
    } else {
      return items.sort((a, b) => (b as any).credits - (a as any).credits);
    }
  }
}
