import mongoose from 'mongoose';
import AppError from '../Utils/Errors/AppError';

const connectDB = async () => {
  try {
    const MONGODB_URI = process.env.MONGODB_URI as string;
    if (!MONGODB_URI)
      throw new AppError(
        'MONGODB_URI is not defined in environment variables',
        500
      );
    const opts: mongoose.ConnectOptions = {
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      retryReads: true,
      retryWrites: true,
      maxPoolSize: 15,
      minPoolSize: 3
    };
    await mongoose.connect(MONGODB_URI, opts);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export default connectDB;
