import { Router } from "express";
const storyRouter = Router();
import storyController from "../Controllers/story.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
storyRouter
  .route("/")
  .get(authMiddle, storyController.getAllStories)
  .post(authMiddle, storyController.addStory);
storyRouter
  .route("/generationData")
  .get(storyController.getGenerationData)
  .put(storyController.updateGenerationData);
storyRouter
  .route("/:storyID")
  .get(authMiddle, storyController.getStory)
  .delete(authMiddle, storyController.deleteStory);
export default storyRouter;
