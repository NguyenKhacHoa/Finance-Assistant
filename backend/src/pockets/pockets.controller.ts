import { Controller, Post, Get, Put, Delete, Param, Body, Req, UseGuards } from '@nestjs/common';
import { PocketsService } from './pockets.service';
import { JwtGuard } from '../auth/jwt.guard';

@UseGuards(JwtGuard)
@Controller('pockets')
export class PocketsController {
  constructor(private readonly pocketsService: PocketsService) {}

  @Get()
  async getPockets(@Req() req: any) {
    const userId = req.user?.sub;
    let pockets = await this.pocketsService.getUserPockets(userId);
    return pockets;
  }

  @Post('init')
  async initPockets(@Req() req: any) {
    const userId = req.user?.sub;
    let pockets = await this.pocketsService.getUserPockets(userId);
    if (pockets.length === 0) {
      pockets = await this.pocketsService.initializeDefaultPockets(userId);
    }
    return pockets;
  }

  @Post()
  async createPocket(@Body() body: any, @Req() req: any) {
    const userId = req.user?.sub;
    return this.pocketsService.createPocket(userId, body);
  }

  @Post('distribute')
  async distributeIncome(@Body() body: { amount: number }, @Req() req: any) {
    const userId = req.user?.sub;
    return this.pocketsService.distributeIncome(userId, body.amount);
  }
  @Put(':id')
  async updatePocket(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const userId = req.user?.sub;
    return this.pocketsService.updatePocket(userId, id, body);
  }

  @Delete(':id')
  async deletePocket(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub;
    return this.pocketsService.deletePocket(userId, id);
  }
}
