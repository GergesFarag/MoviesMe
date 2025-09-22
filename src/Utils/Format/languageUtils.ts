import { Request } from 'express';

/**
 * Extract language preference from Accept-Language header
 * @param req - Express request object
 * @returns Preferred language code (e.g., 'en', 'ar') or 'en' as default
 */
export function extractLanguageFromRequest(req: Request): string {
  const acceptLanguage = req.headers['accept-language'];
  
  if (!acceptLanguage) {
    return 'en'; // Default to English
  }

  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,ar;q=0.8")
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, quality] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0], // Extract language code without region
        quality: quality ? parseFloat(quality) : 1.0
      };
    })
    .sort((a, b) => b.quality - a.quality); // Sort by quality score

  // Return the highest quality language, default to 'en'
  return languages[0]?.code || 'en';
}

/**
 * Get user's preferred language from user model or request headers
 * @param req - Express request object
 * @param userLanguage - User's saved language preference (optional)
 * @returns Preferred language code
 */
export function getUserLanguage(req: Request, userLanguage?: string): string {
  // Priority: User's saved preference > Accept-Language header > Default 'en'
  if (userLanguage) {
    return userLanguage;
  }
  
  return extractLanguageFromRequest(req);
}