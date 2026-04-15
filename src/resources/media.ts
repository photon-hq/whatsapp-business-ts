import { fromGrpcError } from "../errors/error-handler.ts";
import type { MediaServiceClient } from "../transport/grpc-client.ts";
import type { RequestOptions } from "../types/client.ts";
import type {
  MediaUrlResult,
  UploadOptions,
  UploadResult,
} from "../types/media.ts";

export class MediaResource {
  private readonly _client: MediaServiceClient;

  constructor(client: MediaServiceClient) {
    this._client = client;
  }

  async upload(
    params: UploadOptions,
    options?: RequestOptions
  ): Promise<UploadResult> {
    try {
      const file =
        params.file instanceof Buffer ? params.file : Buffer.from(params.file);

      const response = await this._client.upload(
        {
          file,
          mimeType: params.mimeType,
          filename: params.filename,
        },
        { signal: options?.signal }
      );
      return { mediaId: response.mediaId };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  async getUrl(
    mediaId: string,
    options?: RequestOptions
  ): Promise<MediaUrlResult> {
    try {
      const response = await this._client.getUrl(
        { mediaId },
        { signal: options?.signal }
      );
      return {
        url: response.url,
        mimeType: response.mimeType,
        fileSize: Number(response.fileSize),
        sha256: response.sha256,
      };
    } catch (err) {
      throw fromGrpcError(err);
    }
  }

  async delete(mediaId: string, options?: RequestOptions): Promise<void> {
    try {
      await this._client.delete({ mediaId }, { signal: options?.signal });
    } catch (err) {
      throw fromGrpcError(err);
    }
  }
}
