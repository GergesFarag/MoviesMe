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
    language: string = "English",
    doNarration: boolean = false
  ) {
    this.client = new OpenAI({ apiKey: OPENAI_API_KEY });
    this.SYSTEM_PROMPT = generateSysPrompt(
      numOfScenes,
      storyTitle,
      storyStyle,
      storyGenere,
      storyLocation,
      language,
      doNarration
    );
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
          const sanitizedResponse = this.sanitizeJSON(rawResponse);
          console.log("Sanitized response:", sanitizedResponse);
          
          try {
            parsedResponse = JSON.parse(sanitizedResponse);
          } catch (sanitizedParseErr) {
            const fixedResponse = this.fixCommonJSONIssues(sanitizedResponse);
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
            let extractedJson = this.sanitizeJSON(jsonMatch[0]);
            extractedJson = this.fixCommonJSONIssues(extractedJson);
            parsedResponse = JSON.parse(extractedJson);
            console.log("Successfully parsed extracted JSON");
          } catch (extractErr) {
            console.error("Failed to parse extracted JSON:", extractErr);
            throw new AppError(
              `Invalid JSON response from AI model after all parsing attempts: ${
                parseErr instanceof Error
                  ? parseErr.message
                  : "Unknown parsing error"
              }. Please check the AI model response format. Raw response (first 500 chars): ${rawResponse.substring(0, 500)}...`,
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
      
      if (!parsedResponse.title || !parsedResponse.scenes || !Array.isArray(parsedResponse.scenes)) {
        throw new AppError("Invalid response structure from AI model: missing title or scenes array", 500);
      }
      
      for (let i = 0; i < parsedResponse.scenes.length; i++) {
        const scene = parsedResponse.scenes[i];
        if (!scene.sceneNumber || !scene.imageDescription || !scene.videoDescription || !scene.sceneDescription) {
          throw new AppError(`Invalid scene structure at index ${i}: missing required fields`, 500);
        }
        if (typeof scene.sceneNumber !== 'number') {
          throw new AppError(`Invalid scene structure at index ${i}: sceneNumber must be a number`, 500);
        }
        if (typeof scene.imageDescription !== 'string' || typeof scene.videoDescription !== 'string' || typeof scene.sceneDescription !== 'string') {
          throw new AppError(`Invalid scene structure at index ${i}: descriptions must be strings`, 500);
        }
      }
      
      for (let i = 0; i < parsedResponse.scenes.length; i++) {
        if (parsedResponse.scenes[i].sceneNumber !== i + 1) {
          console.warn(`Scene number mismatch at index ${i}: expected ${i + 1}, got ${parsedResponse.scenes[i].sceneNumber}`);
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

  private sanitizeJSON(jsonString: string): string {
    try {
      // Remove any markdown code blocks if present
      let sanitized = jsonString.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      
      // Remove any leading/trailing whitespace
      sanitized = sanitized.trim();
      
      // Replace single quotes with double quotes for property names and string values
      // This is a simple regex that may not cover all cases but handles common issues
      sanitized = sanitized.replace(/'([^']*)'/g, '"$1"');
      
      // Fix unquoted property names (simple cases)
      sanitized = sanitized.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      
      // Remove trailing commas before closing braces/brackets
      sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');
      
      // Fix missing commas between properties
      sanitized = sanitized.replace(/"\s*\n\s*"/g, '",\n"');
      sanitized = sanitized.replace(/}\s*\n\s*"/g, '},\n"');
      sanitized = sanitized.replace(/]\s*\n\s*"/g, '],\n"');
      
      // Fix missing quotes around string values that contain spaces or special characters
      sanitized = sanitized.replace(/:\s*([^"{\[\d\-][^,}\]]*[^,}\]\s])\s*([,}\]])/g, ': "$1"$2');
      
      // Remove any non-JSON content before the first { or [
      const jsonStart = Math.min(
        sanitized.indexOf('{') >= 0 ? sanitized.indexOf('{') : Infinity,
        sanitized.indexOf('[') >= 0 ? sanitized.indexOf('[') : Infinity
      );
      if (jsonStart !== Infinity && jsonStart > 0) {
        sanitized = sanitized.substring(jsonStart);
      }
      
      // Remove any non-JSON content after the last } or ]
      const lastBrace = sanitized.lastIndexOf('}');
      const lastBracket = sanitized.lastIndexOf(']');
      const jsonEnd = Math.max(lastBrace, lastBracket);
      if (jsonEnd >= 0 && jsonEnd < sanitized.length - 1) {
        sanitized = sanitized.substring(0, jsonEnd + 1);
      }
      
      return sanitized;
    } catch (error) {
      console.error("Error in sanitizeJSON:", error);
      return jsonString; // Return original if sanitization fails
    }
  }

  private isValidJSON(str: string): boolean {
    try {
      const parsed = JSON.parse(str);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  }

  private fixCommonJSONIssues(jsonString: string): string {
    try {
      let fixed = jsonString;
      
      // Fix missing commas between array elements (scenes)
      fixed = fixed.replace(/}\s*\n\s*{/g, '},\n{');
      fixed = fixed.replace(/}\s*{/g, '},{');
      
      // Fix missing commas between object properties
      fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');
      
      // Ensure proper escaping of quotes within strings
      fixed = fixed.replace(/([^\\])"/g, (match, p1) => {
        // Don't escape quotes that are property names or values boundaries
        if (p1 === ':' || p1 === ',' || p1 === '{' || p1 === '[') {
          return match;
        }
        return p1 + '\\"';
      });
      
      // Remove any JavaScript comments
      fixed = fixed.replace(/\/\/.*$/gm, '');
      fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
      
      return fixed;
    } catch (error) {
      console.error("Error in fixCommonJSONIssues:", error);
      return jsonString;
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
