import express from "express";
import dotenv from "dotenv";
import authRouter from "./Routes/auth.routes";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import cors from "cors";
import adminRouter from "./Routes/admin.routes";
import { errorHandler } from "./Utils/Errors/globalHandlers";
import AppError from "./Utils/Errors/AppError";
import userRouter from "./Routes/user.routes";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./swagger";
import storyRouter from "./Routes/story.routes";
import modelsRouter from "./Routes/models.routes";
import connectDB from "./Config/db";
const PORT = process.env.PORT_NUMBER || 3000;
const app = express();
app.use(express.json());
dotenv.config({ quiet: true });
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cookieParser());
app.use(cors({origin : "*", credentials: true}));
app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));

app.get("/" , (req, res) => {
  res.send("Welcome to the API");
});

const API_VERSION = process.env.API_VERSION || "/v1";
const prefix = process.env.API_PREFIX || "/api";
const basePath = `${prefix}${API_VERSION}`;
app.use(`${basePath}/auth`, authRouter);
app.use(`${basePath}/admin`, adminRouter);
app.use(`${basePath}/user`, userRouter); 
app.use(`${basePath}/story`, storyRouter);
app.use(`${basePath}/models`, modelsRouter);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use((req, res, next) => {
  next(new AppError("Not Found Route", 404));
});
 
app.use(errorHandler);

(async () => {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`Sever is running on : http://localhost:${PORT}/`);
  });
  process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error);
    server.close(() => {
      process.exit(1);
    });
  });
})();

export default app;
