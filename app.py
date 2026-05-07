import os
import base64
from flask import Flask, request, jsonify, send_from_directory
from openai import OpenAI
from flask_cors import CORS

app = Flask(__name__, static_folder='static')
CORS(app, resources={
    r"/*": {
        "origins": [
            "https://mbelsabah.github.io",
            "http://127.0.0.1:5000",
            "http://localhost:5000"
        ]
    }
})

client = OpenAI(
    api_key=os.environ.get("OPENAI_API_KEY") or os.environ.get("AI_INTEGRATIONS_OPENAI_API_KEY"),
    base_url=os.environ.get("AI_INTEGRATIONS_OPENAI_BASE_URL")
)

WASTE_DATA = {
    "recycling": {
        "items": ["plastic bottle", "aluminum can", "glass bottle", "cardboard", "paper", "newspaper", "magazine", "milk carton", "plastic container", "tin can", "metal lid", "glass jar"],
        "co2_factor": 2.0,
        "money_factor": 0.4
    },
    "compost": {
        "items": ["food scraps", "banana peel", "apple core", "coffee grounds", "tea bag", "eggshell", "vegetable peels", "fruit", "leaves", "grass clippings", "paper towel", "napkin"],
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

@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory('static', path)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

@app.route('/classify-image', methods=['POST'])
def classify_image():
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
                    "content": """You are a waste classification expert. Analyze the image and identify the main item that needs to be disposed of.

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
        
        import json
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
                    "content": f"""You are a waste sorting quality inspector. Analyze this image of a filled garbage bag and evaluate how well it is sorted.

The user claims this is a {bag_type} bag. Evaluate if the contents match what should go in that bag type.

Bag color meanings (generic recycling guidelines):
- Green bag: Compost/organic waste (food scraps, yard waste, organic matter)
- Blue bag: Recycling (plastics, metals, glass, paper, cardboard)
- White/Black bag: Landfill/general waste (non-recyclable items)

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
        
        import json
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

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
