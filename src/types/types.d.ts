declare namespace Express {
  interface Request {
    user?: {
      id: string | Types.ObjectId;
      email?: string;
      name?: string;
      uid?: string | Types.ObjectId;
      phone_number?: string;
    };
    t: (key: string, options?: any) => string;
  }
}
