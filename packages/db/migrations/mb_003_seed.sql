-- Donna MB Seed Templates
-- Rich template pack with neutral and Catholic tones

-- Clear existing templates
delete from mb.templates;

-- NUDGE templates (daily check-ins)
insert into mb.templates (kind, tone, template, variables) values
-- Neutral nudges
('nudge', 'neutral', 'Hey {{name}}! How did "{{commitment}}" go today?', array['name', 'commitment']),
('nudge', 'neutral', 'Quick check-in on "{{commitment}}" - how are we doing?', array['name', 'commitment']),
('nudge', 'neutral', 'Time for your daily update on "{{commitment}}". What''s the status?', array['name', 'commitment']),
('nudge', 'neutral', '{{name}}, just checking in on "{{commitment}}". How did it go?', array['name', 'commitment']),

-- Catholic nudges
('nudge', 'catholic', 'Hey {{name}}! How did "{{commitment}}" go today? Praying for your success! 🙏', array['name', 'commitment']),
('nudge', 'catholic', 'Quick check-in on "{{commitment}}" - trusting God is strengthening you in this! How are we doing?', array['name', 'commitment']),
('nudge', 'catholic', '{{name}}, just checking in on "{{commitment}}". Remember, God gives strength to the weary! How did it go?', array['name', 'commitment']),
('nudge', 'catholic', 'Time for your daily update on "{{commitment}}". The Lord delights in your efforts! What''s the status?', array['name', 'commitment']);

-- ESCALATION templates (when commitments need attention)
insert into mb.templates (kind, tone, template, variables) values
-- Neutral escalations
('escalation', 'neutral', '{{manager_name}}, {{person_name}} has missed check-ins for "{{commitment}}" ({{missed_count}} days). May need follow-up.', array['manager_name', 'person_name', 'commitment', 'missed_count']),
('escalation', 'neutral', 'FYI: {{person_name}} is struggling with "{{commitment}}" - last check-in was {{days_ago}} days ago.', array['person_name', 'commitment', 'days_ago']),

-- Catholic escalations
('escalation', 'catholic', '{{manager_name}}, {{person_name}} has missed check-ins for "{{commitment}}" ({{missed_count}} days). Perhaps they could use your prayers and support.', array['manager_name', 'person_name', 'commitment', 'missed_count']),
('escalation', 'catholic', 'FYI: {{person_name}} is struggling with "{{commitment}}" - last check-in was {{days_ago}} days ago. Keeping them in prayer!', array['person_name', 'commitment', 'days_ago']);

-- PRAISE templates (celebrating success)
insert into mb.templates (kind, tone, template, variables) values
-- Neutral praise
('praise', 'neutral', 'Awesome work on "{{commitment}}", {{name}}! {{streak_days}} days strong! 🎉', array['name', 'commitment', 'streak_days']),
('praise', 'neutral', 'Well done, {{name}}! Your consistency on "{{commitment}}" is impressive.', array['name', 'commitment']),
('praise', 'neutral', 'Great job staying committed to "{{commitment}}" - you''re crushing it!', array['name', 'commitment']),

-- Catholic praise
('praise', 'catholic', 'Praise God! Awesome work on "{{commitment}}", {{name}}! {{streak_days}} days strong! 🙏', array['name', 'commitment', 'streak_days']),
('praise', 'catholic', 'Well done, good and faithful servant! Your consistency on "{{commitment}}" is a beautiful witness.', array['name', 'commitment']),
('praise', 'catholic', 'Great job staying committed to "{{commitment}}" - the Lord is pleased with your faithfulness!', array['name', 'commitment']);

-- HABIT templates (building routines)
insert into mb.templates (kind, tone, template, variables) values
-- Neutral habits
('habit', 'neutral', 'Building habits takes time. How can we make "{{commitment}}" easier to stick with?', array['commitment']),
('habit', 'neutral', 'What''s working well with "{{commitment}}"? What could we adjust?', array['commitment']),

-- Catholic habits
('habit', 'catholic', 'Building virtue takes patience - even St. Paul struggled! How can we make "{{commitment}}" easier to stick with?', array['commitment']),
('habit', 'catholic', 'Remember, God gives us the grace to grow. What''s working well with "{{commitment}}"? What could we adjust?', array['commitment']);

-- FAMILY templates (family-related commitments)
insert into mb.templates (kind, tone, template, variables) values
-- Neutral family
('family', 'neutral', 'How did family time go with "{{commitment}}" today? Family relationships need tending!', array['commitment']),
('family', 'neutral', 'Quick check on "{{commitment}}" - these moments with family matter so much.', array['commitment']),

-- Catholic family
('family', 'catholic', 'How did family time go with "{{commitment}}" today? The family that prays together stays together! 👨‍👩‍👧‍👦', array['commitment']),
('family', 'catholic', 'Quick check on "{{commitment}}" - building the domestic church, one moment at a time!', array['commitment']);

-- CHIEF templates (executive/leadership focus)
insert into mb.templates (kind, tone, template, variables) values
-- Neutral chief
('chief', 'neutral', 'Leadership check: How did "{{commitment}}" impact your team/organization today?', array['commitment']),
('chief', 'neutral', 'Strategic update on "{{commitment}}" - what results are you seeing?', array['commitment']),

-- Catholic chief
('chief', 'catholic', 'Leadership check: How did "{{commitment}}" impact your team/organization today? Leading with servant''s heart!', array['commitment']),
('chief', 'catholic', 'Strategic update on "{{commitment}}" - what results are you seeing? Trusting Divine Providence in leadership!', array['commitment']);

-- DIGEST_CLOSING templates (weekly summary closings)
insert into mb.templates (kind, tone, template, variables) values
-- Neutral closing
('digest_closing', 'neutral', 'Keep up the great work this week! Every small step counts. 💪'),
('digest_closing', 'neutral', 'Another week of growth and progress. You''ve got this!'),
('digest_closing', 'neutral', 'Proud of your commitment to growth. See you next week!'),

-- Catholic closing  
('digest_closing', 'catholic', 'May God bless your efforts this week! Ad astra per aspera! 🌟'),
('digest_closing', 'catholic', 'Another week of grace and growth. God is not outdone in generosity!'),
('digest_closing', 'catholic', 'Proud of your commitment to growth. May Mary intercede for you this week! ⭐'),
('digest_closing', 'catholic', 'Keep fighting the good fight! St. Joseph, pray for us! 🔨');