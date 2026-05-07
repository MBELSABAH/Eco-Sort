import os
import base64
import json
from datetime import datetime, timedelta
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from openai import OpenAI
from werkzeug.exceptions import RequestEntityTooLarge

app = Flask(__name__, static_folder='static')
app.config['MAX_CONTENT_LENGTH'] = 8 * 1024 * 1024
CORS(app, resources={r"/*": {"origins": ["https://mbelsabah.github.io", "http://127.0.0.1:5000", "http://localhost:5000"], "methods": ["GET", "POST", "OPTIONS"], "allow_headers": ["Content-Type", "Authorization"]}})

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
    base_url=os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
)

users_db = {}
bag_submissions_db = []
management_feedback_db = {}
redemptions_db = []

MANAGEMENT_ID = os.environ.get("MANAGEMENT_ID")
MANAGEMENT_KEY = os.environ.get("MANAGEMENT_KEY")
SCANNER_USERNAME = os.environ.get("SCANNER_USERNAME")
SCANNER_PASSWORD = os.environ.get("SCANNER_PASSWORD")
SCANNER_ACCESS_TOKEN = os.environ.get("SCANNER_ACCESS_TOKEN")
VALID_BAG_TYPES = {"green", "blue", "white"}

REDEEM_OPTIONS = {
    "tree": {
        "label": "Plant a Tree",
        "cost": 500,
        "description": "Support local tree planting initiatives."
    },
    "farmers_market": {
        "label": "Farmers Market Gift Card",
        "cost": 750,
        "description": "Shop local produce and support local farmers."
    },
    "cavendish": {
        "label": "Cavendish Farms Voucher",
        "cost": 1000,
        "description": "Redeem a voucher for Canadian-made products."
    },
    "refill_shop": {
        "label": "Refill Shop Gift Card",
        "cost": 900,
        "description": "Stock up on low-waste refills and bulk essentials."
    },
    "bike_tune": {
        "label": "Bike Tune-Up Credit",
        "cost": 650,
        "description": "Support sustainable commuting with a local bike shop."
    },
    "community_garden": {
        "label": "Community Garden Donation",
        "cost": 400,
        "description": "Help expand local community garden beds."
    }
}

PICKUP_SCHEDULE = {
    "Monday": "green",
    "Tuesday": "blue",
    "Wednesday": "white",
    "Thursday": "green",
    "Friday": "blue"
}

WASTE_DATA = {
    "recycling": {
        "items": ["plastic bottle", "aluminum can", "glass bottle", "cardboard", "paper", "newspaper", "magazine", "milk carton", "plastic container", "tin can", "metal lid", "glass jar"],
        "co2_factor": 2.0,
        "money_factor": 0.4
    },
    "compost": {
        "items": ["food scraps", "banana peel", "apple core", "coffee grounds", "tea bag", "eggshell", "vegetable peels", "fruit", "leaves", "grass clippings", "paper towel", "napkin", "tissue", "pizza box (soiled)"],
        "co2_factor": 0.5,
        "money_factor": 0.2
    },
    "landfill": {
        "items": ["styrofoam", "chip bag", "candy wrapper", "plastic straw", "broken glass", "ceramic", "diaper", "pet waste", "cigarette butt", "rubber band"],
        "co2_factor": 0.1,
        "money_factor": 0.05
    },
    "e-waste": {
        "items": ["phone", "laptop", "battery", "charger", "headphones", "cable", "keyboard", "mouse", "tablet", "monitor", "tv", "remote", "light bulb", "led bulb"],
        "co2_factor": 5.0,
        "money_factor": 1.0
    }
}

def normalize_house_number(house_number):
    if house_number is None:
        return ''
    return str(house_number).strip().upper()

def normalize_name(name):
    if name is None:
        return ''
    return str(name).strip()

def calculate_points(score):
    if score >= 90:
        return 100
    elif score >= 80:
        return 75
    elif score >= 70:
        return 50
    elif score >= 60:
        return 25
    else:
        return 0

def get_week_start():
    today = datetime.now()
    return today - timedelta(days=today.weekday())

