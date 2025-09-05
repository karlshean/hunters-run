import { DatabaseService } from "../common/database.service";
import { PolicyEngine } from "../policy/policy.engine";

/**
 * Handle natural language admin intents
 * Returns response message if handled, null if not an admin intent
 */
export async function maybeHandleAdminIntent(
  text: string, 
  managerId: string, 
  db: DatabaseService, 
  policy: PolicyEngine
): Promise<string | null> {
  const lower = text.toLowerCase().trim();

  // Toggle departments: "turn off family manager" / "turn on life coach"
  const departmentToggle = lower.match(/turn (on|off) (middle manager|chief of staff|life coach|family manager)/);
  if (departmentToggle) {
    const enable = departmentToggle[1] === 'on';
    const deptDisplay = departmentToggle[2];
    const deptKey = deptDisplay.replace(/\s+/g, '_'); // family manager -> family_manager
    
    const oldValue = await db.one(`select enable_${deptKey} from mb.managers where id=$1`, [managerId]);
    
    await db.query(`update mb.managers set enable_${deptKey}=$1, updated_at=now() where id=$2`, [enable, managerId]);
    
    await policy.learn(
      {type: 'manager', id: managerId}, 
      `enable_${deptKey}`, 
      oldValue[`enable_${deptKey}`], 
      enable, 
      'user instruction', 
      1.0
    );
    
    return `✅ ${deptDisplay.charAt(0).toUpperCase() + deptDisplay.slice(1)} ${enable ? 'enabled' : 'disabled'}.`;
  }

  // Tone adjustments: "more catholic" / "neutral only" / "balanced approach"
  if (lower.includes('more catholic') || lower.includes('add catholic') || lower.includes('sprinkle catholic')) {
    const oldTone = await db.one(`select tone_style from mb.managers where id=$1`, [managerId]);
    await db.query(`update mb.managers set tone_style='neutral_plus_catholic', updated_at=now() where id=$1`, [managerId]);
    
    await policy.learn(
      {type: 'manager', id: managerId}, 
      'tone_style', 
      oldTone.tone_style, 
      'neutral_plus_catholic', 
      'user instruction', 
      1.0
    );
    
    return `🙏 Got it — I'll sprinkle in Catholic inspiration at natural moments (praise, habits, weekly summaries).`;
  }

  if (lower.includes('neutral only') || lower.includes('no catholic') || lower.includes('secular only')) {
    const oldTone = await db.one(`select tone_style from mb.managers where id=$1`, [managerId]);
    await db.query(`update mb.managers set tone_style='neutral', updated_at=now() where id=$1`, [managerId]);
    
    await policy.learn(
      {type: 'manager', id: managerId}, 
      'tone_style', 
      oldTone.tone_style, 
      'neutral', 
      'user instruction', 
      1.0
    );
    
    return `✅ Understood — I'll keep the tone neutral and professional.`;
  }

  if (lower.includes('full catholic') || lower.includes('always catholic') || lower.includes('catholic mode')) {
    const oldTone = await db.one(`select tone_style from mb.managers where id=$1`, [managerId]);
    await db.query(`update mb.managers set tone_style='catholic', updated_at=now() where id=$1`, [managerId]);
    
    await policy.learn(
      {type: 'manager', id: managerId}, 
      'tone_style', 
      oldTone.tone_style, 
      'catholic', 
      'user instruction', 
      1.0
    );
    
    return `🙏 Excellent — I'll use Catholic inspiration in all my messages.`;
  }

  // Person-specific evidence policy: "make Bob proof required/encouraged"
  const personProofMatch = lower.match(/make (.+?) proof (required|encouraged)/);
  if (personProofMatch) {
    const name = personProofMatch[1].trim();
    const mode = personProofMatch[2] === 'required' ? 'require' : 'encourage';
    
    const person = await db.oneOrNull(`
      select p.id, p.name 
      from mb.people p 
      join mb.managers m on m.id = p.manager_id 
      where m.id = $1 and lower(p.name) = lower($2) 
      limit 1
    `, [managerId, name]);
    
    if (person) {
      // Update all open commitments for this person
      await db.query(`
        update mb.commitments 
        set proof_mode = $1, updated_at = now() 
        where person_id = $2 and status = 'open'
      `, [mode, person.id]);
      
      await policy.learn(
        {type: 'person', id: person.id}, 
        'proof_mode', 
        null, 
        mode, 
        'user instruction', 
        1.0
      );
      
      return `✅ ${person.name} set to "${mode}" proof for all commitments.`;
    } else {
      return `❓ I couldn't find someone named "${name}" on your team. Could you double-check the name?`;
    }
  }

  // Bulk policy changes: "require proof for everyone" / "encourage proof for all"
  if (lower.match(/(require|encourage) proof for (everyone|all)/)) {
    const mode = lower.includes('require') ? 'require' : 'encourage';
    
    const updated = await db.query(`
      update mb.commitments 
      set proof_mode = $2, updated_at = now() 
      where status = 'open' 
        and person_id in (
          select p.id from mb.people p where p.manager_id = $1
        )
    `, [managerId, mode]);
    
    await policy.learn(
      {type: 'manager', id: managerId}, 
      'bulk_proof_mode', 
      null, 
      mode, 
      'user instruction', 
      1.0
    );
    
    return `✅ Set all team members to "${mode}" proof mode.`;
  }

  // Help/status request
  if (lower.includes('help') || lower.includes('what can you do') || lower.includes('commands')) {
    const depts = await policy.enabledDepartments(managerId);
    const enabledDepts = Object.entries(depts)
      .filter(([_, enabled]) => enabled)
      .map(([key, _]) => key.replace('_', ' '))
      .join(', ');

    return `🤖 I'm Donna, your AI management assistant. I can:

📋 Track commitments and send daily check-ins
📊 Send weekly progress digests
🏢 Route requests to: ${enabledDepts}

🎛️ **Admin commands** (natural language):
• "Turn on/off [department]" (family manager, life coach, etc.)
• "More Catholic" / "Neutral only" / "Full Catholic" (tone)
• "Make [person] proof required/encouraged"
• "Require/encourage proof for everyone"

Just chat naturally - I'll understand! 😊`;
  }

  return null; // Not an admin intent
}