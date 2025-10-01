export interface ITranslationService {
  translateModels(items: any[], locale: string): any[];
  translateGenerationData(data: any, locale: string): any;
  translateText(prefix: string, key: string, locale: string, opts?: any): string;
  translateCategory(category: string, locale: string): string;
  translateCategories(categories: string[], locale: string): string[];
  getCategoryKey(translatedCategory: string, locale: string): string;
}