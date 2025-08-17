import { model, Schema } from "mongoose";
import { IUser } from "../Interfaces/user.interface";

const userSchema = new Schema<IUser>({
  username: { type: String, required: true, select: true },
  email: {
    type: String,
    unique: true,
    validate: {
      validator: (v: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: (data) => `${data.value} is not a valid email!`,
    },
    select: true,
  },
  phoneNumber: {
    type: String,
    select: true,
  },
  age: { type: Number, min: 12, select: true },
  credits: { type: Number, default: 10, select: true },
  userLocation: { type: String, default: "", select: true },
  dob: { type: Date, default: null, select: true },
  isMale: { type: Boolean, default: false, select: true },
  profilePicture: { type: String, default: "", select: true },
  videos: [{ type: String }],
  isActive: { type: Boolean, default: true },
  stories: [{ type: Schema.Types.ObjectId, ref: "Story" }],
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
  firebaseUid: { type: String, unique: true },
  favs: [{ type: Schema.Types.ObjectId }],
});

const User = model<IUser>("User", userSchema);
export default User;
export { IUser };