def get_redemption_summary(house_number):
    house_number = normalize_house_number(house_number)
    redemptions = [r for r in redemptions_db if r.get("house_number") == house_number]
    tree_count = sum(1 for r in redemptions if r.get("reward_id") == "tree")
    local_credit_rewards = {"farmers_market", "refill_shop", "cavendish", "bike_tune"}
    local_credits = sum(1 for r in redemptions if r.get("reward_id") in local_credit_rewards)
    return {
        "trees_planted": tree_count,
        "local_credits": local_credits
    }

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@app.route('/api/scanner/login', methods=['POST'])
def scanner_login():
    if not SCANNER_USERNAME or not SCANNER_PASSWORD or not SCANNER_ACCESS_TOKEN:
        return jsonify({"ok": False, "error": "Scanner login is not configured"}), 500

    data = request.json or {}
    username = data.get('username', '')
    password = data.get('password', '')

    if username == SCANNER_USERNAME and password == SCANNER_PASSWORD:
        return jsonify({"ok": True, "token": SCANNER_ACCESS_TOKEN})

    return jsonify({"ok": False, "error": "Invalid scanner username or password"}), 401

def require_scanner_auth():
    expected_token = SCANNER_ACCESS_TOKEN
    auth_header = request.headers.get("Authorization", "")
    provided_token = ""
    if auth_header.startswith("Bearer "):
        provided_token = auth_header[7:].strip()
    if not expected_token or provided_token != expected_token:
        return jsonify({"error": "Scanner login required"}), 401
    return None

@app.route('/api/user/register', methods=['POST'])
def register_user():
    data = request.json or {}
    name = normalize_name(data.get('name', ''))
    house_number = normalize_house_number(data.get('house_number', ''))
    
    if not name or not house_number:
        return jsonify({"error": "Name and house number are required"}), 400
    
    if house_number not in users_db:
        users_db[house_number] = {
            "name": name,
            "house_number": house_number,
            "created_at": datetime.now().isoformat(),
            "total_points": 0
        }
    else:
        existing_name = users_db[house_number].get("name", "")
        if name and name.casefold() != existing_name.casefold():
            users_db[house_number]["name"] = name
    
    return jsonify({
        "success": True,
        "user": users_db[house_number]
    })

@app.route('/api/user/<house_number>', methods=['GET'])
def get_user(house_number):
    house_number = normalize_house_number(house_number)
    if house_number not in users_db:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify(users_db[house_number])

@app.route('/api/user/<house_number>/stats', methods=['GET'])
def get_user_stats(house_number):
    house_number = normalize_house_number(house_number)
    week_start = get_week_start()
    
    user_submissions = [s for s in bag_submissions_db 
                       if s['house_number'] == house_number]
    
    weekly_submissions = [s for s in user_submissions 
                         if datetime.fromisoformat(s['submitted_at']) >= week_start]
    
    total_bags = len(weekly_submissions)
    avg_score = sum(s['score'] for s in weekly_submissions) / total_bags if total_bags > 0 else 0
    
    total_points = users_db.get(house_number, {}).get('total_points', 0)
    
    feedback = management_feedback_db.get(house_number, [])
    
    return jsonify({
        "weekly_bags": total_bags,
        "weekly_avg_score": round(avg_score, 1),
        "total_points": total_points,
        "total_submissions": len(user_submissions),
        "recent_submissions": weekly_submissions[-5:] if weekly_submissions else [],
        "pickup_schedule": PICKUP_SCHEDULE,
        "management_feedback": feedback[-3:] if feedback else [],
        "redemption_summary": get_redemption_summary(house_number)
    })

