import OpenAI from "openai";
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});
export const openAICalling = async (story: string) => {
  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: story,
          },
        ],
      },
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `You are a cinematic scene generator for visual storytelling and AI animation.
                    TASK:
                    Convert valid short stories (in ANY language) into EXACTLY 3 cinematic scenes optimized for AI image/video generation.

                    VALIDATION:
                    - Reject input if: single words, greetings, prompts, questions, or non-narrative text.
                    → Respond: { "error": "Invalid input. Please provide a valid story." }
                    - If story too complex for 3 scenes:
                    → Respond: { "error": "Story too complex for 3 scenes." }
                    RESPONSE FORMAT:
                    {
                      "title": "<Story Title>",
                      "scenes": [<Scenes>]
                    }
                      
                    SCENE FORMAT (3 scenes only):
                        {
                        "sceneNumber": <1 to 3>,
                        "imageDescription": "<Main subject, detailed setting, lighting, camera composition, cinematic style>",
                        "videoDescription": "<Camera movement, timing, effects, transitions, character acting and motion>"
                        }

                    OUTPUT RULES:
                    - JSON array ONLY
                    - English only
                    - Visually rich and AI-optimized`,
          },
        ],
      },
    ],
    max_output_tokens: 400,
  });
  console.log("JSON RESPONSE: ", response.output_text);
  try {
    const parsedResponse = JSON.parse(response.output_text);
    return parsedResponse;
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return null;
  }
};
