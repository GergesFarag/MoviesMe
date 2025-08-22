const jwt = require("jsonwebtoken");
import { loginResponse } from "../../Interfaces/response.interface";
import AppError, { HTTP_STATUS_CODE } from "../Errors/AppError";

const createAccessToken = (userData: loginResponse["data"]["user"]): string => {
  const expiry = process.env.ACCESS_TOKEN_EXPIRY || "5h";
  const secret = process.env.ACCESS_TOKEN_SECRET;
  
  if (!secret) {
    throw new AppError("ACCESS_TOKEN_SECRET is not defined" ,  HTTP_STATUS_CODE.UNAUTHORIZED);
  }

  const token = jwt.sign(
    { id: userData.id, isAdmin: userData.isAdmin },
    secret,
    { expiresIn: expiry }
  );
  return token;
};

const createRefreshToken = (userData: loginResponse["data"]["user"]): string => {
  const secret = process.env.REFRESH_TOKEN_SECRET;
  
  if (!secret) {
    throw new AppError("REFRESH_TOKEN_SECRET is not defined"  ,  HTTP_STATUS_CODE.UNAUTHORIZED);
  }

  const token = jwt.sign(
    { id: userData.id, isAdmin: userData.isAdmin },
    secret,
    { expiresIn: "12h" }
  );
  return token;
};
const verifyRefreshToken = (token: string) => {
  try {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    if (!secret) {
      throw new AppError("REFRESH_TOKEN_SECRET is not defined", HTTP_STATUS_CODE.UNAUTHORIZED);
    }
    const decoded = jwt.verify(token, secret);
    return decoded as loginResponse["data"]["user"];
  } catch (error) {
    throw new AppError("Invalid Refresh token", HTTP_STATUS_CODE.UNAUTHORIZED);
  }
};

const verifyAccessToken = (token: string) => {
  try {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      throw new AppError("ACCESS_TOKEN_SECRET is not defined", HTTP_STATUS_CODE.UNAUTHORIZED);
    }
    const decoded = jwt.verify(token, secret);
    return decoded;
  } catch (error) {
    throw new AppError("Invalid Access token", HTTP_STATUS_CODE.UNAUTHORIZED);
  }
};
export {
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  verifyRefreshToken,
};
