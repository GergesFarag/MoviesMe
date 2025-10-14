import { ITranslationService } from "../Interfaces/translation.interface";
import { I18nService } from "../Config/i18next";
import { language } from "@elevenlabs/elevenlabs-js/api/resources/dubbing/resources/resource";

export class TranslationService implements ITranslationService {
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
        ...item,
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
      }),
      genderOptions: data.genderOptions.map((gender: any) => {
        return {
          ...gender,
          name: this.translateItem("voiceOver.voiceGender", gender._id, locale),
        };
      }),
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
    if (translatedCategory === "all") return "all";
    const categoryKeys = [
      "fashion", "fantasy", "gaming", "romance", "sports", 
      "cinematic", "ai tools", "artistic", "character", "lifestyle", "unknown"
    ];
    for (const key of categoryKeys) {
      const translatedValue = this.translateItem("categories", key, locale);
      if (translatedValue === translatedCategory) {
        return key;
      }
    }

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

  public translateGenerationModels(models: any[], locale :string): any[] {
    return models.map((model) => {
      const translatedName = this.translateItem("generationModels", model._id, locale);
      return {
        ...model,
        name: translatedName,
      };
    });
  }
}
export const translationService = TranslationService.getInstance();
