import i18next from "i18next";
import Backend from "i18next-fs-backend";
import i18nextMiddleware from "i18next-http-middleware";
import path from "path";
export class I18nService {
  private static singletonInstance: I18nService;
  private i18n: typeof i18next;
  private constructor() {
    this.i18n = i18next;
    this.initialize();
  }
  private async initialize() {
    await i18next
      .use(Backend)
      .use(i18nextMiddleware.LanguageDetector)
      .init({
        backend: {
          loadPath: path.join(__dirname, "../../locales/{{lng}}/{{ns}}.json"),
        },
        fallbackLng: "en",
        preload: ["en", "fr", "es", "ar"],
        ns: ["translation"],
        defaultNS: "translation",
        detection: {
          order: ["header", "querystring", "cookie"],
          lookupQuerystring: "lng",
          lookupCookie: "i18next",
          lookupHeader: "accept-language",
          caches: ["cookie"],
        },
      });
  }

  public static getInstance(): I18nService {
    if (!I18nService.singletonInstance) {
      I18nService.singletonInstance = new I18nService();
    }
    return I18nService.singletonInstance;
  }
  
  public static t(key: string, options?: any): string | object {
    return I18nService.getInstance().i18n.t(key, options);
  }
  public static changeLanguage(lng: string): Promise<any> {
    return I18nService.getInstance().i18n.changeLanguage(lng);
  }
}
export default I18nService.getInstance();
