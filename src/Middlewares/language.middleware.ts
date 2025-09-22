import { Request, Response, NextFunction } from 'express';
import User from '../Models/user.model';
import { extractLanguageFromRequest } from '../Utils/Format/languageUtils';

/**
 * Middleware to update user's language preference based on Accept-Language header
 * This should be used on authenticated routes where req.user is available
 */
export const updateUserLanguagePreference = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Only process if user is authenticated
    if (req.user?.id) {
      const preferredLanguage = extractLanguageFromRequest(req);
      
      // Update user's language preference if it's different
      const user = await User.findById(req.user.id).select('preferredLanguage');
      
      if (user && user.preferredLanguage !== preferredLanguage) {
        await User.findByIdAndUpdate(
          req.user.id, 
          { preferredLanguage },
          { new: true }
        );
        console.log(`Updated user ${req.user.id} language preference to: ${preferredLanguage}`);
      }
    }
  } catch (error) {
    // Log error but don't block the request
    console.error('Error updating user language preference:', error);
  }
  
  next();
};

/**
 * Get current user's language preference with fallback to Accept-Language header
 */
export const getCurrentUserLanguage = async (req: Request): Promise<string> => {
  try {
    if (req.user?.id) {
      const user = await User.findById(req.user.id).select('preferredLanguage');
      if (user?.preferredLanguage) {
        return user.preferredLanguage;
      }
    }
    
    // Fallback to Accept-Language header
    return extractLanguageFromRequest(req);
  } catch (error) {
    console.error('Error getting user language:', error);
    return 'en'; // Default fallback
  }
};