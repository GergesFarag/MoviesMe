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
import responseTime from 'response-time';
import { composeVideoWithAudio } from './Utils/APIs/cloudinary';
import { firebaseAdmin } from './Config/firebase';
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

app.post(`${basePath}/custom`, async (req, res) => {});

//*HERE IS CUSTOM SCRIPTS TO RUN ON DB
app.post(`${basePath}/dbScript`, async (req, res) => {
  res.end();
});

app.get(`/`, async (req, res) => {
  res.status(200).json({ message: 'API is running' });
});

// Firebase config endpoint for client
app.get(`${basePath}/config/firebase`, async (req, res) => {
  try {
    const firebaseConfig = {
      apiKey:
        process.env.FIREBASE_CLIENT_API_KEY ||
        'AIzaSyAVdx4hQAviTmiE7_vVmoaSyb3lx1hachY',
      authDomain:
        process.env.FIREBASE_AUTH_DOMAIN || 'ttov-a9677.firebaseapp.com',
      projectId: process.env.FIREBASE_PROJECT_ID || 'ttov-a9677',
      appId:
        process.env.FIREBASE_APP_ID ||
        '1:57747989938:web:e4af38b054fd30014130ab',
    };
    res.status(200).json(firebaseConfig);
  } catch (error) {
    console.error('Error serving Firebase config:', error);
    res.status(500).json({ error: 'Failed to load Firebase configuration' });
  }
});

app.use(`${basePath}/auth`, authRouter);
app.use(`${basePath}/admin`, adminRouter);
app.use(`${basePath}/user`, userRouter);
app.use(`${basePath}/story`, storyRouter);
app.use(`${basePath}/models`, modelsRouter);
app.use(`${basePath}/generation`, generationLibRouter);
app.use(`${basePath}/payment`, paymentRouter);
app.use(`/api-docs`, swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use(ErrorHandler);

app.use(/\/(.*)/, (req, res, next) => {
  res.status(404).json({ message: 'Route not found' });
});

export default app;
