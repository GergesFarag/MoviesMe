import { Schema } from "mongoose";
import { INotification } from "../Interfaces/notification.interface";

const notificationSchema = new Schema<INotification>(
  {
    title: { type: String, required: [true, "Title is required"] },
    message: { type: String, required: [true, "Message is required"] },
    data: { type: Object, required: [true, "Data is required"] },
    redirectTo: { type: String, required: false, default: null },
    createdAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      required: true,
      default: function () {
        return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      },
    },
    category: {
      type: String,
      required: true,
      enum: ["systemUpdates", "activities", "transactions", "promotions"],
    },
  },
  {
    timestamps: true,
    _id: true,
  }
);
export default notificationSchema;
