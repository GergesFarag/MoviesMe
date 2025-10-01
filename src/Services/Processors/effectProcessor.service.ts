import IAiModel from "../../Interfaces/aiModel.interface";
import { IEffectProcessor } from "../../Interfaces/effectProcessor.interface";
import { getIO } from "../../Sockets/socket";
import { wavespeedBase } from "../../Utils/APIs/wavespeed_base";
import AppError from "../../Utils/Errors/AppError";
import {
  filterModelType,
  reverseModelTypeMapper,
} from "../../Utils/Format/filterModelType";
import { payloadBuilder, updateJobProgress } from "../../Utils/Model/model.utils";
export class EffectProcessorService implements IEffectProcessor {
  private WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;
  async processEffect(job: any): Promise<any> {
    try {
      const { modelData, userId, data, prompt} =
        job.data;
      if (!modelData) {
        throw new AppError("Model Data not found", 404);
      }
      let progress = 0;
      const intervalId = setInterval(async () => {
        if (job && progress < 95) {
          console.log("Sending Progress...");
          progress += 2;
          await updateJobProgress(
            job,
            progress,
            "Still processing...",
            getIO(),
            "job:progress"
          );
        }
      }, 2000);
        if (!this.WAVESPEED_API_KEY) {
          console.error(
            "Your API_KEY is not set, you can check it in Access Keys"
          );
          throw new AppError("WAVESPEED_API_KEY is not set", 500);
        }
        const url = `https://api.wavespeed.ai/api/v3/${modelData.wavespeedCall}`;
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.WAVESPEED_API_KEY}`,
        };
        console.log("Prompt" , prompt);
        const payload = payloadBuilder({
          images: data.images || [data.image],
          hasPrompt: !!prompt,
          size: "2227*3183",
          prompt: prompt
        });
        let modelType = filterModelType(modelData as IAiModel);
        if (!modelType) {
          throw new AppError("Invalid model type", 400);
        }
        const result = await wavespeedBase(url, headers, payload);
        clearInterval(intervalId);
        if (!result) {
          throw new AppError("Model processing Result Failed", 500);
        }
        modelType = modelType === "bytedance" ? "image-effects" : modelType;

        const effectThumbnail = modelData.isVideo
          ? modelData.thumbnail
          : result;

        const dataToBeSent = {
          userId,
          modelType:
            reverseModelTypeMapper[
              modelType as keyof typeof reverseModelTypeMapper
            ] || modelType,
          resultURL: result,
          modelName: modelData.name,
          isVideo: modelData.isVideo,
          modelThumbnail: modelData.thumbnail,
          effectThumbnail,
          jobId: job.id,
          duration: modelData.isVideo ? 0 : 0,
        };
        updateJobProgress(
          job,
          100,
          "Processing completed",
          getIO(),
          "job:progress"
        );
        return dataToBeSent;
    } catch (error) {
      console.error(`Job ${job.id} failed:`, error);
      throw error;
    }
  }
}
