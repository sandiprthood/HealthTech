// ========================================================
// GLOBAL STATE
// ========================================================

let map;

let routeLine;

let patientMarker;

let hospitalMarker;


let emergencyState = {

    patient: {

        lat: 18.5204,

        lng: 73.8567
    },

    severity: null,

    hospitals: [],

    selectedHospital: null,

    ambulance: null
};


// ========================================================
// INITIALIZE MAP
// ========================================================

function initMap() {

    map = L.map("map").setView(

        [
            18.5204,
            73.8567
        ],

        13
    );


    L.tileLayer(

        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

        {

            attribution:
                "&copy; OpenStreetMap contributors"
        }

    ).addTo(map);


    patientMarker = L.marker(

        [
            18.5204,
            73.8567
        ]

    )
        .addTo(map)

        .bindPopup(
            "🚨 Emergency Location"
        );
}


// ========================================================
// LOAD DASHBOARD
// ========================================================

async function loadDashboard() {

    const response =
        await fetch(
            "/api/dashboard"
        );


    const data =
        await response.json();


    document.getElementById(
        "activeEmergencies"
    ).textContent =
        data.stats.active_emergencies;


    document.getElementById(
        "availableAmbulances"
    ).textContent =
        data.stats.available_ambulances;


    document.getElementById(
        "connectedHospitals"
    ).textContent =
        data.stats.connected_hospitals;


    document.getElementById(
        "alertsSent"
    ).textContent =
        data.stats.alerts_sent;


    renderAlerts(
        data.alerts
    );
}


// ========================================================
// ALERT LOG
// ========================================================

function renderAlerts(alerts) {

    const area =
        document.getElementById(
            "alertLog"
        );


    if (!alerts.length) {

        area.innerHTML =
            '<div class="empty">No alerts yet.</div>';

        return;
    }


    area.innerHTML =
        alerts.map(

            alert => `

                <div class="alert-item">

                    <strong>
                        🔔 ${alert.id}
                        —
                        ${alert.hospital}
                    </strong>

                    <small>

                        Severity:
                        ${alert.severity}

                        |

                        Ambulance:
                        ${alert.ambulance}

                    </small>

                    <div>
                        ${alert.message}
                    </div>

                </div>

            `

        ).join("");
}


// ========================================================
// EMERGENCY FORM
// ========================================================

document
    .getElementById(
        "emergencyForm"
    )
    .addEventListener(

        "submit",

        async function(event) {

            event.preventDefault();


            // Get selected symptoms

            const symptoms = [

                ...document.querySelectorAll(
                    ".check input:checked"
                )

            ].map(

                input =>
                    input.value

            );


            // Prepare data

            const data = {

                patient_name:
                    document.getElementById(
                        "patientName"
                    ).value,

                age:
                    document.getElementById(
                        "age"
                    ).value,

                emergency_type:
                    document.getElementById(
                        "emergencyType"
                    ).value,

                symptoms:

                    symptoms,

                lat:
                    emergencyState.patient.lat,

                lng:
                    emergencyState.patient.lng
            };


            // Send to Flask

            const response =
                await fetch(

                    "/api/assess",

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify(
                                data
                            )
                    }
                );


            const result =
                await response.json();


            // Save result

            emergencyState.severity =
                result.severity;


            emergencyState.hospitals =
                result.hospitals;


            emergencyState.ambulance =
                result.ambulance;


            // Display AI result

            showSeverity(
                result.severity
            );


            // Display hospitals

            renderHospitals(
                result.hospitals
            );


            // Display ambulance

            renderAmbulance(
                result.ambulance
            );


            // Select first hospital

            if (
                result.hospitals.length
            ) {

                selectHospital(
                    result.hospitals[0]
                );
            }

        }
    );


// ========================================================
// SHOW SEVERITY
// ========================================================

function showSeverity(
    severity
) {

    document
        .getElementById(
            "emptyResult"
        )
        .classList
        .add(
            "hidden"
        );


    document
        .getElementById(
            "resultArea"
        )
        .classList
        .remove(
            "hidden"
        );


    const card =
        document.getElementById(
            "severityCard"
        );


    card.className =
        `severity-card severity-${severity.color}`;


    document.getElementById(
        "severityLevel"
    ).textContent =
        severity.level;


    document.getElementById(
        "severityScore"
    ).textContent =
        severity.score;


    const reasons =
        document.getElementById(
            "reasons"
        );


    if (
        severity.reasons.length
    ) {

        reasons.innerHTML =

            severity.reasons.map(

                reason =>
                    `<li>${reason}</li>`

            ).join("");

    } else {

        reasons.innerHTML =
            "<li>No high-risk factor detected.</li>";
    }
}


// ========================================================
// DISPLAY HOSPITALS
// ========================================================

function renderHospitals(
    hospitals
) {

    const list =
        document.getElementById(
            "hospitalList"
        );


    if (!hospitals.length) {

        list.innerHTML =
            '<div class="empty">No hospital found.</div>';

        return;
    }


    list.innerHTML =

        hospitals.map(

            (hospital, index) => `

                <div
                    class="hospital-card
                    ${index === 0 ? "selected" : ""}"

                    id="hospital-${hospital.id}"
                >

                    <div class="hospital-header">

                        <h3>
                            🏥
                            ${hospital.name}
                        </h3>

                        <span class="match">

                            ${Math.round(
                                hospital.recommendation_score
                            )}

                            match

                        </span>

                    </div>


                    <div class="hospital-meta">

                        <span class="meta">

                            📍
                            ${hospital.live_distance}
                            km

                        </span>


                        <span class="meta">

                            🛏
                            ${hospital.beds}
                            beds

                        </span>


                        <span class="meta">

                            ❤️ ICU:
                            ${hospital.icu}

                        </span>


                        ${
                            hospital.trauma

                            ? `
                                <span class="meta">
                                    🚑 Trauma
                                </span>
                              `

                            : ""
                        }


                        ${
                            hospital.cardiac

                            ? `
                                <span class="meta">
                                    ❤️ Cardiac
                                </span>
                              `

                            : ""
                        }

                    </div>


                    <button

                        class="select-hospital"

                        onclick='selectHospital(
                            ${JSON.stringify(hospital)}
                        )'

                    >

                        Select Hospital

                    </button>

                </div>
            `

        ).join("");
}


