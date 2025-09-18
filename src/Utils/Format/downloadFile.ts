import AppError from "../Errors/AppError";

export async function downloadFile(
    url: string,
    type: "video" | "audio"
  ): Promise<Buffer> {
    try {
      console.log(`Downloading ${type} from:`, url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new AppError(
          `Failed to download ${type}: ${response.status} ${response.statusText}`,
          500
        );
      }

      const buffer = await response.arrayBuffer();
      console.log(
        `Downloaded ${type} successfully, size: ${buffer.byteLength} bytes`
      );

      return Buffer.from(buffer);
    } catch (error) {
      console.error(`Error downloading ${type}:`, error);
      throw new AppError(
        `Failed to download ${type} from ${url}: ${error}`,
        500
      );
    }
  }