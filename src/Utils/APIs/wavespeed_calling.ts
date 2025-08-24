import Bull from "bull";
import AppError from "../Errors/AppError";
import { formatModelName } from "../Format/modelNames";
import { sendNotificationToAllUsers } from "../Notifications/notifications";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;

const updateJobProgress = async (
  job: Bull.Job,
  progress: number,
  status: string,
  additionalData: object = {}
) => {
  if (job) {
    await job.progress(progress);
    await job.update({ status, ...additionalData });
  }
};

export const runModel = async (
  modelName: string,
  type: string,
  data: any,
  job?: Bull.Job
) => {
  console.log("data" , data);
  if (!WAVESPEED_API_KEY) {
    throw new AppError(
      "Your API key is missing. Please check your Access Keys in the environment variables."
    );
  }

  const formattedModel = formatModelName(modelName, type);
  console.log("MODEL NAME:", formattedModel);

  if (job) {
    await updateJobProgress(job, 10, "Initializing model processing...");
    await new Promise((res) => setTimeout((res), 4000));
  }

  const url = `https://api.wavespeed.ai/api/v3/${formattedModel}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${WAVESPEED_API_KEY}`,
  };

  const payload = {
    ...data,
  };
  try {
    if (job) {
      await updateJobProgress(job, 30, "Submitting model data...");
      await new Promise((res) => setTimeout((res), 2000)); // Simulate submit delay
    }
    
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
        await updateJobProgress(job, 50, "Waiting..", { requestId });
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

          if (job) {
            await updateJobProgress(job, 70, "Processing...", { requestId });
          }

          if (status === "completed") {
            const resultUrl = data.outputs[0];
            console.log("Task completed successfully. Result URL:", resultUrl);

            sendNotificationToAllUsers("Model Processing Completed", `Your video generated successfully`);
            return resultUrl;
          } else if (status === "failed") {
            if (job) {
              await updateJobProgress(job, 0, "Model processing failed.", { error: data.error });
            }
            console.error("Task failed:", data.error);
            sendNotificationToAllUsers("Model Processing Failed", `Your video failed to generate`);
            return null;
          } else {
            console.log("Task still processing. Current status:", status);
          }
        } else {
          console.error(
            "Error with status check:",
            statusResponse.status,
            await statusResponse.text()
          );

          if (job) {
            await updateJobProgress(job, 0, "API error while checking status.", {
              error: statusResponse.status,
            });
          }

          throw new AppError("Wavespeed API request failed during status check", 500);
        }

        await new Promise((resolve) => setTimeout(resolve, 500)); // Wait before re-checking
      }
    } else {
      console.error(`Error submitting task: ${response.status}, ${await response.text()}`);
      if (job) {
        await updateJobProgress(job, 0, "Error submitting task.", {
          error: response.status,
        });
      }
    }
  } catch (error) {
    if (job) {
      await updateJobProgress(job, 0, "An error occurred during model processing.", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    console.error(`Request failed: ${error}`);
  }
};
