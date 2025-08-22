import { Router } from "express";
import modelsController from "../Controllers/models.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
import { upload } from "../Config/multer";
const modelsRouter = Router();
modelsRouter.get("/videoEffects" , modelsController.getVideoModels);
modelsRouter.get("/imageEffects" , modelsController.getImageModels);
modelsRouter.get("/characterEffects" , modelsController.getCharacterEffects);
modelsRouter.get("/aiTools" , modelsController.getAITools);
modelsRouter.get("/ai3dTools" , modelsController.getAI3DTools);
modelsRouter.get("/marketingTools" , modelsController.getMarketingTools);
modelsRouter.get("/trending" , modelsController.getTrendingModels);
modelsRouter.post("/applyModel" , upload.single('payload[image]') ,modelsController.applyModel);
modelsRouter.post("/", modelsController.addModel);
modelsRouter
.route("/:id")
.patch(modelsController.updateModel)
.delete(modelsController.deleteModel);
export default modelsRouter;
