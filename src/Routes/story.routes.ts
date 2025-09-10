import { Router } from "express";
import storyController from "../Controllers/story.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
import { imageUpload } from "../Config/multer";
const storyRouter = Router();
storyRouter
  .route("/")
  .post(authMiddle, imageUpload.single("image"), storyController.generateStory);
  storyRouter.route("/:storyID").delete(authMiddle, storyController.deleteStory);
storyRouter
  .route("/generationData")
  .get(storyController.getGenerationData)
  .put(storyController.updateGenerationData);
export default storyRouter;
