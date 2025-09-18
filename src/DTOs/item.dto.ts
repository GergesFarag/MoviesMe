import { IEffectItem } from "../Interfaces/effectItem.interface";
import { reverseModelTypeMapper } from "../Utils/Format/filterModelType";
export interface IItemDTO {
  id: string;
  url: string;
  modelType: string;
  modelName: string;
  isVideo: boolean;
  thumbnail: string;
  status: string;
  isFavorite: boolean;
  jobId: string;
  duration: number;
  createdAt: string;
}

export interface INotificationItemDTO {
  [key: string]: string;
}

interface IItemMapper {
  toDTO(item: IEffectItem): IItemDTO | INotificationItemDTO;
}

export class ItemDTO implements IItemMapper {
  private item: IEffectItem;

  constructor(item: IEffectItem) {
    this.item = item;
  }

  toDTO(): IItemDTO {
    return {
      id: this.item._id!.toString(),
      url: this.item.URL,
      modelType:
        reverseModelTypeMapper[
          this.item.modelType as keyof typeof reverseModelTypeMapper
        ] ||
        this.item.modelType ||
        "unknown",
      modelName: this.item.modelName,
      isVideo: this.item.isVideo,
      jobId: this.item.jobId.toString(),
      thumbnail: this.item.effectThumbnail || this.item.URL,
      status: this.item.status,
      isFavorite: this.item.isFav,
      duration: this.item.duration,
      createdAt: this.item.createdAt?.toISOString() || new Date().toISOString(),
    };
  }

  public static toDTO(item: IEffectItem): IItemDTO {
    return new ItemDTO(item).toDTO();
  }

  public static toListDTO(items: IEffectItem[]): IItemDTO[] {
    return items.map((item) => new ItemDTO(item).toDTO());
  }
}

export class NotificationItemDTO implements IItemMapper {
  toDTO(item: IEffectItem): INotificationItemDTO {
    return {
      id: item._id!.toString(),
      url: String(item.URL),
      modelType: String(
        reverseModelTypeMapper[
          item.modelType as keyof typeof reverseModelTypeMapper
        ] ||
        item.modelType ||
        "unknown"),
      modelName: item.modelName,
      isVideo: String(item.isVideo),
      jobId: String(item.jobId),
      thumbnail: item.modelThumbnail,
      status: item.status,
      isFavorite: String(item.isFav),
      duration: item.duration.toString(),
      createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
    };
  }
  public static toNotificationDTO(item: IEffectItem): INotificationItemDTO {
    return new NotificationItemDTO().toDTO(item);
  }

  public static toNotificationListDTO(items: IEffectItem[]): INotificationItemDTO[] {
    return items.map((item) => new NotificationItemDTO().toDTO(item));
  }
}
