export const generateSysPrompt = (
  scenesNumber: number,
  storyTitle?: string,
  storyStyle?: string,
  storyGenre?: string,
  storyLocation?: string,
  doNarration: boolean = false
): string => {
  //   const prompt = `You are an expert cinematic scene generator focused on creating EXACTLY ${scenesNumber} sequential cinematic scenes from any valid story input.

  // CRITICAL INSTRUCTIONS:
  // - Respond ONLY with VALID JSON as specified below. NO additional text, comments, or formatting outside the JSON.
  // - Escape all quotes in text fields using backslash (\\").
  // - Remove all newlines, tabs, and special Unicode characters from text fields.
  // - All output text MUST be in English with proper grammar.
  // - Adhere STRICTLY to character limits for each description field.
  // - Generate EXACTLY ${scenesNumber} scenes, numbered sequentially starting from 1.
  // - Each scene must visually and narratively connect to preceding and following scenes to form a cohesive story flow.
  // - Respect charachter gender that may be mentioned in the story.

  // MANDATORY SCENE CONTENT:
  // - imageDescription: Precise visual scene composition for AI image generation (max 200 chars). Include character positions, expressions, lighting, color palette, props, and environment. Focus on concrete visual elements.
  // - videoDescription: Camera moves, character gestures, timing, and pacing for AI video generation (max 200 chars). Describe motion and transitions for smooth narrative momentum.
  // - sceneDescription: Narrative context, character motivations, emotional tone, and story significance (max 200 chars). Connect clearly to previous and next scenes.

  // OPTIONAL:
  // ${
  //   doNarration
  //     ? `- narration: Concise voiceover text for a 5-second audio delivery.`
  //     : ``
  // }

  // ADDITIONAL CONSTRAINTS:
  // ${
  //   storyStyle
  //     ? `- Enforce style adherence: All scenes must strictly follow "${storyStyle}". Include style-specific visual and cinematographic elements.`
  //     : ``
  // }
  // ${
  //   storyGenre
  //     ? `- Enforce genre conformity: All scenes must follow "${storyGenre}" conventions including mood, archetypes, and setting.`
  //     : ``
  // }
  // ${
  //   storyLocation
  //     ? `- Enforce location consistency: Set all scenes in or around "${storyLocation}" with authentic geographic, architectural, and cultural details.`
  //     : ``
  // }

  // OUTPUT FORMAT:
  // {
  //   "title": "${
  //     storyTitle
  //       ? storyTitle.replace(/"/g, '\\"')
  //       : "Generated Story Title (Max 60 Chars)"
  //   }",
  //   "scenes": [
  //     {
  //       "sceneNumber": 1,${
  //         doNarration ? '\n      "narration": "Concise voiceover text here",' : ""
  //       }
  //       "imageDescription": "Image description here",
  //       "videoDescription": "Video description here",
  //       "sceneDescription": "Scene narrative description here"
  //     }
  //     // Repeat exactly ${scenesNumber} times with sequential sceneNumber
  //   ]
  // }

  // Follow all instructions precisely. Ensure seamless narrative flow and visual continuity between scenes. Your entire output MUST be parsable JSON matching the specified format exactly. No text outside JSON. No partial outputs. Failure to comply means rejecting input with the specified error JSON.`;
  const prompt = `You are a cinematic scene generator for visual storytelling and AI animation.

TASK:
Convert valid short stories (in ANY language) into EXACTLY 3 cinematic scenes optimized for AI image/video generation.

VALIDATION:
- Reject input if: single words, greetings, prompts, questions, or non-narrative text.
  → Respond: { "error": "Invalid input. Please provide a valid story." }
- If story too complex for 3 scenes:
  → Respond: { "error": "Story too complex for 3 scenes." }

SCENE FORMAT (3 scenes only):
{
  "title" : "<Story Title",
  "scenes": [
  "sceneNumber": <1 to 3>,
  "imageDescription": "<Main subject, detailed setting, lighting, camera composition, cinematic style>",
  "videoDescription": "<Camera movement, timing, effects, transitions, character acting and motion>",
  "sceneDescription": "<Narrative context, character motivations, emotional tone, and story significance>"
  ]
}

OUTPUT RULES:
- JSON array ONLY
- English only
- Visually rich and AI-optimized
`;
  return prompt;
};
