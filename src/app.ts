import express from "express";
import dotenv from "dotenv";
import authRouter from "./Routes/auth.routes";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";
import adminRouter from "./Routes/admin.routes";
import ErrorHandler from "./Middlewares/error.middleware";
import userRouter from "./Routes/user.routes";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./swagger";
import storyRouter from "./Routes/story.routes";
import modelsRouter from "./Routes/models.routes";
import generationLibRouter from "./Routes/generationLib.routes";
import { cleanupRedisJobs } from "./Utils/Cache/redisCleanup";
import { translationService } from "./Services/translation.service";
import "./Queues/generationLib.queue";
import "./Queues/story.queue";
import "./Queues/model.queue";
import Story from "./Models/story.model";
import mongoose from "mongoose";

const app = express();
app.use(express.json());
dotenv.config({ quiet: true });
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cookieParser());
app.use(cors({ origin: "*", credentials: true }));
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));
const API_VERSION = process.env.API_VERSION || "/v1";
const prefix = process.env.API_PREFIX || "/api";
const basePath = `${prefix}${API_VERSION}`;

app.get(`/`, (req, res) => {
  console.log("Request Headers:", req.headers["accept-language"]);
  res.send(
    translationService.translateText(
      "admin",
      "greeting",
      req.headers["accept-language"] || "en",
      { name: "Gerges" }
    )
  );
});
  
//*HERE IS CUSTOM SCRIPTS TO RUN ON DB
app.post(`${basePath}/dbScript`, async (req, res) => {
  try {
    await Story.deleteMany({ userId: new mongoose.Types.ObjectId("68dc6b7e0dfbb81d538692ab") });
    res.status(200).json({ message: "DB script executed successfully" });
  } catch (error) {
    console.error("Error executing DB script:", error);
    res.status(500).json({ message: "Error executing DB script" });
  }
});
app.use(`${basePath}/auth`, authRouter);
app.use(`${basePath}/admin`, adminRouter);
app.use(`${basePath}/user`, userRouter);
app.use(`${basePath}/story`, storyRouter);
app.use(`${basePath}/models`, modelsRouter);
app.use(`${basePath}/generation`, generationLibRouter);
app.use(`/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use(ErrorHandler);
app.use(/\/(.*)/, (req, res, next) => {
  console.log("404 middleware triggered for:", req.originalUrl);
  res.status(404).json({ message: "Route not found" });
});

setInterval(async () => {
  console.log("Running periodic Redis cleanup...");
  await cleanupRedisJobs();
}, 30 * 60 * 1000);

export default app;
