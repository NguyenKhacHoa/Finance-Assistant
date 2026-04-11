import { Module } from '@nestjs/common';
import { PocketsService } from './pockets.service';
import { PocketsController } from './pockets.controller';

@Module({
  providers: [PocketsService],
  controllers: [PocketsController],
  exports: [PocketsService],
})
export class PocketsModule {}
