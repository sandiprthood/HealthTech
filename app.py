from flask import Flask, render_template, request, jsonify
from math import radians, sin, cos, sqrt, atan2

app = Flask(__name__)

# ============================================================
# DEMO HOSPITAL DATA
# ============================================================
# These are fictional/demo hospitals for the hackathon prototype.

HOSPITALS = [
    {
        "id": 1,
        "name": "CityCare Emergency Hospital",
        "lat": 18.5204,
        "lng": 73.8567,
        "beds": 18,
        "icu": 6,
        "trauma": True,
        "cardiac": True,
        "phone": "+91 90000 10001"
    },
    {
        "id": 2,
        "name": "Metro General Hospital",
        "lat": 18.5314,
        "lng": 73.8446,
        "beds": 25,
        "icu": 4,
        "trauma": True,
        "cardiac": False,
        "phone": "+91 90000 10002"
    },
    {
        "id": 3,
        "name": "LifeLine Multi-Speciality Hospital",
        "lat": 18.5074,
        "lng": 73.8077,
        "beds": 12,
        "icu": 8,
        "trauma": False,
        "cardiac": True,
        "phone": "+91 90000 10003"
    },
    {
        "id": 4,
        "name": "District Trauma Centre",
        "lat": 18.5642,
        "lng": 73.7769,
        "beds": 9,
        "icu": 3,
        "trauma": True,
        "cardiac": False,
        "phone": "+91 90000 10004"
    }
]


# ============================================================
# DEMO AMBULANCE DATA
# ============================================================

AMBULANCES = [
    {
        "id": "AMB-101",
        "status": "Available",
        "lat": 18.5260,
        "lng": 73.8500
    },
    {
        "id": "AMB-102",
        "status": "On Route",
        "lat": 18.5350,
        "lng": 73.8650
    },
    {
        "id": "AMB-103",
        "status": "Available",
        "lat": 18.5120,
        "lng": 73.8420
    },
    {
        "id": "AMB-104",
        "status": "At Hospital",
        "lat": 18.5500,
        "lng": 73.8300
    }
]


# ============================================================
# ALERT STORAGE
# ============================================================

ALERTS = []


# ============================================================
# DISTANCE CALCULATION
# ============================================================

def haversine(lat1, lon1, lat2, lon2):

    R = 6371

    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)

    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(dlon / 2) ** 2
    )

    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


# ============================================================
# AI EMERGENCY SEVERITY ASSESSMENT
# ============================================================

def assess_severity(data):

    score = 0
    reasons = []

    symptoms = set(data.get("symptoms", []))

    # Critical symptoms
    if "Unconscious" in symptoms:
        score += 5
        reasons.append("Unconsciousness reported")

    if "Severe bleeding" in symptoms:
        score += 5
        reasons.append("Severe bleeding reported")

    if "Breathing difficulty" in symptoms:
        score += 5
        reasons.append("Breathing difficulty reported")

    if "Seizure" in symptoms:
        score += 5
        reasons.append("Seizure reported")

    # High-risk symptoms
    if "Chest pain" in symptoms:
        score += 4
        reasons.append("Chest pain reported")

    if "Major injury" in symptoms:
        score += 4
        reasons.append("Major injury reported")

    # Moderate symptoms
    if "Burns" in symptoms:
        score += 3
        reasons.append("Burn injury reported")

    if "Fracture" in symptoms:
        score += 2
        reasons.append("Possible fracture reported")

    if "Minor injury" in symptoms:
        score += 1
        reasons.append("Minor injury reported")

    # Age factor
    try:
        age = int(data.get("age", 30))
    except:
        age = 30

    if age >= 65:
        score += 1
        reasons.append("Age 65+ increases priority")

    elif age < 5:
        score += 1
        reasons.append("Very young patient increases priority")

    # Severity level
    if score >= 8:

        level = "CRITICAL"
        color = "critical"

    elif score >= 5:

        level = "HIGH"
        color = "high"

    elif score >= 2:

        level = "MODERATE"
        color = "moderate"

    else:

        level = "LOW"
        color = "low"

    return {
        "score": score,
        "level": level,
        "color": color,
        "reasons": reasons
    }


# ============================================================
# HOSPITAL RECOMMENDATION ENGINE
# ============================================================

