import { model, Schema } from "mongoose";
import { IUser } from "../Interfaces/user.interface";

const userSchema = new Schema<IUser>({
  username: { type: String, required: true },
  email: {
    type: String,
    unique: true,
    validate: {
      validator: (v: string) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: (data) => `${data.value} is not a valid email!`,
    },
  },
  phoneNumber : {
    type: String},
  age: { type: Number, min: 12 },
  isActive: { type: Boolean, default: true },
  videos: [{ type: String }], 
  stories: [{ type: Schema.Types.ObjectId, ref: "Story" }],
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now() },
  updatedAt: { type: Date, default: Date.now() },
  firebaseUid: { type: String, unique: true },
  userLocation: { type: String, default: "" }
});

const User = model<IUser>("User", userSchema);
export default User;
export {  IUser };
