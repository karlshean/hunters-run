# Hunters Run Demo Script (60 seconds)

## Setup
- Ensure FEATURE_DEMO_SLICE=true in both apps
- Start API: npm run dev:api
- Start Web: npm run dev:web
- Navigate to http://localhost:3000/work-orders

## Golden Path (8 clicks)
1. **Create** → Click "New Work Order"
2. **Fill** → Title: "Fix broken sink", Description: "Kitchen sink leaking"
3. **Submit** → Click "Create Work Order"
4. **Select** → Click on the new work order in list
5. **Assign** → Change assignee to "John Smith"
6. **Progress** → Update status to "In Progress"
7. **Complete** → Change status to "Completed"
8. **Verify** → See timeline shows create → update → complete

## Key Demo Points
- Smooth UI transitions (list → detail drawer)
- Consistent API responses ({ success, data, error })
- Real-time updates (status changes immediately visible)
- Empty states (friendly "No work orders yet" message)
- Responsive design (works on mobile/desktop)
- Security (RLS enforced - only see your org's data)

## Fallback (if issues)
- Refresh page and try again
- Check browser console for API errors
- Verify database connection in API logs
- Toggle FEATURE_DEMO_SLICE=false to see original app

Total time: ~45 seconds for smooth execution