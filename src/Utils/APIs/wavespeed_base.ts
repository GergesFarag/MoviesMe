const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
export const wavespeedBase = async (
  url: string,
  headers: HeadersInit,
  payload: any
): Promise<string | null | string[]> => {
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
            const errorMessage = data.error || "Task failed without specific error message";
            console.error("Task failed:", errorMessage);
            throw new Error(`Image generation failed: ${errorMessage}`);
          } else {
            // Only log every 10th check to reduce spam
            if (Math.random() < 0.1) {
              console.log("Task still processing. Status:", status);
            }
          }
        } else {
          const errorData = await response.text();
          console.error("Error checking task status:", response.status, errorData);
          throw new Error(`Status check failed: ${response.status} - ${errorData}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000)); // Increased to 2 seconds
      }
    } else {
      const errorText = await response.text();
      console.error(`Initial request failed: ${response.status}, ${errorText}`);
      throw new Error(`Image generation request failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error(`Request failed: ${error}`);
    return null;
  }
};
