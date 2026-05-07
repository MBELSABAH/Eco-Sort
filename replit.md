# EcoSort - Waste Sorting Assistant with Role-Based Access

## Overview
EcoSort is an AI-powered waste sorting assistant with two access levels:
1. **Resident (User) Access** - Sort items, check bags, submit for pickup, earn points
2. **Management Access** - View household performance, provide feedback, assist pickup decisions

## Current State
- Fully functional waste classification app with role-based views
- In-memory data storage (demo-level, resets on restart)
- Pure HTML, CSS, JavaScript frontend (no frameworks)
- Python Flask backend with OpenAI Vision API integration

## Project Structure
```
/
├── app.py              # Flask backend with all API endpoints
├── static/
│   ├── index.html      # Main HTML with role-based views
│   ├── styles.css      # Complete styling for all views
│   └── app.js          # Frontend logic for both portals
├── pyproject.toml      # Python dependencies
└── replit.md           # This file
```

## Access System

### Resident Access (No Password)
- Enter Name + House Number to create/access profile
- No authentication - demo-level identity system

### Management Access (Fixed Credentials)
- ID: 123
- Key: 123
- Single management view for all households

## User Portal Features

### 1. Existing Features (Unchanged)
- **Item Scanner** - Classify individual waste items → bin recommendation
- **Bag Quality Checker** - Check if bag is properly sorted before submission

### 2. Bag Submission (New)
- Submit bag photos for pickup evaluation
- Stored under house number
- Receives sorting score and earns eco-points

### 3. Weekly Summary
- Total bags submitted this week
- Average sorting score
- Pickup schedule (which bag type on which day)

### 4. Performance Points
Points earned based on bag score:
- 90-100 score = 100 points
- 80-89 score = 75 points
- 70-79 score = 50 points
- 60-69 score = 25 points
- Below 60 = 0 points

## Management Portal Features

### 1. Household List
- House number, resident name
- Number of bags submitted
- Average sorting score
- Performance status

### 2. Pickup Decision Support
Status indicators:
- **OK** (green): Score 75+ - Ready for pickup
- **Review** (yellow): Score 60-74 - May need attention
- **Attention** (red): Score below 60 - Needs improvement
- **No Data**: No submissions yet

Note: System assists decision-making only, does not enforce rules.

### 3. Feedback Loop
- Management can send feedback to households
- Optional point adjustments (+25, +10, -10, -25)
- Feedback visible in user dashboard

## API Endpoints

### User Management
- `POST /api/user/register` - Register/update user (name, house_number)
- `GET /api/user/<house_number>` - Get user details
- `GET /api/user/<house_number>/stats` - Get weekly stats, points, feedback

### Management
- `POST /api/management/login` - Verify credentials (id, key)
- `GET /api/management/households` - List all households with stats
- `POST /api/management/feedback` - Send feedback to household

### Bag Operations
- `POST /api/bag/submit` - Submit bag for pickup (requires house_number)
- `POST /classify-image` - Classify single item (unchanged)
- `POST /check-bag` - Check bag quality (unchanged)

## Data Model (In-Memory)

### User
```json
{
  "name": "John Doe",
  "house_number": "123",
  "created_at": "2026-01-24T10:00:00",
  "total_points": 250
}
```

### Bag Submission
```json
{
  "id": 1,
  "house_number": "123",
  "bag_type": "green",
  "score": 85,
  "grade": "B",
  "points_earned": 75,
  "submitted_at": "2026-01-24T10:30:00"
}
```

## Pickup Schedule (Demo)
- Monday: Green (Compost)
- Tuesday: Blue (Recycling)
- Wednesday: White (Landfill)
- Thursday: Green (Compost)
- Friday: Blue (Recycling)

## Limitations (Explicit)
- In-memory storage resets on server restart
- Demo-level identity (no real authentication)
- Single management account (fixed credentials)
- AI image recognition has accuracy limitations
- Generic recycling guidelines (not location-specific)
- System assists but does not enforce pickup rules

## Running the App
The app runs on port 5000 using Flask development server.

## Recent Changes
- January 2026: Added role-based access (User/Management portals)
- January 2026: Added bag submission with points system
- January 2026: Added management dashboard with household overview
- January 2026: Added Bag Quality Checker feature
- January 2026: Initial implementation with Item Scanner
