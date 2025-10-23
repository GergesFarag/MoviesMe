import { Validator } from "../Services/validation.service";

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'FIREBASE_PROJECT_ID',
  'OPENAI_API_KEY',
  'WAVESPEED_API_KEY',
];
const runEnvValidation = () => {
  Validator.EnvValidator.validateEnvVariable(REQUIRED_ENV_VARS);
};
export default runEnvValidation;
