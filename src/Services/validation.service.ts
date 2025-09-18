import { IValidator, IJSONValidator } from "../Interfaces/validation.interface";

export class Validator implements IValidator {
  JSONValidator: IJSONValidator = {
    sanitizeJSON(jsonString: string): string {
      try {
        // Remove any markdown code blocks if present
        let sanitized = jsonString
          .replace(/```json\s*/g, "")
          .replace(/```\s*$/g, "");

        // Remove any leading/trailing whitespace
        sanitized = sanitized.trim();

        // Replace single quotes with double quotes for property names and string values
        // This is a simple regex that may not cover all cases but handles common issues
        sanitized = sanitized.replace(/'([^']*)'/g, '"$1"');

        // Fix unquoted property names (simple cases)
        sanitized = sanitized.replace(
          /([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g,
          '$1"$2":'
        );

        // Remove trailing commas before closing braces/brackets
        sanitized = sanitized.replace(/,(\s*[}\]])/g, "$1");

        // Fix missing commas between properties
        sanitized = sanitized.replace(/"\s*\n\s*"/g, '",\n"');
        sanitized = sanitized.replace(/}\s*\n\s*"/g, '},\n"');
        sanitized = sanitized.replace(/]\s*\n\s*"/g, '],\n"');

        // Fix missing quotes around string values that contain spaces or special characters
        sanitized = sanitized.replace(
          /:\s*([^"{\[\d\-][^,}\]]*[^,}\]\s])\s*([,}\]])/g,
          ': "$1"$2'
        );

        // Remove any non-JSON content before the first { or [
        const jsonStart = Math.min(
          sanitized.indexOf("{") >= 0 ? sanitized.indexOf("{") : Infinity,
          sanitized.indexOf("[") >= 0 ? sanitized.indexOf("[") : Infinity
        );
        if (jsonStart !== Infinity && jsonStart > 0) {
          sanitized = sanitized.substring(jsonStart);
        }

        // Remove any non-JSON content after the last } or ]
        const lastBrace = sanitized.lastIndexOf("}");
        const lastBracket = sanitized.lastIndexOf("]");
        const jsonEnd = Math.max(lastBrace, lastBracket);
        if (jsonEnd >= 0 && jsonEnd < sanitized.length - 1) {
          sanitized = sanitized.substring(0, jsonEnd + 1);
        }

        return sanitized;
      } catch (error) {
        console.error("Error in sanitizeJSON:", error);
        return jsonString; // Return original if sanitization fails
      }
    },

    validateJSON(str: string): boolean {
      try {
        const parsed = JSON.parse(str);
        return typeof parsed === "object" && parsed !== null;
      } catch {
        return false;
      }
    },

    fixCommonJSONIssues(jsonString: string): string {
      try {
        let fixed = jsonString;

        // Fix missing commas between array elements (scenes)
        fixed = fixed.replace(/}\s*\n\s*{/g, "},\n{");
        fixed = fixed.replace(/}\s*{/g, "},{");

        // Fix missing commas between object properties
        fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');

        // Ensure proper escaping of quotes within strings
        fixed = fixed.replace(/([^\\])"/g, (match, p1) => {
          // Don't escape quotes that are property names or values boundaries
          if (p1 === ":" || p1 === "," || p1 === "{" || p1 === "[") {
            return match;
          }
          return p1 + '\\"';
        });

        // Remove any JavaScript comments
        fixed = fixed.replace(/\/\/.*$/gm, "");
        fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, "");

        return fixed;
      } catch (error) {
        console.error("Error in fixCommonJSONIssues:", error);
        return jsonString;
      }
    },
  };
}
