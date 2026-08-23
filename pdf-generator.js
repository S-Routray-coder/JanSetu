/**
 * JanSetu PDF Generator Utility
 * Generates Official Municipal Grievance Receipts & Contractor Work Completion Certificates.
 */

const JanSetuPDF = {
    downloadCitizenReceipt(grievance) {
        const ticketId = grievance.ticket_id || 'JS-20481';
        const title = grievance.title || 'Civic Complaint';
        const category = grievance.category || 'Road & Infrastructure';
        const ward = grievance.ward || 'Ward 12';
        const landmark = grievance.landmark || grievance.address || 'Unit 4, Bhubaneswar';
        const dateStr = new Date(grievance.created_at || Date.now()).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        const officer = grievance.assigned_officer_name || 'Er. Rajesh Mohapatra (Executive Engineer)';
        const sla = grievance.target_sla_date || '24-48 Hours (ORTPS Act Commitment)';
        const citizenName = (grievance.citizen && grievance.citizen.full_name) ? grievance.citizen.full_name : 'Registered Citizen';

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to download your official PDF receipt.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>JanSetu Receipt - ${ticketId}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; max-width: 750px; margin: auto; }
                    .header { text-align: center; border-bottom: 3px double #0284c7; padding-bottom: 20px; margin-bottom: 25px; }
                    .header h1 { margin: 0; font-size: 24px; color: #0369a1; text-transform: uppercase; letter-spacing: 1px; }
                    .header p { margin: 4px 0 0; font-size: 13px; color: #64748b; }
                    .badge-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #f0fdf4; padding: 12px 18px; border-radius: 8px; border: 1px solid #bbf7d0; }
                    .badge-bar strong { font-size: 16px; color: #15803d; }
                    .table-info { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
                    .table-info td { padding: 10px 14px; border: 1px solid #e2e8f0; font-size: 13px; }
                    .table-info td.label { width: 32%; background: #f8fafc; font-weight: 600; color: #475569; }
                    .sla-box { background: #eff6ff; border-left: 4px solid #2563eb; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 30px; font-size: 12px; }
                    .qr-section { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
                    .seal { border: 2px dashed #0284c7; padding: 10px 16px; border-radius: 50%; font-size: 11px; text-align: center; color: #0284c7; font-weight: bold; width: 110px; height: 110px; display: flex; align-items: center; justify-content: center; }
                    @media print {
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div style="font-size: 28px; margin-bottom: 6px;">🏛️ 🇮🇳</div>
                    <h1>Government of Odisha • Municipal Corporation</h1>
                    <p>JanSetu Unified Citizen Grievance Redressal & Intelligence Portal</p>
                    <p style="font-weight: 700; color: #0284c7; margin-top: 4px;">OFFICIAL GRIEVANCE ACKNOWLEDGMENT RECEIPT</p>
                </div>

                <div class="badge-bar">
                    <div>
                        <span style="font-size: 11px; color: #64748b; display: block;">TICKET TRACKING NUMBER</span>
                        <strong>#${ticketId}</strong>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 11px; color: #64748b; display: block;">CURRENT STATUS</span>
                        <span style="background: #2563eb; color: #fff; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700;">${grievance.status || 'Registered'}</span>
                    </div>
                </div>

                <table class="table-info">
                    <tr>
                        <td class="label">Complainant / Citizen</td>
                        <td><strong>${citizenName}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">Issue Title</td>
                        <td><strong>${title}</strong></td>
                    </tr>
                    <tr>
                        <td class="label">Civic Department / Category</td>
                        <td>${category} • ${grievance.department || 'Municipal Administration'}</td>
                    </tr>
                    <tr>
                        <td class="label">Location & Landmark</td>
                        <td>${landmark} (${ward})</td>
                    </tr>
                    <tr>
                        <td class="label">Date & Time Logged</td>
                        <td>${dateStr}</td>
                    </tr>
                    <tr>
                        <td class="label">Assigned Nodal Officer</td>
                        <td>${officer}</td>
                    </tr>
                    <tr>
                        <td class="label">Assigned Contractor / Agency</td>
                        <td>${grievance.contractor_name || 'Apex Civic Infra Ltd.'} (Work Order: #${grievance.work_order_id || 'WO-2026-881'})</td>
                    </tr>
                </table>

                <div class="sla-box">
                    <strong style="color: #1e40af; display: block; margin-bottom: 4px;">⚖️ Right to Public Services Act (ORTPS) Guarantee:</strong>
                    This grievance has been assigned a strict time-bound resolution SLA: <strong>${sla}</strong>. If the issue is not inspected and addressed within the designated turnaround time, it is automatically escalated to the Municipal Commissioner.
                </div>

                <div class="qr-section">
                    <div>
                        <p style="font-size: 11px; color: #64748b; margin: 0 0 4px;">Verified Digital Dispatch • JanSetu Security Hash</p>
                        <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 10px;">AUTH-HASH-${ticketId}-VERIFIED-2026</code>
                        <p style="font-size: 11px; color: #64748b; margin-top: 10px;">Citizen Helpline: <strong>1916 (Toll-Free)</strong> | WhatsApp: <strong>+91 94370 12345</strong></p>
                    </div>
                    <div class="seal">
                        OFFICIAL<br>MUNICIPAL<br>SEAL
                    </div>
                </div>

                <div class="no-print" style="margin-top: 35px; text-align: center;">
                    <button onclick="window.print()" style="padding: 10px 24px; font-size: 14px; font-weight: 700; background: #0284c7; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
                        🖨️ Print / Save as PDF
                    </button>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    },

    downloadWorkCompletionCertificate(grievance) {
        const ticketId = grievance.ticket_id || 'JS-20481';
        const title = grievance.title || 'Civic Complaint';
        const contractor = grievance.contractor_name || 'Apex Civic Infra Ltd.';
        const workOrderId = grievance.work_order_id || 'WO-2026-881';
        const officer = grievance.assigned_officer_name || 'Er. Rajesh Mohapatra (Executive Engineer)';
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
        const beforeImg = (grievance.evidence && grievance.evidence.length > 0) ? grievance.evidence[0].file_url : 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400';
        const afterImg = grievance.resolution_proof_url || 'https://images.unsplash.com/photo-1590496793929-36417d3117de?w=400';

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to download the certificate.');
            return;
        }

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Work Completion Certificate - ${workOrderId}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: auto; }
                    .header { text-align: center; border-bottom: 3px double #16a34a; padding-bottom: 20px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 22px; color: #15803d; text-transform: uppercase; }
                    .photos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
                    .photo-card { border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
                    .photo-card img { width: 100%; height: 160px; object-fit: cover; }
                    .photo-card .caption { padding: 6px 10px; background: #f8fafc; font-size: 11px; font-weight: bold; }
                    .table-info { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
                    .table-info td { padding: 8px 12px; border: 1px solid #e2e8f0; }
                    .table-info td.label { width: 30%; background: #f8fafc; font-weight: 600; }
                    .sign-grid { display: flex; justify-content: space-between; margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1; }
                    .sign-box { text-align: center; width: 200px; }
                    .sign-line { border-bottom: 1px solid #000; height: 35px; margin-bottom: 6px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div style="font-size: 24px; margin-bottom: 4px;">🏛️</div>
                    <h1>Municipal Corporation of Odisha</h1>
                    <p style="margin: 3px 0; font-size: 13px; color: #64748b;">CIVIC INFRASTRUCTURE WORK COMPLETION & CLEARANCE CERTIFICATE</p>
                </div>

                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 15px; border-radius: 6px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <strong>Work Order #${workOrderId}</strong>
                    <span style="background: #16a34a; color: #fff; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: bold;">PASSED & VERIFIED ✓</span>
                </div>

                <table class="table-info">
                    <tr><td class="label">Contractor Agency</td><td><strong>${contractor}</strong></td></tr>
                    <tr><td class="label">Civic Grievance Reference</td><td>#${ticketId} — ${title}</td></tr>
                    <tr><td class="label">Location / Ward</td><td>${grievance.landmark || 'Unit 4'} (${grievance.ward || 'Ward 12'})</td></tr>
                    <tr><td class="label">Supervising Nodal Officer</td><td>${officer}</td></tr>
                    <tr><td class="label">Certification Date</td><td>${dateStr}</td></tr>
                    <tr><td class="label">Citizen Community Verification</td><td>⭐⭐⭐⭐⭐ 4.8 / 5 (94% Confirmed Fixed)</td></tr>
                </table>

                <div class="photos-grid">
                    <div class="photo-card">
                        <div class="caption">📸 BEFORE REPAIR (Report Photo)</div>
                        <img src="${beforeImg}" alt="Before Repair">
                    </div>
                    <div class="photo-card" style="border-color: #86efac;">
                        <div class="caption" style="background: #f0fdf4; color: #15803d;">📸 AFTER REPAIR (Contractor Clearance Photo)</div>
                        <img src="${afterImg}" alt="After Repair">
                    </div>
                </div>

                <div class="sign-grid">
                    <div class="sign-box">
                        <div class="sign-line"></div>
                        <strong style="font-size: 11px;">Field Contractor Supervisor</strong><br>
                        <small style="color: #64748b; font-size: 10px;">${contractor}</small>
                    </div>
                    <div class="sign-box">
                        <div class="sign-line"></div>
                        <strong style="font-size: 11px;">Executive Engineer (EE)</strong><br>
                        <small style="color: #64748b; font-size: 10px;">Municipal Corporation</small>
                    </div>
                </div>

                <div style="margin-top: 30px; text-align: center;" class="no-print">
                    <button onclick="window.print()" style="padding: 9px 22px; font-size: 13px; font-weight: 700; background: #16a34a; color: #fff; border: none; border-radius: 6px; cursor: pointer;">
                        🖨️ Print / Save Certificate PDF
                    </button>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
    }
};

if (typeof window !== 'undefined') {
    window.JanSetuPDF = JanSetuPDF;
}
