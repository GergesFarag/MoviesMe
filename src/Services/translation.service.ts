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
      languages: data.languages.map((lang: any) =>
        this.translateItem("languages", lang, locale)
      ),
    };
    return translatedData;
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
