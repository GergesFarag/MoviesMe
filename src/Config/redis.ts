import { HTTP_STATUS_CODE } from '../Enums/error.enum';
import AppError from '../Utils/Errors/AppError';

export const getRedisConfig = () => {
  const app_env = process.env.NODE_ENV as string;
  const server_env = process.env.SERVER_ENV as string;
  let redisPort, redisHost, redisPassword;
  if (app_env === 'production') {
    redisPort = parseInt(process.env.REDIS_PORT as string);
    redisHost = process.env.REDIS_HOST as string;
    redisPassword = process.env.REDIS_PASSWORD as string;
  } else if (app_env === 'development') {
    redisPort =
      server_env === 'local'
        ? 6379
        : parseInt(process.env.REDIS_REMOTE_PORT as string);
    redisPassword =
      server_env === 'local'
        ? undefined
        : (process.env.REDIS_REMOTE_PASSWORD as string);
    redisHost =
      server_env === 'local'
        ? 'localhost'
        : (process.env.REDIS_REMOTE_HOST as string);
  } else {
    throw new AppError(
      'Error in ENV While Redis Config',
      HTTP_STATUS_CODE.BAD_REQUEST
    );
  }
  return { host: redisHost, port: redisPort, password: redisPassword };
};
