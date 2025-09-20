import { TNotificationCategory } from "../types/custom";

export interface INotification{
    title:string;
    message:string;
    redirectTo:string | null;
    data:any;
    category?:TNotificationCategory;
    createdAt?:Date;
    expiresAt?:Date;
}