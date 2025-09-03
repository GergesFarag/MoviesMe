import { Schema } from "mongoose";
import { INotification } from "../Interfaces/notification.interface";

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: [true , "Title is required"] },
    message: { type: String, required: [true , "Message is required"] },
    data: { type: Object, required: [true , "Data is required"] },
    redirectTo: { type: String, required: [true , "RedirectTo is required"] },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    _id: true,
  }
);
export default notificationSchema;
