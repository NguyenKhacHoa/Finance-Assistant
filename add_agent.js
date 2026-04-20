const fs = require('fs');

const codeToAppend = `
  // ══════════════════════════════════════════════════════════
  //  TÍNH NĂNG 6: AGENT THỰC THI (Function Calling)
  // ══════════════════════════════════════════════════════════
  async agentChat(userId: string, message: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const pockets = await this.prisma.pocket.findMany({ where: { userId } });
    const goals = await this.prisma.goal.findMany({ where: { userId } });

    const unallocatedBalance = Number(user?.unallocatedBalance || 0) + Number(pockets.find(p => p.name === 'Tiền chưa vào hũ')?.balance || 0);
    const pocketsCtx = pockets.map(p => \`[ID: \${p.id}] \${p.name} | Balance: \${Number(p.balance).toLocaleString()} VNĐ | \${Number(p.percentage)}%\`).join('\\n');
    const goalsCtx = goals.length ? goals.map(g => \`[ID: \${g.id}] \${g.title} | \${Number(g.currentAmount).toLocaleString()}/\${Number(g.targetAmount).toLocaleString()} VNĐ\`).join('\\n') : 'Chưa có mục tiêu nào.';

    const systemInstruction = \`QUY TẮC HÀNH VI (CHUYÊN GIA TÀI CHÍNH THÂN THIỆN):
1. VAI TRÒ: Luôn đóng vai một chuyên gia tài chính cá nhân thân thiện, nhiệt tình. Dùng giọng điệu tự nhiên, xưng "em/mình" và gọi "bạn/anh/chị".
2. TỰ ĐỘNG NHẬN DIỆN CHI TIÊU: Khi người dùng nói về một khoản tiêu xài (VD: "Tôi vừa mua đôi giày 2tr"), tự hiểu đó là EXPENSE. Hãy tự tìm hũ phù hợp (VD: hũ "Hưởng thụ" hoặc "Mua sắm") HOẶC hỏi lại người dùng muốn trừ tiền vào hũ nào nếu không chắc chắn. TỰ ĐỘNG lấy ID hũ phù hợp nhất để gọi tool create_transaction.
3. XÓA MỤC TIÊU: Khi thực hiện xóa mục tiêu, KHÔNG được xóa ngay lập tức. PHẢI MANG tính chất an toàn bằng cách hỏi lại: "Bạn có chắc chắn muốn xóa mục tiêu [Tên mục tiêu] không?".
4. QUY TẮC NẠP TIỀN: Cận thận kiểm tra giới hạn hũ.
5. REALTIME: Mọi hành động về tiền bạc em thao tác đều đã được hệ thống đồng bộ ngầm tự động ra các bảng Dashboard ngay lập tức. Cứ tự tin xác nhận nha!
6. THÀNH CÔNG: Khi đã làm xong lệnh, cứ báo "Xong! Em đã [hành động] rồi nhé 🎉. Số dư của bạn đã được cập nhật Dashboard."

THÔNG TIN TÀI KHOẢN:
Người dùng: \${user?.name}
Số dư chưa phân bổ: \${unallocatedBalance.toLocaleString()} VNĐ
Hũ tài chính:
\${pocketsCtx || 'Không có hũ nào'}

Mục tiêu tiết kiệm:
\${goalsCtx}\`;

    const tools = [{
      functionDeclarations: [
        {
          name: 'get_financial_status',
          description: 'Lấy trạng thái tài chính của User.',
        },
        {
          name: 'create_transaction',
          description: 'Tạo một giao dịch thu/chi mới.',
          parameters: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING', description: 'Tiêu đề' },
              amount: { type: 'NUMBER', description: 'Số tiền' },
              type: { type: 'STRING', description: 'EXPENSE hoặc INCOME' },
              pocketId: { type: 'STRING', description: 'ID hũ' },
              category: { type: 'STRING', description: 'Phân loại (Food, Transport, v.v)' },
            },
            required: ['title', 'amount', 'type', 'pocketId'],
          },
        },
        {
          name: 'edit_transaction',
          description: 'Chỉnh sửa giao dịch.',
          parameters: {
            type: 'OBJECT',
            properties: {
              transactionId: { type: 'STRING', description: 'ID giao dịch' },
              title: { type: 'STRING' },
              amount: { type: 'NUMBER' },
            },
            required: ['transactionId'],
          },
        },
        {
          name: 'delete_transaction',
          description: 'Xóa giao dịch.',
          parameters: {
            type: 'OBJECT',
            properties: {
              transactionId: { type: 'STRING' },
            },
            required: ['transactionId'],
          },
        },
        {
          name: 'create_goal',
          description: 'Tạo mục tiêu.',
          parameters: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              targetAmount: { type: 'NUMBER' },
              deadline: { type: 'STRING', description: 'ISO 8601' },
            },
            required: ['title', 'targetAmount'],
          },
        },
        {
          name: 'update_goal',
          description: 'Cập nhật mục tiêu.',
          parameters: {
            type: 'OBJECT',
            properties: {
              goalId: { type: 'STRING' },
              title: { type: 'STRING' },
              targetAmount: { type: 'NUMBER' },
            },
            required: ['goalId'],
          },
        },
        {
          name: 'delete_goal',
          description: 'Xóa mục tiêu.',
          parameters: {
            type: 'OBJECT',
            properties: {
              goalId: { type: 'STRING' },
            },
            required: ['goalId'],
          },
        }
      ]
    }];

    const model = this.genAI.getGenerativeModel({
      model: this.DEFAULT_MODEL,
      tools: tools as any,
      systemInstruction,
    }, { apiVersion: 'v1' });

    const chat = model.startChat();
    const result = await chat.sendMessage(message);
    const response = result.response;
    const calls = response.functionCalls();

    const actionsExecuted = [];

    if (calls && calls.length > 0) {
      for (const call of calls) {
        if (call.name === 'create_transaction') {
          const args = call.args as any;
          await this.prisma.transaction.create({
            data: {
              userId,
              title: args.title,
              amount: args.amount,
              type: args.type,
              pocketId: args.pocketId,
              category: args.category || 'Other',
              source: 'CASH',
            }
          });
          
          if (args.type === 'EXPENSE') {
            await this.prisma.pocket.update({
              where: { id: args.pocketId },
              data: { balance: { decrement: args.amount } }
            });
          } else {
            await this.prisma.pocket.update({
              where: { id: args.pocketId },
              data: { balance: { increment: args.amount } }
            });
          }

          this.alertsGateway?.sendAiActionAlert(userId, {
            title: 'Thêm giao dịch thành công!',
            summary: \`Giao dịch "\${args.title}" \${args.amount.toLocaleString()} VND đã được thêm.\`,
            actType: 'create_transaction',
            amount: args.amount,
            type: args.type
          });

          actionsExecuted.push({ tool: call.name, args, result: 'success' });
        }
        else if (call.name === 'edit_transaction') {
          const args = call.args as any;
          await this.transactionsService.editTransaction(userId, args.transactionId, args);
          this.alertsGateway?.sendAiActionAlert(userId, {
            title: 'Sửa giao dịch thành công!',
            summary: \`Đã điều chỉnh giao dịch.\`,
            actType: 'create_transaction'
          });
          actionsExecuted.push({ tool: call.name, args, result: 'success' });
        }
        else if (call.name === 'delete_transaction') {
          const args = call.args as any;
          await this.transactionsService.deleteTransaction(userId, args.transactionId);
          this.alertsGateway?.sendAiActionAlert(userId, {
            title: 'Xóa giao dịch thành công!',
            summary: \`Đã xóa giao dịch khỏi lịch sử.\`,
            actType: 'create_transaction'
          });
          actionsExecuted.push({ tool: call.name, args, result: 'success' });
        }
        else if (call.name === 'create_goal') {
          const args = call.args as any;
          await this.prisma.goal.create({
            data: {
              userId,
              title: args.title,
              targetAmount: args.targetAmount,
              deadline: args.deadline ? new Date(args.deadline) : null,
              currentAmount: 0
            }
          });
          this.alertsGateway?.sendAiActionAlert(userId, {
            title: 'Tạo mục tiêu thành công!',
            summary: \`Mục tiêu "\${args.title}" đã được thiết lập.\`,
            actType: 'manage_goal'
          });
          actionsExecuted.push({ tool: call.name, args, result: 'success' });
        }
        else if (call.name === 'update_goal') {
          const args = call.args as any;
          await this.prisma.goal.update({
            where: { id: args.goalId },
            data: {
              title: args.title,
              targetAmount: args.targetAmount
            }
          });
          this.alertsGateway?.sendAiActionAlert(userId, {
            title: 'Sửa mục tiêu thành công!',
            summary: \`Mục tiêu đã được điều chỉnh.\`,
            actType: 'manage_goal'
          });
          actionsExecuted.push({ tool: call.name, args, result: 'success' });
        }
        else if (call.name === 'delete_goal') {
          const args = call.args as any;
          const goal = await this.prisma.goal.delete({ where: { id: args.goalId } });
          this.alertsGateway?.sendAiActionAlert(userId, {
            title: 'Đã xóa mục tiêu',
            summary: \`Mục tiêu "\${goal.title}" đã bị xóa.\`,
            actType: 'manage_goal'
          });
          actionsExecuted.push({ tool: call.name, args, result: 'success' });
        }

        const funcResponse = await chat.sendMessage([{
          functionResponse: {
            name: call.name,
            response: { status: 'success' }
          }
        }]);
        
        return { reply: funcResponse.response.text(), actionsExecuted };
      }
    }

    return { reply: response.text(), actionsExecuted };
  }
`;

let content = fs.readFileSync('backend/src/ai/ai.service.ts', 'utf8');

// Insert imports
content = content.replace(
  "import { PrismaService } from '../prisma/prisma.service';",
  "import { PrismaService } from '../prisma/prisma.service';\\nimport { TransactionsService } from '../transactions/transactions.service';\\nimport { AlertsGateway } from '../alerts/alerts.gateway';\\nimport { Inject, forwardRef } from '@nestjs/common';"
);

// Modify constructor
content = content.replace(
  "constructor(private readonly prisma: PrismaService) {",
  \`constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TransactionsService)) private readonly transactionsService: TransactionsService,
    @Inject(forwardRef(() => AlertsGateway)) private readonly alertsGateway: AlertsGateway
  ) {\`
);

// Insert function
content = content.replace(/^}$/m, codeToAppend + '\\n}');

fs.writeFileSync('backend/src/ai/ai.service.ts', content);
console.log('Successfully added agentChat back to ai.service.ts');
