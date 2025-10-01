import { ITranslationService } from "../Interfaces/translation.interface";
import { I18nService } from "../Config/i18next";
import { language } from "@elevenlabs/elevenlabs-js/api/resources/dubbing/resources/resource";

class TranslationService implements ITranslationService {
  private static instance: TranslationService;
  private constructor() {}

  public static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService();
    }
    return TranslationService.instance;
  }

  private translateItem(
    prefix: string,
    key: string,
    locale: string,
    opts?: any
  ): string {
    return I18nService.t(`${prefix}.${key}`, {
      lng: locale,
      ...opts,
    }) as string;
  }

  public translateModels(items: any[], locale: string): any[] {
    return items.map((item) => {
      const translatedName = this.translateItem("models", item._id, locale);
      return {
        ...item.toObject(),
        name: translatedName,
        category: this.translateCategory(item.category, locale),
      };
    });
  }

  public translateGenerationData(data: any, locale: string): any {
    const translatedData = {
      ...data,
      location: data.location.map((loc: any) => {
        return {
          ...loc,
          name: this.translateItem("locations", loc._id, locale),
        };
      }),
      style: data.style.map((style: any) => {
        return {
          ...style,
          name: this.translateItem("styles", style._id, locale),
        };
      }),
      genres: data.genres.map((genre: any) => {
        return this.translateItem("genres", genre, locale);
      })
    };
    return translatedData;
  }

  public translateCategory(category: string, locale: string): string {
    return this.translateItem("categories", category, locale);
  }

  public translateCategories(categories: string[], locale: string): string[] {
    return categories.map((category) => this.translateItem("categories", category, locale));
  }

  public getCategoryKey(translatedCategory: string, locale: string): string {
    // If it's already "all", return it as is
    if (translatedCategory === "all") return "all";
    
    // List of all possible category keys
    const categoryKeys = [
      "fashion", "fantasy", "gaming", "romance", "sports", 
      "cinematic", "ai tools", "artistic", "character", "lifestyle", "unknown"
    ];
    
    // Find the key that matches the translated value
    for (const key of categoryKeys) {
      const translatedValue = this.translateItem("categories", key, locale);
      if (translatedValue === translatedCategory) {
        return key;
      }
    }
    
    // If no match found, return the original value (might already be a key)
    return translatedCategory;
  }

  public translateText(
    prefix: string,
    key: string,
    locale: string,
    opts?: any
  ): string {
    return this.translateItem(prefix, key, locale, opts);
  }
}
export const translationService = TranslationService.getInstance();
