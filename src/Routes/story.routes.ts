import { Router } from "express";
import storyController from "../Controllers/story.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
import { upload } from "../Config/multer";
import { updateUserLanguagePreference } from "../Middlewares/language.middleware";
const storyRouter = Router();
storyRouter.route("/").post(
  authMiddle,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "audio", maxCount: 1 },
  ]),
  updateUserLanguagePreference,
  storyController.generateStory
);

storyRouter.route("/retry/:jobId").post(authMiddle, storyController.retryStoryJob);

storyRouter.route("/:storyID").delete(authMiddle, storyController.deleteStory);
storyRouter
  .route("/generationData")
  .get(storyController.getGenerationData)
  .put(storyController.updateGenerationData);
export default storyRouter;
