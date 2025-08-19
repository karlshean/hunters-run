# Web Interface Setup Guide

## What You Get
A complete web interface at **http://localhost:3001** where you can:
- View and manage work orders through a browser
- Test payments with Stripe checkout
- See real-time data updates
- Test the full user experience

## Quick Setup (5 minutes)

### 1. Complete the Web App Creation
```bash
cd C:\Users\KA\myprojects3\hunters-run\apps\hr-web

# Install all dependencies
npm install

# Copy environment configuration
cp .env.local.example .env.local
```

### 2. Start Both Services
```bash
# Terminal 1: Start the API
cd C:\Users\KA\myprojects3\hunters-run
docker compose up -d
npm run migrate
npm run seed:local
npm run dev:hr

# Terminal 2: Start the Web Interface
cd C:\Users\KA\myprojects3\hunters-run\apps\hr-web
npm run dev
```

### 3. Open in Browser
Navigate to **http://localhost:3001**

You'll see:
- **Work Orders** page: List all maintenance requests
- **Payments** page: View charges and process payments

## How to Test Like a Real User

### Testing Work Orders
1. **Go to http://localhost:3001/work-orders**
2. **Click on any work order** to see details
3. **Assign technician** using the dropdown
4. **Change status** (new → triaged → assigned → in_progress → completed)
5. **Upload evidence** (photos, documents)
6. **View audit trail** to see all changes

### Testing Payments  
1. **Go to http://localhost:3001/payments**
2. **Click "Pay Now"** on any charge
3. **Complete checkout** in the popup (test mode)
4. **Simulate webhook** with the provided button
5. **Refresh** to see payment applied

### Real User Experience
- **No technical knowledge needed** - it's just clicking buttons
- **Visual feedback** with status colors and notifications
- **Error handling** shows clear messages
- **Mobile-friendly** responsive design

## What Each Page Does

### Work Orders Page (`/work-orders`)
- Lists all maintenance requests with filters
- Shows status, priority, tenant info
- Click to view full details and take actions

### Work Order Detail (`/work-orders/[id]`)
- Full work order information
- Assign technician dropdown
- Status change buttons (only valid transitions)
- File upload for evidence (photos/documents)
- Audit trail showing all changes with validation

### Payments Page (`/payments`)
- Shows all charges (rent, fees, etc.)
- Current balance and payment status
- "Pay Now" button opens Stripe checkout
- Webhook simulation for testing
- Payment history and allocation details

## Testing Scenarios

### Scenario 1: Complete Work Order
1. Go to work orders list
2. Open "Kitchen sink leaking" work order
3. Assign to "Mike Wilson" 
4. Change status: new → triaged → assigned → in_progress
5. Upload a photo as evidence
6. Mark as completed
7. Check audit trail shows all changes

### Scenario 2: Process Payment
1. Go to payments page
2. See $1200 rent charge (unpaid)
3. Click "Pay Now" - opens Stripe checkout
4. Complete test payment
5. Simulate webhook (dev button)
6. Refresh - see charge now shows "paid"

### Scenario 3: Test Error Handling
1. Try invalid actions (like changing status incorrectly)
2. See clear error messages
3. Try without internet - see network error handling
4. All errors show user-friendly messages

## For Non-Technical Users

**This is just like any website you use:**
- Click buttons to do actions
- Fill forms to enter information  
- See immediate feedback when things happen
- Navigate between pages using the sidebar
- No command line or technical skills needed

**Think of it like:**
- Work Orders = Maintenance ticket system (like help desk)
- Payments = Online billing system (like utility company website)
- Everything updates in real-time

## Production Ready
- Real Stripe integration (just change API keys)
- Mobile responsive design
- Error handling and validation
- Security (organization isolation)
- Audit trails for compliance
- Ready to deploy anywhere

The web interface makes all the complex API functionality accessible through a simple point-and-click interface!