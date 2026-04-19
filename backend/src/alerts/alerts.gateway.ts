import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*', // Trong production nên giới hạn origin
  },
})
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Lưu trữ mapping userId -> socketId
  private userSockets = new Map<string, string>();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.userSockets.set(userId, client.id);
      // Join room tương ứng với userId để gửi riêng
      client.join(`user_${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.userSockets.delete(userId);
    }
  }

  // Gửi cảnh báo sinh tồn tới 1 user cụ thể
  sendSurvivalAlert(userId: string, data: any) {
    this.server.to(`user_${userId}`).emit('survival-alert', data);
  }

  // Gửi thông báo chặn giao dịch
  sendBlockAlert(userId: string, data: any) {
    this.server.to(`user_${userId}`).emit('transaction-blocked', data);
  }

  // Gửi thông báo giao dịch ngân hàng
  sendBankTransactionAlert(userId: string, data: any) {
    this.server.to(`user_${userId}`).emit('new_bank_transaction', data);
  }
}
