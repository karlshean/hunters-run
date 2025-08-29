# RLS Policy Inventory

Generated: 2025-08-29T18:08:52.332Z

## Summary Table

| Table Name | Policy Name | Command | Mentions app.org_id | Mentions app.current_organization |
|------------|-------------|---------|---------------------|-----------------------------------|
| events | p_ev | ALL | yes | no |
| legal_notices | p_ln | ALL | yes | no |
| notice_templates | p_nt | ALL | yes | no |
| payment_disputes | p_pd | ALL | yes | no |
| properties | properties_org_rls | ALL | yes | no |
| service_attempts | p_sa | ALL | yes | no |
| sms_messages | p_sms | ALL | yes | no |
| test_rls | test_rls_policy | ALL | no | no |
| webhook_events | p_we | ALL | yes | no |
| work_order_transitions | work_order_transitions_org_rls | ALL | yes | no |
| work_orders | work_orders_org_rls | ALL | yes | no |

## Detailed Policy Information

### events - p_ev

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(organization_id = (current_setting('app.org_id'::text, true))::uuid)`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

### legal_notices - p_ln

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(organization_id = (current_setting('app.org_id'::text, true))::uuid)`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

### notice_templates - p_nt

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(organization_id = (current_setting('app.org_id'::text, true))::uuid)`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

### payment_disputes - p_pd

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(organization_id = (current_setting('app.org_id'::text, true))::uuid)`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

### properties - properties_org_rls

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(organization_id = (current_setting('app.org_id'::text, true))::uuid)`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

### service_attempts - p_sa

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(organization_id = (current_setting('app.org_id'::text, true))::uuid)`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

### sms_messages - p_sms

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(organization_id = (current_setting('app.org_id'::text, true))::uuid)`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

### test_rls - test_rls_policy

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(name = 'allowed'::text)`
- **Check Expression**: `N/A`
- **References app.org_id**: no
- **References app.current_organization**: no

### webhook_events - p_we

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `((organization_id IS NULL) OR (organization_id = (current_setting('app.org_id'::text, true))::uuid))`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

### work_order_transitions - work_order_transitions_org_rls

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(organization_id = (current_setting('app.org_id'::text, true))::uuid)`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

### work_orders - work_orders_org_rls

- **Command**: ALL
- **Permissive**: PERMISSIVE
- **Roles**: {public}
- **Using Expression**: `(organization_id = (current_setting('app.org_id'::text, true))::uuid)`
- **Check Expression**: `N/A`
- **References app.org_id**: yes
- **References app.current_organization**: no

