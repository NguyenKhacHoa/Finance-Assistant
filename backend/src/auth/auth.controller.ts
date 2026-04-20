import { Body, Controller, Get, Post, Patch, Query, Req, Res, UseGuards, HttpCode } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtGuard } from './jwt.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Get('health')
  healthCheck() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Post('register')
  register(@Body() body: { name: string; email: string; password: string; phone?: string }) {
    return this.auth.register(body);
  }

  @HttpCode(200)
  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(JwtGuard)
  getMe(@Req() req: any) {
    return this.auth.getMe(req.user.sub);
  }

  @Get('verify-email')
  verifyEmail(@Query('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Post('resend-verify')
  @UseGuards(JwtGuard)
  resendVerify(@Req() req: any) {
    return this.auth.resendVerifyEmail(req.user.sub);
  }

  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() body: { email: string }) {
    return this.auth.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.auth.resetPassword(body.token, body.password);
  }

  // ────────────────────────────────────────────────────────
  //  GOOGLE OAUTH2
  // ────────────────────────────────────────────────────────
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Controller rỗng, Passport sẽ lo phần chuyển hướng
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const token = req.user.access_token;
    // Chuyển hướng về Frontend kèm theo token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/login?token=${token}`);
  }

  // ────────────────────────────────────────────────────────
  //  PHONE OTP
  // ────────────────────────────────────────────────────────
  @Post('send-otp')
  @HttpCode(200)
  sendOtp(@Body() body: { phone: string }) {
    return this.auth.sendOtp(body.phone);
  }

  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body() body: { phone: string; otp: string }) {
    return this.auth.verifyOtp(body.phone, body.otp);
  }

  // ────────────────────────────────────────────────────────
  //  UPDATE PROFILE & CHANGE PASSWORD
  // ────────────────────────────────────────────────────────
  @Patch('profile')
  @UseGuards(JwtGuard)
  updateProfile(@Req() req: any, @Body() body: { name?: string; phone?: string }) {
    return this.auth.updateProfile(req.user.sub, body);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  changePassword(@Req() req: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.auth.changePassword(req.user.sub, body);
  }

  // ────────────────────────────────────────────────────────
  //  2FA ENGINES
  // ────────────────────────────────────────────────────────
  @Post('2fa/generate')
  @UseGuards(JwtGuard)
  generateTwoFactorSecret(@Req() req: any) {
    return this.auth.generateTwoFactorSecret(req.user.sub);
  }

  @Post('2fa/enable')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  enableTwoFactor(@Req() req: any, @Body() body: { token: string }) {
    return this.auth.enableTwoFactor(req.user.sub, body.token);
  }

  @Post('2fa/disable')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  disableTwoFactor(@Req() req: any) {
    return this.auth.disableTwoFactor(req.user.sub);
  }
}
