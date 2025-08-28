import { model, Schema, Types } from "mongoose";
import { IUser } from "../Interfaces/user.interface";
import itemSchema from "./item.model";

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
  items: {
    type: [itemSchema],
    default: [],
  },
  isActive: { type: Boolean, default: true },
  stories: [{ type: Schema.Types.ObjectId, ref: "Story" }],
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
  firebaseUid: { type: String, unique: true },
  jobs: [{ type: { _id: Schema.Types.ObjectId, jobId: String }, ref: "Job" }],
  FCMToken: { type: String, default: null },
});
userSchema.on("delete", (doc) => {
  console.log("User deleted:", doc);
});
const User = model<IUser>("User", userSchema);
export default User;
export { IUser };