def recommend_hospitals(
    patient_lat,
    patient_lng,
    emergency_type,
    severity
):

    emergency_type = emergency_type.lower()

    results = []

    for hospital in HOSPITALS:

        distance = haversine(
            patient_lat,
            patient_lng,
            hospital["lat"],
            hospital["lng"]
        )

        # Base score
        score = 100 - distance * 5

        # Emergency type matching
        if emergency_type == "trauma":
            if hospital["trauma"]:
                score += 35

        if emergency_type == "cardiac":
            if hospital["cardiac"]:
                score += 35

        if emergency_type == "general":
            score += 10

        # ICU matching
        if severity == "CRITICAL":
            score += hospital["icu"] * 4

        elif severity == "HIGH":
            score += hospital["icu"] * 2

        # Bed availability
        if hospital["beds"] <= 0:
            score -= 100

        hospital_data = dict(hospital)

        hospital_data["live_distance"] = round(
            distance,
            2
        )

        hospital_data["recommendation_score"] = round(
            score,
            1
        )

        results.append(hospital_data)

    # Highest recommendation first
    results.sort(
        key=lambda x: x["recommendation_score"],
        reverse=True
    )

    return results


# ============================================================
# HOME PAGE
# ============================================================

@app.route("/")
def index():

    return render_template(
        "index.html"
    )


# ============================================================
# DASHBOARD API
# ============================================================

@app.route("/api/dashboard")
def dashboard():

    return jsonify({

        "hospitals": HOSPITALS,

        "ambulances": AMBULANCES,

        "alerts": ALERTS[-10:][::-1],

        "stats": {

            "active_emergencies":
                len(ALERTS),

            "available_ambulances":
                sum(
                    a["status"] == "Available"
                    for a in AMBULANCES
                ),

            "connected_hospitals":
                len(HOSPITALS),

            "alerts_sent":
                len(ALERTS)
        }
    })


# ============================================================
# EMERGENCY ASSESSMENT API
# ============================================================

@app.route(
    "/api/assess",
    methods=["POST"]
)
def assess():

    data = request.get_json(force=True)

    # AI severity
    severity = assess_severity(data)

    # Patient location
    patient_lat = float(
        data.get(
            "lat",
            18.5204
        )
    )

    patient_lng = float(
        data.get(
            "lng",
            73.8567
        )
    )

    emergency_type = data.get(
        "emergency_type",
        "General"
    )

    # Hospital recommendation
    hospitals = recommend_hospitals(
        patient_lat,
        patient_lng,
        emergency_type,
        severity["level"]
    )

    # Find nearest available ambulance
    available_ambulances = [
        ambulance
        for ambulance in AMBULANCES
        if ambulance["status"] == "Available"
    ]

    selected_ambulance = None

    if available_ambulances:

        selected_ambulance = min(
            available_ambulances,

            key=lambda ambulance:
            haversine(
                patient_lat,
                patient_lng,
                ambulance["lat"],
                ambulance["lng"]
            )
        )

    return jsonify({

        "severity": severity,

        "hospitals": hospitals,

        "ambulance": selected_ambulance,

        "patient": {

            "lat": patient_lat,

            "lng": patient_lng
        }
    })


# ============================================================
# HOSPITAL PRE-ALERT API
# ============================================================

@app.route(
    "/api/pre-alert",
    methods=["POST"]
)
def pre_alert():

    data = request.get_json(force=True)

    alert = {

        "id":
            f"ALERT-{1000 + len(ALERTS) + 1}",

        "hospital":
            data.get(
                "hospital",
                "Unknown Hospital"
            ),

        "severity":
            data.get(
                "severity",
                "HIGH"
            ),

        "ambulance":
            data.get(
                "ambulance",
                "AMB-101"
            ),

        "message":
            data.get(
                "message",
                "Incoming emergency patient."
            )
    }

    ALERTS.append(alert)

    # Change ambulance status
    ambulance_id = alert["ambulance"]

    for ambulance in AMBULANCES:

        if ambulance["id"] == ambulance_id:

            ambulance["status"] = "On Route"

    return jsonify({

        "success": True,

        "message":
            f"Pre-alert sent to {alert['hospital']}",

        "alert":
            alert
    })


# ============================================================
# ROUTE API
# ============================================================

@app.route(
    "/api/route",
    methods=["POST"]
)
def route():

    data = request.get_json(force=True)

    start = [
        float(data["start"][0]),
        float(data["start"][1])
    ]

    end = [
        float(data["end"][0]),
        float(data["end"][1])
    ]

    distance = haversine(
        start[0],
        start[1],
        end[0],
        end[1]
    )

    # Demo ETA
    eta = max(
        3,
        round(distance / 0.55)
    )

    # Demo route points
    middle_1 = [

        (start[0] + end[0]) / 2 + 0.003,

        (start[1] + end[1]) / 2 - 0.002
    ]

    middle_2 = [

        (start[0] + end[0]) / 2 - 0.002,

        (start[1] + end[1]) / 2 + 0.003
    ]

    coordinates = [

        start,

        middle_1,

        middle_2,

        end
    ]

    return jsonify({

        "distance_km":
            round(distance, 2),

        "eta_minutes":
            eta,

        "coordinates":
            coordinates,

        "note":
            "Demo ETA; live traffic routing can be connected later."
    })


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    app.run(
        debug=True
    )
  
