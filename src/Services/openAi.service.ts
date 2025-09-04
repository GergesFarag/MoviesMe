import OpenAI from "openai";
import AppError from "../Utils/Errors/AppError";
import { IStoryResponse } from "../Interfaces/storyResponse.interface";
export class OpenAIService {
  private client: OpenAI;
  private readonly SYSTEM_PROMPT = `You are a cinematic scene generator for visual storytelling and AI animation.
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
                        "sceneDescription": "<Detailed description of the scene>",
                        "imageDescription": "<Main subject, detailed setting, lighting, camera composition, cinematic style>",
                        "videoDescription": "<Camera movement, timing, effects, transitions, character acting and motion>"
                        }

                    OUTPUT RULES:
                    - JSON array ONLY
                    - English only
                    - Visually rich and AI-optimized`;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateScenes(prompt: string): Promise<IStoryResponse> {
    try {
      const response = await this.client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt,
              },
            ],
          },
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: this.SYSTEM_PROMPT,
              },
            ],
          },
        ],
        max_output_tokens: 400,
      });
      console.log("JSON RESPONSE: ", response.output_text);
      const parsedResponse = JSON.parse(response.output_text);
      if (parsedResponse.error) {
        throw new AppError(parsedResponse.error);
      }
      return parsedResponse as IStoryResponse;
    } catch (err: any) {
      throw new AppError(err.message, err.status);
    }
  }

  async generateNarrativeText(
    sceneDescription: string[],
    language: string
  ): Promise<string> {
    try {
      const response = await this.client.responses.create({
        model: "gpt-4o-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${sceneDescription.join("\n")}`,
              },
            ],
          },
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: `You are a cinematic narrator and translator.
                    TASK:
                    Convert the given scene descriptions into a cohesive, engaging narrative text in the ${language} language. or leave it in English if the language is not supported.
                    OUTPUT RULES:
                    - Narrative text only, no scene descriptions.`,
              },
            ],
          },
        ],
        max_output_tokens: 400,
      });
      console.log("NARRATIVE RESPONSE: ", response.output_text);
      return response.output_text as string;
    } catch (err: any) {
      throw new AppError(err.message, err.status);
    }
  }
  
}
