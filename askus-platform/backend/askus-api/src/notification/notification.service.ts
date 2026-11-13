import { Injectable, Logger } from '@nestjs/common';

export interface Notification {
  channel: 'sms' | 'email' | 'push';
  to: string;
  message: string;
}

// Provider integrations (SMS gateway, SMTP, FCM/APNs) plug in here.
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async send(n: Notification) {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn(`No ${n.channel} provider configured; dropping message to ${n.to}`);
      return;
    }
    this.logger.debug(`[DEV ${n.channel}] ${n.to}: ${n.message}`);
  }
}
