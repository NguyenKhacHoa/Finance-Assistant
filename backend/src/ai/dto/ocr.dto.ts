export class OcrReceiptDto {
  /** Base64 encoded image string (without data: prefix) */
  imageBase64: string;
  /** MIME type: image/jpeg | image/png | image/webp */
  mimeType?: string;
  /** Optional: pocket ID to associate extracted items */
  pocketId?: string;
}
