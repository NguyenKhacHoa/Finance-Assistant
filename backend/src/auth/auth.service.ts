import {
  Injectable, ConflictException, UnauthorizedException,
  NotFoundException, BadRequestException, Logger
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';

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
      },
    });

    // Gửi email xác thực (bỏ qua nếu SMTP không được cấu hình)
    await this.sendVerifyEmail(user.email, user.name ?? 'bạn', verifyToken).catch(() => {});

    // Cấp token ngay để FE có thể load trang (isVerified=false)
    return this.signToken(user.id, user.email, user.role, user.isVerified);
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

    return this.signToken(user.id, user.email, user.role, user.isVerified);
  }

  // ────────────────────────────────────────────────────────
  //  GET ME
  // ────────────────────────────────────────────────────────
  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, phone: true,
        avatarUrl: true, role: true, rewardPoints: true,
        loginStreak: true, isVerified: true, createdAt: true,
      },
    });
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
  //  HELPERS
  // ────────────────────────────────────────────────────────
  private signToken(userId: string, email: string, role: string, isVerified: boolean) {
    const payload = { sub: userId, email, role };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: userId, email, role, isVerified },
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
        },
      });
    } else if (!user.googleId) {
      // Nếu email đã có nhưng chưa liên kết Google Id
      user = await this.prisma.user.update({
        where: { email: profile.email },
        data: { googleId: profile.googleId, isVerified: true },
      });
    }

    return this.signToken(user.id, user.email, user.role, user.isVerified);
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

    return this.signToken(user.id, user.email, user.role, user.isVerified);
  }
}
