import AppError from "../Errors/AppError";
import { formatModelName } from "../Format/modelNames";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY as string;

export const runModel = async (modelName: string, type: string, data: any) => {
  if (!WAVESPEED_API_KEY) {
    throw new AppError(
      "Your API_KEY is not set, you can check it in Access Keys"
    );
  }
  const formattedModel = formatModelName(modelName, type);
  console.log("MODEL NAME:", formattedModel);
  const url = `https://api.wavespeed.ai/api/v3/${formattedModel}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${WAVESPEED_API_KEY}`,
  };

  const payload = {
    ...data
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const result = await response.json();
      const requestId = result.data.id;
      console.log(`Task submitted successfully. Request ID: ${requestId}`);

      while (true) {
        const response = await fetch(
          `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`,
          {
            headers: {
              Authorization: `Bearer ${WAVESPEED_API_KEY}`,
            },
          }
        );
        const result = await response.json();

        if (response.ok) {
          const data = result.data;
          const status = data.status;

          if (status === "completed") {
            const resultUrl = data.outputs[0];
            console.log("Task completed. URL:", resultUrl);
            return resultUrl;
          } else if (status === "failed") {
            console.error("Task failed:", data.error);
            return null;
          } else {
            console.log("Task still processing. Status:", status);
          }
        } else {
          console.error("Error:", response.status, JSON.stringify(result));
          throw new AppError("Wavespeed API request failed", 500);
        }

        await new Promise((resolve) => setTimeout(resolve, 0.5 * 1000));
      }
    } else {
      console.error(`Error: ${response.status}, ${await response.text()}`);
    }
  } catch (error) {
    console.error(`Request failed: ${error}`);
  }
};
