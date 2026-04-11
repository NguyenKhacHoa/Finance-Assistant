import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientInitializationError, Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientInitializationError | Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi cơ sở dữ liệu không xác định.';

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Không thể kết nối đến cơ sở dữ liệu. Vui lòng kiểm tra lại dịch vụ (P1000).';
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Ví dụ vi phạm unique constraint
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Dữ liệu này đã tồn tại (vi phạm trùng lặp).';
      } else {
        message = `Lỗi truy vấn cơ sở dữ liệu: ${exception.message}`;
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.name,
    });
  }
}