// ========================================================
// SELECT HOSPITAL
// ========================================================

async function selectHospital(
    hospital
) {

    emergencyState.selectedHospital =
        hospital;


    // Remove selected style

    document
        .querySelectorAll(
            ".hospital-card"
        )
        .forEach(

            card =>
                card.classList.remove(
                    "selected"
                )
        );


    // Add selected style

    const card =
        document.getElementById(
            `hospital-${hospital.id}`
        );


    if (card) {

        card.classList.add(
            "selected"
        );
    }


    // Remove old marker

    if (hospitalMarker) {

        hospitalMarker.remove();
    }


    // Add hospital marker

    hospitalMarker =
        L.marker(

            [
                hospital.lat,
                hospital.lng
            ]

        )
            .addTo(map)

            .bindPopup(
                `🏥 ${hospital.name}`
            )

            .openPopup();


    // Calculate route

    await calculateRoute(

        emergencyState.patient,

        {

            lat:
                hospital.lat,

            lng:
                hospital.lng
        }
    );
}


// ========================================================
// ROUTE
// ========================================================

async function calculateRoute(
    start,
    end
) {

    const response =
        await fetch(

            "/api/route",

            {

                method:
                    "POST",

                headers: {

                    "Content-Type":
                        "application/json"
                },

                body:

                    JSON.stringify({

                        start: [

                            start.lat,

                            start.lng
                        ],

                        end: [

                            end.lat,

                            end.lng
                        ]
                    })
            }
        );


    const data =
        await response.json();


    // Remove previous route

    if (routeLine) {

        routeLine.remove();
    }


    // Draw route

    routeLine =
        L.polyline(

            data.coordinates,

            {

                weight: 6
            }

        ).addTo(map);


    // Zoom route

    map.fitBounds(

        routeLine.getBounds(),

        {

            padding: [
                30,
                30
            ]
        }
    );


    // Route information

    document.getElementById(
        "routeInfo"
    ).textContent =

        `📍 ${data.distance_km} km
         •
         ⏱ ~${data.eta_minutes} min`;
}


// ========================================================
// AMBULANCE
// ========================================================

function renderAmbulance(
    ambulance
) {

    const area =
        document.getElementById(
            "ambulanceArea"
        );


    const alertButton =
        document.getElementById(
            "alertBtn"
        );


    if (!ambulance) {

        area.innerHTML = `

            <div class="empty">

                <div>
                    🚑
                </div>

                <p>
                    No available ambulance
                    in demo data.
                </p>

            </div>

        `;


        alertButton
            .classList
            .add(
                "hidden"
            );


        return;
    }


    area.innerHTML = `

        <div class="ambulance-card">

            <h3>
                🚑
                ${ambulance.id}
            </h3>

            <p>

                <b>Status:</b>

                <span class="on-route">

                    Available → Ready

                </span>

            </p>


            <p>

                <b>Location:</b>

                ${ambulance.lat.toFixed(4)},
                ${ambulance.lng.toFixed(4)}

            </p>


            <p>

                <b>Assignment:</b>

                Nearest available
                demo ambulance

            </p>

        </div>

    `;


    alertButton
        .classList
        .remove(
            "hidden"
        );
}


// ========================================================
// SEND HOSPITAL PRE-ALERT
// ========================================================

document
    .getElementById(
        "alertBtn"
    )
    .addEventListener(

        "click",

        async function() {

            const hospital =
                emergencyState.selectedHospital;


            const ambulance =
                emergencyState.ambulance;


            const severity =
                emergencyState.severity;


            if (
                !hospital ||
                !ambulance ||
                !severity
            ) {

                alert(
                    "Please assess an emergency first."
                );

                return;
            }


            const response =
                await fetch(

                    "/api/pre-alert",

                    {

                        method:
                            "POST",

                        headers: {

                            "Content-Type":
                                "application/json"
                        },

                        body:

                            JSON.stringify({

                                hospital:
                                    hospital.name,

                                ambulance:
                                    ambulance.id,

                                severity:
                                    severity.level,

                                message:

                                    `Incoming
                                    ${severity.level}
                                    emergency.
                                    Prepare emergency
                                    response team.`
                            })
                    }
                );


            const data =
                await response.json();


            const message =
                document.getElementById(
                    "alertMessage"
                );


            message.textContent =
                `✅ ${data.message}`;


            message
                .classList
                .remove(
                    "hidden"
                );


            // Refresh dashboard

            await loadDashboard();
        }
    );


// ========================================================
// DEMO LOCATION
// ========================================================

document
    .getElementById(
        "locationBtn"
    )
    .addEventListener(

        "click",

        function() {

            emergencyState.patient = {

                lat:
                    18.5204,

                lng:
                    73.8567
            };


            patientMarker.setLatLng(

                [

                    emergencyState.patient.lat,

                    emergencyState.patient.lng
                ]
            );


            map.setView(

                [

                    emergencyState.patient.lat,

                    emergencyState.patient.lng
                ],

                13
            );


            document.getElementById(
                "locationText"
            ).textContent =

                "Demo GPS location: Pune, Maharashtra";
        }
    );


// ========================================================
// START APPLICATION
// ========================================================

initMap();

loadDashboard();
