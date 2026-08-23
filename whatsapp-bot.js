/**
 * JanSetu WhatsApp Civic Bot Assistant Widget (Advanced)
 * Photo attachments, voice notes, live location sharing, and instant PDF ticket receipts.
 */

(function() {
    // 1. Inject Styles for WhatsApp Widget
    const style = document.createElement('style');
    style.innerHTML = `
        .wa-floating-btn {
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 58px;
            height: 58px;
            background: #25D366;
            color: #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 8px 24px rgba(37, 211, 102, 0.4);
            cursor: pointer;
            z-index: 9999;
            transition: transform 0.25s, box-shadow 0.25s;
            border: none;
            outline: none;
        }
        .wa-floating-btn:hover {
            transform: scale(1.08);
            box-shadow: 0 12px 30px rgba(37, 211, 102, 0.55);
        }
        .wa-floating-btn svg {
            width: 32px;
            height: 32px;
            fill: #ffffff;
        }
        .wa-badge-pulse {
            position: absolute;
            top: -2px;
            right: -2px;
            width: 14px;
            height: 14px;
            background: #ef4444;
            border: 2px solid #ffffff;
            border-radius: 50%;
        }
        .wa-chat-window {
            position: fixed;
            bottom: 92px;
            right: 24px;
            width: 375px;
            max-width: calc(100vw - 32px);
            height: 540px;
            max-height: calc(100vh - 120px);
            background: #efeae2;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            display: none;
            flex-direction: column;
            overflow: hidden;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        }
        .wa-chat-window.active {
            display: flex;
        }
        .wa-header {
            background: #075E54;
            color: #ffffff;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .wa-header-info {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .wa-avatar {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        .wa-close-btn {
            background: none;
            border: none;
            color: #ffffff;
            font-size: 20px;
            cursor: pointer;
            padding: 4px;
        }
        .wa-messages {
            flex: 1;
            padding: 14px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 10px;
            background-image: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
            background-repeat: repeat;
        }
        .wa-msg {
            max-width: 84%;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.4;
            position: relative;
            word-wrap: break-word;
            box-shadow: 0 1px 2px rgba(0,0,0,0.13);
        }
        .wa-msg.bot {
            align-self: flex-start;
            background: #ffffff;
            color: #111b21;
            border-top-left-radius: 2px;
        }
        .wa-msg.user {
            align-self: flex-end;
            background: #d9fdd3;
            color: #111b21;
            border-top-right-radius: 2px;
        }
        .wa-time {
            font-size: 9px;
            color: #667781;
            float: right;
            margin-left: 8px;
            margin-top: 4px;
        }
        .wa-chips {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            padding: 8px 12px;
            background: #f0f2f5;
            scrollbar-width: none;
        }
        .wa-chip {
            white-space: nowrap;
            background: #ffffff;
            color: #075E54;
            border: 1px solid #cbd5e1;
            border-radius: 14px;
            padding: 5px 10px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .wa-chip:hover {
            background: #075E54;
            color: #ffffff;
        }
        .wa-input-bar {
            background: #f0f2f5;
            padding: 8px 10px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .wa-input {
            flex: 1;
            border: none;
            background: #ffffff;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 13px;
            outline: none;
            font-family: inherit;
        }
        .wa-icon-btn {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            padding: 4px;
            color: #54656f;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
        }
        .wa-icon-btn:hover {
            background: #e2e8f0;
        }
        .wa-send-btn {
            background: #00a884;
            color: #ffffff;
            border: none;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
        }
        .wa-voice-bubble {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 0;
        }
        .wa-voice-play {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #00a884;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            cursor: pointer;
        }
        .wa-waveform {
            font-family: monospace;
            letter-spacing: 1px;
            color: #54656f;
            font-size: 12px;
        }
    `;
    document.head.appendChild(style);

    // 2. Inject HTML for Floating Trigger & Chat Window
    const container = document.createElement('div');
    container.id = 'jansetuWhatsAppBotRoot';
    container.innerHTML = `
        <button class="wa-floating-btn" id="waOpenBtn" title="Chat with JanSetu on WhatsApp">
            <svg viewBox="0 0 24 24">
                <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 6.46 17.5 2 12.04 2M12.05 3.67C16.57 3.67 20.24 7.34 20.24 11.86C20.24 16.38 16.57 20.05 12.05 20.05C10.55 20.05 9.12 19.64 7.89 18.91L7.59 18.73L4.47 19.55L5.31 16.5L5.11 16.18C4.31 14.9 3.89 13.4 3.89 11.86C3.89 7.34 7.56 3.67 12.05 3.67M9.07 7.74C8.91 7.74 8.65 7.8 8.44 8.03C8.23 8.26 7.64 8.81 7.64 9.94C7.64 11.07 8.46 12.16 8.58 12.32C8.7 12.48 10.2 14.78 12.49 15.77C13.04 16 13.46 16.14 13.79 16.25C14.34 16.42 14.84 16.4 15.23 16.34C15.68 16.27 16.61 15.77 16.8 15.23C17 14.68 17 14.22 16.94 14.12C16.88 14.03 16.72 13.97 16.48 13.85C16.24 13.73 15.06 13.15 14.84 13.07C14.62 12.99 14.46 12.95 14.3 13.19C14.14 13.43 13.68 13.97 13.54 14.13C13.4 14.29 13.26 14.31 13.02 14.19C12.78 14.07 12.01 13.82 11.09 13C10.37 12.36 9.88 11.57 9.74 11.33C9.6 11.09 9.72 10.96 9.84 10.84C9.95 10.73 10.09 10.55 10.21 10.41C10.33 10.27 10.37 10.17 10.45 10.01C10.53 9.85 10.49 9.71 10.43 9.59C10.37 9.47 9.91 8.33 9.72 7.87C9.53 7.42 9.34 7.48 9.19 7.47L9.07 7.74Z"/>
            </svg>
            <div class="wa-badge-pulse"></div>
        </button>

        <div class="wa-chat-window" id="waChatWindow">
            <div class="wa-header">
                <div class="wa-header-info">
                    <div class="wa-avatar">🏛️</div>
                    <div>
                        <strong style="font-size: 14px; display: block;">JanSetu Civic AI Assistant</strong>
                        <small style="font-size: 10px; color: #a7f3d0;">● Verified Municipal Bot</small>
                    </div>
                </div>
                <button class="wa-close-btn" id="waCloseBtn">✕</button>
            </div>

            <div class="wa-messages" id="waMessages">
                <div class="wa-msg bot">
                    🙏 <strong>Namaste!</strong> Welcome to JanSetu WhatsApp Civic Helpline.
                    <br><br>
                    You can report potholes, broken lights, waste dumps, or share live photos and GPS location to register complaints instantly.
                    <span class="wa-time">Just now</span>
                </div>
            </div>

            <div class="wa-chips">
                <span class="wa-chip" onclick="JanSetuWhatsApp.sendQuick('🚧 Report large pothole on Market Road')">🚧 Pothole</span>
                <span class="wa-chip" onclick="JanSetuWhatsApp.sendQuick('💡 Streetlight dark near Sector 5')">💡 Street Light</span>
                <span class="wa-chip" onclick="JanSetuWhatsApp.sendQuick('🗑️ Garbage overflow at Unit 4 market')">🗑️ Garbage</span>
                <span class="wa-chip" onclick="JanSetuWhatsApp.sendLiveLocation()">📍 Share GPS</span>
                <span class="wa-chip" onclick="JanSetuWhatsApp.sendVoiceNote()">🎙️ Voice Note</span>
                <span class="wa-chip" onclick="JanSetuWhatsApp.sendQuick('🔍 Track Status #JS-20481')">🔍 Track</span>
            </div>

            <div class="wa-input-bar">
                <label class="wa-icon-btn" title="Attach Photo Proof">
                    📷
                    <input type="file" id="waPhotoUpload" accept="image/*" style="display: none;" onchange="JanSetuWhatsApp.handlePhotoUpload(this)">
                </label>
                <button class="wa-icon-btn" title="Send Voice Note" onclick="JanSetuWhatsApp.sendVoiceNote()">🎙️</button>
                <button class="wa-icon-btn" title="Share Live Location" onclick="JanSetuWhatsApp.sendLiveLocation()">📍</button>
                <input type="text" class="wa-input" id="waInput" placeholder="Type an issue or landmark..." onkeypress="if(event.key==='Enter') JanSetuWhatsApp.sendMsg()">
                <button class="wa-send-btn" onclick="JanSetuWhatsApp.sendMsg()">➤</button>
            </div>
        </div>
    `;
    document.body.appendChild(container);

    // 3. Event Listeners
    const openBtn = document.getElementById('waOpenBtn');
    const closeBtn = document.getElementById('waCloseBtn');
    const chatWin = document.getElementById('waChatWindow');

    if (openBtn && chatWin) {
        openBtn.addEventListener('click', () => {
            chatWin.classList.toggle('active');
        });
    }
    if (closeBtn && chatWin) {
        closeBtn.addEventListener('click', () => {
            chatWin.classList.remove('active');
        });
    }

    // 4. WhatsApp Chat Bot Controller
    window.JanSetuWhatsApp = {
        sendQuick(text) {
            const input = document.getElementById('waInput');
            if (input) {
                input.value = text;
                this.sendMsg();
            }
        },

        handlePhotoUpload(input) {
            if (input.files && input.files[0]) {
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.sendUserPhotoMessage(e.target.result, file.name);
                };
                reader.readAsDataURL(file);
                input.value = '';
            }
        },

        sendUserPhotoMessage(base64Data, fileName) {
            const messages = document.getElementById('waMessages');
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const userMsg = document.createElement('div');
            userMsg.className = 'wa-msg user';
            userMsg.innerHTML = `
                <div style="margin-bottom: 4px;">
                    <img src="${base64Data}" style="width: 100%; max-height: 140px; object-fit: cover; border-radius: 6px;">
                </div>
                <span>📸 Attached: ${fileName}</span>
                <span class="wa-time">${now} ✓✓</span>
            `;
            messages.appendChild(userMsg);
            messages.scrollTop = messages.scrollHeight;

            this.processBotResponse('Photo uploaded: Civic damage inspection requested.');
        },

        sendVoiceNote() {
            const messages = document.getElementById('waMessages');
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const userMsg = document.createElement('div');
            userMsg.className = 'wa-msg user';
            userMsg.innerHTML = `
                <div class="wa-voice-bubble">
                    <div class="wa-voice-play" onclick="JanSetuAPI.speakText('There is a major water pipeline leakage near Unit 4 market road', 'en')">▶</div>
                    <div class="wa-waveform">ılılllııılıllı</div>
                    <span style="font-size: 11px; color: #54656f;">0:06</span>
                </div>
                <div style="font-size: 11px; color: #166534; margin-top: 3px;">🎙️ <em>Transcribing: "Major water pipeline leakage near Unit 4 market road"</em></div>
                <span class="wa-time">${now} ✓✓</span>
            `;
            messages.appendChild(userMsg);
            messages.scrollTop = messages.scrollHeight;

            this.processBotResponse('Water pipeline leakage near Unit 4');
        },

        sendLiveLocation() {
            const messages = document.getElementById('waMessages');
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const userMsg = document.createElement('div');
            userMsg.className = 'wa-msg user';
            userMsg.innerHTML = `
                <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; margin-bottom: 4px;">
                    <strong style="color: #0284c7; font-size: 12px; display: block;">📍 Live GPS Location Shared</strong>
                    <div style="font-size: 11px; color: #475569;">20.2742° N, 85.8324° E (Ward 12, Unit 4)</div>
                </div>
                <span class="wa-time">${now} ✓✓</span>
            `;
            messages.appendChild(userMsg);
            messages.scrollTop = messages.scrollHeight;

            this.processBotResponse('Location locked: Unit 4 Market, Ward 12');
        },

        async sendMsg() {
            const input = document.getElementById('waInput');
            const messages = document.getElementById('waMessages');
            if (!input || !messages) return;

            const text = input.value.trim();
            if (!text) return;

            input.value = '';

            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const userMsg = document.createElement('div');
            userMsg.className = 'wa-msg user';
            userMsg.innerHTML = `${text} <span class="wa-time">${now} ✓✓</span>`;
            messages.appendChild(userMsg);
            messages.scrollTop = messages.scrollHeight;

            this.processBotResponse(text);
        },

        processBotResponse(text) {
            const messages = document.getElementById('waMessages');
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const typing = document.createElement('div');
            typing.className = 'wa-msg bot';
            typing.id = 'waTyping';
            typing.innerHTML = '<em>JanSetu AI is analyzing & routing...</em>';
            messages.appendChild(typing);
            messages.scrollTop = messages.scrollHeight;

            setTimeout(async () => {
                const typingElem = document.getElementById('waTyping');
                if (typingElem) typingElem.remove();

                const botMsg = document.createElement('div');
                botMsg.className = 'wa-msg bot';

                const lower = text.toLowerCase();

                if (lower.includes('track') || lower.includes('status') || lower.includes('js-')) {
                    botMsg.innerHTML = `
                        📋 <strong>Ticket #JS-20481 Status:</strong><br>
                        • <strong>Department:</strong> Roads & Infrastructure<br>
                        • <strong>Status:</strong> <span style="color:#2563eb; font-weight:bold;">In Progress</span><br>
                        • <strong>Assigned Contractor:</strong> Apex Civic Infra Ltd.<br>
                        • <strong>SLA Target:</strong> 24 Hours<br><br>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button onclick="JanSetuPDF.downloadCitizenReceipt({ticket_id: 'JS-20481', title: 'Road damage near Unit 4', category: 'Road & Infrastructure', status: 'In Progress', ward: 'Ward 12' })" style="background:#0284c7; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">📥 Download PDF</button>
                            <a href="citizendashboard.html" style="background:#f1f5f9; color:#0f172a; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; text-decoration:none; border:1px solid #cbd5e1;">Open Dashboard →</a>
                        </div>
                        <span class="wa-time">${now}</span>
                    `;
                } else {
                    let category = 'Road & Infrastructure';
                    if (lower.includes('light') || lower.includes('dark')) category = 'Street Lighting';
                    if (lower.includes('waste') || lower.includes('garbage')) category = 'Waste Management';
                    if (lower.includes('water') || lower.includes('drain') || lower.includes('pipe')) category = 'Water Supply';

                    const randomNum = Math.floor(20000 + Math.random() * 80000);
                    const ticket = 'JS-' + randomNum;

                    botMsg.innerHTML = `
                        ✅ <strong>Grievance Registered Successfully!</strong><br><br>
                        • <strong>Ticket ID:</strong> <code>#${ticket}</code><br>
                        • <strong>Category:</strong> ${category}<br>
                        • <strong>AI Priority:</strong> High (Auto-triaged)<br>
                        • <strong>Assigned Nodal Officer:</strong> Er. Rajesh Mohapatra<br>
                        • <strong>SLA Commitment:</strong> 24 Hours<br><br>
                        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                            <button onclick="JanSetuPDF.downloadCitizenReceipt({ticket_id: '${ticket}', title: '${text.substring(0, 35)}...', category: '${category}', status: 'Pending', ward: 'Ward 12' })" style="background:#16a34a; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">📥 Download PDF Receipt</button>
                            <a href="citizendashboard.html" style="background:#f1f5f9; color:#0f172a; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; text-decoration:none; border:1px solid #cbd5e1;">Track on Web →</a>
                        </div>
                        <span class="wa-time">${now}</span>
                    `;
                }

                messages.appendChild(botMsg);
                messages.scrollTop = messages.scrollHeight;
            }, 800);
        }
    };
})();