@app.route('/api/management/login', methods=['POST'])
def management_login():
    if not MANAGEMENT_ID or not MANAGEMENT_KEY:
        return jsonify({"error": "Management login is not configured"}), 500

    data = request.json or {}
    mgmt_id = data.get('id', '')
    mgmt_key = data.get('key', '')
    
    if mgmt_id == MANAGEMENT_ID and mgmt_key == MANAGEMENT_KEY:
        return jsonify({"success": True})
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/management/households', methods=['GET'])
def get_households():
    households = []
    
    for house_number, user in users_db.items():
        submissions = [s for s in bag_submissions_db if s['house_number'] == house_number]
        avg_score = sum(s['score'] for s in submissions) / len(submissions) if submissions else 0
        recent_submissions = submissions[-3:] if submissions else []
        bag_types_submitted = sorted({
            s.get("bag_type") for s in submissions
            if s.get("bag_type") in VALID_BAG_TYPES
        })
        recent_bags = [
            {
                "id": s.get("id"),
                "house_number": house_number,
                "bag_type": s.get("bag_type", "unknown"),
                "score": s.get("score", 0),
                "grade": s.get("grade", "C"),
                "is_properly_sorted": s.get("is_properly_sorted", False),
                "items_detected": s.get("items_detected", []),
                "contamination_issues": s.get("contamination_issues", []),
                "explanation": s.get("explanation", ""),
                "suggestions": s.get("suggestions", []),
                "confidence": s.get("confidence", "low"),
                "image_data": s.get("image_data"),
                "submitted_at": s.get("submitted_at")
            }
            for s in recent_submissions
        ]
        
        status = "ok"
        if len(submissions) == 0:
            status = "no_data"
        elif avg_score < 60:
            status = "needs_attention"
        elif avg_score < 75:
            status = "review"
        
        households.append({
            "house_number": house_number,
            "name": user["name"],
            "bags_submitted": len(submissions),
            "avg_score": round(avg_score, 1),
            "total_points": user.get("total_points", 0),
            "status": status,
            "last_submission": submissions[-1]["submitted_at"] if submissions else None,
            "recent_bags": list(reversed(recent_bags)),
            "bag_types_submitted": bag_types_submitted
        })
    
    return jsonify(households)

@app.route('/api/management/feedback', methods=['POST'])
def submit_feedback():
    data = request.json or {}
    house_number = normalize_house_number(data.get('house_number'))
    feedback_text = (data.get('feedback') or '').strip()
    point_adjustment = data.get('point_adjustment', 0)
    try:
        point_adjustment = int(point_adjustment)
    except (TypeError, ValueError):
        point_adjustment = 0

    bag_type = (data.get('bag_type') or '').strip().lower()
    if bag_type not in VALID_BAG_TYPES:
        bag_type = None
    reasons = data.get('reasons', [])
    if not isinstance(reasons, list):
        reasons = []
    reasons = [str(reason).strip() for reason in reasons if str(reason).strip()]
    points_override = data.get('points_override', None)
    points_override_value = None
    if points_override is not None and str(points_override).strip() != "":
        try:
            points_override_value = int(points_override)
        except (TypeError, ValueError):
            return jsonify({"error": "Invalid override points"}), 400
        if points_override_value < 0:
            return jsonify({"error": "Override points must be non-negative"}), 400
    if not feedback_text and reasons:
        feedback_text = "Sorting issue noted."
    
    if not house_number or house_number not in users_db:
        return jsonify({"error": "Invalid house number"}), 400

    points_delta = None
    if points_override_value is not None:
        if bag_type is None:
            return jsonify({"error": "Select a bag color to adjust points"}), 400
        submissions = [
            s for s in bag_submissions_db
            if s['house_number'] == house_number and s.get("bag_type") == bag_type
        ]
        if not submissions:
            return jsonify({"error": f"No {bag_type} bag submissions to override"}), 400
        latest_submission = max(submissions, key=lambda s: s.get('submitted_at', ''))
        original_points = latest_submission.get("points_earned", 0)
        latest_submission["points_earned"] = points_override_value
        points_delta = points_override_value - original_points
        users_db[house_number]["total_points"] += points_delta
    else:
        users_db[house_number]["total_points"] += point_adjustment
    
    feedback_entry = {
        "feedback": feedback_text,
        "point_adjustment": point_adjustment if points_override_value is None else 0,
        "points_override": points_override_value,
        "points_delta": points_delta,
        "bag_type": bag_type,
        "reasons": reasons,
        "submitted_at": datetime.now().isoformat()
    }
    
    if house_number not in management_feedback_db:
        management_feedback_db[house_number] = []
    management_feedback_db[house_number].append(feedback_entry)
    
    return jsonify({"success": True})

