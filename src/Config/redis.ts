export const getRedisConfig = () => {
  const redisPort = process.env.NODE_ENV === "production"
    ? process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 10711
    : 6379;
  
  const redisHost = process.env.NODE_ENV === "production"
    ? (process.env.REDIS_HOST as string)
    : "localhost";
  
  const redisPassword = process.env.NODE_ENV === "production"
    ? (process.env.REDIS_PASSWORD as string)
    : undefined;

  return { host: redisHost, port: redisPort, password: redisPassword };
};