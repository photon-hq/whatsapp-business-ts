export interface UploadOptions {
  readonly file: Buffer | Uint8Array;
  readonly mimeType: string;
  readonly filename?: string;
}

export interface UploadResult {
  readonly mediaId: string;
}

export interface MediaUrlResult {
  readonly url: string;
  readonly mimeType: string;
  readonly fileSize: number;
  readonly sha256: string;
}
