export interface INotification{
    title:string;
    message:string;
    redirectTo:string | null;
    data:any;
    createdAt?:Date;
    expiresAt?:Date;
}