export interface IScene {
  sceneNumber: number;
  imageDescription: string|null;
  videoDescription: string|null;
  sceneDescription: string|null;
  scenePrompt?: string|null;
  image?: string|null;
  narration?: string|null;
}
