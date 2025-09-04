const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
export const wavespeedBase = async (
  url: string,
  headers: HeadersInit,
  payload: any
) => {
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
            return resultUrl;
          } else if (status === "failed") {
            console.error("Task failed:", data.error);
            return null;
          } else {
            console.log("Task still processing. Status:", status);
          }
        } else {
          console.error("Error:", response.status, JSON.stringify(result));
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 0.1 * 1000));
      }
    } else {
      console.error(`Error: ${response.status}, ${await response.text()}`);
    }
  } catch (error) {
    console.error(`Request failed: ${error}`);
  }
};