@app.route('/api/user/redeem', methods=['POST'])
def redeem_points():
    data = request.json or {}
    house_number = normalize_house_number(data.get('house_number'))
    reward_id = (data.get('reward_id') or '').strip()

    if not house_number or house_number not in users_db:
        return jsonify({"error": "Invalid house number"}), 400

    if reward_id not in REDEEM_OPTIONS:
        return jsonify({"error": "Invalid reward option"}), 400

    reward = REDEEM_OPTIONS[reward_id]
    current_points = users_db[house_number].get("total_points", 0)
    if current_points < reward["cost"]:
        return jsonify({
            "error": "Not enough points",
            "required_points": reward["cost"],
            "current_points": current_points
        }), 400

    users_db[house_number]["total_points"] = current_points - reward["cost"]
    redemption_entry = {
        "house_number": house_number,
        "reward_id": reward_id,
        "reward_label": reward["label"],
        "points_spent": reward["cost"],
        "submitted_at": datetime.now().isoformat()
    }
    redemptions_db.append(redemption_entry)

    return jsonify({
        "success": True,
        "total_points": users_db[house_number]["total_points"],
        "redemption": redemption_entry,
        "redemption_summary": get_redemption_summary(house_number)
    })

@app.route('/api/bag/submit-batch', methods=['POST'])
def submit_bag_batch():
    data = request.json or {}
    house_number = normalize_house_number(data.get('house_number'))
    bags = data.get('bags', [])

    if not house_number or house_number not in users_db:
        return jsonify({"error": "Invalid house number. Please register first."}), 400

    if not isinstance(bags, list) or not bags:
        return jsonify({"error": "No bags provided"}), 400

    submissions = []
    total_points_awarded = 0

    for bag in bags:
        bag_type = (bag.get("bag_type") or "unknown").strip().lower()
        if bag_type not in VALID_BAG_TYPES:
            bag_type = "unknown"

        score = bag.get("score", 0)
        try:
            score = int(score)
        except (TypeError, ValueError):
            score = 0
        score = max(0, min(100, score))

        points_earned = calculate_points(score)
        total_points_awarded += points_earned

        submission = {
            "id": len(bag_submissions_db) + 1,
            "house_number": house_number,
            "bag_type": bag_type,
            "score": score,
            "grade": bag.get("grade", "C"),
            "is_properly_sorted": bag.get("is_properly_sorted", score >= 75),
            "items_detected": bag.get("items_detected", []),
            "contamination_issues": bag.get("contamination_issues", []),
            "explanation": bag.get("explanation", ""),
            "suggestions": bag.get("suggestions", []),
            "confidence": bag.get("confidence", "low"),
            "points_earned": points_earned,
            "image_data": bag.get("image_data"),
            "submitted_at": datetime.now().isoformat()
        }

        bag_submissions_db.append(submission)
        submissions.append(submission)

    users_db[house_number]["total_points"] += total_points_awarded

    response_submissions = [
        {k: v for k, v in s.items() if k != "image_data"} for s in submissions
    ]

    return jsonify({
        "success": True,
        "submissions": response_submissions,
        "total_points": users_db[house_number]["total_points"]
    })

@app.route('/api/bag/submit', methods=['POST'])
def submit_bag():
    auth_error = require_scanner_auth()
    if auth_error:
        return auth_error

    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No image selected"}), 400
    
    house_number = normalize_house_number(request.form.get('house_number'))
    bag_type = request.form.get('bag_type', 'unknown')
    
    if not house_number or house_number not in users_db:
        return jsonify({"error": "Invalid house number. Please register first."}), 400
    
    image_data = file.read()
    base64_image = base64.b64encode(image_data).decode('utf-8')
    mime_type = file.content_type or 'image/jpeg'
    image_data_url = f"data:{mime_type};base64,{base64_image}"
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a PEI/IWMC waste sorting quality inspector. Analyze this image of a filled garbage bag and evaluate how well it is sorted according to PEI (Island Waste Management) guidelines.

The user claims this is a {bag_type} bag. Evaluate if the contents match what should go in that bag type.

Bag color meanings (generic recycling guidelines):
- Green bag: Compost/organic waste (food scraps, yard waste, organic matter)
- Blue bag: Recycling (plastics, metals, glass, paper, cardboard)
- White/Black bag: Landfill/general waste (non-recyclable items)

