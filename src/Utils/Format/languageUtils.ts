import { Request } from "express";
import User from "../../Models/user.model";

export function extractLanguageFromRequest(req: Request): string {
  const acceptLanguage = req.headers["accept-language"];

  if (!acceptLanguage) {
    return "en"; // Default to English
  }

  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,ar;q=0.8")
  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [code, quality] = lang.trim().split(";q=");
      return {
        code: code.split("-")[0], // Extract language code without region
        quality: quality ? parseFloat(quality) : 1.0,
      };
    })
    .sort((a, b) => b.quality - a.quality); // Sort by quality score

  // Return the highest quality language, default to 'en'
  return languages[0]?.code || "en";
}

export function getUserLanguage(req: Request, userLanguage?: string): string {
  // Priority: User's saved preference > Accept-Language header > Default 'en'
  if (userLanguage) {
    return userLanguage;
  }
  return extractLanguageFromRequest(req);
}

export const getUserLangFromDB = async function (
  userId: string
): Promise<string> {
  try {
    const user = await User.findById(userId).select("preferredLanguage");
    return user?.preferredLanguage || "en";
  } catch (error) {
    console.error(`❌ Failed to get user language for ${userId}:`, error);
    return "en"; // Default fallback
  }
};

export const mapLanguageAccent = (accent:string) => {
  const accentMap: Record<string, string> = {
    "مصري" : "Egyptian Arabic",
    "سعودي" : "Saudi Arabic",
    "لبناني" : "Lebanese Arabic",
    "مغربي" : "Moroccan Arabic",
    "شامي" : "Levantine Arabic",
    "عراقي" : "Iraqi Arabic",
    "خليجي" : "Gulf Arabic",
  }
  return accentMap[accent] || accent;
};
