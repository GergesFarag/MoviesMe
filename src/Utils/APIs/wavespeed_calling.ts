import { formatModelName } from "../Format/modelNames";
import AppError from "../Errors/AppError";
import Bull from "bull";
import { getIO } from "../../Sockets/socket";
import { processModelData, updateJobProgress } from "../Model/model.utils";
import { DefaultEventsMap, Server } from "socket.io";
import { sendNotificationToClient } from "../Notifications/notifications";
import { cloudUploadURL } from "./cloudinary";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;

export const runModel = async (
  modelName: string,
  modelType: string,
  data: any,
  FCM: string,
  job?: Bull.Job,
  IO?: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) => {
  if (!WAVESPEED_API_KEY) {
    throw new AppError(
      "Your API key is missing. Please check your Access Keys in the environment variables."
    );
  }

  const { formattedModel, url, headers } = await processModelData(
    modelName,
    modelType,
    data
  );
  try {
    if (job) {
      await updateJobProgress(
        job,
        30,
        "Submitting model data...",
        IO,
        "job:progress"
      );
      await new Promise((res) => setTimeout(res, 2000));
    }
    
    // Build payload based on model requirements
    const payload: any = {
      enable_base64_output: false,
      image: data.image,
    };
    
    // Add additional parameters that might be required by certain models
    if (data.prompt) {
      payload.prompt = data.prompt;
    }
    
    if (data.duration) {
      payload.duration = data.duration;
    }
    
    if (data.seed !== undefined) {
      payload.seed = data.seed;
    }
    
    // Add BGM parameter for video models that require it
    // Some video generation models require background music
    if (modelType.includes('video') || modelType.includes('bytedance')) {
      payload.bgm = data.bgm || null; // Use provided BGM or null as default
    }
    
    console.log("Sending payload to Wavespeed:", JSON.stringify(payload, null, 2));
    
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      const requestId = result.data.id;

      console.log(`Task submitted successfully. Request ID: ${requestId}`);

      if (job) {
        await updateJobProgress(job, 60, "Processing...", IO, "job:progress");
      }

      while (true) {
        const statusResponse = await fetch(
          `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
          {
            headers: {
              Authorization: `Bearer ${WAVESPEED_API_KEY}`,
            },
          }
        );

        if (statusResponse.ok) {
          const result = await statusResponse.json();
          const data = result.data;
          const status = data.status;

          if (status === "completed") {
            updateJobProgress(job!, 80, "Finalizing...", IO, "job:progress");
            await new Promise((res) => setTimeout(res, 2000)); // Simulate finalization delay
            const resultUrl = data.outputs[0];
            
            updateJobProgress(
              job!,
              100,
              "Processing Completed!",
              IO,
              "job:progress"
            );
            return resultUrl;
          } else if (status === "failed") {
            if (job) {
              await updateJobProgress(
                job,
                0,
                "Model processing failed.",
                IO,
                "model_error"
              );
            }
            console.error("Task failed:", data.error);
            sendNotificationToClient(
              FCM,
              "Model Processing Failed",
              `Your video failed to generate`,
              { error: data.error || "Unknown error" }
            );
            return null;
          }
        } else {
          console.error(
            "Error with status check:",
            statusResponse.status,
            await statusResponse.text()
          );

          if (job) {
            await updateJobProgress(
              job,
              0,
              "API error while checking status.",
              IO,
              "model_error"
            );
          }

          throw new AppError(
            "Wavespeed API request failed during status check",
            500
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait before re-checking
      }
    } else {
      console.error(
        `Error submitting task: ${response.status}, ${await response.text()}`
      );
      if (job) {
        await updateJobProgress(
          job,
          0,
          "Error submitting task.",
          IO,
          "model_error"
        );
      }
    }
  } catch (error) {
    if (job) {
      await updateJobProgress(
        job,
        0,
        "An error occurred during model processing.",
        IO,
        "model_error"
      );
    }
    console.error(`Request failed: ${error}`);
  }
};
