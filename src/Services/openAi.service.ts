import OpenAI from "openai";
import AppError from "../Utils/Errors/AppError";
import { IStoryResponse } from "../Interfaces/storyResponse.interface";
import { generateSysPrompt } from "../Utils/Format/generateSysPrompt";
import { Validator } from "./validation.service";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
export class OpenAIService {
  private client: OpenAI;
  private SYSTEM_PROMPT: string;
  private validator: Validator;
  constructor(
    numOfScenes: number,
    storyTitle?: string,
    storyStyle?: string,
    storyGenere?: string,
    storyLocation?: string
  ) {
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
    this.SYSTEM_PROMPT = generateSysPrompt(
      numOfScenes,
      storyTitle,
      storyStyle,
      storyGenere,
      storyLocation
    );
    this.validator = new Validator();
  }

  async generateScenes(prompt: string): Promise<IStoryResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: this.SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 4000,
        temperature: 0.7,
      });

      const rawResponse = response.choices[0]?.message?.content;
      if (!rawResponse) {
        throw new AppError("No response content from OpenAI", 500);
      }
      let parsedResponse;
      try {
        try {
          parsedResponse = JSON.parse(rawResponse);
        } catch (directParseErr) {
          // If direct parsing fails, try sanitizing first
          console.log("Direct JSON parse failed, attempting sanitization...");
          const sanitizedResponse =
            this.validator.JSONValidator.sanitizeJSON(rawResponse);
          console.log("Sanitized response:", sanitizedResponse);

          try {
            parsedResponse = JSON.parse(sanitizedResponse);
          } catch (sanitizedParseErr) {
            const fixedResponse =
              this.validator.JSONValidator.fixCommonJSONIssues(
                sanitizedResponse
              );
            parsedResponse = JSON.parse(fixedResponse);
          }
        }
      } catch (parseErr) {
        console.error("JSON Parse Error:", parseErr);
        console.error("Raw response:", rawResponse);

        let jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          jsonMatch = rawResponse.match(/\{[^}]*"title"[\s\S]*\}/);
        }
        if (jsonMatch) {
          try {
            console.log("Attempting to parse extracted JSON...");
            let extractedJson = this.validator.JSONValidator.sanitizeJSON(
              jsonMatch[0]
            );
            extractedJson =
              this.validator.JSONValidator.fixCommonJSONIssues(extractedJson);
            parsedResponse = JSON.parse(extractedJson);
            console.log("Successfully parsed extracted JSON");
          } catch (extractErr) {
            console.error("Failed to parse extracted JSON:", extractErr);
            throw new AppError(
              `Invalid JSON response from AI model after all parsing attempts: ${
                parseErr instanceof Error
                  ? parseErr.message
                  : "Unknown parsing error"
              }. Please check the AI model response format. Raw response (first 500 chars): ${rawResponse.substring(
                0,
                500
              )}...`,
              500
            );
          }
        } else {
          throw new AppError(
            `No valid JSON found in AI response: ${
              parseErr instanceof Error
                ? parseErr.message
                : "Unknown parsing error"
            }. Raw response: ${rawResponse.substring(0, 500)}...`,
            500
          );
        }
      }

      if (parsedResponse.error) {
        throw new AppError(parsedResponse.error, 500);
      }

      if (
        !parsedResponse.title ||
        !parsedResponse.scenes ||
        !Array.isArray(parsedResponse.scenes)
      ) {
        throw new AppError(
          "Invalid response structure from AI model: missing title or scenes array",
          500
        );
      }

      for (let i = 0; i < parsedResponse.scenes.length; i++) {
        const scene = parsedResponse.scenes[i];
        if (
          !scene.sceneNumber ||
          !scene.imageDescription ||
          !scene.videoDescription ||
          !scene.sceneDescription
        ) {
          throw new AppError(
            `Invalid scene structure at index ${i}: missing required fields`,
            500
          );
        }
        if (typeof scene.sceneNumber !== "number") {
          throw new AppError(
            `Invalid scene structure at index ${i}: sceneNumber must be a number`,
            500
          );
        }
        if (
          typeof scene.imageDescription !== "string" ||
          typeof scene.videoDescription !== "string" ||
          typeof scene.sceneDescription !== "string"
        ) {
          throw new AppError(
            `Invalid scene structure at index ${i}: descriptions must be strings`,
            500
          );
        }
      }

      for (let i = 0; i < parsedResponse.scenes.length; i++) {
        if (parsedResponse.scenes[i].sceneNumber !== i + 1) {
          console.warn(
            `Scene number mismatch at index ${i}: expected ${i + 1}, got ${
              parsedResponse.scenes[i].sceneNumber
            }`
          );
          // Auto-fix scene numbers
          parsedResponse.scenes[i].sceneNumber = i + 1;
        }
      }

      console.log("OPENAI PARSED RESPONSE:", parsedResponse);
      return parsedResponse as IStoryResponse;
    } catch (err: any) {
      console.error("OpenAI service error:", err);
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(
        err.message || "OpenAI service error",
        err.status || 500
      );
    }
  }

  async generateNarrativeText(
    sceneDescription: string[],
    language: string
  ): Promise<string> {
    console.log("language:", language);
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a cinematic narrator and translator.
                    TASK:
                    Convert the given scene descriptions into a cohesive, engaging narrative text in the ${language} language.
                    
                    CRITICAL CONSTRAINTS:
                    - Voice narration time must fit exactly in ${sceneDescription.length * 4} seconds (approximately 4 seconds per scene).
                    
                    OUTPUT RULES:
                    - Narrative text only, no scene descriptions.`,
          },
          {
            role: "user",
            content: sceneDescription.join(" "),
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
      const narrativeText = response.choices[0]?.message?.content;
      if (!narrativeText) {
        throw new AppError("No narrative text generated from OpenAI", 500);
      }

      return narrativeText;
    } catch (err: any) {
      throw new AppError(err.message, err.status || 500);
    }
  }
}
