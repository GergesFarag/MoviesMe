import { HydratedDocument, Model, Mongoose } from "mongoose";
import { IUser } from "../../Interfaces/user.interface";

class UserEvents {
  public static onUserDeleted(user: HydratedDocument<IUser>) {

  }
}

export default UserEvents;
