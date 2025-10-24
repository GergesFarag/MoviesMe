import { HTTP_STATUS_CODE } from '../Enums/error.enum';
export const ERROR_MESSAGES = {
  USER_NOT_FOUND: {
    message: 'User not found',
    code: HTTP_STATUS_CODE.NOT_FOUND,
  },
  STORY_NOT_FOUND: {
    message: 'Story not found',
    code: HTTP_STATUS_CODE.NOT_FOUND,
  },
  JOB_NOT_FOUND: {
    message: 'Job not found',
    code: HTTP_STATUS_CODE.NOT_FOUND,
  },
  MODEL_NOT_FOUND: {
    message: 'Model not found',
    code: HTTP_STATUS_CODE.NOT_FOUND,
  },
  UNAUTHORIZED: {
    message: 'Unauthorized access',
    code: HTTP_STATUS_CODE.UNAUTHORIZED,
  },
  INVALID_CREDENTIALS: {
    message: 'Invalid credentials',
    code: HTTP_STATUS_CODE.UNAUTHORIZED,
  },
  INSUFFICIENT_CREDITS: {
    message: 'Insufficient credits',
    code: HTTP_STATUS_CODE.PAYMENT_REQUIRED,
  },
  INVALID_REQUEST: {
    message: 'Invalid request data',
    code: HTTP_STATUS_CODE.BAD_REQUEST,
  },
  UPLOAD_FAILED: {
    message: 'File upload failed',
    code: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
  },
} as const;