PEI-specific notes:
- Napkins, paper towels, tissues, and soiled paper belong in compost.
- Food-soiled paper (e.g., greasy pizza boxes) belongs in compost.

Respond with ONLY valid JSON in this exact format:
{{
    "score": integer from 0-100 representing sorting quality,
    "grade": "A", "B", "C", "D", or "F" based on score,
    "is_properly_sorted": true or false,
    "items_detected": ["list", "of", "visible", "items"],
    "contamination_issues": ["list of items that don't belong in this bag type"],
    "explanation": "Brief explanation of why the bag received this score",
    "suggestions": ["actionable suggestion 1", "actionable suggestion 2"],
    "confidence": "high", "medium", or "low"
}}"""
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Evaluate this {bag_type} garbage bag. Is it properly sorted?"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=600
        )
        
        result_content = response.choices[0].message.content
        if result_content is None:
            raise ValueError("No response from AI model")
        result_text = result_content.strip()
        
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        result_text = result_text.strip()
        
        ai_result = json.loads(result_text)
        
        score = ai_result.get("score", 50)
        points_earned = calculate_points(score)
        
        submission = {
            "id": len(bag_submissions_db) + 1,
            "house_number": house_number,
            "bag_type": bag_type,
            "score": score,
            "grade": ai_result.get("grade", "C"),
            "is_properly_sorted": ai_result.get("is_properly_sorted", False),
            "items_detected": ai_result.get("items_detected", []),
            "contamination_issues": ai_result.get("contamination_issues", []),
            "explanation": ai_result.get("explanation", ""),
            "suggestions": ai_result.get("suggestions", []),
            "confidence": ai_result.get("confidence", "low"),
            "points_earned": points_earned,
            "image_data": image_data_url,
            "submitted_at": datetime.now().isoformat()
        }
        
        bag_submissions_db.append(submission)
        users_db[house_number]["total_points"] += points_earned
        
        response_payload = {k: v for k, v in submission.items() if k != "image_data"}
        return jsonify({
            **response_payload,
            "total_points": users_db[house_number]["total_points"]
        })
        
    except Exception as e:
        print(f"Error analyzing bag: {e}")
        return jsonify({
            "error": "Failed to analyze bag. Please try again.",
            "details": str(e)
        }), 500

@app.route('/classify-image', methods=['POST'])
def classify_image():
    auth_error = require_scanner_auth()
    if auth_error:
        return auth_error

    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No image selected"}), 400
    
    image_data = file.read()
    base64_image = base64.b64encode(image_data).decode('utf-8')
    
    mime_type = file.content_type or 'image/jpeg'
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": """You are a PEI/IWMC waste classification expert. Analyze the image and identify the main item that needs to be disposed of according to PEI (Island Waste Management) guidelines.

Respond with ONLY valid JSON in this exact format:
{
    "item": "name of the item (e.g., plastic bottle, banana peel, old phone)",
    "bin": "one of: recycling, compost, landfill, e-waste",
    "weight_grams": estimated weight in grams (integer between 5 and 2000),
    "confidence": your confidence level (high, medium, or low)
}

Bin categories:
- recycling: plastics, metals, glass, paper, cardboard
- compost: food waste, organic matter, yard waste
- landfill: non-recyclable items, mixed materials, contaminated items
- e-waste: electronics, batteries, cables, devices

PEI-specific notes:
- Napkins, paper towels, tissues, and soiled paper belong in compost.
- Food-soiled paper (e.g., greasy pizza boxes) belongs in compost.

