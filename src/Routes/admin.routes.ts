import { Router } from "express";
import adminController from "../Controllers/admin.controller";
const adminRouter = Router();

adminRouter.route("/users")
    .get(adminController.getAllUsers)
    .post(adminController.addUser);

adminRouter.route("/users/:id")
    .get(adminController.getUserById)
    .delete(adminController.deleteUser)
    .put(adminController.updateUser);

export default adminRouter;