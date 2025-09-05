#!/usr/bin/env node
import { DatabaseService } from '../common/database.service';

interface OutboxMessage {
  id: string;
  recipient_type: string;
  recipient_id?: string;
  telegram_chat_id: number;
  content: any;
  attempts: number;
  scheduled_for: string;
}

class OutboxWorker {
  private db: DatabaseService;
  private botToken: string;
  private maxAttempts: number = 5;
  private backoffMultiplier: number = 2;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.botToken = process.env.TELEGRAM_BOT_TOKEN!;
    
    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }
  }

  /**
   * Main worker function - process pending outbox messages
   */
  async run(): Promise<void> {
    console.log('📤 Outbox worker starting...');

    try {
      const pendingMessages = await this.getPendingMessages();
      
      if (pendingMessages.length === 0) {
        console.log('✅ No pending messages in outbox.');
        return;
      }

      console.log(`📨 Processing ${pendingMessages.length} pending messages`);

      let sent = 0;
      let failed = 0;

      for (const message of pendingMessages) {
        const success = await this.processMessage(message);
        if (success) {
          sent++;
        } else {
          failed++;
        }
        
        // Rate limiting - Telegram allows 30 messages per second
        await this.sleep(100);
      }

      console.log(`✅ Outbox processing complete: ${sent} sent, ${failed} failed`);
    } catch (error) {
      console.error('❌ Outbox worker error:', error);
      throw error;
    }
  }

  /**
   * Get pending messages from outbox
   */
  private async getPendingMessages(): Promise<OutboxMessage[]> {
    return await this.db.query<OutboxMessage>(`
      select id, recipient_type, recipient_id, telegram_chat_id, content, attempts, scheduled_for
      from mb.outbox
      where status = 'pending'
        and scheduled_for <= now()
        and attempts < $1
      order by scheduled_for asc
      limit 50
    `, [this.maxAttempts]);
  }

  /**
   * Process a single message
   */
  private async processMessage(message: OutboxMessage): Promise<boolean> {
    try {
      console.log(`📤 Sending message ${message.id} (attempt ${message.attempts + 1})`);

      // Increment attempt count
      await this.db.query(`
        update mb.outbox
        set attempts = attempts + 1, updated_at = now()
        where id = $1
      `, [message.id]);

      // Send via Telegram API
      const telegramResponse = await this.sendToTelegram(message.telegram_chat_id, message.content);
      
      if (telegramResponse.success) {
        // Mark as sent
        await this.db.query(`
          update mb.outbox
          set status = 'sent', sent_at = now(), telegram_message_id = $2, updated_at = now()
          where id = $1
        `, [message.id, telegramResponse.message_id || 0]);

        // Store outbound message record
        await this.storeOutboundMessage(
          message.telegram_chat_id,
          telegramResponse.message_id,
          message.content
        );

        console.log(`✅ Message ${message.id} sent successfully`);
        return true;
      } else {
        throw new Error(telegramResponse.error);
      }

    } catch (error) {
      console.error(`❌ Error sending message ${message.id}:`, error);

      const nextAttempt = message.attempts + 1;
      
      if (nextAttempt >= this.maxAttempts) {
        // Mark as permanently failed
        await this.db.query(`
          update mb.outbox
          set status = 'failed', updated_at = now()
          where id = $1
        `, [message.id]);
        
        console.error(`💀 Message ${message.id} permanently failed after ${this.maxAttempts} attempts`);
      } else {
        // Schedule retry with exponential backoff
        const retryDelay = Math.pow(this.backoffMultiplier, nextAttempt) * 60; // minutes
        
        await this.db.query(`
          update mb.outbox
          set scheduled_for = now() + interval '${retryDelay} minutes',
              updated_at = now()
          where id = $1
        `, [message.id]);
        
        console.log(`🔄 Message ${message.id} scheduled for retry in ${retryDelay} minutes`);
      }

      return false;
    }
  }

  /**
   * Send message via Telegram API
   */
  private async sendToTelegram(chatId: number, content: any): Promise<{
    success: boolean;
    message_id?: number;
    error?: string;
  }> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          ...content
        })
      });

      const responseData = await response.json() as any;

      if (response.ok && responseData.ok) {
        return {
          success: true,
          message_id: responseData.result.message_id
        };
      } else {
        return {
          success: false,
          error: responseData.description || `HTTP ${response.status}`
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Store outbound message for tracking
   */
  private async storeOutboundMessage(chatId: number, messageId: number, content: any): Promise<void> {
    try {
      await this.db.query(`
        insert into public.messages (telegram_message_id, telegram_chat_id, direction, content)
        values ($1, $2, 'out', $3)
        on conflict (telegram_message_id) do nothing
      `, [messageId, chatId, JSON.stringify(content)]);
    } catch (error) {
      // Non-critical error, just log it
      console.warn('Warning: Failed to store outbound message record:', error);
    }
  }

  /**
   * Clean up old processed messages (housekeeping)
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up old outbox messages...');
    
    const deletedCount = await this.db.query(`
      delete from mb.outbox
      where status in ('sent', 'failed')
        and updated_at < now() - interval '7 days'
    `);

    console.log(`🗑️ Cleaned up ${deletedCount.length} old messages`);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run continuously (daemon mode)
   */
  async runDaemon(intervalSeconds: number = 30): Promise<void> {
    console.log(`🔄 Starting outbox daemon (checking every ${intervalSeconds}s)`);
    
    while (true) {
      try {
        await this.run();
        
        // Periodic cleanup (once per hour)
        if (Math.random() < 1/120) { // ~1/120 chance per 30s = ~1/hour
          await this.cleanup();
        }
        
      } catch (error) {
        console.error('❌ Daemon cycle error:', error);
      }
      
      await this.sleep(intervalSeconds * 1000);
    }
  }
}

// Run worker if called directly
if (require.main === module) {
  const worker = new OutboxWorker();
  
  // Check for daemon mode
  const isDaemon = process.argv.includes('--daemon');
  const interval = parseInt(process.env.OUTBOX_INTERVAL || '30');

  if (isDaemon) {
    console.log('Starting outbox worker in daemon mode...');
    worker.runDaemon(interval).catch(error => {
      console.error('Daemon failed:', error);
      process.exit(1);
    });
  } else {
    worker.run()
      .then(() => {
        console.log('Outbox worker completed successfully');
        process.exit(0);
      })
      .catch(error => {
        console.error('Outbox worker failed:', error);
        process.exit(1);
      });
  }
}