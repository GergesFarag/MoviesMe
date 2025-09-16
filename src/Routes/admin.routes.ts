import { Router } from "express";
import adminController from "../Controllers/admin.controller";
const adminRouter = Router();

adminRouter
  .route("/users")
  .get(adminController.getAllUsers)
  .post(adminController.addUser);

adminRouter
  .route("/users/:id")
  .get(adminController.getUserById)
  .delete(adminController.deleteUser)
  .put(adminController.updateUser);
adminRouter
  .route("/audioModels")
  .get(adminController.getAllModels)
  .post(adminController.addModels);

// Voice service management routes
adminRouter
  .route("/voice/clear-cache")
  .post(adminController.clearVoiceCache);

adminRouter
  .route("/voice/status")
  .get(adminController.getVoiceServiceStatus);

export default adminRouter;
