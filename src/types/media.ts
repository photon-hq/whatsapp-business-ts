export interface UploadOptions {
  readonly file: Buffer | Uint8Array;
  readonly filename?: string;
  readonly mimeType: string;
}

export interface UploadResult {
  readonly mediaId: string;
}

export interface MediaUrlResult {
  readonly fileSize: number;
  readonly mimeType: string;
  readonly sha256: string;
  readonly url: string;
}
