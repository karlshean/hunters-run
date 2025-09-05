# Donna v1.3: Invisible Policy Implementation (Telegram)

**Donna** is an AI-powered management assistant that helps track commitments and send intelligent check-ins via Telegram. This implementation features invisible policy decisions - Donna learns and adapts without exposing configuration UI to users.

## 🌟 Key Features

- **Policy-Driven Intelligence**: Donna makes tone, department routing, and evidence decisions invisibly
- **Natural Language Admin**: Configure via chat ("more Catholic", "turn off family manager")
- **Reliable Messaging**: Outbox pattern ensures no messages are lost
- **Department Routing**: Auto-routes to Middle Manager, Chief of Staff, Life Coach, or Family Manager
- **Evidence Tracking**: Smart proof requirements based on completion patterns
- **Rich Templates**: Catholic and neutral tone templates for all contexts

## 🏗️ Architecture

```
📦 Donna MB System
├── 📁 Database Migrations (packages/db/migrations/)
│   ├── mb_001_core.sql       # Core schema (managers, people, commitments)
│   ├── mb_002_functions.sql  # Scheduling functions  
│   ├── mb_003_seed.sql       # Template library
│   ├── mb_004_triggers.sql   # Auto-scheduling triggers
│   └── mb_005_policy.sql     # Policy tracking tables
├── 📁 Policy Engine (apps/hr-api/src/policy/)
│   └── policy.engine.ts      # Decision algorithms
├── 📁 Telegram Bot (apps/hr-api/src/telegram/)
│   ├── telegram.controller.ts # Webhook handler
│   └── admin-intents.ts      # Natural language commands
└── 📁 Workers (apps/hr-api/src/workers/)
    ├── due-checkin.worker.ts # Daily commitment pings
    ├── weekly-digest.worker.ts # Progress summaries  
    └── outbox.worker.ts      # Reliable message delivery
```

## 🚀 Quick Start

### 1. Environment Setup

```bash
# Required environment variables
DATABASE_URL=postgresql://user:pass@host:5432/dbname
TELEGRAM_BOT_TOKEN=your_bot_token
DB_SSL_MODE=relaxed
```

### 2. Database Setup

```bash
# Run migrations
npm run mb:migrate

# Check migration status
npm run mb:migrate:status
```

### 3. Start Services

```bash
# Start the API server
npm run dev:hr

# Start message outbox worker (daemon mode)
npm run mb:outbox:daemon

# Run check-in worker (typically via cron)
npm run mb:checkins

# Run weekly digest (typically via cron)  
npm run mb:digest
```

### 4. Configure Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-domain.com/api/telegram/webhook"}'
```

## 💬 Usage Examples

### Natural Language Admin Commands

```
👤 User: "Turn off family manager"
🤖 Donna: "✅ Family Manager disabled."

👤 User: "More Catholic tone"  
🤖 Donna: "🙏 Got it — I'll sprinkle in Catholic inspiration at natural moments."

👤 User: "Make Bob proof required"
🤖 Donna: "✅ Bob set to 'require' proof for all commitments."

👤 User: "Help"
🤖 Donna: "🤖 I'm Donna, your AI management assistant..."
```

### Regular Interactions

```
👤 User: "I want to exercise 30 minutes daily"
🤖 Donna: "✅ Got it! I'll help you track this. Check-in scheduled for tomorrow."

# Next day - Donna sends check-in with policy-appropriate buttons:
🤖 Donna: "Hey! How did 'exercise 30 minutes daily' go today?"
[✅ Done] [📎 Add Proof] [⏭️ Skip]
```

## 🎛️ Policy Engine

Donna makes invisible decisions about:

### Tone Selection
- **Neutral**: Professional, secular tone
- **Catholic**: Faith-integrated messaging  
- **Neutral + Catholic**: Catholic tone only for praise, habits, digest closings

### Department Routing
- **Middle Manager**: General management tasks
- **Chief of Staff**: Strategic/executive focus
- **Life Coach**: Personal development, habits
- **Family Manager**: Family-related commitments

### Evidence Requirements
- **Encourage**: Optional proof, [Done] [Add Proof] [Skip] buttons
- **Require**: Mandatory proof, [Add Proof] [Mark Done Anyway] buttons
- Auto-adjusts based on completion patterns

## 📊 Database Schema

### Core Tables
- `mb.managers` - Team leaders using Donna
- `mb.people` - Team members being managed  
- `mb.commitments` - Tracked goals/tasks
- `mb.checkins` - Daily check-in responses
- `mb.evidence` - Proof attachments
- `mb.templates` - Message templates
- `mb.outbox` - Reliable message queue

### Policy Tables
- `mb.policy_events` - Decision audit trail
- `learned_prefs` columns - Donna's adaptive memory

## 🔧 API Scripts

```bash
# Database
npm run mb:migrate           # Apply migrations
npm run mb:migrate:status    # Check status

# Workers  
npm run mb:outbox           # Process outbox once
npm run mb:outbox:daemon    # Continuous outbox processing
npm run mb:checkins         # Send due check-ins
npm run mb:digest           # Send weekly digests
```

## 🎯 Acceptance Criteria

✅ **No Settings UI**: All configuration via natural language  
✅ **Admin Intents**: Tone changes, department toggles, proof policies  
✅ **Policy Decisions**: Invisible tone/department/evidence choices  
✅ **Reliable Messaging**: Outbox with retries and backoff  
✅ **Idempotent Webhook**: Duplicate update detection  
✅ **Smart Templates**: Rich Catholic/neutral template library  
✅ **Auto-scheduling**: Commitment pings based on timezone/preferences  

## 🔄 Deployment Runbook

1. **Environment**: Set `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`
2. **Migrations**: Run `npm run mb:migrate`  
3. **Workers**: Start `npm run mb:outbox:daemon`
4. **Webhook**: Configure Telegram webhook URL
5. **Cron**: Schedule workers (`mb:checkins` hourly, `mb:digest` weekly)
6. **Test**: Send natural language commands to verify

## 📝 Template Examples

### Nudges (Daily Check-ins)
- Neutral: "Hey {{name}}! How did '{{commitment}}' go today?"
- Catholic: "Hey {{name}}! How did '{{commitment}}' go today? Praying for your success! 🙏"

### Weekly Digest Closings
- Neutral: "Keep up the great work this week! Every small step counts. 💪"
- Catholic: "May God bless your efforts this week! Ad astra per aspera! 🌟"

### Praise (Celebrations)
- Neutral: "Awesome work on '{{commitment}}', {{name}}! {{streak_days}} days strong! 🎉"
- Catholic: "Praise God! Awesome work on '{{commitment}}', {{name}}! {{streak_days}} days strong! 🙏"

---

**Ready to use Donna?** Start with `npm run mb:migrate` and begin chatting! 🤖✨