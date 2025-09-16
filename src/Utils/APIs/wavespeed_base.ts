const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
export const wavespeedBase = async (
  url: string,
  headers: HeadersInit,
  payload: any
): Promise<string | null> => {
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
            if (!resultUrl) {
              console.error("No output URL found in completed task");
              return null;
            }
            return resultUrl;
          } else if (status === "failed") {
            console.error("Task failed:", data.error);
            return null;
          } else {
            // Only log every 10th check to reduce spam
            if (Math.random() < 0.1) {
              console.log("Task still processing. Status:", status);
            }
          }
        } else {
          console.error("Error checking task status:", response.status, JSON.stringify(result));
          return null;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased to 2 seconds
      }
    } else {
      console.error(`Initial request failed: ${response.status}, ${await response.text()}`);
      return null;
    }
  } catch (error) {
    console.error(`Request failed: ${error}`);
    return null;
  }
};
