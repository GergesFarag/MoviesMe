import { Request } from "express";
import User from "../../Models/user.model";

export function extractLanguageFromRequest(req: Request): string {
  const acceptLanguage = req.headers["accept-language"];

  if (!acceptLanguage) {
    return "en";
  }
  return acceptLanguage || "en";
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
