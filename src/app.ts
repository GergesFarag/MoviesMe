import express from 'express';
import dotenv from 'dotenv';
import authRouter from './Routes/auth.routes';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import cors from 'cors';
import adminRouter from './Routes/admin.routes';
import ErrorHandler from './Middlewares/error.middleware';
import userRouter from './Routes/user.routes';
import swaggerUi from 'swagger-ui-express';
import swaggerDoc from './swagger';
import storyRouter from './Routes/story.routes';
import modelsRouter from './Routes/models.routes';
import paymentRouter from './Routes/purchasing.routes';
import generationLibRouter from './Routes/generationLib.routes';
import './Queues/generationLib.queue';
import './Queues/story.queue';
import './Queues/model.queue';
import {
  authLimiter,
  limiter,
  standardLimiter,
  webhookLimiter,
} from './Middlewares/rateLimiter.middleware';
import cloudinary from './Config/cloudinary';
import { cloudUploadURL, deleteCloudinaryFolder } from './Utils/APIs/cloudinary';

const app = express();
dotenv.config({ quiet: true });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(cookieParser());
app.use(cors({ origin: '*', credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
const API_VERSION = process.env.API_VERSION || '/v1';
const prefix = process.env.API_PREFIX || '/api';
const basePath = `${prefix}${API_VERSION}`;

app.use(limiter);

app.post(`${basePath}/custom`, async (req, res) => {
  res.status(200).json({ message: 'Custom script executed' });
});

//*HERE IS CUSTOM SCRIPTS TO RUN ON DB
app.post(`${basePath}/dbScript`, async (req, res) => {
  res.end();
});

app.get(`/`, async (req, res) => {
  res.status(200).json({ message: 'API is running' });
});

app.use(`${basePath}/auth`, authLimiter, authRouter);
app.use(`${basePath}/admin`, standardLimiter, adminRouter);
app.use(`${basePath}/user`, standardLimiter, userRouter);
app.use(`${basePath}/story`, storyRouter);
app.use(`${basePath}/models`, modelsRouter);
app.use(`${basePath}/generation`, generationLibRouter);
app.use(`${basePath}/payment`, webhookLimiter, paymentRouter);
app.use(`/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use(ErrorHandler);

app.use(/\/(.*)/, (req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;
