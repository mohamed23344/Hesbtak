import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as tls from 'node:tls';
import { JwtUser } from '../../common/auth/current-user.decorator';
import { DataBaseService } from '../../database/database.service';
import { CreateSupportTicketDto, ReplySupportTicketDto } from './dto';

@Injectable()
export class SupportService {
  constructor(private readonly db: DataBaseService) {}

  async create(userId: string, dto: CreateSupportTicketDto) {
    if (dto.organizationId) {
      const membership = await this.db.organizationUser.findFirst({
        where: { userId, organizationId: dto.organizationId },
      });
      if (!membership) throw new ForbiddenException('Organization access is required');
    }
    return this.db.supportTicket.create({
      data: {
        userId,
        organizationId: dto.organizationId,
        subject: dto.subject.trim(),
        category: dto.category,
        message: dto.message.trim(),
      },
    });
  }

  mine(userId: string) {
    return this.db.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  all(user: JwtUser) {
    this.ensureAdmin(user);
    return this.db.supportTicket.findMany({
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async reply(user: JwtUser, ticketId: string, dto: ReplySupportTicketDto) {
    this.ensureAdmin(user);
    const ticket = await this.db.supportTicket.findUnique({
      where: { id: ticketId },
      include: { user: true },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');

    const reply = dto.reply.trim();
    await this.sendEmail(
      ticket.user.email,
      `Hesbtk.AI support reply: ${ticket.subject}`,
      [
        `Hello ${ticket.user.fullName},`,
        '',
        'Our support team replied to your ticket:',
        reply,
        '',
        `Ticket: ${ticket.subject}`,
      ].join('\n'),
    );

    return this.db.$transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          adminReply: reply,
          repliedBy: user.sub,
          repliedAt: new Date(),
          status: dto.status ?? 'resolved',
        },
      });
      await tx.userNotification.create({
        data: {
          userId: ticket.userId,
          organizationId: ticket.organizationId,
          type: 'support_ticket',
          title: 'Support replied to your ticket',
          message: `${ticket.subject}: ${reply}`,
        },
      });
      return updated;
    });
  }

  private ensureAdmin(user: JwtUser) {
    if (user.globalRole !== 'admin') {
      throw new ForbiddenException('Global admin role required');
    }
  }

  private async sendEmail(to: string, subject: string, body: string) {
    const user = process.env.GOOGLE_EMAIL;
    const pass = process.env.GOOGLE_APP_PASSWORD;
    if (!user || !pass) {
      throw new BadRequestException('Email is not configured');
    }
    const message = [
      `From: Hesbtk.AI <${user}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      body,
    ].join('\r\n');
    await smtpSend({
      user,
      pass,
      to,
      message,
      rejectUnauthorized: process.env.GOOGLE_SMTP_REJECT_UNAUTHORIZED !== 'false',
    });
  }
}

function smtpSend(options: {
  user: string; pass: string; to: string; message: string; rejectUnauthorized: boolean;
}) {
  return new Promise<void>((resolve, reject) => {
    const socket = tls.connect(465, 'smtp.gmail.com', {
      servername: 'smtp.gmail.com',
      rejectUnauthorized: options.rejectUnauthorized,
    });
    let buffer = '';
    const waitFor = (expected: number[]) => new Promise<void>((res, rej) => {
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const last = buffer.split(/\r?\n/).filter(Boolean).at(-1);
        if (!last || /^\d{3}-/.test(last)) return;
        const code = Number(last.slice(0, 3));
        if (expected.includes(code)) {
          socket.off('data', onData);
          buffer = '';
          res();
        } else if (code >= 400) {
          socket.off('data', onData);
          rej(new Error(last));
        }
      };
      socket.on('data', onData);
      socket.once('error', rej);
    });
    const send = async (command: string, expected: number[]) => {
      socket.write(`${command}\r\n`);
      await waitFor(expected);
    };
    socket.once('error', reject);
    socket.once('secureConnect', async () => {
      try {
        await waitFor([220]);
        await send('EHLO hesbtk.ai', [250]);
        await send('AUTH LOGIN', [334]);
        await send(Buffer.from(options.user).toString('base64'), [334]);
        await send(Buffer.from(options.pass).toString('base64'), [235]);
        await send(`MAIL FROM:<${options.user}>`, [250]);
        await send(`RCPT TO:<${options.to}>`, [250, 251]);
        await send('DATA', [354]);
        socket.write(`${options.message}\r\n.\r\n`);
        await waitFor([250]);
        await send('QUIT', [221]);
        socket.end();
        resolve();
      } catch (error) {
        socket.destroy();
        reject(error);
      }
    });
  });
}
