import { Router } from "express";
import storyController from "../Controllers/story.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
import { imageUpload } from "../Config/multer";
import { updateUserLanguagePreference } from "../Middlewares/language.middleware";
const storyRouter = Router();
storyRouter
  .route("/")
  .post(authMiddle, imageUpload.single("image"),updateUserLanguagePreference ,storyController.generateStory);
  storyRouter.route("/:storyID").delete(authMiddle, storyController.deleteStory);
storyRouter
  .route("/generationData")
  .get(storyController.getGenerationData)
  .put(storyController.updateGenerationData);
export default storyRouter;
