#!/usr/bin/env node
import { DatabaseService } from '../common/database.service';
import { PolicyEngine } from '../policy/policy.engine';

interface DigestData {
  manager_id: string;
  manager_name: string;
  telegram_user_id: number;
  people: PersonDigest[];
}

interface PersonDigest {
  person_id: string;
  person_name: string;
  commitments: CommitmentDigest[];
  streak_days: number;
  trust_score: number;
}

interface CommitmentDigest {
  id: string;
  title: string;
  department: string;
  status: string;
  completed_this_week: number;
  total_checkins: number;
}

class WeeklyDigestWorker {
  private db: DatabaseService;
  private policy: PolicyEngine;

  constructor() {
    this.db = DatabaseService.getInstance();
    this.policy = new PolicyEngine(this.db);
  }

  /**
   * Main worker function - generate and send weekly digests
   */
  async run(): Promise<void> {
    console.log('📊 Weekly digest worker starting...');

    try {
      const managers = await this.getManagersForDigest();
      
      if (managers.length === 0) {
        console.log('✅ No managers need digests.');
        return;
      }

      console.log(`📋 Generating digests for ${managers.length} managers`);

      for (const manager of managers) {
        await this.generateDigest(manager);
        // Small delay between digests
        await this.sleep(500);
      }

      console.log('✅ Weekly digest worker completed');
    } catch (error) {
      console.error('❌ Weekly digest worker error:', error);
      throw error;
    }
  }

  /**
   * Get managers who need weekly digests
   */
  private async getManagersForDigest(): Promise<{manager_id: string, telegram_user_id: number}[]> {
    // For now, send to all managers with telegram IDs
    // In production, you'd check last digest date, etc.
    return await this.db.query(`
      select id as manager_id, telegram_user_id
      from mb.managers 
      where telegram_user_id is not null
    `);
  }

  /**
   * Generate digest for a single manager
   */
  private async generateDigest(manager: {manager_id: string, telegram_user_id: number}): Promise<void> {
    try {
      console.log(`📊 Generating digest for manager ${manager.manager_id}`);

      // Get digest data
      const digestData = await this.getDigestData(manager.manager_id);
      
      // Check enabled departments
      const enabledDepts = await this.policy.enabledDepartments(manager.manager_id);
      
      // Get closing tone
      const closingTone = await this.policy.decideTone(
        manager.manager_id, 
        undefined, 
        { placement: 'digest_closing' }
      );

      // Get recent policy explanations
      const policyExplanations = await this.policy.getRecentPolicyExplanations(manager.manager_id, 7);

      // Build digest message
      const digestMessage = await this.buildDigestMessage(
        digestData,
        enabledDepts,
        closingTone,
        policyExplanations
      );

      // Queue digest for sending
      await this.queueDigest(manager.telegram_user_id, digestMessage);

    } catch (error) {
      console.error(`❌ Error generating digest for manager ${manager.manager_id}:`, error);
    }
  }

  /**
   * Get digest data for a manager
   */
  private async getDigestData(managerId: string): Promise<DigestData> {
    const manager = await this.db.one(`
      select id, name, telegram_user_id
      from mb.managers 
      where id = $1
    `, [managerId]);

    const people = await this.db.query<{
      person_id: string;
      person_name: string;
      streak_days: number;
      trust_score: number;
    }>(`
      select 
        p.id as person_id,
        p.name as person_name,
        p.streak_days,
        p.trust_score
      from mb.people p
      where p.manager_id = $1
      order by p.name
    `, [managerId]);

    const digestData: DigestData = {
      manager_id: manager.id,
      manager_name: manager.name,
      telegram_user_id: manager.telegram_user_id,
      people: []
    };

    for (const person of people) {
      const commitments = await this.db.query<{
        id: string;
        title: string;
        department: string;
        status: string;
        completed_this_week: number;
        total_checkins: number;
      }>(`
        select 
          c.id,
          c.title,
          c.department,
          c.status,
          (select count(*) 
           from mb.checkins ch 
           where ch.commitment_id = c.id 
             and ch.status = 'done'
             and ch.created_at >= date_trunc('week', now())
          )::int as completed_this_week,
          (select count(*) 
           from mb.checkins ch 
           where ch.commitment_id = c.id
          )::int as total_checkins
        from mb.commitments c
        where c.person_id = $1
          and c.created_at >= date_trunc('month', now()) -- Recent commitments only
        order by c.created_at desc
      `, [person.person_id]);

      digestData.people.push({
        ...person,
        commitments
      });
    }

    return digestData;
  }

