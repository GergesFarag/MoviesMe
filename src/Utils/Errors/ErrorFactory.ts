import { ERROR_MESSAGES } from '../../Constants/error-messages';
import AppError from './AppError';
import { HTTP_STATUS_CODE } from '../../Enums/error.enum';

export class ErrorFactory {
  static userNotFound(userId?: string): AppError {
    const error = ERROR_MESSAGES.USER_NOT_FOUND;
    return new AppError(
      userId ? `${error.message}: ${userId}` : error.message,
      error.code
    );
  }
  static storyNotFound(jobId?: string): AppError {
    const error = ERROR_MESSAGES.STORY_NOT_FOUND;
    return new AppError(
      jobId ? `${error.message} for job: ${jobId}` : error.message,
      error.code
    );
  }

  static insufficientCredits(required: number, available: number): AppError {
    return new AppError(
      `Insufficient credits. Required: ${required}, Available: ${available}`,
      HTTP_STATUS_CODE.PAYMENT_REQUIRED
    );
  }

  static validationError(field: string, reason: string): AppError {
    return new AppError(
      `Validation failed for ${field}: ${reason}`,
      HTTP_STATUS_CODE.BAD_REQUEST
    );
  }
  static unauthorized() {
    return new AppError(
      ERROR_MESSAGES.UNAUTHORIZED.message,
      ERROR_MESSAGES.UNAUTHORIZED.code
    );
  }
}
