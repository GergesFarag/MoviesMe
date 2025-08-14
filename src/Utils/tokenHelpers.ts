const jwt = require("jsonwebtoken");
import { loginResponse } from "../Interfaces/response.interface";

const createAccessToken = (userData: loginResponse["data"]["user"]): string => {
  const expiry = process.env.ACCESS_TOKEN_EXPIRY || "30s";
  const secret = process.env.ACCESS_TOKEN_SECRET;
  
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET is not defined");
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
    throw new Error("REFRESH_TOKEN_SECRET is not defined");
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
      throw new Error("REFRESH_TOKEN_SECRET is not defined");
    }
    const decoded = jwt.verify(token, secret);
    return decoded as loginResponse["data"]["user"];
  } catch (error) {
    throw new Error("Invalid Refresh token");
  }
};

const verifyAccessToken = (token: string) => {
  try {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      throw new Error("ACCESS_TOKEN_SECRET is not defined");
    }
    const decoded = jwt.verify(token, secret);
    console.log("DECODED:", decoded);
    return decoded;
  } catch (error) {
    throw new Error("Invalid Access token");
  }
};
export {
  createAccessToken,
  verifyAccessToken,
  createRefreshToken,
  verifyRefreshToken,
};