  /**
   * Build the digest message
   */
  private async buildDigestMessage(
    data: DigestData,
    enabledDepts: Record<string, boolean>,
    closingTone: string,
    policyExplanations: string[]
  ): Promise<string> {
    let message = `📊 <b>Weekly Management Digest</b>\n\n`;

    if (data.people.length === 0) {
      message += `No team members tracked yet. Add people to get started!\n\n`;
    } else {
      // Summary stats
      const totalCommitments = data.people.reduce((sum, p) => sum + p.commitments.length, 0);
      const completedThisWeek = data.people.reduce((sum, p) => 
        sum + p.commitments.reduce((pSum, c) => pSum + c.completed_this_week, 0), 0
      );

      message += `📈 <b>This Week:</b> ${completedThisWeek}/${totalCommitments} commitments completed\n\n`;

      // Department breakdown (only enabled departments)
      const deptCommitments: Record<string, {total: number, completed: number}> = {};
      
      data.people.forEach(person => {
        person.commitments.forEach(c => {
          if (c.department && enabledDepts[c.department as keyof typeof enabledDepts]) {
            if (!deptCommitments[c.department]) {
              deptCommitments[c.department] = { total: 0, completed: 0 };
            }
            deptCommitments[c.department].total++;
            deptCommitments[c.department].completed += c.completed_this_week;
          }
        });
      });

      if (Object.keys(deptCommitments).length > 0) {
        message += `🏢 <b>By Department:</b>\n`;
        for (const [dept, stats] of Object.entries(deptCommitments)) {
          const deptName = dept.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
          message += `• ${deptName}: ${stats.completed}/${stats.total}\n`;
        }
        message += `\n`;
      }

      // People highlights
      message += `👥 <b>Team Highlights:</b>\n`;
      data.people.forEach(person => {
        const weeklyCompletions = person.commitments.reduce((sum, c) => sum + c.completed_this_week, 0);
        const streakEmoji = person.streak_days >= 7 ? '🔥' : person.streak_days >= 3 ? '⭐' : '📈';
        
        message += `${streakEmoji} <b>${person.person_name}</b>: ${weeklyCompletions} completed`;
        if (person.streak_days > 0) {
          message += ` (${person.streak_days} day streak)`;
        }
        message += `\n`;
      });
      message += `\n`;
    }

    // Policy explanations
    if (policyExplanations.length > 0) {
      message += `🧠 <b>Donna's Updates:</b>\n`;
      policyExplanations.forEach(explanation => {
        message += `${explanation}\n`;
      });
      message += `\n`;
    }

    // Closing with appropriate tone
    const closingTemplate = await this.getClosingTemplate(closingTone);
    if (closingTemplate) {
      message += closingTemplate;
    }

    return message;
  }

  /**
   * Get closing template based on tone
   */
  private async getClosingTemplate(tone: string): Promise<string> {
    const template = await this.db.oneOrNull(`
      select template from mb.templates
      where kind = 'digest_closing' and tone = $1
      order by random() limit 1
    `, [tone]);

    return template?.template || 'Keep up the great work this week! 💪';
  }

  /**
   * Queue digest for delivery
   */
  private async queueDigest(telegramUserId: number, message: string): Promise<void> {
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
        text: message,
        parse_mode: 'HTML'
      })
    ]);
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
  const worker = new WeeklyDigestWorker();
  worker.run()
    .then(() => {
      console.log('Weekly digest worker completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Weekly digest worker failed:', error);
      process.exit(1);
    });
}