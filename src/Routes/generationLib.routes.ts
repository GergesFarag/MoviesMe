import { Router } from "express";
import generationLibController from "../Controllers/generationLib.controller";
import { authMiddle } from "../Middlewares/auth.middleware";
import { imageUpload } from "../Config/multer";

const router = Router();

router.post("/", authMiddle, imageUpload.any(), generationLibController.createGeneration);

export default router;