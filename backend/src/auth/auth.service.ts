import {
  Injectable, ConflictException, UnauthorizedException,
  NotFoundException, BadRequestException, Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private mailer: nodemailer.Transporter;
  
  // Lưu fake OTP trên bộ nhớ phụ tạm
  private otpStore = new Map<string, { otp: string; expires: Date }>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {
    // Dùng Ethereal (fake SMTP) trong dev hoặc Gmail thật qua ENV
    const useGmail = !!process.env.SMTP_USER;
    this.mailer = nodemailer.createTransport(
      useGmail
        ? {
            service: 'gmail',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          }
        : {
            host: 'smtp.ethereal.email',
            port: 587,
            auth: { user: 'test@ethereal.email', pass: 'test' },
          },
    );
  }

  // ────────────────────────────────────────────────────────
  //  REGISTER
  // ────────────────────────────────────────────────────────
  async register(dto: { name: string; email: string; password: string; phone?: string }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email này đã được đăng ký.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone || null,
        passwordHash,
        verifyToken,
        verifyExpiry,
        isVerified: false,
        webhookToken: crypto.randomUUID(),
      },
    });

    // Gửi email xác thực (bỏ qua nếu SMTP không được cấu hình)
    await this.sendVerifyEmail(user.email, user.name ?? 'bạn', verifyToken).catch(() => {});

    // Cấp token ngay để FE có thể load trang (isVerified=false)
    return this.signToken(user);
  }

  // ────────────────────────────────────────────────────────
  //  LOGIN
  // ────────────────────────────────────────────────────────
  async login(dto: { email: string; password: string }) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Email chưa được đăng ký hoặc tài khoản dùng Google.');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Mật khẩu không đúng.');

    return this.signToken(user);
  }

  // ────────────────────────────────────────────────────────
  //  GET ME
  // ────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, phone: true,
        avatarUrl: true, role: true, rewardPoints: true,
        loginStreak: true, isVerified: true, createdAt: true,
        googleId: true, passwordHash: true, twoFactorEnabled: true,
      },
    });
    if (!user) return null;
    const { passwordHash, ...rest } = user;
    return { ...rest, hasPassword: !!passwordHash };
  }

  // ────────────────────────────────────────────────────────
  //  CHANGE PASSWORD (chỉ dành cho Email Account)
  // ────────────────────────────────────────────────────────
  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');

    // Guard: Tài khoản Google không có mật khẩu local
    if (user.googleId && !user.passwordHash) {
      throw new BadRequestException(
        'Tài khoản Google không thể đổi mật khẩu tại đây. Vui lòng quản lý mật khẩu qua Google.',
      );
    }
    if (!user.passwordHash) {
      throw new BadRequestException('Tài khoản này chưa có mật khẩu (đăng nhập bằng Google/OTP).');
    }

    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) throw new BadRequestException('Mật khẩu hiện tại không đúng.');

    if (dto.newPassword.length < 8) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 8 ký tự.');
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { message: 'Đổi mật khẩu thành công!' };
  }

  // ────────────────────────────────────────────────────────
  //  UPDATE PROFILE (name, phone)
  // ────────────────────────────────────────────────────────
  async updateProfile(userId: string, dto: { name?: string; phone?: string }) {
    const PHONE_REGEX = /^(0|\+84)(3[2-9]|5[6-9]|7[06-9]|8[1-9]|9[0-9])\d{7}$/;

    if (dto.phone && !PHONE_REGEX.test(dto.phone)) {
      throw new BadRequestException('Số điện thoại không đúng định dạng Việt Nam.');
    }
    if (dto.name !== undefined && dto.name.trim().length < 2) {
      throw new BadRequestException('Họ và tên phải có ít nhất 2 ký tự.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
      },
      select: { id: true, name: true, phone: true, email: true, avatarUrl: true, role: true, isVerified: true, googleId: true, passwordHash: true, rewardPoints: true, loginStreak: true },
    });
    const { passwordHash, ...rest } = updated;
    return { ...rest, hasPassword: !!passwordHash };
  }

  // ────────────────────────────────────────────────────────
  //  VERIFY EMAIL
  // ────────────────────────────────────────────────────────
  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({ where: { verifyToken: token } });
    if (!user) throw new BadRequestException('Token xác thực không hợp lệ.');
    if (user.verifyExpiry && user.verifyExpiry < new Date())
      throw new BadRequestException('Token đã hết hạn. Vui lòng yêu cầu gửi lại email.');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verifyToken: null, verifyExpiry: null },
    });
    return { message: 'Email xác thực thành công!' };
  }

  // ────────────────────────────────────────────────────────
  //  RESEND VERIFY EMAIL
  // ────────────────────────────────────────────────────────
  async resendVerifyEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');
    if (user.isVerified) throw new BadRequestException('Email đã được xác thực rồi.');

    const verifyToken = crypto.randomBytes(32).toString('hex');
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { verifyToken, verifyExpiry },
    });
    await this.sendVerifyEmail(user.email, user.name ?? 'bạn', verifyToken).catch(() => {});
    return { message: 'Đã gửi lại email xác thực!' };
  }

  // ────────────────────────────────────────────────────────
  //  FORGOT PASSWORD
  // ────────────────────────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Không tiết lộ email có tồn tại hay không (bảo mật)
    if (!user) return { message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn trong vài phút.' };

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetExpiry },
    });
    await this.sendResetEmail(user.email, user.name ?? 'bạn', resetToken).catch(() => {});
    return { message: 'Nếu email tồn tại, bạn sẽ nhận được hướng dẫn trong vài phút.' };
  }

  // ────────────────────────────────────────────────────────
  //  RESET PASSWORD
  // ────────────────────────────────────────────────────────
  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({ where: { resetToken: token } });
    if (!user) throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ.');
    if (user.resetExpiry && user.resetExpiry < new Date())
      throw new BadRequestException('Token đã hết hạn. Vui lòng yêu cầu đặt lại mật khẩu mới.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetExpiry: null },
    });
    return { message: 'Đặt lại mật khẩu thành công! Hãy đăng nhập lại.' };
  }

  // ────────────────────────────────────────────────────────
  //  2FA ENGINES
  // ────────────────────────────────────────────────────────
  async generateTwoFactorSecret(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');
    if (user.twoFactorEnabled) throw new BadRequestException('Bảo mật 2 lớp đã được bật.');

    // Tạo secret mới
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'Finance Assistant', secret);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret, qrCode: qrCodeUrl };
  }

  async enableTwoFactor(userId: string, token: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || (!user.twoFactorSecret)) {
      throw new BadRequestException('Bạn chưa khởi tạo mã bảo mật 2 lớp.');
    }

    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new BadRequestException('Mã xác nhận không hợp lệ hoặc đã hết hạn.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
    return { message: 'Bật bảo mật 2 lớp thành công!' };
  }

  async disableTwoFactor(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { message: 'Đã tắt bảo mật 2 lớp.' };
  }

  // ────────────────────────────────────────────────────────
  //  HELPERS
  // ────────────────────────────────────────────────────────
  private signToken(user: { id: string; email: string; role: string; isVerified: boolean; name?: string | null; phone?: string | null; googleId?: string | null; passwordHash?: string | null; hasPassword?: boolean; twoFactorEnabled?: boolean }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      access_token: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        phone: user.phone ?? null,
        role: user.role,
        isVerified: user.isVerified,
        googleId: user.googleId ?? null,
        hasPassword: user.hasPassword !== undefined ? user.hasPassword : !!user.passwordHash,
        twoFactorEnabled: user.twoFactorEnabled ?? false,
      },
    };
  }

  private async sendVerifyEmail(to: string, name: string, token: string) {
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
    await this.mailer.sendMail({
      from: `"Finance Assistant" <${process.env.SMTP_USER || 'noreply@finance.app'}>`,
      to,
      subject: '✅ Xác thực tài khoản Finance Assistant',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:16px">
          <h2 style="color:#818cf8">Chào ${name}! 👋</h2>
          <p>Cảm ơn bạn đã đăng ký Finance Assistant V4.0.</p>
          <p>Nhấn nút bên dưới để xác thực email của bạn:</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#06b6d4);color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold;margin:16px 0">
            ✅ Xác Thực Email
          </a>
          <p style="color:#64748b;font-size:12px">Link hết hạn sau 24 giờ. Nếu bạn không đăng ký, hãy bỏ qua email này.</p>
        </div>
      `,
    });
  }

  private async sendResetEmail(to: string, name: string, token: string) {
    const link = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
    await this.mailer.sendMail({
      from: `"Finance Assistant" <${process.env.SMTP_USER || 'noreply@finance.app'}>`,
      to,
      subject: '🔑 Đặt lại mật khẩu Finance Assistant',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:32px;background:#0f172a;color:#e2e8f0;border-radius:16px">
          <h2 style="color:#f472b6">Đặt lại mật khẩu 🔑</h2>
          <p>Xin chào ${name}, chúng tôi nhận được yêu cầu đặt lại mật khẩu của bạn.</p>
          <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#ec4899,#8b5cf6);color:white;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:bold;margin:16px 0">
            🔑 Đặt Lại Mật Khẩu
          </a>
          <p style="color:#64748b;font-size:12px">Link hết hạn sau 1 giờ. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
        </div>
      `,
    });
  }

  // ────────────────────────────────────────────────────────
  //  GOOGLE OAUTH2 LOGIN
  // ────────────────────────────────────────────────────────
  async validateOAuthLogin(profile: any) {
    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          name: `${profile.firstName} ${profile.lastName}`.trim(),
          avatarUrl: profile.picture,
          googleId: profile.googleId,
          isVerified: true, // OAuth là đã xác thực luôn
          webhookToken: crypto.randomUUID(),
        },
      });
    } else if (!user.googleId) {
      // Nếu email đã có nhưng chưa liên kết Google Id
      user = await this.prisma.user.update({
        where: { email: profile.email },
        data: { googleId: profile.googleId, isVerified: true },
      });
    }

    return this.signToken(user);
  }

  // ────────────────────────────────────────────────────────
  //  PHONE OTP LOGIN (IN-MEMORY SIMULATION)
  // ────────────────────────────────────────────────────────
  async sendOtp(phone: string) {
    // 1. Tạo ngẫu nhiên 6 chữ số
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 phút

    this.otpStore.set(phone, { otp, expires });
    
    // 2. Giả lập in ra console (Thay vì gọi Zalo hay SMS tốn phí)
    this.logger.log(`\n======================================================\n🚀 GIẢ LẬP GỬI ZALO/SMS CHO SĐT: ${phone}\n🔑 MÃ OTP CỦA BẠN LÀ: ${otp} (Hiệu lực: 5 phút)\n======================================================`);
    
    return { message: 'Đã gửi mã OTP thành công.' };
  }

  async verifyOtp(phone: string, otp: string) {
    const record = this.otpStore.get(phone);
    if (!record) {
      throw new BadRequestException('Chứng thực thất bại. Vui lòng gửi lại yêu cầu OTP.');
    }
    if (record.expires < new Date()) {
      this.otpStore.delete(phone);
      throw new BadRequestException('Mã OTP đã hết hạn.');
    }
    if (record.otp !== otp) {
      throw new BadRequestException('Mã OTP không đúng.');
    }

    // OTP Hợp lệ, tiến hành đăng nhập / đăng ký sđt
    this.otpStore.delete(phone);

    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      // Đăng ký mới nếu chưa tồn tại
      user = await this.prisma.user.create({
        data: {
          // Sinh tạm email giả do DB yêu cầu email unique (có thể thiết kế lại DB sau)
          email: `${phone}@fa.local`,
          phone,
          isVerified: true,
          name: `Người dùng ${phone}`,
        },
      });
    } else if (!user.isVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      });
    }

    return this.signToken(user);
  }
}
