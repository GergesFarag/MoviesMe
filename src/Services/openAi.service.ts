import OpenAI from "openai";
import AppError from "../Utils/Errors/AppError";
import { IStoryResponse } from "../Interfaces/storyResponse.interface";
import { generateSysPrompt } from "../Utils/Format/generateSysPrompt";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
export class OpenAIService {
  private client: OpenAI;
  private SYSTEM_PROMPT: string;

  constructor(
    numOfScenes: number,
    storyTitle?: string,
    storyStyle?: string,
    storyGenere?: string,
    storyLocation?: string,
    doNarration: boolean = false
  ) {
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
    this.SYSTEM_PROMPT = generateSysPrompt(
      numOfScenes,
      storyTitle,
      storyStyle,
      storyGenere,
      storyLocation,
      doNarration
    );
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
        max_output_tokens: 2000,
      });
      console.log("Parsed response:", JSON.parse(response.output_text as string));
      let cleanResponse = response.output_text.trim();
      
      // Check if response appears to be truncated
      if (!cleanResponse.endsWith('}') && !cleanResponse.endsWith(']}')) {
        throw new AppError(
          "AI response was truncated. The response appears incomplete. Please try with a shorter story or fewer scenes.",
          500
        );
      }
      
      // Basic JSON structure validation
      const openBraces = (cleanResponse.match(/\{/g) || []).length;
      const closeBraces = (cleanResponse.match(/\}/g) || []).length;
      const openBrackets = (cleanResponse.match(/\[/g) || []).length;
      const closeBrackets = (cleanResponse.match(/\]/g) || []).length;
      
      if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
        throw new AppError(
          "AI response contains malformed JSON structure. Mismatched braces or brackets detected.",
          500
        );
      }

      if (cleanResponse.startsWith("```json")) {
        cleanResponse = cleanResponse
          .replace(/```json\s*/, "")
          .replace(/\s*```$/, "");
      }
      if (cleanResponse.startsWith("```")) {
        cleanResponse = cleanResponse
          .replace(/```\s*/, "")
          .replace(/\s*```$/, "");
      }

      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanResponse);
      } catch (parseErr) {
        console.error("JSON Parse Error:", parseErr);
        console.error("Raw response:", response.output_text);
        throw new AppError(
          `Invalid JSON response from AI model: ${
            parseErr instanceof Error
              ? parseErr.message
              : "Unknown parsing error"
          }`,
          500
        );
      }

      if (parsedResponse.error) {
        throw new AppError(parsedResponse.error);
      }
      return parsedResponse as IStoryResponse;
    } catch (err: any) {
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
      return response.output_text as string;
    } catch (err: any) {
      throw new AppError(err.message, err.status);
    }
  }
}