Be specific about the item name and accurate with the bin classification."""
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "What item is in this image and which waste bin should it go in?"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=300
        )
        
        result_content = response.choices[0].message.content
        if result_content is None:
            raise ValueError("No response from AI model")
        result_text = result_content.strip()
        
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        result_text = result_text.strip()
        
        ai_result = json.loads(result_text)
        
        item = ai_result.get("item", "unknown item")
        bin_type = ai_result.get("bin", "landfill")
        weight = ai_result.get("weight_grams", 50)
        
        if bin_type not in WASTE_DATA:
            bin_type = "landfill"
        
        waste_info = WASTE_DATA[bin_type]
        co2_saved = int(weight * waste_info["co2_factor"])
        money_saved = int(weight * waste_info["money_factor"])
        
        return jsonify({
            "item": item,
            "bin": bin_type,
            "waste_saved_grams": weight,
            "co2_saved_grams": co2_saved,
            "money_saved_cents": money_saved,
            "confidence": ai_result.get("confidence", "medium")
        })
        
    except Exception as e:
        print(f"Error classifying image: {e}")
        return jsonify({
            "error": "Failed to classify image. Please try again.",
            "details": str(e)
        }), 500

@app.route('/check-bag', methods=['POST'])
def check_bag():
    auth_error = require_scanner_auth()
    if auth_error:
        return auth_error

    if 'image' not in request.files:
        return jsonify({"error": "No image provided"}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No image selected"}), 400
    
    bag_type = request.form.get('bag_type', 'unknown')
    
    image_data = file.read()
    base64_image = base64.b64encode(image_data).decode('utf-8')
    
    mime_type = file.content_type or 'image/jpeg'
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a PEI/IWMC waste sorting quality inspector. Analyze this image of a filled garbage bag and evaluate how well it is sorted according to PEI (Island Waste Management) guidelines.

The user claims this is a {bag_type} bag. Evaluate if the contents match what should go in that bag type.

Bag color meanings (generic recycling guidelines):
- Green bag: Compost/organic waste (food scraps, yard waste, organic matter)
- Blue bag: Recycling (plastics, metals, glass, paper, cardboard)
- White/Black bag: Landfill/general waste (non-recyclable items)

PEI-specific notes:
- Napkins, paper towels, tissues, and soiled paper belong in compost.
- Food-soiled paper (e.g., greasy pizza boxes) belongs in compost.

Respond with ONLY valid JSON in this exact format:
{{
    "score": integer from 0-100 representing sorting quality,
    "grade": "A", "B", "C", "D", or "F" based on score,
    "is_properly_sorted": true or false,
    "bag_type_correct": true or false (does content match claimed bag type),
    "items_detected": ["list", "of", "visible", "items"],
    "contamination_issues": ["list of items that don't belong in this bag type"],
    "explanation": "Brief explanation of why the bag received this score",
    "suggestions": ["actionable suggestion 1", "actionable suggestion 2"],
    "confidence": "high", "medium", or "low"
}}

Scoring guide:
- 90-100 (A): Perfectly sorted, no contamination
- 80-89 (B): Well sorted, minor issues
- 70-79 (C): Acceptable, some contamination
- 60-69 (D): Poor sorting, significant contamination
- 0-59 (F): Failed, major contamination or wrong bag type

Be honest about limitations - if the image is unclear or you cannot identify items with certainty, reflect that in confidence level and explanation."""
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": f"Evaluate this {bag_type} garbage bag. Is it properly sorted? What items can you see?"
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=600
        )
        
        result_content = response.choices[0].message.content
        if result_content is None:
            raise ValueError("No response from AI model")
        result_text = result_content.strip()
        
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        result_text = result_text.strip()
        
        ai_result = json.loads(result_text)
        
        return jsonify({
            "score": ai_result.get("score", 50),
            "grade": ai_result.get("grade", "C"),
            "is_properly_sorted": ai_result.get("is_properly_sorted", False),
            "bag_type_correct": ai_result.get("bag_type_correct", True),
            "items_detected": ai_result.get("items_detected", []),
            "contamination_issues": ai_result.get("contamination_issues", []),
            "explanation": ai_result.get("explanation", "Unable to determine sorting quality."),
            "suggestions": ai_result.get("suggestions", ["Please ensure items match the bag type."]),
            "confidence": ai_result.get("confidence", "low"),
            "bag_type": bag_type
        })
        
    except Exception as e:
        print(f"Error checking bag: {e}")
        return jsonify({
            "error": "Failed to analyze bag. Please try again.",
            "details": str(e)
        }), 500

@app.errorhandler(RequestEntityTooLarge)
def handle_large_file(_error):
    return jsonify({"error": "File is too large. Maximum upload size is 8 MB."}), 413

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
