# Photo-First UI Demo Walkthrough (60 seconds)

## Demo URL

http://localhost:3000/demo/work-orders/wo-demo-1/photos

## Quick Demo Script

### Setup (10 seconds)

1. Navigate to demo URL
2. Notice role switcher at top (TENANT | MANAGER | TECH)
3. Current state: Work order in SUBMITTED status

### Tenant Flow (15 seconds)

1. **Role: TENANT** (default)
2. See photo encouragement banner: "Photos help us fix it faster"
3. Click "Add Photos" button
4. Drag/drop or click to upload (simulated)
5. Watch upload progress and preview
6. Photos appear in "Tenant Photos" section

### Manager Flow (10 seconds)

1. **Switch to: MANAGER**
2. Click "Add Context Photo"
3. Upload additional reference photo
4. Photo appears in "Manager Notes" section

### Tech Flow (20 seconds)

1. **Switch to: TECH**
2. Notice requirements checklist:
   - ⏳ Before photos (0)
   - ⏳ During photos (0)
   - ⏳ After photos (0)
3. Notice "Start Work" button is disabled
4. Click "Add Before" → upload → see ✅ Before photos (1)
5. "Start Work" now enabled, click to change status
6. Click "Add During" → upload
7. Click "Add After" → upload
8. "Complete" button now enabled

### Gallery Interaction (5 seconds)

1. Click any photo thumbnail → opens lightbox
2. Use arrow keys or buttons to navigate
3. Press Esc to close
4. Photos grouped by: Before | During | After | Tenant | Manager

## Key Demo Points

- **Photo-first UX**: Photos encouraged at every step
- **Role-based workflows**: Each role has different capabilities
- **Status gating**: Tech can't progress without required photos
- **Smooth interactions**: Upload progress, previews, lightbox
- **Accessibility**: Keyboard navigation, focus states, ARIA labels
- **Mobile ready**: "Use camera" button, responsive design

## Evidence Generated

- All data stored in memory only (no database/storage calls)
- Mock service simulates realistic upload delays and responses
- Feature flag FEATURE_DEMO_PHOTOS_UI=true enables entire UI

## Rollback

Set FEATURE_DEMO_PHOTOS_UI=false to hide all new components