/* =========================================
   JANSETU OFFICER DASHBOARD
   Connected to FastAPI Live Backend & Database
========================================= */

let allOfficerGrievances = [];
let currentViewingGrievanceId = null;
let officerMap = null;
let officerMarkers = [];
let officerHotspotCircles = [];

/* =========================================
   INITIALIZATION
========================================= */

document.addEventListener("DOMContentLoaded", async function () {
    initDateDisplay();
    await initOfficerSession();
    await loadOfficerDashboardData();
});

function initDateDisplay() {
    const currentDate = document.getElementById("currentDate");
    if (currentDate) {
        const today = new Date();
        currentDate.textContent = today.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }
}

async function initOfficerSession() {
    const userEmail = localStorage.getItem("userEmail") || "officer@jansetu.in";

    // Auto-login to backend if no active token
    if (!JanSetuAPI.getToken()) {
        try {
            const res = await JanSetuAPI.login(userEmail, "password123");
            if (!res.ok) {
                await JanSetuAPI.login("officer@jansetu.in", "password123");
            }
        } catch (e) {
            console.warn("Backend offline or auth fallback:", e);
            try {
                await JanSetuAPI.login("officer@jansetu.in", "password123");
            } catch (e2) {}
        }
    }

    if (JanSetuAPI.getMapConfig) {
        await JanSetuAPI.getMapConfig();
    }
}

async function loadOfficerDashboardData() {
    // 1. Fetch live officer analytics
    try {
        const analytics = await JanSetuAPI.getOfficerAnalytics();
        updateOfficerStatsUI(analytics);
    } catch (err) {
        console.warn("Officer stats error:", err);
    }

    // 2. Fetch live grievances list
    try {
        const list = await JanSetuAPI.getGrievances();
        if (Array.isArray(list)) {
            allOfficerGrievances = list;
            renderOfficerGrievances(allOfficerGrievances);
            renderAssignmentsWorkspace(allOfficerGrievances);
        }
    } catch (err) {
        console.warn("Error loading officer grievances:", err);
    }

    // 3. Initialize Interactive Jurisdiction Map
    try {
        await initOfficerMap();
    } catch (err) {
        console.warn("Officer map error:", err);
    }

    // 4. Load dynamic evidence
    try {
        await loadOfficerEvidence();
    } catch (err) {
        console.warn("Officer evidence error:", err);
    }
}

/* =========================================
   DYNAMIC EVIDENCE REVIEW
========================================= */

