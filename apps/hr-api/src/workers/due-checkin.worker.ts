#!/usr/bin/env node
import { DatabaseService } from '../common/database.service';
import { PolicyEngine } from '../policy/policy.engine';

interface DueCommitment {
  id: string;
  person_id: string;
  manager_id: string;
  title: string;
  person_name: string;
  manager_telegram_user_id: number;
  department: string;
  proof_mode: 'encourage' | 'require';
}

class DueCheckinWorker {
  private db: DatabaseService;
  private policy: PolicyEngine;
  private botToken: string;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.policy = new PolicyEngine(this.db);
    this.botToken = process.env.TELEGRAM_BOT_TOKEN!;
  }

  /**
   * Main worker function - find and process due check-ins
   */
  async run(): Promise<void> {
    console.log('🔄 Due check-in worker starting...');

    try {
      // Find commitments that need check-ins
      const dueCommitments = await this.findDueCommitments();
      
      if (dueCommitments.length === 0) {
        console.log('✅ No due check-ins found.');
        return;
      }

      console.log(`📋 Found ${dueCommitments.length} due check-ins`);

      // Process each commitment
      for (const commitment of dueCommitments) {
        await this.processCommitment(commitment);
        // Small delay to avoid rate limits
        await this.sleep(100);
      }

      console.log('✅ Due check-in worker completed');
    } catch (error) {
      console.error('❌ Due check-in worker error:', error);
      throw error;
    }
  }

  /**
   * Find commitments that are due for check-in
   */
  private async findDueCommitments(): Promise<DueCommitment[]> {
    return await this.db.query<DueCommitment>(`
      select 
        c.id,
        c.person_id,
        c.title,
        c.department,
        c.proof_mode,
        p.name as person_name,
        p.manager_id,
        m.telegram_user_id as manager_telegram_user_id
      from mb.commitments c
      join mb.people p on p.id = c.person_id  
      join mb.managers m on m.id = p.manager_id
      where c.status = 'open'
        and c.next_ping_at <= now()
        and m.telegram_user_id is not null
      order by c.next_ping_at asc
    `);
  }

  /**
   * Process a single commitment for check-in
   */
  private async processCommitment(commitment: DueCommitment): Promise<void> {
    try {
      console.log(`📨 Processing check-in for: ${commitment.title} (${commitment.person_name})`);

      // Use policy engine to decide evidence mode and tone
      const evidenceMode = await this.policy.decideEvidenceMode(commitment.person_id);
      const tone = await this.policy.decideTone(
        commitment.manager_id, 
        commitment.person_id, 
        { placement: 'nudge' }
      );

      // Get appropriate template
      const template = await this.getTemplate('nudge', tone);
      
      // Build message
      const messageText = this.fillTemplate(template, {
        name: commitment.person_name,
        commitment: commitment.title
      });

      // Create inline keyboard based on evidence mode
      const keyboard = this.createKeyboard(commitment.id, evidenceMode);

      // Queue message for sending
      await this.queueMessage(
        commitment.manager_telegram_user_id,
        messageText,
        keyboard
      );

      // Schedule next ping
      await this.scheduleNextPing(commitment.id);

      // Log policy decision if different from stored mode
      if (evidenceMode !== commitment.proof_mode) {
        await this.policy.learn(
          { type: 'commitment', id: commitment.id },
          'proof_mode',
          commitment.proof_mode,
          evidenceMode,
          `Adjusted based on completion history`,
          0.85
        );

        // Update commitment with new mode
        await this.db.query(`
          update mb.commitments 
          set proof_mode = $1, updated_at = now() 
          where id = $2
        `, [evidenceMode, commitment.id]);
      }

    } catch (error) {
      console.error(`❌ Error processing commitment ${commitment.id}:`, error);
    }
  }

  /**
   * Get template for nudge message
   */
  private async getTemplate(kind: string, tone: string): Promise<string> {
    const template = await this.db.oneOrNull(`
      select template from mb.templates 
      where kind = $1 and tone = $2 
      order by random() limit 1
    `, [kind, tone]);

    return template?.template || 'Quick check-in on "{{commitment}}" - how are we doing?';
  }

  /**
   * Fill template with variables
   */
  private fillTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  /**
   * Create inline keyboard based on evidence mode
   */
  private createKeyboard(commitmentId: string, evidenceMode: 'encourage' | 'require') {
    if (evidenceMode === 'require') {
      return {
        inline_keyboard: [
          [
            { text: '📎 Add Proof', callback_data: `proof:${commitmentId}` }
          ],
          [
            { text: '✅ Mark Done Anyway', callback_data: `done_anyway:${commitmentId}` }
          ]
        ]
      };
    } else {
      return {
        inline_keyboard: [
          [
            { text: '✅ Done', callback_data: `done:${commitmentId}` },
            { text: '📎 Add Proof', callback_data: `proof:${commitmentId}` }
          ],
          [
            { text: '⏭️ Skip', callback_data: `skip:${commitmentId}` }
          ]
        ]
      };
    }
  }

  /**
   * Queue message for reliable delivery
   */
  private async queueMessage(telegramUserId: number, text: string, replyMarkup?: any): Promise<void> {
    await this.db.query(`
      insert into mb.outbox (
        recipient_type, 
        telegram_chat_id, 
        content, 
        scheduled_for
      ) values (
        'manager',
        $1,
        $2,
        now()
      )
    `, [
      telegramUserId,
      JSON.stringify({
        text,
        reply_markup: replyMarkup,
        parse_mode: 'HTML'
      })
    ]);
  }

  /**
   * Schedule next ping for commitment
   */
  private async scheduleNextPing(commitmentId: string): Promise<void> {
    await this.db.query(`select mb.schedule_next_ping($1)`, [commitmentId]);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run worker if called directly
if (require.main === module) {
  const worker = new DueCheckinWorker();
  worker.run()
    .then(() => {
      console.log('Worker completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Worker failed:', error);
      process.exit(1);
    });
}