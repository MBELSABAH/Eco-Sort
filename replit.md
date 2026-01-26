# EcoSort - Waste Sorting Assistant

## Overview
EcoSort is an AI-powered waste sorting assistant that helps users identify the correct bin for their waste items AND evaluate whether filled garbage bags are properly sorted. Uses OpenAI Vision API for classification.

## Current State
- Fully functional waste classification app with two features:
  1. **Item Scanner** - Classify individual waste items
  2. **Bag Quality Checker** - Evaluate filled garbage bags
- Pure HTML, CSS, JavaScript frontend (no frameworks)
- Python Flask backend with OpenAI Vision API integration

## Project Structure
```
/
├── app.py              # Flask backend with /classify-image and /check-bag endpoints
├── static/
│   ├── index.html      # Main HTML page with tabs for both features
│   ├── styles.css      # Eco-friendly themed styles
│   └── app.js          # Frontend logic and localStorage
├── pyproject.toml      # Python dependencies
└── replit.md           # This file
```

## Features

### Item Scanner (Original)
- Drag & drop image upload with file picker
- AI-based waste classification using GPT-4o Vision
- Color-coded bin recommendations (Blue=Recycling, Green=Compost, Gray=Landfill, Red=E-waste)
- Sustainability metrics (waste diverted, CO2 saved, money saved)
- Total impact counter saved in localStorage

### Bag Quality Checker (New)
- Separate upload area for filled garbage bag photos
- Bag type selector (Green/Compost, Blue/Recycling, White/Landfill)
- Quality score (0-100) with letter grade (A-F)
- Pass/Fail verdict on sorting quality
- Lists detected items in the bag
- Identifies contamination issues
- Provides actionable suggestions for improvement
- Confidence level indicator
- Explicit limitations notice

## API Endpoints

**POST /classify-image** (Item Scanner)
- Accepts: multipart/form-data with 'image' field
- Returns: item, bin, waste_saved_grams, co2_saved_grams, money_saved_cents, confidence

**POST /check-bag** (Bag Quality Checker)
- Accepts: multipart/form-data with 'image' and 'bag_type' fields
- Returns:
```json
{
  "score": 85,
  "grade": "B",
  "is_properly_sorted": true,
  "bag_type_correct": true,
  "items_detected": ["banana peel", "coffee grounds"],
  "contamination_issues": [],
  "explanation": "Well-sorted compost bag...",
  "suggestions": ["Continue sorting this way"],
  "confidence": "high",
  "bag_type": "green"
}
```

## Limitations (Explicit)
- Uses AI image recognition which may not detect all items
- Results based on generic recycling guidelines (not location-specific)
- Confidence levels indicate uncertainty in analysis
- Cannot guarantee 100% accuracy for obscured or unclear images

## Running the App
The app runs on port 5000 using Flask development server.

## Recent Changes
- January 2026: Added Bag Quality Checker feature with scoring, contamination detection, and suggestions
- January 2026: Initial implementation with Item Scanner feature
