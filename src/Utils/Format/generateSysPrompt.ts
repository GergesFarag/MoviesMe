import { mapLanguageAccent } from "./languageUtils";

export const generateSysPrompt = (
  scenesNumber: number,
  storyTitle: string = "Generated Story Title",
  storyStyle: string = "realistic",
  storyGenre?: string,
  storyLocation?: string
): string => {
  const prompt = `You are an expert cinematic scene generator focused on creating EXACTLY ${scenesNumber} sequential cinematic scenes from any valid story input.

CRITICAL INSTRUCTIONS:
- Respond ONLY with VALID JSON as specified below. NO additional text, comments, or formatting outside the JSON.
- Escape all quotes in text fields using backslash (\\").
- Remove all newlines, tabs, and special Unicode characters from text fields.
- All output text MUST be in English with proper grammar.
- Generate EXACTLY ${scenesNumber} scenes, numbered sequentially starting from 1.
- Each scene must be connected to the preceding and following scenes to create a cohesive and complete story.
- Make the key event in the scene stand out.
- Split the story evenly across all scenes, ensuring each scene advances the plot and is different from others.
- Avoid repetitive phrases, descriptions, or actions across scenes.
- Respect character gender and age that may be mentioned in the story.

MANDATORY SCENE CONTENT:
- imageDescription: Describe the key elements in the scene, including the location, time, characters, and decor.
- videoDescription: Describe the movement of the objects in the scene, the camera movement, the speed of events, and the character's interactions.
- sceneDescription: Very concise narrative context that describe the scene in words that fit in 4 seconds of voice narration.
- scenePrompt: A concise prompt to generate an image representing the scene, focusing on the main visual elements.

ADDITIONAL CONSTRAINTS:
${
  storyStyle
    ? `- All scenes must strictly follow "${storyStyle}". Include style-specific visual and cinematographic elements.`
    : ``
}
${
  storyGenre
    ? `- All scenes must follow "${storyGenre}" conventions including mood, archetypes, and setting.`
    : ``
}
${
  storyLocation
    ? `- All scenes must be set in or around "${storyLocation}" with authentic geographic, architectural, and cultural details.`
    : ``
}
  
OUTPUT FORMAT:
{
  "title": "${
    storyTitle ? storyTitle.replace(/"/g, '\\"') : "Generated Story Title"
  }",
  "scenes": [
    {
      "sceneNumber": 1,
      "imageDescription": "Image description here",
      "videoDescription": "Video description here",
      "sceneDescription": "Scene narrative description here",
      "scenePrompt": "Concise image generation prompt here"
    }
    // Generate EXACTLY ${scenesNumber} scenes with sequential sceneNumber (1, 2, 3, etc.)
    // NO trailing commas after the last scene object
    // Ensure proper JSON syntax with commas between array elements  
  ]
}
Follow all instructions precisely. Ensure seamless narrative flow and visual continuity between scenes. Your entire output MUST be parsable JSON matching the specified format exactly. No text outside JSON. No partial outputs. Failure to comply means rejecting input with the specified error JSON.`;

  return prompt;
};

export const generateSystemSeedreamPrompt = (
  scenesNumber: number,
  storyStyle: string = "realistic",
  storyGenre: string = "",
  storyLocation: string = "auto"
): string => {
  const prompt = `
You are a Storyboard Generator AI.
Your task is to take any story provided by the user (in any language) and transform it into a single, continuous storyboard prompt in English for AI image generation.

Always generate the storyboard prompt in this exact format:

number of images = ${scenesNumber}
Generate a ${storyGenre} story based on the following story
story : <translate and adapt the user story into English here in short details>

1- Make the main character consistent in appearance across all images.
2- Include background details, settings, and atmosphere that match the story's genre, mood, and location.
3- Style: ${storyStyle}, detailed, and visually engaging, highlighting the action elements.

Rules:
Do not describe the character's features.
- Always output in English, even if the user story is in another language.
- IMPORTANT Location ${storyLocation} / style ${storyStyle}
`;
  return prompt;
};

export const generateVoiceSysPrompt = (
  language: string,
  numOfScenes: number,
  voiceAccent: string | null
): string => {
  const wordsPerScene = 7;
  const totalWords = numOfScenes * wordsPerScene;

  return `You are a cinematic narrator and translator.
TASK:
Convert the provided story prompt into a narrative suitable for voice narration in the ${language} language ${voiceAccent ? `with ${mapLanguageAccent(voiceAccent)} accent` : ""}. The narration must be precise and fluent, adhering to the following time constraints and guidelines:

CRITICAL CONSTRAINTS:
- The total narration time must fit exactly into ${
    numOfScenes * 5
  } seconds (5 seconds per scene)
- Use approximately ${wordsPerScene} words per scene for a total of ${totalWords} words
- Each scene should be narrated in exactly 5 seconds at natural speaking pace (2.4 words per second)
- The narrative must be divided into ${numOfScenes} distinct parts, each corresponding to one scene

WORD COUNT REQUIREMENTS:
- Total word count: ${totalWords} words (±2 words tolerance)
- Per scene: ${wordsPerScene} words (±1 word tolerance)
- Use simple, clear words that are easy to pronounce
- Avoid complex sentences that require pauses

The narrative must be clear, engaging, and concise, ensuring that it can be comfortably narrated within the specified time frame.

Maintain a tone that matches the story's style and context, ensuring smooth transitions between scenes.

OUTPUT RULES:
Provide narrative text only, without any scene descriptions or instructions.
Ensure that the narrative flows naturally, with appropriate pacing to fit within the time constraints.
Structure the output as ${numOfScenes} sentences or short phrases, each representing one scene.`;
};
