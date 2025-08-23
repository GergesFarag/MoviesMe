import Bull, { Job } from "bull";
import taskQueue from "../../Queues/model.queue";
import AppError from "../Errors/AppError";
import { formatModelName } from "../Format/modelNames";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;

export const runModel = async (
  modelName: string,
  type: string,
  data: any,
  job?: Bull.Job
) => {
  if (!WAVESPEED_API_KEY) {
    throw new AppError(
      "Your API_KEY is not set, you can check it in Access Keys"
    );
  }
  const formattedModel = formatModelName(modelName, type);
  if (job) {
    await job.progress(10);
    await job.update({ status: "initializing" });
  }
  console.log("MODEL NAME:", formattedModel);
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
      await job.progress(30);
      await job.update({ status: "submitting_to_api" });
    }
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      const requestId = result.data.id;
      if (job) {
        await job.progress(40);
        await job.update({ status: "waiting_for_processing", requestId });
      }
      console.log(`Task submitted successfully. Request ID: ${requestId}`);

      while (true) {
        if (job) {
          await job.update({ status: "checking_status" });
        }
        const response = await fetch(
          `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
          {
            headers: {
              Authorization: `Bearer ${WAVESPEED_API_KEY}`,
            },
          }
        );
        if (job) {
          await job.progress(40);
          await job.update({ status: "waiting_for_response", requestId });
        }
        const result = await response.json();
        if (response.ok) {
          const data = result.data;
          const status = data.status;

          if (status === "completed") {
            const resultUrl = data.outputs[0];
            console.log("Task completed. URL:", resultUrl);
            if (job) {
              await job.progress(100);
              await job.update({ status: "completed", resultUrl });
            }
            return resultUrl;
          } else if (status === "failed") {
            if (job) {
              await job.progress(0);
              await job.update({ status: "failed", error: data.error });
            }
            console.error("Task failed:", data.error);

            return null;
          } else {
            console.log("Task still processing. Status:", status);
            if (job) {
              let progress = 50;
              if (status === "processing") progress = 60;
              if (status === "almost_done") progress = 80;

              await job.progress(progress);
              await job.update({ status: "processing", apiStatus: status });
            }
          }
        } else {
          console.error("Error:", response.status, JSON.stringify(result));
          if (job) {
            await job.progress(0);
            await job.update({ status: "api_error", error: response.status });
          }
          throw new AppError("Wavespeed API request failed", 500);
        }
        await new Promise((resolve) => setTimeout(resolve, 0.5 * 1000));
      }
    } else {
      console.error(`Error: ${response.status}, ${await response.text()}`);
    }
  } catch (error) {
    if (job) {
      await job.progress(0);
      await job.update({
        status: "errored",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    console.error(`Request failed: ${error}`);
  }
};
