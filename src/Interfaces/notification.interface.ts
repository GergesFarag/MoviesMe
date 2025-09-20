import { TNotificationCategory } from "../types/custom";

export interface INotification{
    title:string;
    message:string;
    redirectTo:string | null;
    category:TNotificationCategory;
    data:any;
    createdAt?:Date;
    expiresAt?:Date;
}