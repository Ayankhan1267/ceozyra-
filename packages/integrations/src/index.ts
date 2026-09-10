export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<{ id: string }>;
}
export interface WhatsAppProvider {
  send(to: string, message: string): Promise<{ id: string }>;
}
export interface SMSProvider {
  send(to: string, message: string): Promise<{ id: string }>;
}
export interface PaymentProvider {
  charge(amount: number, currency: string, source: string): Promise<{ id: string; status: string }>;
}
export interface StorageProvider {
  upload(key: string, body: Buffer | string): Promise<{ url: string }>;
  getUrl(key: string): Promise<string>;
}
export class StubEmailProvider implements EmailProvider {
  async send(to: string, subject: string, html: string) {
    return { id: 'email_' + Date.now() };
  }
}
export class StubWhatsAppProvider implements WhatsAppProvider {
  async send(to: string, message: string) {
    return { id: 'wa_' + Date.now() };
  }
}
export class StubSMSProvider implements SMSProvider {
  async send(to: string, message: string) {
    return { id: 'sms_' + Date.now() };
  }
}
export class StubPaymentProvider implements PaymentProvider {
  async charge(amount: number, currency: string, source: string) {
    return { id: 'pay_' + Date.now(), status: 'succeeded' };
  }
}
export class StubStorageProvider implements StorageProvider {
  async upload(key: string, body: Buffer | string) {
    return { url: `https://stub-storage.local/${key}` };
  }
  async getUrl(key: string) {
    return `https://stub-storage.local/${key}`;
  }
}
