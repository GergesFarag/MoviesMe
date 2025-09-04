import { Router } from "express";
import storyController from "../Controllers/story.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
import { imageUpload } from "../Config/multer";
const storyRouter = Router();
storyRouter
  .route("/")
  .get(authMiddle, storyController.getAllStories)
  .post(authMiddle, imageUpload.single("image"), storyController.generateStory);
storyRouter
  .route("/generationData")
  .get(storyController.getGenerationData)
  .put(storyController.updateGenerationData);
storyRouter
  .route("/:storyID")
  .get(authMiddle, storyController.getStory)
  .delete(authMiddle, storyController.deleteStory);
export default storyRouter;
