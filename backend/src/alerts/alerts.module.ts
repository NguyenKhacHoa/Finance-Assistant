import { Module, Global } from '@nestjs/common';
import { AlertsGateway } from './alerts.gateway';

@Global()
@Module({
  providers: [AlertsGateway],
  exports: [AlertsGateway],
})
export class AlertsModule {}
