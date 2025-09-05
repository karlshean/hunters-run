import { Request, Response } from 'express';
import { DatabaseService } from '../common/database.service';
import { PolicyEngine } from '../policy/policy.engine';
import { maybeHandleAdminIntent } from './admin-intents';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      username?: string;
      first_name?: string;
    };
    message: {
      message_id: number;
      chat: {
        id: number;
      };
    };
    data: string;
  };
}

export class TelegramController {
  private db: DatabaseService;
  private policy: PolicyEngine;
  private botToken: string;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.policy = new PolicyEngine(this.db);
    this.botToken = process.env.TELEGRAM_BOT_TOKEN!;
  }

  /**
   * Main webhook handler for Telegram updates
   */
  async webhook(req: Request, res: Response): Promise<void> {
    try {
      const update: TelegramUpdate = req.body;

      // Idempotent processing - check if we've seen this update
      const existing = await this.db.oneOrNull(
        `select id from public.messages where telegram_update_id = $1`,
        [update.update_id]
      );

      if (existing) {
        res.status(200).json({ status: 'ok', message: 'duplicate update ignored' });
        return;
      }

      // Store incoming message for idempotency
      await this.db.query(`
        insert into public.messages (telegram_update_id, telegram_message_id, telegram_chat_id, direction, content)
        values ($1, $2, $3, 'in', $4)
      `, [
        update.update_id,
        update.message?.message_id || update.callback_query?.message.message_id,
        update.message?.chat.id || update.callback_query?.message.chat.id,
        JSON.stringify(update)
      ]);

      // Handle message or callback query
      if (update.message) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      console.error('Telegram webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle incoming text messages
   */
  private async handleMessage(message: any): Promise<void> {
    const telegramUserId = message.from.id;
    const chatId = message.chat.id;
    const text = message.text?.trim() || '';

    if (!text) return;

    // Upsert manager record
    const manager = await this.upsertManager(telegramUserId, message.from);
    
    // Try admin intent first
    const adminResponse = await maybeHandleAdminIntent(text, manager.id, this.db, this.policy);
    
    if (adminResponse) {
      await this.sendMessage(chatId, adminResponse);
      return;
    }

    // Handle regular content - classify and route to departments
    await this.handleRegularMessage(manager.id, chatId, text);
  }

  /**
   * Handle callback button presses
   */
  private async handleCallbackQuery(callbackQuery: any): Promise<void> {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;

    // Parse callback data format: "action:commitmentId"
    const [action, commitmentId] = data.split(':');

    try {
      switch (action) {
        case 'done':
          await this.markCommitmentDone(commitmentId, false);
          await this.editMessage(chatId, callbackQuery.message.message_id, '✅ Marked as done!');
          break;

        case 'proof':
          await this.requestProof(commitmentId, chatId);
          break;

        case 'skip':
          await this.markCommitmentDone(commitmentId, true);
          await this.editMessage(chatId, callbackQuery.message.message_id, '⏭️ Skipped for today');
          break;

        case 'done_anyway':
          await this.markCommitmentDone(commitmentId, false, true); // Mark done without proof
          await this.editMessage(chatId, callbackQuery.message.message_id, '✅ Marked as done (no proof)');
          break;
      }

      // Answer callback query to remove loading state
      await this.answerCallbackQuery(callbackQuery.id);

    } catch (error) {
      console.error('Callback query error:', error);
      await this.answerCallbackQuery(callbackQuery.id, 'Error processing request');
    }
  }

  /**
   * Handle regular content messages - classify and route
   */
  private async handleRegularMessage(managerId: string, chatId: number, text: string): Promise<void> {
    // Get enabled departments
    const depts = await this.policy.enabledDepartments(managerId);
    
    // Simple AI classification (would normally use OpenAI/Anthropic)
    const classification = this.classifyContent(text, depts);
    
    if (classification.department) {
      // Create commitment routed to appropriate department
      const commitment = await this.createCommitment(managerId, text, classification);
      await this.sendMessage(chatId, `✅ Got it! I'll help you track "${classification.title}". Check-in scheduled for tomorrow.`);
    } else {
      // Fallback response
      await this.sendMessage(chatId, `I received: "${text}"\n\nTry being more specific about what you'd like to commit to, or type "help" for commands.`);
    }
  }

  /**
   * Simple content classification (replace with actual AI)
   */
  private classifyContent(text: string, enabledDepts: Record<string, boolean>): {
    title: string;
    department: string | null;
    description?: string;
  } {
    const lower = text.toLowerCase();
    
    // Family-related keywords
    if (enabledDepts.family_manager && (
      lower.includes('family') || lower.includes('kids') || lower.includes('spouse') ||
      lower.includes('child') || lower.includes('dinner') || lower.includes('bedtime')
    )) {
      return {
        title: text,
        department: 'family_manager',
        description: 'Family-related commitment'
      };
    }
    
    // Life coach keywords  
    if (enabledDepts.life_coach && (
      lower.includes('exercise') || lower.includes('workout') || lower.includes('habit') ||
      lower.includes('read') || lower.includes('meditation') || lower.includes('prayer')
    )) {
      return {
        title: text,
        department: 'life_coach',
        description: 'Personal development commitment'
      };
    }
    
    // Chief of staff keywords
    if (enabledDepts.chief_of_staff && (
      lower.includes('project') || lower.includes('meeting') || lower.includes('strategic') ||
      lower.includes('team') || lower.includes('deadline') || lower.includes('goal')
    )) {
      return {
        title: text,
        department: 'chief_of_staff',
        description: 'Strategic/leadership commitment'
      };
    }
    
    // Default to middle manager
    if (enabledDepts.middle_manager) {
      return {
        title: text,
        department: 'middle_manager',
        description: 'General management commitment'
      };
    }
    
    return { title: text, department: null };
  }

  /**
   * Upsert manager record
   */
  private async upsertManager(telegramUserId: number, fromData: any): Promise<any> {
    const name = [fromData.first_name, fromData.last_name].filter(Boolean).join(' ') || 
                 fromData.username || 
                 `User${telegramUserId}`;

    return await this.db.one(`
      insert into mb.managers (telegram_user_id, name)
      values ($1, $2)
      on conflict (telegram_user_id) 
      do update set 
        name = excluded.name,
        updated_at = now()
      returning *
    `, [telegramUserId, name]);
  }

  /**
   * Create a new commitment
   */
  private async createCommitment(managerId: string, text: string, classification: any): Promise<any> {
    // For now, create a person record or use existing one
    let person = await this.db.oneOrNull(
      `select id from mb.people where manager_id = $1 limit 1`,
      [managerId]
    );

    if (!person) {
      person = await this.db.one(`
        insert into mb.people (manager_id, name, timezone, checkin_hour)
        values ($1, 'Default Person', 'UTC', 17)
        returning *
      `, [managerId]);
    }

    return await this.db.one(`
      insert into mb.commitments (person_id, title, description, department, status)
      values ($1, $2, $3, $4, 'open')
      returning *
    `, [person.id, classification.title, classification.description, classification.department]);
  }

  /**
   * Mark commitment as done
   */
  private async markCommitmentDone(commitmentId: string, skipped: boolean = false, withoutProof: boolean = false): Promise<void> {
    const status = skipped ? 'skipped' : 'completed';
    
    await this.db.query(`
      update mb.commitments 
      set status = $1, completed_at = now(), updated_at = now()
      where id = $2
    `, [status, commitmentId]);

    // Insert checkin record
    await this.db.query(`
      insert into mb.checkins (commitment_id, status)
      values ($1, $2)
    `, [commitmentId, skipped ? 'skipped' : 'done']);
  }

  /**
   * Request proof for a commitment
   */
  private async requestProof(commitmentId: string, chatId: number): Promise<void> {
    await this.sendMessage(chatId, '📎 Please upload proof (photo, document, or description) for this commitment.');
    // TODO: Handle proof uploads in message handler
  }

  /**
   * Send a message via Telegram API
   */
  private async sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<void> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          reply_markup: replyMarkup,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        throw new Error(`Telegram API error: ${response.status}`);
      }

      const result = await response.json() as any;
      
      // Store outbound message
      await this.db.query(`
        insert into public.messages (telegram_message_id, telegram_chat_id, direction, content)
        values ($1, $2, 'out', $3)
      `, [result.result.message_id, chatId, JSON.stringify(result.result)]);

    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  /**
   * Edit an existing message
   */
  private async editMessage(chatId: number, messageId: number, text: string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          text,
          parse_mode: 'HTML'
        })
      });
    } catch (error) {
      console.error('Edit message error:', error);
    }
  }

  /**
   * Answer callback query
   */
  private async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text
        })
      });
    } catch (error) {
      console.error('Answer callback query error:', error);
    }
  }
}