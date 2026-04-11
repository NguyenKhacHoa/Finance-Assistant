import { Controller, Get, Req } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    const userId = req.user?.id || 'simulated-admin-id'; // Cần cơ chế override test
    return this.adminService.getDashboardMetrics(userId);
  }
}