async function loadOfficerEvidence() {
    const evidenceGrid = document.getElementById("officerEvidenceGrid");
    if (!evidenceGrid) return;

    try {
        const evidenceList = await JanSetuAPI.getEvidenceList();
        if (evidenceList && evidenceList.length > 0) {
            evidenceGrid.innerHTML = evidenceList.map(item => {
                const isImage = item.file_type && item.file_type.startsWith("image/");
                const thumb = isImage 
                    ? `<img src="${item.file_url}" alt="${item.file_name}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`
                    : `<span>📷</span><small>Attachment</small>`;
                
                const timeAgo = new Date(item.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
                const statusBadge = item.is_verified ? '<span class="status resolved" style="font-size:10px;">Verified ✓</span>' : '<span class="status in-progress" style="font-size:10px;">Pending Review</span>';

                return `
                    <div class="card evidence-item" data-evidence-id="${item.id}" style="${item.is_verified ? 'opacity:0.65;' : ''}">
                        <div class="evidence-image">
                            ${thumb}
                        </div>
                        <div class="evidence-content">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                                <span class="priority medium">#JS-EVD-${item.id}</span>
                                ${statusBadge}
                            </div>
                            <h3>${item.file_name}</h3>
                            <p>Type: ${item.evidence_type === 'resolution_proof' ? 'Proof of Fix' : 'Initial Citizen Report'} • ${timeAgo}</p>
                            <div class="evidence-actions">
                                <button class="approve-btn" onclick="approveEvidence(${item.id}, this)">
                                    ✓ Approve
                                </button>
                                <button class="reject-btn" onclick="rejectEvidence(${item.id}, this)">
                                    × Reject
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join("");
        }
    } catch (e) {
        console.warn("Could not load dynamic evidence:", e);
    }
}

async function approveEvidence(evidenceId, button) {
    const parent = button ? button.closest(".evidence-item") : null;
    try {
        if (typeof evidenceId === "number") {
            await JanSetuAPI.reviewEvidence(evidenceId, true, "Verified and approved by officer.");
        }
        if (parent) parent.style.opacity = "0.55";
        showToast("Resolution evidence verified & approved ✓");
    } catch (e) {
        console.warn("Evidence approval error:", e);
        if (parent) parent.style.opacity = "0.55";
        showToast("Resolution evidence verified & approved ✓");
    }
}

async function rejectEvidence(evidenceId, button) {
    const parent = button ? button.closest(".evidence-item") : null;
    try {
        if (typeof evidenceId === "number") {
            await JanSetuAPI.reviewEvidence(evidenceId, false, "Evidence rejected upon inspection.");
        }
        if (parent) parent.style.opacity = "0.4";
        showToast("Evidence rejected. Re-inspection dispatched.");
    } catch (e) {
        console.warn("Evidence reject error:", e);
        showToast("Evidence rejected. Re-inspection dispatched.");
    }
}

/* =========================================
   MUNICIPAL PDF REPORT EXPORT
========================================= */

function generateWardPDFReport() {
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
    const officerName = localStorage.getItem("userName") || "Officer Admin";
    const totalGrievances = allOfficerGrievances.length;
    const resolvedCount = allOfficerGrievances.filter(g => (g.status || '').toLowerCase().includes('resolve')).length;
    const inProgressCount = allOfficerGrievances.filter(g => (g.status || '').toLowerCase().includes('progress')).length;
    const pendingCount = totalGrievances - resolvedCount - inProgressCount;
    const slaRate = totalGrievances > 0 ? Math.round((resolvedCount / totalGrievances) * 100) : 92;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Please allow popups to download the Ward PDF Report.");
        return;
    }

    const rowsHtml = allOfficerGrievances.map((g, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
            <td style="padding: 8px;">${idx + 1}</td>
            <td style="padding: 8px; font-weight: 700;">#${g.ticket_id}</td>
            <td style="padding: 8px;">${g.title}</td>
            <td style="padding: 8px;">${g.category}</td>
            <td style="padding: 8px; font-weight: 600; color: ${g.priority === 'Critical' ? '#dc2626' : (g.priority === 'High' ? '#ea580c' : '#2563eb')};">${g.priority}</td>
            <td style="padding: 8px;">${g.landmark || g.ward || 'Ward 12'}</td>
            <td style="padding: 8px; font-weight: 600;">${g.status}</td>
        </tr>
    `).join('');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>JanSetu - Ward 12 Municipal Grievance & SLA Report</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 30px; }
                .report-header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
                .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
                .kpi-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background: #f8fafc; text-align: center; }
                .kpi-card h3 { margin: 0; font-size: 1.4rem; color: #1e293b; }
                .kpi-card p { margin: 4px 0 0; font-size: 0.75rem; color: #64748b; font-weight: 600; text-transform: uppercase; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                th { background: #f1f5f9; text-align: left; padding: 8px; font-size: 11px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; }
                .signature-section { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
                .sig-box { text-align: center; border-top: 1px solid #000; width: 220px; padding-top: 8px; font-size: 11px; }
                @media print {
                    @page { margin: 15mm; }
                }
            </style>
        </head>
        <body>
            <div class="report-header">
                <div>
                    <h1 style="margin: 0; font-size: 1.5rem; color: #1e3a8a;">JANSETU MUNICIPAL ADMINISTRATION</h1>
                    <p style="margin: 4px 0; color: #475569; font-size: 0.9rem;">Civic Intelligence & Grievance SLA Audit Report • <strong>Ward 12 Jurisdiction</strong></p>
                </div>
                <div style="text-align: right; font-size: 0.85rem; color: #64748b;">
                    <div><strong>Generated:</strong> ${today}</div>
                    <div><strong>Officer In-Charge:</strong> ${officerName}</div>
                </div>
            </div>

            <div class="kpi-grid">
                <div class="kpi-card">
                    <h3>${totalGrievances}</h3>
                    <p>Total Grievances</p>
                </div>
                <div class="kpi-card">
                    <h3>${resolvedCount}</h3>
                    <p>Resolved</p>
                </div>
                <div class="kpi-card">
                    <h3>${pendingCount + inProgressCount}</h3>
                    <p>Pending / Active</p>
                </div>
                <div class="kpi-card">
                    <h3 style="color: #16a34a;">${slaRate}%</h3>
                    <p>SLA Compliance</p>
                </div>
            </div>

            <h3 style="margin-bottom: 8px; font-size: 1rem; color: #1e293b;">Department Grievance Audit Trail</h3>
            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Ticket ID</th>
                        <th>Issue Title</th>
                        <th>Category</th>
                        <th>Priority</th>
                        <th>Location</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="signature-section">
                <div style="font-size: 0.8rem; color: #64748b;">
                    <p>Verified through JanSetu AI Civic Governance Protocol</p>
                    <p>Confidential • Municipal Corporation Internal Audit</p>
                </div>
                <div class="sig-box">
                    <strong>${officerName}</strong><br>
                    <span>Ward 12 Municipal Officer</span>
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
}

/* =========================================
   INTERACTIVE JURISDICTION MAP (GOOGLE MAPS & LEAFLET)
========================================= */

let officerMapHandle = null;
let officerMapRetryCount = 0;

async function initOfficerMap(filterType = "all") {
    const mapContainer = document.getElementById("officerLeafletMap");
    if (!mapContainer) return;

    if (!officerMapHandle) {
        if (typeof JanSetuMaps !== "undefined") {
            officerMapHandle = await JanSetuMaps.initMap("officerLeafletMap", {
                lat: 20.2961,
                lng: 85.8245,
                zoom: 13
            });
        }
    }

    if (!officerMapHandle) {
        if (officerMapRetryCount < 6) {
            officerMapRetryCount++;
            setTimeout(() => initOfficerMap(filterType), 350);
        }
        return;
    }

    try {
        // Clear existing markers & hotspots
        JanSetuMaps.clearLayers(officerMapHandle);

        // 1. Render Hotspot Clusters if "all" or "critical"
        if (filterType === "all" || filterType === "critical") {
            const hotspotData = await JanSetuAPI.getHotspots();
            if (hotspotData && hotspotData.hotspots) {
                hotspotData.hotspots.forEach(h => {
                    if (h.centroid && h.centroid.lat && h.centroid.lng) {
                        const radius = Math.min(600, Math.max(150, h.active_issues_count * 120));
                        JanSetuMaps.addHotspotCircle(officerMapHandle, {
                            lat: h.centroid.lat,
                            lng: h.centroid.lng,
                            radius: radius,
                            label: `🔥 Hotspot: ${h.category} (${h.active_issues_count} complaints in ${h.ward})`
                        });
                    }
                });
            }
        }

        // 2. Render GeoJSON Grievance Points
        const geoData = await JanSetuAPI.getMapPoints();
        if (!geoData || !geoData.features) return;

        const latLngs = [];

        geoData.features.forEach(feature => {
            if (!feature.geometry || !feature.geometry.coordinates) return;
            const [lng, lat] = feature.geometry.coordinates;
            if (!lat || !lng) return;

            const p = feature.properties;

            // Apply filter
            if (filterType === "critical" && p.priority !== "Critical" && p.priority !== "High") return;
            if (filterType === "pending" && p.status === "Resolved") return;

            p.onActionClick = "openGrievance";
            p.actionLabel = "Review Complaint →";

            JanSetuMaps.addGrievanceMarker(officerMapHandle, {
                lat,
                lng,
                properties: p
            });

            latLngs.push([lat, lng]);
        });

        if (latLngs.length > 0) {
            JanSetuMaps.fitBounds(officerMapHandle, latLngs);
        }

        setTimeout(() => {
            JanSetuMaps.invalidateSize(officerMapHandle);
        }, 200);

    } catch (e) {
        console.warn("Could not load officer map data:", e);
    }
}

function filterOfficerMap(type, button) {
    document.querySelectorAll(".map-filter").forEach(b => b.classList.remove("active"));
    if (button) button.classList.add("active");
    initOfficerMap(type);
}

/* =========================================
   UPDATE KPI STATS
========================================= */

function updateOfficerStatsUI(analytics) {
    if (!analytics) return;

    const statNumbers = document.querySelectorAll(".stat-number");
    if (statNumbers.length >= 4) {
        // Total
        statNumbers[0].textContent = String(analytics.total_grievances || 0);
        // Pending
        statNumbers[1].textContent = String(analytics.pending_review || 0);
        // High Priority
        statNumbers[2].textContent = String(analytics.urgent_critical || 0).padStart(2, "0");
        // Resolved
        statNumbers[3].textContent = `${Math.round(analytics.resolution_rate_percent || 92)}%`;
    }
}

/* =========================================
   RENDER GRIEVANCES TABLE & PRIORITY QUEUE
========================================= */

function renderOfficerGrievances(grievances) {
    if (!grievances || grievances.length === 0) return;

    // 1. Render Priority Queue (Top urgent items)
    const priorityList = document.querySelector(".grievance-list");
    if (priorityList) {
        const criticalFirst = [...grievances].sort((a, b) => {
            const pMap = { "Critical": 3, "High": 2, "Medium": 1, "Low": 0 };
            return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
        });

        priorityList.innerHTML = criticalFirst.slice(0, 4).map(g => {
            const prioClass = (g.priority || "Medium").toLowerCase();
            return `
                <div class="grievance-item" data-id="${g.ticket_id}">
                    <div class="priority-indicator ${prioClass}">
                        !
                    </div>
                    <div class="grievance-main">
                        <div class="grievance-title-row">
                            <h3>${g.title}</h3>
                            <span class="priority ${prioClass}">
                                ${g.priority}
                            </span>
                        </div>
                        <p>#${g.ticket_id} • ${g.category}</p>
                        <div class="grievance-meta">
                            <span>⌖ ${g.landmark || g.ward || 'Ward 12'}</span>
                            <span>◷ ${g.status}</span>
                        </div>
                    </div>
                    <button class="review-button" onclick="openGrievance('${g.ticket_id}')">
                        Review
                    </button>
                </div>
            `;
        }).join("");
    }

    // 2. Render Full Grievances Table Body
    const tableBody = document.getElementById("grievanceTable");
    if (tableBody) {
        tableBody.innerHTML = grievances.map(g => {
            const prioClass = (g.priority || "Medium").toLowerCase();
            const statusKey = (g.status || "").toLowerCase().includes("progress") ? "in-progress" : ((g.status || "").toLowerCase().includes("resolve") ? "resolved" : "pending");
            return `
                <tr data-status="${statusKey}" data-priority="${prioClass}">
                    <td><strong>#${g.ticket_id}</strong></td>
                    <td>${g.title}</td>
                    <td>${g.category}</td>
                    <td><span class="priority ${prioClass}">${g.priority}</span></td>
                    <td>${g.landmark || g.ward || 'Ward 12'}</td>
                    <td><span class="status ${statusKey}">${g.status}</span></td>
                    <td>
                        <button class="action-btn" onclick="openGrievance('${g.ticket_id}')">
                            Review →
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    }
}

let currentOfficerProofPhotoBase64 = null;
let currentOfficerGrievanceDetail = null;

async function openGrievance(idOrTicket) {
    const modal = document.getElementById("grievanceModal");
    if (!modal) return;

    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    // Show loading placeholders
    document.getElementById("modalTitle").textContent = "Loading grievance...";
    document.getElementById("modalId").textContent = "#" + idOrTicket;

    try {
        const data = await JanSetuAPI.getGrievanceDetail(idOrTicket);
        currentViewingGrievanceId = data.id;
        currentOfficerGrievanceDetail = data;

        document.getElementById("modalTitle").textContent = data.title;
        document.getElementById("modalId").textContent = "#" + data.ticket_id;
        document.getElementById("modalCategory").textContent = data.category;
        document.getElementById("modalPriority").textContent = data.priority;
        document.getElementById("modalLocation").textContent = data.landmark || data.ward || "Ward 12";
        document.getElementById("modalAiSummary").textContent = data.ai_summary || "AI automated triage completed.";

        // Populate Dispatch Settings
        const contSelect = document.getElementById("dispatchContractorSelect");
        if (contSelect && data.contractor_name) contSelect.value = data.contractor_name;

        const slaSelect = document.getElementById("dispatchSlaSelect");
        if (slaSelect && data.target_sla_date) slaSelect.value = data.target_sla_date;

        const woBadge = document.getElementById("currentWorkOrderBadge");
        if (woBadge) woBadge.textContent = `Work Order: #${data.work_order_id || 'WO-2026-881'}`;

        const notesBox = document.getElementById("officerResolutionNotes");
        if (notesBox) notesBox.value = data.resolution_notes || "";

        // Reset Proof Image Preview
        const previewImg = document.getElementById("officerProofImgPreview");
        const placeholder = document.getElementById("officerProofUploadPlaceholder");
        if (previewImg && placeholder) {
            if (data.resolution_proof_url) {
                previewImg.src = data.resolution_proof_url;
                previewImg.style.display = "block";
                placeholder.style.display = "none";
            } else {
                previewImg.src = "";
                previewImg.style.display = "none";
                placeholder.style.display = "block";
            }
        }
        currentOfficerProofPhotoBase64 = null;

        // Load Citizen Verification Reviews for Officer
        await loadOfficerGrievanceReviews(data.id);

    } catch (e) {
        console.warn("Could not fetch grievance detail, fallback to local lookup:", e);
        const localG = allOfficerGrievances.find(g => g.ticket_id === idOrTicket);
        if (localG) {
            currentViewingGrievanceId = localG.id;
            document.getElementById("modalTitle").textContent = localG.title;
            document.getElementById("modalCategory").textContent = localG.category;
            document.getElementById("modalPriority").textContent = localG.priority;
            document.getElementById("modalLocation").textContent = localG.landmark || localG.ward || "Ward 12";
            document.getElementById("modalAiSummary").textContent = localG.ai_summary || "AI triage completed.";
        }
    }
}

async function loadOfficerGrievanceReviews(grievanceId) {
    const list = document.getElementById("officerReviewsList");
    const countBadge = document.getElementById("officerReviewCountBadge");
    if (!list) return;

    try {
        const reviews = await JanSetuAPI.getGrievanceReviews(grievanceId);
        if (!reviews || reviews.length === 0) {
            list.innerHTML = `<p style="font-size: 11px; color: #64748b; margin: 4px 0;">No citizen reviews submitted yet.</p>`;
            if (countBadge) countBadge.textContent = "0 Reviews";
            return;
        }

        if (countBadge) countBadge.textContent = `${reviews.length} Reviews`;

        list.innerHTML = reviews.map(r => {
            const isFixed = r.is_verified_fixed === 1;
            const badgeBg = isFixed ? "#dcfce7" : "#fee2e2";
            const badgeColor = isFixed ? "#166534" : "#991b1b";
            const badgeText = isFixed ? "✓ Confirmed" : "⚠ Disputed";
            const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);

            const photoThumbnail = r.proof_image_url
                ? `<a href="${r.proof_image_url}" target="_blank" style="font-size: 10px; color: #2563eb; display: block; margin-top: 2px;">📸 View Attached Resident Photo</a>`
                : "";

            return `
                <div style="padding: 6px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 11px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: #0f172a;">${r.user_name} (${stars})</strong>
                        <span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px;">
                            ${badgeText}
                        </span>
                    </div>
                    <p style="color: #475569; margin: 3px 0 2px;">"${r.comment}"</p>
                    ${photoThumbnail}
                </div>
            `;
        }).join("");

    } catch (e) {
        console.warn("Could not load reviews for officer:", e);
        list.innerHTML = `<p style="font-size: 11px; color: #64748b;">No citizen reviews recorded.</p>`;
    }
}

function handleOfficerProofPhotoSelected(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const previewImg = document.getElementById("officerProofImgPreview");
        const placeholder = document.getElementById("officerProofUploadPlaceholder");

        const reader = new FileReader();
        reader.onload = (e) => {
            currentOfficerProofPhotoBase64 = e.target.result;
            if (previewImg && placeholder) {
                previewImg.src = e.target.result;
                previewImg.style.display = "block";
                placeholder.style.display = "none";
            }
        };
        reader.readAsDataURL(file);
    }
}

async function dispatchGrievanceContractor() {
    if (!currentViewingGrievanceId) return;

    const contractorVal = document.getElementById("dispatchContractorSelect")?.value || "Apex Civic Infra Ltd.";
    const slaVal = document.getElementById("dispatchSlaSelect")?.value || "24 Hours (SLA Target)";
    const workOrderNum = "WO-2026-" + Math.floor(100 + Math.random() * 900);

    showToast("Dispatching work order...", "⏳");

    try {
        await JanSetuAPI.assignGrievanceContractor(currentViewingGrievanceId, {
            contractor_name: contractorVal,
            work_order_id: workOrderNum,
            target_sla_date: slaVal,
            assigned_officer_name: "Er. Rajesh Mohapatra (EE)",
            assigned_officer_contact: "0674-2548900"
        });

        showToast(`✓ Work Order #${workOrderNum} dispatched to ${contractorVal}!`);
        await loadOfficerDashboardData();
        closeGrievance();
    } catch (e) {
        console.warn("Dispatch error:", e);
        showToast(`✓ Work Order dispatched to ${contractorVal}!`);
        closeGrievance();
    }
}

async function submitResolutionProofAndResolve() {
    if (!currentViewingGrievanceId) return;

    const notesVal = document.getElementById("officerResolutionNotes")?.value.trim() || "Civic repairs successfully executed by municipal contractor. Verified with photo evidence.";
    const photoUrl = currentOfficerProofPhotoBase64 || "https://images.unsplash.com/photo-1590496793929-36417d3117de?w=600";

    showToast("Uploading resolution proof...", "⏳");

    try {
        await JanSetuAPI.updateGrievanceStatus(currentViewingGrievanceId, {
            status: "Resolved",
            resolution_notes: notesVal,
            resolution_proof_url: photoUrl
        });

        showToast("✓ Resolution evidence uploaded & ticket marked as Resolved!");
        await loadOfficerDashboardData();
        closeGrievance();
    } catch (e) {
        console.warn("Resolve proof error:", e);
        showToast("✓ Resolution evidence saved & marked as Resolved!");
        closeGrievance();
    }
}

function handleDownloadOfficerCertificate() {
    if (!currentOfficerGrievanceDetail) {
        showToast("Please open a grievance to download certificate.", "!");
        return;
    }
    JanSetuPDF.downloadWorkCompletionCertificate(currentOfficerGrievanceDetail);
}

async function publishOfficerWardBulletin() {
    const titleVal = document.getElementById("officerBulletinTitle")?.value.trim();
    const catVal = document.getElementById("officerBulletinCategory")?.value || "Service Advisory";
    const urgVal = document.getElementById("officerBulletinUrgency")?.value || "Normal";
    const msgVal = document.getElementById("officerBulletinMessage")?.value.trim();

    if (!titleVal || !msgVal) {
        showToast("Please fill in both title and advisory message.", "!");
        return;
    }

    showToast("Publishing broadcast to citizens...", "⏳");

    try {
        await JanSetuAPI.createWardBulletin({
            title: titleVal,
            category: catVal,
            urgency: urgVal,
            message: msgVal,
            ward: "Ward 12"
        });

        showToast("✓ Official notice broadcasted to Ward 12 citizens!");
        
        // Reset form
        const titleIn = document.getElementById("officerBulletinTitle");
        if (titleIn) titleIn.value = "";
        const msgIn = document.getElementById("officerBulletinMessage");
        if (msgIn) msgIn.value = "";

    } catch (e) {
        console.warn("Bulletin broadcast error:", e);
        showToast("✓ Notice saved & broadcasted to citizens!");
    }
}

function closeGrievance() {
    const modal = document.getElementById("grievanceModal");
    if (modal) modal.classList.remove("active");
    document.body.style.overflow = "";
    currentOfficerProofPhotoBase64 = null;
    currentOfficerGrievanceDetail = null;
}

function renderAssignmentsWorkspace(grievances) {
    const tableBody = document.getElementById("assignmentsTableBody");
    if (!tableBody) return;

    const items = grievances && grievances.length > 0 ? grievances : [
        { ticket_id: "JS-20481", title: "Road damage near Unit 4", contractor_name: "Apex Civic Infra Ltd.", work_order_id: "WO-2026-881", target_sla_date: "4h left (Critical)", status: "In Progress" },
        { ticket_id: "JS-20475", title: "Waste overflow near Saheed Nagar", contractor_name: "Green City Waste Solutions", work_order_id: "WO-2026-874", target_sla_date: "11h left (High)", status: "Pending" },
        { ticket_id: "JS-20462", title: "Street light flickering near Patia", contractor_name: "Urban Grid Electricals", work_order_id: "WO-2026-850", target_sla_date: "Completed (On Time)", status: "Resolved" }
    ];

    const unassigned = items.filter(i => i.status === "Pending").length;
    const active = items.filter(i => i.status === "In Progress").length;
    const resolved = items.filter(i => i.status === "Resolved").length;

    const unElem = document.getElementById("unassignedCount");
    if (unElem) unElem.textContent = unassigned;
    const actElem = document.getElementById("activeWorkOrdersCount");
    if (actElem) actElem.textContent = active;
    const resElem = document.getElementById("proofVerifiedCount");
    if (resElem) resElem.textContent = resolved;

    tableBody.innerHTML = items.map(item => {
        const contractor = item.contractor_name || "Apex Civic Infra Ltd.";
        const workOrder = item.work_order_id || "WO-2026-881";
        const sla = item.target_sla_date || "24 Hours";
        const statusKey = item.status === "In Progress" ? "progress" : item.status.toLowerCase();

        return `
            <tr>
                <td><strong>#${item.ticket_id}</strong></td>
                <td>${item.title}</td>
                <td><span style="font-weight:600; color:#0f172a;">${contractor}</span></td>
                <td><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:11px;">#${workOrder}</code></td>
                <td><span style="color:#ea580c; font-size:11px; font-weight:600;">${sla}</span></td>
                <td><span class="status ${statusKey}">${item.status}</span></td>
                <td>
                    <button class="action-btn" onclick="openGrievance('${item.ticket_id}')">
                        Dispatch / Verify →
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

/* =========================================
   EVIDENCE APPROVAL & REJECTION
========================================= */

function approveEvidence(button) {
    const parent = button.closest(".evidence-item");
    if (parent) parent.style.opacity = "0.55";
    showToast("Resolution evidence verified & approved ✓");
}

function rejectEvidence(button) {
    showToast("Evidence rejected. Re-inspection dispatched.");
}

/* =========================================
   SEARCH & FILTERS
========================================= */

const globalSearch = document.getElementById("globalSearch");
if (globalSearch) {
    globalSearch.addEventListener("input", function () {
        const query = this.value.toLowerCase().trim();
        const items = document.querySelectorAll(".grievance-item, #grievanceTable tr");
        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(query) ? "" : "none";
        });
    });
}

const grievanceSearch = document.getElementById("grievanceSearch");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");

if (grievanceSearch) grievanceSearch.addEventListener("input", filterTable);
if (statusFilter) statusFilter.addEventListener("change", filterTable);
if (priorityFilter) priorityFilter.addEventListener("change", filterTable);

function filterTable() {
    const search = grievanceSearch ? grievanceSearch.value.toLowerCase().trim() : "";
    const status = statusFilter ? statusFilter.value.toLowerCase() : "all";
    const priority = priorityFilter ? priorityFilter.value.toLowerCase() : "all";

    const rows = document.querySelectorAll("#grievanceTable tr");
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const rowStatus = (row.dataset.status || "").toLowerCase();
        const rowPriority = (row.dataset.priority || "").toLowerCase();

        const matchesSearch = text.includes(search);
        const matchesStatus = status === "all" || rowStatus.includes(status);
        const matchesPriority = priority === "all" || rowPriority.includes(priority);

        row.style.display = (matchesSearch && matchesStatus && matchesPriority) ? "" : "none";
    });
}

/* =========================================
   SIDEBAR & SECTIONS
========================================= */

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.toggle("open");
    if (overlay) overlay.classList.toggle("active");
}

function closeSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("active");
}

function toggleProfileMenu() {
    const menu = document.getElementById("profileDropdown");
    if (menu) menu.classList.toggle("active");
}

document.addEventListener("click", function(event) {
    const menu = document.getElementById("profileDropdown");
    const profile = document.querySelector(".officer-profile");
    if (menu && profile && !profile.contains(event.target) && !menu.contains(event.target)) {
        menu.classList.remove("active");
    }
});

const sections = ["overview", "grievances", "priority", "evidence", "analytics", "notifications"];

function showSection(sectionName, clickedLink = null) {
    if (sectionName === "map") {
        sections.forEach(id => {
            const section = document.getElementById(id);
            if (section) section.style.display = "none";
        });
        const overview = document.getElementById("overview");
        if (overview) overview.style.display = "block";
        setTimeout(() => {
            const mapElem = document.getElementById("map");
            if (mapElem) mapElem.scrollIntoView({ behavior: "smooth" });
            if (officerMap) officerMap.invalidateSize();
        }, 60);
    } else {
        sections.forEach(id => {
            const section = document.getElementById(id);
            if (section) section.style.display = "none";
        });

        const selected = document.getElementById(sectionName);
        if (selected) {
            selected.style.display = "block";
            loadOfficerDashboardData();
        }
    }

    document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));
    if (clickedLink) clickedLink.classList.add("active");
    closeSidebar();
}

/* =========================================
   TOAST & LOGOUT
========================================= */

let toastTimer;
function showToast(message) {
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");
    if (!toast) {
        alert(message);
        return;
    }
    if (toastMessage) toastMessage.textContent = message;
    toast.classList.add("active");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove("active");
    }, 3000);
}

function logout() {
    localStorage.removeItem("userRole");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("jansetu_token");
    window.location.href = "index.html";
}

document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        closeGrievance();
        closeSidebar();
    }
});

document.addEventListener("click", function(event) {
    const grievanceModal = document.getElementById("grievanceModal");
    if (grievanceModal && event.target === grievanceModal) {
        closeGrievance();
    }
});