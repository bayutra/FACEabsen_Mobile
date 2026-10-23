import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly config: ConfigService;
  private readonly transporter: nodemailer.Transporter | null;

  constructor(config: ConfigService) {
    this.config = config;
    const host = config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(config.get('SMTP_PORT', 587)),
        secure: String(config.get('SMTP_SECURE', 'false')) === 'true',
        auth: config.get('SMTP_USER')
          ? { user: config.get('SMTP_USER'), pass: config.get('SMTP_PASS') }
          : undefined,
      });
    } else {
      this.transporter = null;
    }
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM', 'no-reply@faceabsen.local');
    if (this.transporter) {
      await this.transporter.sendMail({
        from,
        to,
        subject: 'Kode verifikasi FACEabsen',
        text: `Kode verifikasi Anda: ${code}. Berlaku 15 menit.`,
      });
      return;
    }
    const isDev =
      this.config.get('NODE_ENV') !== 'production' &&
      String(this.config.get('DEV_EMAIL_LOG_CODES', 'false')) === 'true';
    if (isDev) {
      this.logger.warn(`[email] kode verifikasi untuk ${to}: ${code}`);
      return;
    }
    throw new Error('SMTP belum dikonfigurasi');
  }
}