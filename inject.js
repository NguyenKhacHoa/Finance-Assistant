const fs = require('fs');

let f = fs.readFileSync('backend/src/ai/ai.service.ts', 'utf8');

const imports = `import { PrismaService } from '../prisma/prisma.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AlertsGateway } from '../alerts/alerts.gateway';
import { Inject, forwardRef } from '@nestjs/common';`;

const constructorCode = `constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => TransactionsService)) private readonly transactionsService: TransactionsService,
    @Inject(forwardRef(() => AlertsGateway)) private readonly alertsGateway: AlertsGateway
  ) {`;

f = f.replace("import { PrismaService } from '../prisma/prisma.service';", imports);
f = f.replace("constructor(private readonly prisma: PrismaService) {", constructorCode);

const agentChatLogic = fs.readFileSync('agentChat.txt', 'utf8');

// Replace the VERY LAST brace in the file
const lastBraceIndex = f.lastIndexOf('}');
if (lastBraceIndex !== -1) {
  f = f.substring(0, lastBraceIndex) + '\\n' + agentChatLogic + '\\n}';
} else {
  console.log("Error: No closing brace found");
}

fs.writeFileSync('backend/src/ai/ai.service.ts', f);
console.log('Injected successfully');
