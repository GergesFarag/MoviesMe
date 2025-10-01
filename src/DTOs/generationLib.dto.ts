import { IGenerationLib } from "../Interfaces/generationLib.interface";

export interface IGenerationLibDTO {
  id: string;
  url: string|null;
  isVideo: boolean;
  thumbnail: string|null;
  status: string;
  isFavorite: boolean;
  jobId: string;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface IGenerationLibRequestDTO {
  prompt: string;
  refImages?: string[];
  isVideo?: boolean;
  size?: string;
}

export interface IGenerationLibResponseDTO {
  success: boolean;
  message: string;
  jobId?: string;
  data?: IGenerationLibDTO;
}

interface IGenerationLibMapper {
  toDTO(item: IGenerationLib): IGenerationLibDTO;
  fromRequestDTO(dto: IGenerationLibRequestDTO): any;
}

export class GenerationLibDTO implements IGenerationLibMapper {
  private item: IGenerationLib;

  constructor(item: IGenerationLib) {
    this.item = item;
  }

  toDTO(item: IGenerationLib): IGenerationLibDTO {
    return {
      id: item._id.toString(),
      url: item.URL!,
      isVideo: item.isVideo,
      thumbnail: item.thumbnail!,
      status: item.status,
      isFavorite: item.isFav,
      jobId: item.jobId.toString(),
      duration: item.duration,
      createdAt: item.createdAt?.toISOString() || "",
      updatedAt: item.updatedAt?.toISOString() || "",
    };
  }

  fromRequestDTO(dto: IGenerationLibRequestDTO): any {
    return {
      prompt: dto.prompt,
      refImages: dto.refImages || null,
      isVideo: dto.isVideo || false,
      size: dto.size || "2048*2048",
    };
  }

  static toDTOArray(items: IGenerationLib[]): IGenerationLibDTO[] {
    return items.map((item) => new GenerationLibDTO(item).toDTO(item));
  }
}