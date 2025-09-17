import { Images } from "openai/resources/images";
import { IScene } from "../Interfaces/scene.interface";
import { wavespeedBase } from "../Utils/APIs/wavespeed_base";

const WAVESPEED_API_KEY = process.env.WAVESPEED_API_KEY || "";
const baseURL = "https://api.wavespeed.ai/api/v3";

export class ImageGenerationService {
  private enableContentSanitization: boolean;

  constructor(enableContentSanitization: boolean = true) {
    this.enableContentSanitization = enableContentSanitization;
  }
  
  /**
   * Sanitizes image descriptions to avoid content flagging
   * Replaces potentially sensitive terms with neutral alternatives
   */
  private sanitizeImageDescription(description: string): string {
    const sensitiveTerms = {
      // Violence/destruction related
      'broken glass': 'scattered items',
      'ransacked': 'disorganized',
      'violated': 'disturbed',
      'devastated expression': 'concerned expression',
      'shattered': 'scattered',
      'chaotic': 'busy',
      'wreckage': 'items',
      'disarray': 'scattered belongings',
      'threshold': 'doorway',
      
      // Emotional distress
      'grief': 'contemplation',
      'despair': 'thoughtfulness',
      'helplessness': 'reflection',
      'isolation': 'solitude',
      'weary': 'tired',
      'red eyes': 'tired eyes',
      'red and weary': 'tired and thoughtful',
      
      // Physical distress
      'tear rolling down': 'looking down thoughtfully',
      'head in hands': 'resting head thoughtfully',
      'overwhelmed': 'contemplative',
      'frozen': 'standing still',
      'shock': 'surprise',
      'disbelief': 'surprise',
      
      // Dark/negative descriptions
      'harsh shadow': 'dramatic lighting',
      'dimly lit': 'softly lit',
      'torn sofa': 'worn sofa',
      'scattered belongings': 'various items',
      'devastated': 'concerned',
      
      // Crime-related terms
      'burglar': 'visitor',
      'robbed': 'visited',
      'robbery': 'incident',
      'theft': 'incident',
      'crime': 'incident',
      'victim': 'person',
      
      // Additional emotional terms
      'anguish': 'concern',
      'suffering': 'contemplation',
      'distress': 'concern',
      'trauma': 'experience',
      'pain': 'concern'
    };

    let sanitized = description;
    
    // Replace sensitive terms (case insensitive)
    Object.entries(sensitiveTerms).forEach(([sensitive, replacement]) => {
      const regex = new RegExp(sensitive, 'gi');
      sanitized = sanitized.replace(regex, replacement);
    });

    // Additional safety measures
    // Remove any remaining potentially problematic phrases
    const problematicPhrases = [
      /has been (violated|ransacked|robbed)/gi,
      /broken into/gi,
      /crime scene/gi,
      /evidence of/gi
    ];
    
    problematicPhrases.forEach(regex => {
      sanitized = sanitized.replace(regex, 'has been disturbed');
    });

    // If description still seems problematic, provide a generic safe version
    const warningTerms = ['blood', 'violence', 'attack', 'assault', 'murder', 'death', 'kill'];
    const hasWarningTerms = warningTerms.some(term => 
      sanitized.toLowerCase().includes(term.toLowerCase())
    );
    
    if (hasWarningTerms) {
      console.warn('Description contains potentially sensitive content, using generic description');
      // Extract basic elements and create a safe description
      const isIndoor = sanitized.toLowerCase().includes('apartment') || sanitized.toLowerCase().includes('room') || sanitized.toLowerCase().includes('indoor');
      const hasCharacter = sanitized.toLowerCase().includes('dr. amir') || sanitized.toLowerCase().includes('man');
      
      if (isIndoor && hasCharacter) {
        sanitized = 'A thoughtful middle-aged man in casual clothes standing in a modern apartment interior with soft lighting, photorealistic style';
      } else if (hasCharacter) {
        sanitized = 'A contemplative middle-aged man in casual clothes, soft natural lighting, photorealistic portrait style';
      } else {
        sanitized = 'A peaceful indoor scene with soft natural lighting, modern interior design, photorealistic style';
      }
    }

    if (description !== sanitized) {
      console.log(`Sanitized description for content safety:`);
      console.log(`Original: ${description.substring(0, 200)}...`);
      console.log(`Sanitized: ${sanitized.substring(0, 200)}...`);
    }
    
    return sanitized;
  }
  async generateImageFromDescription(
    imageDescription: string
  ): Promise<string> {
    const finalDescription = this.enableContentSanitization 
      ? this.sanitizeImageDescription(imageDescription)
      : imageDescription;
    
    let url = `${baseURL}/google/nano-banana/text-to-image`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      output_format: "jpeg",
      prompt: finalDescription,
    };

    const resultUrl = await wavespeedBase(url, headers, payload);
    if (!resultUrl) {
      throw new Error(`Failed to generate image from description: ${finalDescription}`);
    }
    return resultUrl;
  }

  async generateImageFromRefImage(
    refImage: string,
    imageDescription: string
  ): Promise<string> {
    const finalDescription = this.enableContentSanitization 
      ? this.sanitizeImageDescription(imageDescription)
      : imageDescription;
    
    let url = `${baseURL}/google/nano-banana/edit`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WAVESPEED_API_KEY}`,
    };
    const payload = {
      enable_base64_output: false,
      enable_sync_mode: false,
      output_format: "jpeg",
      images: [refImage],
      prompt: finalDescription,
    };

    const resultUrl = await wavespeedBase(url, headers, payload);
    if (!resultUrl) {
      throw new Error(`Failed to generate image from reference image: ${finalDescription}`);
    }
    return resultUrl;
  }

  async generateImagesForScenes(
    scenes: IScene[],
    refImage: string,
    skipFirstImage: boolean
  ): Promise<string[]> {
    const imageUrls: string[] = [];
    let currentRefImage = refImage;
    let scene = null;
    for (let i = 0; i < scenes.length; i++) {
      scene = scenes[i];
      try {
        if(skipFirstImage && i === 0) {
          console.log(`Skipping image generation for first scene as per flag. Using provided reference image.`);
          imageUrls.push(currentRefImage);
          continue;
        }
        console.log(`Generating image for scene ${i + 1}/${scenes.length}`);
        console.log(`Original description: ${scene.imageDescription.substring(0, 100)}...`);
        
        const imageUrl = await this.generateImageFromRefImage(
          currentRefImage,
          scene.imageDescription
        );
        
        if (!imageUrl) {
          throw new Error(`Failed to generate image for scene ${i + 1}`);
        }
        
        imageUrls.push(imageUrl);
        currentRefImage = imageUrl;
        
        console.log(`Successfully generated image for scene ${i + 1}: ${imageUrl}`);
      } catch (error) {
        console.error(`Error generating image for scene ${i + 1}:`, error);
        throw new Error(`Failed to generate image for scene ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return imageUrls;
  }
}
