import { Request, Response, NextFunction } from 'express';
import User from '../Models/user.model';
import { extractLanguageFromRequest } from '../Utils/Format/languageUtils';

export const updateUserLanguagePreference = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.id) {
      const preferredLanguage = extractLanguageFromRequest(req);
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
    console.error('Error updating user language preference:', error);
  }
  
  next();
};

export const getCurrentUserLanguage = async (req: Request): Promise<string> => {
  try {
    if (req.user?.id) {
      const user = await User.findById(req.user.id).select('preferredLanguage');
      if (user?.preferredLanguage) {
        return user.preferredLanguage;
      }
    }
    return extractLanguageFromRequest(req);
  } catch (error) {
    console.error('Error getting user language:', error);
    return 'en';
  }
};