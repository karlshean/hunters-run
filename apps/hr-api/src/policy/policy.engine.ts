import { DatabaseService } from "../common/database.service";

export type EffectiveTone = 'neutral'|'catholic'|'neutral_plus_catholic';
export type DeptKey = 'middle_manager'|'chief_of_staff'|'life_coach'|'family_manager';

export class PolicyEngine {
  constructor(private db: DatabaseService) {}

  /**
   * Decide the effective tone for a message
   * Considers person overrides, manager settings, and learned preferences
   */
  async decideTone(
    managerId: string, 
    personId?: string, 
    context?: {placement?: 'digest_closing'|'praise'|'habit'|'nudge'}
  ): Promise<EffectiveTone> {
    // Check person-level override first
    const person = personId ? await this.db.oneOrNull(
      `select tone_override, learned_prefs from mb.people where id=$1`, 
      [personId]
    ) : null;
    
    if (person?.tone_override) {
      return person.tone_override as EffectiveTone;
    }
    
    // Get manager settings and learned preferences
    const mgr = await this.db.one(
      `select tone_style, learned_prefs from mb.managers where id=$1`, 
      [managerId]
    );
    
    const learned = mgr.learned_prefs?.tone as EffectiveTone | undefined;
    const base: EffectiveTone = learned || mgr.tone_style || 'neutral';
    
    // Handle neutral_plus_catholic: Catholic only at specific placements
    if (base === 'neutral_plus_catholic') {
      const allowedPlacements = new Set(['digest_closing', 'praise', 'habit']);
      return (context?.placement && allowedPlacements.has(context.placement)) ? 'catholic' : 'neutral';
    }
    
    return base;
  }

  /**
   * Get enabled departments based on manager settings and learned preferences
   */
  async enabledDepartments(managerId: string): Promise<Record<DeptKey, boolean>> {
    const mgr = await this.db.one(
      `select enable_middle_manager, enable_chief_of_staff, enable_life_coach, enable_family_manager, learned_prefs 
       from mb.managers where id=$1`, 
      [managerId]
    );
    
    const learned = (mgr.learned_prefs?.departments ?? {}) as Record<DeptKey, boolean>;
    
    return {
      middle_manager: learned.middle_manager ?? mgr.enable_middle_manager ?? true,
      chief_of_staff: learned.chief_of_staff ?? mgr.enable_chief_of_staff ?? true,
      life_coach: learned.life_coach ?? mgr.enable_life_coach ?? true,
      family_manager: learned.family_manager ?? mgr.enable_family_manager ?? true,
    };
  }

  /**
   * Decide evidence mode based on person's completion history
   * Require proof if person has 3+ no-proof completions and no proof completions
   */
  async decideEvidenceMode(personId: string): Promise<'encourage'|'require'> {
    const stats = await this.db.one(`
      with recent_completions as (
        select c.id, (select count(*) from mb.evidence e where e.commitment_id = c.id) as proof_count
        from mb.commitments c
        where c.person_id = $1 
          and c.status in ('completed')
        order by c.completed_at desc 
        limit 20
      )
      select 
        sum(case when proof_count = 0 then 1 else 0 end)::int as no_proof_count,
        sum(case when proof_count > 0 then 1 else 0 end)::int as with_proof_count,
        count(*)::int as total_completions
      from recent_completions
    `, [personId]);
    
    const noProofCount = Number(stats.no_proof_count || 0);
    const withProofCount = Number(stats.with_proof_count || 0);
    
    // Require proof if 3+ no-proof completions and no proof completions
    return (noProofCount >= 3 && withProofCount === 0) ? 'require' : 'encourage';
  }

  /**
   * Learn from user behavior or explicit instruction
   * Stores policy change with reasoning for explainability
   */
  async learn(
    subject: {type: 'manager'|'person'|'commitment', id: string}, 
    key: string, 
    oldVal: any, 
    newVal: any, 
    reason: string, 
    confidence: number = 0.8
  ): Promise<void> {
    await this.db.query(
      `insert into mb.policy_events(subject_type, subject_id, key, value) values ($1, $2, $3, $4)`,
      [
        subject.type, 
        subject.id, 
        key, 
        { 
          old: oldVal, 
          new: newVal, 
          reason, 
          confidence 
        }
      ]
    );
  }

  /**
   * Get recent policy explanations for weekly digest
   */
  async getRecentPolicyExplanations(managerId: string, days: number = 7): Promise<string[]> {
    const events = await this.db.query<{
      key: string;
      value: any;
      created_at: string;
    }>(`
      select pe.key, pe.value, pe.created_at
      from mb.policy_events pe
      join mb.managers m on m.id = pe.subject_id
      where pe.subject_type = 'manager' 
        and pe.subject_id = $1
        and pe.created_at > now() - interval '${days} days'
      order by pe.created_at desc
      limit 2
    `, [managerId]);

    return events.map(event => {
      const value = event.value;
      switch (event.key) {
        case 'tone_style':
          return `💭 I ${value.new === 'neutral_plus_catholic' ? 'started adding' : 'switched to'} ${value.new} tone based on your feedback.`;
        case 'enable_middle_manager':
        case 'enable_chief_of_staff':  
        case 'enable_life_coach':
        case 'enable_family_manager':
          const dept = event.key.replace('enable_', '').replace('_', ' ');
          return `🔧 ${value.new ? 'Enabled' : 'Disabled'} ${dept} department per your request.`;
        case 'proof_mode':
          return `📎 Adjusted proof requirements based on completion patterns.`;
        default:
          return `⚙️ Updated ${event.key} setting.`;
      }
    });
  }

  /**
   * Update learned preferences for a manager
   */
  async updateManagerPrefs(managerId: string, key: string, value: any): Promise<void> {
    await this.db.query(`
      update mb.managers 
      set learned_prefs = jsonb_set(
        coalesce(learned_prefs, '{}'::jsonb), 
        $2::text[], 
        $3::jsonb,
        true
      ),
      updated_at = now()
      where id = $1
    `, [managerId, `{${key}}`, JSON.stringify(value)]);
  }

  /**
   * Update learned preferences for a person  
   */
  async updatePersonPrefs(personId: string, key: string, value: any): Promise<void> {
    await this.db.query(`
      update mb.people 
      set learned_prefs = jsonb_set(
        coalesce(learned_prefs, '{}'::jsonb),
        $2::text[],
        $3::jsonb,
        true
      ),
      updated_at = now()
      where id = $1
    `, [personId, `{${key}}`, JSON.stringify(value)]);
  }
}