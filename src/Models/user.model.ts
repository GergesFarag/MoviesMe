import { model, Schema, Types } from 'mongoose';
import { IUser } from '../Interfaces/user.interface';
import effectItemSchema from './effectItem.model';
import generationLibSchema from './generationLib.model';
import notificationSchema from './notification.model';
import { HydratedDocument } from 'mongoose';
import UserEvents from '../Utils/Events/userEvents';

const userSchema = new Schema<IUser>({
  username: { type: String, select: true },
  email: {
    type: String,
    select: true,
  },
  phoneNumber: {
    type: String,
    default: null,
    select: true,
  },
  age: { type: Number, min: 12, select: true },
  credits: { type: Number, default: 10, select: true },
  userLocation: { type: String, default: null, select: true },
  dob: { type: Date, default: null, select: true },
  isMale: { type: Boolean, default: null, select: true },
  profilePicture: { type: String, default: null, select: true },
  effectsLib: {
    type: [effectItemSchema],
    default: [],
  },
  generationLib: {
    type: [generationLibSchema],
    default: [],
  },
  storiesLib: [{ type: Schema.Types.ObjectId, ref: 'Story' }],
  isVerified: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
  firebaseUid: { type: String, unique: true },
  jobs: [{ type: { _id: Schema.Types.ObjectId, jobId: String }, ref: 'Job' }],
  FCMToken: { type: String, default: null },
  notifications: {
    type: [notificationSchema],
    default: [],
  },
  preferredLanguage: { type: String, default: 'en' },
});

userSchema.on('delete', async (doc: HydratedDocument<IUser>) => {
  await UserEvents.onUserDeleted(doc);
});

const User = model<IUser>('User', userSchema);
export default User;
export { IUser };
