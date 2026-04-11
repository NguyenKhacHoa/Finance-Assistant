import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  // Lấy khóa bí mật từ biến môi trường (phải dài đúng 32 bytes)
  // Trong môi trường thực tế, nên dùng AWS KMS, Vault hoặc biến môi trường bảo mật.
  private readonly secretKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32); 

  /**
   * Mã hóa văn bản chứa thông tin nhạy cảm của giao dịch (AES-256 GCM)
   */
  encrypt(text: string): string {
    // 1. Tạo Initialization Vector ngẫu nhiên (12 bytes cho GCM)
    const iv = crypto.randomBytes(12);
    
    // 2. Khởi tạo Cipher
    const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.secretKey, 'utf8'), iv);
    
    // 3. Thực hiện mã hóa
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 4. Lấy authentication tag để đảm bảo tính toàn vẹn dứ liệu
    const authTag = cipher.getAuthTag();
    
    // 5. Nối IV + Mật mã + AuthTag để lưu vào DB an toàn
    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
  }

  /**
   * Giải mã văn bản (AES-256 GCM)
   */
  decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Dữ liệu mã hóa không đúng định dạng');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedTextBuffer = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.secretKey, 'utf8'), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedTextBuffer, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
