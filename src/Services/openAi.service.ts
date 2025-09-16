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
      const response = await this.client.chat.completions.create({
        model: "gpt-4.1-mini",
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
      
      let cleanResponse = rawResponse.trim();
      
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

      // Remove markdown code blocks if present
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
      
      console.log("OPENAI CLEAN RESPONSE:", cleanResponse);
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanResponse);
      } catch (parseErr) {
        console.error("JSON Parse Error:", parseErr);
        console.error("Clean response:", cleanResponse);
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
        throw new AppError(parsedResponse.error, 500);
      }
      
      // Validate the response structure
      if (!parsedResponse.title || !parsedResponse.scenes || !Array.isArray(parsedResponse.scenes)) {
        throw new AppError("Invalid response structure from AI model", 500);
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
    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a cinematic narrator and translator.
                    TASK:
                    Convert the given scene descriptions into a cohesive, engaging narrative text in the ${language} language. or leave it in English if the language is not supported.
                    OUTPUT RULES:
                    - Narrative text only, no scene descriptions.`,
          },
          {
            role: "user",
            content: sceneDescription.join("\n"),
          },
        ],
        max_tokens: 400,
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
