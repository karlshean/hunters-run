# Backlog (live)
## Decisions
- [ ] Pick cloud region and S3 bucket
- [ ] Confirm Stripe/Telnyx/SendGrid accounts

## Tasks
- [ ] Fill env values, run end-to-end
- [ ] Add DTO validation and legal routes
- [ ] Add RLS drift snapshot test

## Risks
- RLS misconfig could leak data
- Stripe webhook signature must use raw body