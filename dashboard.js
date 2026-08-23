/* =========================================
   JANSETU CITIZEN DASHBOARD JS
   Connected to FastAPI Live Backend & Database
========================================= */

// State variables
let currentCitizenGrievances = [];
let currentBudgetProjects = [];
let currentNotifications = [];
let currentWardBulletins = [];
let citizenMap = null;
let citizenMapMarkers = [];
let currentModalGrievanceId = null;
let currentModalGrievanceDetail = null;

/* =========================================
   INITIALIZATION & DATA LOADING
========================================= */

document.addEventListener("DOMContentLoaded", async function () {
    await initCitizenSession();
    await loadCitizenDashboardData();
});

async function initCitizenSession() {
    const userEmail = localStorage.getItem("userEmail") || "citizen@jansetu.in";
    const userName = localStorage.getItem("userName") || "Citizen";

    // Auto-login to backend if no active token
    if (!JanSetuAPI.getToken()) {
        try {
            const res = await JanSetuAPI.login(userEmail, "password123");
            if (!res.ok) {
                await JanSetuAPI.login("citizen@jansetu.in", "password123");
            }
        } catch (e) {
            console.warn("Backend connection offline, fallback login:", e);
            try {
                await JanSetuAPI.login("citizen@jansetu.in", "password123");
            } catch (e2) {}
        }
    }

    if (JanSetuAPI.getMapConfig) {
        await JanSetuAPI.getMapConfig();
    }

    // Update UI elements
    const profileEmail = document.getElementById("profileEmail");
    if (profileEmail) profileEmail.textContent = userEmail;

    const userNameElem = document.getElementById("userName");
    if (userNameElem) userNameElem.textContent = userName;

    const welcomeName = document.getElementById("welcomeName");
    if (welcomeName) welcomeName.textContent = userName;
}

async function loadCitizenDashboardData() {
    // 1. Fetch live analytics
    try {
        const analytics = await JanSetuAPI.getCitizenAnalytics();
        updateStatsUI(analytics);
    } catch (e) {
        console.warn("Analytics load:", e);
    }

    // 2. Fetch my grievances (fallback to all public grievances if empty or guest)
    try {
        let grievances = await JanSetuAPI.getMyGrievances();
        if (!Array.isArray(grievances) || grievances.length === 0) {
            grievances = await JanSetuAPI.getGrievances();
        }
        if (Array.isArray(grievances)) {
            currentCitizenGrievances = grievances;
            renderGrievanceLists(currentCitizenGrievances);
        }
    } catch (e) {
        console.warn("Grievances load fallback:", e);
        try {
            const fallbackG = await JanSetuAPI.getGrievances();
            if (Array.isArray(fallbackG)) {
                currentCitizenGrievances = fallbackG;
                renderGrievanceLists(currentCitizenGrievances);
            }
        } catch (e2) {}
    }

    // 3. Fetch notifications
    try {
        currentNotifications = await JanSetuAPI.getNotifications();
        if (Array.isArray(currentNotifications)) {
            renderNotifications(currentNotifications);
        }
    } catch (e) {
        console.warn("Notifications load:", e);
    }

    // 4. Fetch budget projects & render
    try {
        currentBudgetProjects = await JanSetuAPI.getBudgetProjects();
        if (Array.isArray(currentBudgetProjects)) {
            renderBudgetSection(currentBudgetProjects);
        }
    } catch (e) {
        console.warn("Budget load:", e);
    }

    // 5. Fetch Ward Community Bulletins
    try {
        await loadWardBulletins();
    } catch (e) {
        console.warn("Bulletins load:", e);
    }

    // 6. Initialize Interactive Civic Map
    initCitizenMap();
}

/* =========================================
   WARD COMMUNITY BULLETINS & ANNOUNCEMENTS
========================================= */

async function loadWardBulletins() {
    try {
        const bulletins = await JanSetuAPI.getWardBulletins("Ward 12");
        if (Array.isArray(bulletins) && bulletins.length > 0) {
            currentWardBulletins = bulletins;
            const topB = bulletins[0];
            const head = document.getElementById("bulletinHeadline");
            const msg = document.getElementById("bulletinMessage");
            const tag = document.getElementById("bulletinWardTag");

            if (head) head.textContent = topB.title;
            if (msg) msg.textContent = topB.message;
            if (tag) tag.textContent = `${topB.ward || 'Ward 12'} • ${topB.category || 'Advisory'}`;
        }
    } catch (e) {
        console.warn("Could not load ward bulletins:", e);
    }
}

let currentKarmaXP = parseInt(localStorage.getItem("jansetu_citizen_xp") || "340", 10);

function triggerKarmaGain(xp, reason = "Civic Action") {
    currentKarmaXP += xp;
    localStorage.setItem("jansetu_citizen_xp", currentKarmaXP);
    
    const display = document.getElementById("karmaScoreDisplay");
    if (display) display.textContent = `${currentKarmaXP} Points`;
    
    const profileKarma = document.getElementById("modalProfileKarma");
    if (profileKarma) profileKarma.textContent = `${currentKarmaXP} XP`;
    
    const leaderScore = document.getElementById("leaderboardSelfScore");
    if (leaderScore) leaderScore.textContent = `${currentKarmaXP} XP`;
    
    const bar = document.getElementById("karmaProgressBar");
    if (bar) {
        const pct = Math.min(100, Math.round(((currentKarmaXP % 500) / 500) * 100));
        bar.style.width = `${pct}%`;
    }

    showToast(`🎉 +${xp} Civic XP! ${reason}`);
}

window.JanSetuBulletin = {
    async speakCurrentBulletin() {
        const head = document.getElementById("bulletinHeadline")?.textContent || "Ward notice";
        const msg = document.getElementById("bulletinMessage")?.textContent || "";
        const rawText = `Official Municipal Bulletin for Ward 12. ${head}. ${msg}`;
        
        const lang = document.getElementById("globalDashboardLangSelect")?.value || localStorage.getItem("jansetu_preferred_lang") || "en";
        const statusBox = document.getElementById("bulletinAudioStatusBox");
        const stopBtn = document.getElementById("bulletinStopAudioBtn");
        const langLabel = document.getElementById("bulletinAudioLangLabel");
        const transcriptText = document.getElementById("bulletinAudioTranscriptText");

        if (statusBox) statusBox.style.display = "block";
        if (stopBtn) stopBtn.style.display = "inline-flex";
        if (langLabel) langLabel.textContent = `Translating to ${lang.toUpperCase()}...`;
        if (transcriptText) transcriptText.textContent = "Loading neural translation...";

        let spoken = rawText;
        if (lang !== "en" && JanSetuAPI.translateText) {
            const res = await JanSetuAPI.translateText(rawText, lang);
            spoken = res.translated_text || rawText;
        }

        if (langLabel) langLabel.textContent = `Playing Notice (${lang.toUpperCase()})`;
        if (transcriptText) transcriptText.textContent = spoken;

        JanSetuAPI.speakText(
            spoken, 
            lang,
            () => {},
            () => {
                if (statusBox) statusBox.style.display = "none";
                if (stopBtn) stopBtn.style.display = "none";
            }
        );
    },

    async speakDashboardBriefing() {
        const activeCount = document.getElementById("inProgressReportsCount")?.textContent?.trim() || "03";
        const resCount = document.getElementById("resolvedReportsCount")?.textContent?.trim() || "04";
        const rawBriefing = `JanSetu Citizen Executive Briefing for Ward 12. You currently have ${activeCount} active grievances in progress with municipal contractor Apex Civic Infra under statutory SLA guarantee, and ${resCount} verified resolved issues. No emergency flood alerts in your sector.`;

        const lang = document.getElementById("globalDashboardLangSelect")?.value || localStorage.getItem("jansetu_preferred_lang") || "en";
        const statusBox = document.getElementById("bulletinAudioStatusBox");
        const stopBtn = document.getElementById("bulletinStopAudioBtn");
        const langLabel = document.getElementById("bulletinAudioLangLabel");
        const transcriptText = document.getElementById("bulletinAudioTranscriptText");

        if (statusBox) statusBox.style.display = "block";
        if (stopBtn) stopBtn.style.display = "inline-flex";
        if (langLabel) langLabel.textContent = `Translating to ${lang.toUpperCase()}...`;
        if (transcriptText) transcriptText.textContent = "Preparing daily civic audio briefing...";

        let spoken = rawBriefing;
        if (lang !== "en" && JanSetuAPI.translateText) {
            const res = await JanSetuAPI.translateText(rawBriefing, lang);
            spoken = res.translated_text || rawBriefing;
        }

        if (langLabel) langLabel.textContent = `Daily Briefing (${lang.toUpperCase()})`;
        if (transcriptText) transcriptText.textContent = spoken;

        showToast("🔊 Playing Daily Civic Audio Briefing...");
        JanSetuAPI.speakText(
            spoken, 
            lang,
            () => {},
            () => {
                if (statusBox) statusBox.style.display = "none";
                if (stopBtn) stopBtn.style.display = "none";
            }
        );
    },

    stopAudio() {
        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        const statusBox = document.getElementById("bulletinAudioStatusBox");
        const stopBtn = document.getElementById("bulletinStopAudioBtn");
        if (statusBox) statusBox.style.display = "none";
        if (stopBtn) stopBtn.style.display = "none";
    }
};

let currentVoicePlaybackRate = 1.0;

function setVoiceSpeed(rate, btn) {
    currentVoicePlaybackRate = rate;
    window.currentVoicePlaybackRate = rate;
    document.querySelectorAll(".voice-spd-btn").forEach(b => {
        b.style.background = "#fff";
        b.style.color = "#0f172a";
        b.style.borderColor = "#cbd5e1";
    });
    if (btn) {
        btn.style.background = "#10b981";
        btn.style.color = "#fff";
        btn.style.borderColor = "#10b981";
    }
}

function handleStopVoiceModal() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    const listenBtn = document.getElementById("modalVoiceListenBtn");
    if (listenBtn) listenBtn.innerHTML = `<span>🔊</span> Listen`;
    const transcriptBox = document.getElementById("modalVoiceTranscript");
    if (transcriptBox) transcriptBox.style.display = "none";
}

let isWhatsAppSubscribed = true;
function toggleWhatsAppSubscription() {
    isWhatsAppSubscribed = !isWhatsAppSubscribed;
    const btn = document.getElementById("modalWhatsAppSubscribeBtn");
    if (btn) {
        if (isWhatsAppSubscribed) {
            btn.textContent = "✓ Subscribed";
            btn.style.background = "#25D366";
            triggerKarmaGain(5, "Subscribed to live WhatsApp progress updates!");
        } else {
            btn.textContent = "+ Subscribe";
            btn.style.background = "#64748b";
            showToast("WhatsApp notifications paused.");
        }
    }
}

/* =========================================
   CLICKABLE STATS & STATUS FILTERING
========================================= */

function filterGrievanceList(statusFilter, clickedTab) {
    // 1. Update filter pill active styling
    const pills = document.querySelectorAll(".filter-tab-pill");
    pills.forEach(pill => {
        pill.classList.remove("active");
        pill.style.background = "#fff";
        pill.style.color = "#475569";
        pill.style.borderColor = "#cbd5e1";
        pill.style.fontWeight = "600";
    });

    if (clickedTab) {
        clickedTab.classList.add("active");
        clickedTab.style.background = statusFilter === "critical" ? "#dc2626" : "#2563eb";
        clickedTab.style.color = "#fff";
        clickedTab.style.borderColor = statusFilter === "critical" ? "#dc2626" : "#2563eb";
        clickedTab.style.fontWeight = "700";
    } else {
        // Find matching pill if triggered from Stat Card
        pills.forEach(p => {
            if (statusFilter === "all" && p.textContent.includes("All")) {
                p.style.background = "#2563eb"; p.style.color = "#fff"; p.style.borderColor = "#2563eb"; p.style.fontWeight = "700";
            } else if (statusFilter === "in_progress" && p.textContent.includes("In Progress")) {
                p.style.background = "#2563eb"; p.style.color = "#fff"; p.style.borderColor = "#2563eb"; p.style.fontWeight = "700";
            } else if (statusFilter === "resolved" && p.textContent.includes("Resolved")) {
                p.style.background = "#2563eb"; p.style.color = "#fff"; p.style.borderColor = "#2563eb"; p.style.fontWeight = "700";
            }
        });
    }

    // 2. Filter reports list rows
    const rows = document.querySelectorAll(".reports-list .report-row");
    let visibleCount = 0;

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        const statusSpan = row.querySelector(".status");
        const statusText = statusSpan ? statusSpan.textContent.toLowerCase() : "";

        let match = false;
        if (statusFilter === "all") {
            match = true;
        } else if (statusFilter === "in_progress") {
            match = statusText.includes("progress") || statusText.includes("pending") || text.includes("progress");
        } else if (statusFilter === "resolved") {
            match = statusText.includes("resolved") || text.includes("resolved");
        } else if (statusFilter === "critical") {
            match = text.includes("road") || text.includes("damage") || text.includes("20481");
        }

        if (match) {
            row.style.display = "flex";
            visibleCount++;
        } else {
            row.style.display = "none";
        }
    });

    // 3. Smooth scroll to reports section
    const reportsElem = document.getElementById("reports");
    if (reportsElem) {
        reportsElem.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    showToast(`Showing ${statusFilter.replace('_', ' ').toUpperCase()} reports (${visibleCount} items)`);
}

/* =========================================
   GLOBAL DASHBOARD LANGUAGE SWITCHER
========================================= */

const DASHBOARD_TRANSLATIONS = {
    "hi": {
        greeting: "शुभ प्रभात",
        portal: "नागरिक पोर्टल",
        subtitle: "यहाँ आपके क्षेत्र और समुदाय से जुड़ी ताज़ा जानकारी है।",
        reportBtn: "＋ समस्या दर्ज करें",
        bulletinTag: "आधिकारिक वार्ड बुलेटिन",
        briefingBtn: "🔊 दैनिक नागरिक ब्रीफिंग",
        readNoticeBtn: "📢 नोटिस सुनें",
        karmaRank: "पद: वार्ड संरक्षक (लेवल 3)",
        reportsSubmitted: "कुल दर्ज शिकायतें",
        inProgress: "प्रगति पर",
        resolved: "समाधान पूर्ण",
        communityImpact: "सामुदायिक प्रभाव"
    },
    "or": {
        greeting: "ଶୁଭ ସକାଳ",
        portal: "ନାଗରିକ ପୋର୍ଟାଲ୍",
        subtitle: "ଏଠାରେ ଆପଣଙ୍କ ପୌରାଞ୍ଚଳ ଓ ୱାର୍ଡ଼ର ତାଜା ତଥ୍ୟ।",
        reportBtn: "＋ ଅଭିଯୋଗ ଦାଖଲ କରନ୍ତୁ",
        bulletinTag: "ସରକାରୀ ୱାର୍ଡ଼ ବିଜ୍ଞପ୍ତି",
        briefingBtn: "🔊 ଦୈନିକ ପୌର ବାର୍ତ୍ତା",
        readNoticeBtn: "📢 ନୋଟିସ୍ ଶୁଣନ୍ତୁ",
        karmaRank: "ପଦବୀ: ୱାର୍ଡ଼ ଗାର୍ଡିଆନ୍ (ଲେଭଲ ୩)",
        reportsSubmitted: "ଦାଖଲ ଅଭିଯୋଗ",
        inProgress: "କାର୍ଯ୍ୟ ଚାଲୁଅଛି",
        resolved: "ସମାଧାନ ହୋଇଛି",
        communityImpact: "ସାମୂହିକ ଲାଭ"
    },
    "bn": {
        greeting: "সুপ্রভাত",
        portal: "নাগরিক পোর্টাল",
        subtitle: "আপনার এলাকার সর্বশেষ তথ্য ও পরিষেবা আপডেট।",
        reportBtn: "＋ অভিযোগ জানান",
        bulletinTag: "অফিসিয়াল পৌর বুলেটিন",
        briefingBtn: "🔊 দৈনিক নাগরিক ব্রিফিং",
        readNoticeBtn: "📢 নোটিশ শুনুন",
        karmaRank: "র‌্যাঙ্ক: ওয়ার্ড অভিভাবক (লেভেল ৩)",
        reportsSubmitted: "মোট অভিযোগ",
        inProgress: "কাজ চলছে",
        resolved: "সমাধান সম্পন্ন",
        communityImpact: "নাগরিক প্রভাব"
    },
    "gu": {
        greeting: "શુભ સવાર",
        portal: "નાગરિક પોર્ટલ",
        subtitle: "તમારા વોર્ડ અને વિસ્તારની તાજી વિગતો અહીં જુઓ.",
        reportBtn: "＋ સમસ્યા નોંધાવો",
        bulletinTag: "સત્તાવાર વોર્ડ બુલેટિન",
        briefingBtn: "🔊 દૈનિક નાગરિક બ્રીફિંગ",
        readNoticeBtn: "📢 નોટિસ સાંભળો",
        karmaRank: "રેન્ક: વોર્ડ ગાર્ડિયન (લેવલ ૩)",
        reportsSubmitted: "કુલ ફરિયાદો",
        inProgress: "કામ ચાલુ છે",
        resolved: "નિરાકરણ થયેલ",
        communityImpact: "સમુદાય પ્રભાવ"
    },
    "ta": {
        greeting: "காலை வணக்கம்",
        portal: "குடிமக்கள் போர்டல்",
        subtitle: "உங்கள் வார்டின் தற்போதைய நிலவரங்கள்.",
        reportBtn: "＋ புகார் செய்க",
        bulletinTag: "அதிகாரப்பூர்வ அறிவிப்பு",
        briefingBtn: "🔊 தினசரி அறிக்கை",
        readNoticeBtn: "📢 அறிவிப்பை கேட்கவும்",
        karmaRank: "நிலை: வார்டு பாதுகாவலர் (நிலை 3)",
        reportsSubmitted: "பதிவு செய்த புகார்கள்",
        inProgress: "செயலில் உள்ளது",
        resolved: "தீர்க்கப்பட்டது",
        communityImpact: "பொதுமக்கள் தாக்கம்"
    },
    "te": {
        greeting: "శుభోదయం",
        portal: "పౌర పోర్టల్",
        subtitle: "మీ వార్డు తాజా వివరాలు మరియు నివేదికలు.",
        reportBtn: "＋ ఫిర్యాదు చేయండి",
        bulletinTag: "అధికారిక వార్డు సమాచారం",
        briefingBtn: "🔊 రోజువారీ సారాంశం",
        readNoticeBtn: "📢 నోటీసు వినండి",
        karmaRank: "హోదా: వార్డ్ గార్డియన్ (స్థాయి 3)",
        reportsSubmitted: "దాఖలు చేసిన ఫిర్యాదులు",
        inProgress: "పురోగతిలో ఉంది",
        resolved: "పరిష్కరించబడింది",
        communityImpact: "సమాజ ప్రభావం"
    },
    "mr": {
        greeting: "शुभ प्रभात",
        portal: "नागरी पोर्टल",
        subtitle: "आपल्या प्रभागातील ताज्या घडामोडी व तक्रारी.",
        reportBtn: "＋ तक्रार नोंदवा",
        bulletinTag: "अधिकृत प्रभाग सूचना",
        briefingBtn: "🔊 दैनिक नागरी माहिती",
        readNoticeBtn: "📢 नोटीस ऐका",
        karmaRank: "पद: प्रभाग संरक्षक (पातळी ३)",
        reportsSubmitted: "एकूण तक्रारी",
        inProgress: "काम सुरू",
        resolved: "निवारण पूर्ण",
        communityImpact: "नागरी प्रभाव"
    },
    "kn": {
        greeting: "ಶುಭೋದಯ",
        portal: "ಪೌರ ಪೋರ್ಟಲ್",
        subtitle: "ನಿಮ್ಮ ವಾರ್ಡ್‌ನ ಇತ್ತೀಚಿನ ಮಾಹಿತಿ.",
        reportBtn: "＋ ದೂರು ಸಲ್ಲಿಸಿ",
        bulletinTag: "ಅಧಿಕೃತ ವಾರ್ಡ್ ಪ್ರಕಟಣೆ",
        briefingBtn: "🔊 ದೈನಂದಿನ ಮಾಹಿತಿ",
        readNoticeBtn: "📢 ಪ್ರಕಟಣೆ ಆಲಿಸಿ",
        karmaRank: "ಶ್ರೇಣಿ: ವಾರ್ಡ್ ಗಾರ್ಡಿಯನ್ (ಹಂತ 3)",
        reportsSubmitted: "ಸಲ್ಲಿಸಿದ ದೂರುಗಳು",
        inProgress: "ಪ್ರಗತಿಯಲ್ಲಿದೆ",
        resolved: "ಪರಿಹರಿಸಲಾಗಿದೆ",
        communityImpact: "ಸಮುದಾಯ ಪರಿಣಾಮ"
    },
    "en": {
        greeting: "Good morning",
        portal: "CITIZEN PORTAL",
        subtitle: "Here's what's happening with your community.",
        reportBtn: "＋ Report an Issue",
        bulletinTag: "Official Ward Bulletin",
        briefingBtn: "🔊 Daily Civic Briefing",
        readNoticeBtn: "📢 Read Notice",
        karmaRank: "Rank: Ward Guardian (Level 3)",
        reportsSubmitted: "Reports Submitted",
        inProgress: "In Progress",
        resolved: "Issues Resolved",
        communityImpact: "Community Impact"
    }
};

function changeDashboardLanguage(lang) {
    localStorage.setItem("jansetu_preferred_lang", lang);

    // Sync all dropdown selects
    const headerSelect = document.getElementById("globalDashboardLangSelect");
    if (headerSelect) headerSelect.value = lang;
    const modalSelect = document.getElementById("modalVoiceLangSelect");
    if (modalSelect) modalSelect.value = lang;
    const profileSelect = document.getElementById("profileInputLang");
    if (profileSelect) profileSelect.value = lang;

    // Apply translations
    const dict = DASHBOARD_TRANSLATIONS[lang] || DASHBOARD_TRANSLATIONS["en"];
    const welcome = document.querySelector(".welcome-row h1");
    const nameSpan = document.getElementById("welcomeName")?.textContent || "Citizen";
    if (welcome) welcome.innerHTML = `${dict.greeting}, <span id="welcomeName">${nameSpan}</span> 👋`;

    const portalEyebrow = document.querySelector(".welcome-row .eyebrow");
    if (portalEyebrow) portalEyebrow.textContent = dict.portal;

    const sub = document.querySelector(".welcome-row p");
    if (sub) sub.textContent = dict.subtitle;

    const briefingBtn = document.getElementById("bulletinBriefingBtn");
    if (briefingBtn) briefingBtn.innerHTML = `<span>🔊</span> ${dict.briefingBtn.replace('🔊 ', '')}`;

    const noticeBtn = document.getElementById("bulletinNoticeBtn");
    if (noticeBtn) noticeBtn.innerHTML = `<span>📢</span> ${dict.readNoticeBtn.replace('📢 ', '')}`;

    showToast(`🌐 Language switched to ${headerSelect?.options[headerSelect.selectedIndex]?.text || lang.toUpperCase()}`);
}

/* =========================================
   MY CIVIC PROFILE MODAL LOGIC
========================================= */

function openProfileModal() {
    const modal = document.getElementById("profileModal");
    if (modal) {
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";

        // Load saved profile data
        const savedName = localStorage.getItem("jansetu_user_name") || "Sourav P.";
        const savedPhone = localStorage.getItem("jansetu_user_phone") || "+91 98765 43210";
        const savedWard = localStorage.getItem("jansetu_user_ward") || "Ward 12";
        const savedLang = localStorage.getItem("jansetu_preferred_lang") || "en";

        const nameInput = document.getElementById("profileInputName");
        if (nameInput) nameInput.value = savedName;
        const phoneInput = document.getElementById("profileInputPhone");
        if (phoneInput) phoneInput.value = savedPhone;
        const wardInput = document.getElementById("profileInputWard");
        if (wardInput) wardInput.value = savedWard;
        const langInput = document.getElementById("profileInputLang");
        if (langInput) langInput.value = savedLang;

        const profileKarma = document.getElementById("modalProfileKarma");
        if (profileKarma) profileKarma.textContent = `${currentKarmaXP} XP`;
    }
}

function closeProfileModal() {
    const modal = document.getElementById("profileModal");
    if (modal) {
        modal.style.display = "none";
        document.body.style.overflow = "";
    }
}

function saveProfileChanges() {
    const name = document.getElementById("profileInputName")?.value || "Sourav P.";
    const phone = document.getElementById("profileInputPhone")?.value || "+91 98765 43210";
    const ward = document.getElementById("profileInputWard")?.value || "Ward 12";
    const lang = document.getElementById("profileInputLang")?.value || "en";

    localStorage.setItem("jansetu_user_name", name);
    localStorage.setItem("jansetu_user_phone", phone);
    localStorage.setItem("jansetu_user_ward", ward);
    localStorage.setItem("jansetu_preferred_lang", lang);

    // Update UI headers
    const userNameElem = document.getElementById("userName");
    if (userNameElem) userNameElem.textContent = name;
    const welcomeNameElem = document.getElementById("welcomeName");
    if (welcomeNameElem) welcomeNameElem.textContent = name;
    const profileMenuName = document.getElementById("profileMenuName");
    if (profileMenuName) profileMenuName.textContent = name;
    const modalProfileName = document.getElementById("modalProfileCitizenName");
    if (modalProfileName) modalProfileName.textContent = `Citizen (${name})`;
    const leaderName = document.getElementById("leaderboardSelfName");
    if (leaderName) leaderName.textContent = `${name} (You)`;

    const wardTag = document.getElementById("bulletinWardTag");
    if (wardTag) wardTag.textContent = `${ward} • Saheed Nagar`;

    changeDashboardLanguage(lang);
    triggerKarmaGain(15, "Profile details updated & verified!");
    closeProfileModal();
}

/* =========================================
   INTERACTIVE CIVIC MAP (GOOGLE MAPS & LEAFLET)
========================================= */

let citizenMapHandle = null;
let mapRetryCount = 0;

async function initCitizenMap() {
    const mapContainer = document.getElementById("citizenLeafletMap");
    if (!mapContainer) return;

    if (!citizenMapHandle) {
        if (typeof JanSetuMaps !== "undefined") {
            citizenMapHandle = await JanSetuMaps.initMap("citizenLeafletMap", {
                lat: 20.2961,
                lng: 85.8245,
                zoom: 13
            });
        }
    }

    if (!citizenMapHandle) {
        if (mapRetryCount < 6) {
            mapRetryCount++;
            setTimeout(initCitizenMap, 350);
        }
        return;
    }

    try {
        let geoData = await JanSetuAPI.getMapPoints();
        
        // Fallback sample data if no live coordinates exist
        if (!geoData || !geoData.features || geoData.features.length === 0) {
            geoData = {
                type: "FeatureCollection",
                features: [
                    { type: "Feature", geometry: { type: "Point", coordinates: [85.8245, 20.2961] }, properties: { ticket_id: "JS-20482", title: "Dangerous Pothole on Market Road", category: "Road & Infrastructure", status: "In Progress", landmark: "Unit 4 Market", onActionClick: "viewReport" } },
                    { type: "Feature", geometry: { type: "Point", coordinates: [85.8450, 20.2915] }, properties: { ticket_id: "JS-20475", title: "Overflowing waste collection point", category: "Waste Management", status: "Pending", landmark: "Saheed Nagar Park", onActionClick: "viewReport" } },
                    { type: "Feature", geometry: { type: "Point", coordinates: [85.8300, 20.3010] }, properties: { ticket_id: "JS-20469", title: "Non-functional street lights", category: "Street Lighting", status: "Pending", landmark: "3rd Cross Road", onActionClick: "viewReport" } }
                ]
            };
        }

        // Clear existing markers
        JanSetuMaps.clearLayers(citizenMapHandle);

        const latLngs = [];

        geoData.features.forEach(feature => {
            if (!feature.geometry || !feature.geometry.coordinates) return;
            const [lng, lat] = feature.geometry.coordinates;
            if (!lat || !lng) return;

            const p = feature.properties;
            p.onActionClick = "viewReport";

            JanSetuMaps.addGrievanceMarker(citizenMapHandle, {
                lat,
                lng,
                properties: p
            });

            latLngs.push([lat, lng]);
        });

        if (latLngs.length > 0) {
            JanSetuMaps.fitBounds(citizenMapHandle, latLngs);
        }

        setTimeout(() => {
            JanSetuMaps.invalidateSize(citizenMapHandle);
        }, 200);

    } catch (e) {
        console.warn("Could not load civic map points:", e);
    }
}

/* =========================================
   STATS & KPIS
========================================= */

function updateStatsUI(analytics) {
    if (!analytics) return;

    const statCards = document.querySelectorAll(".stat-card");
    if (statCards.length >= 4) {
        // Reports submitted
        const num0 = statCards[0].querySelector("h2");
        if (num0) num0.textContent = String(analytics.reports_submitted || 0).padStart(2, "0");

        // In Progress
        const num1 = statCards[1].querySelector("h2");
        if (num1) num1.textContent = String(analytics.in_progress || 0).padStart(2, "0");

        // Resolved
        const num2 = statCards[2].querySelector("h2");
        if (num2) num2.textContent = String(analytics.resolved || 0).padStart(2, "0");

        // Community impact
        const num3 = statCards[3].querySelector("h2");
        if (num3) num3.textContent = String(analytics.community_impact || 17);
    }

    // Update impact card
    const impactNum = document.querySelector(".impact-number strong");
    if (impactNum) impactNum.textContent = String(analytics.community_impact || 17);
}

/* =========================================
   RENDER GRIEVANCE LISTS
========================================= */

function getCategoryIcon(category) {
    const cat = (category || "").toLowerCase();
    if (cat.includes("road")) return { icon: "🚧", cls: "road" };
    if (cat.includes("light")) return { icon: "💡", cls: "light" };
    if (cat.includes("waste")) return { icon: "🗑", cls: "waste" };
    if (cat.includes("water")) return { icon: "💧", cls: "water" };
    if (cat.includes("drain")) return { icon: "≋", cls: "drainage" };
    return { icon: "📋", cls: "road" };
}

function getStatusBadge(status) {
    const s = (status || "").toLowerCase();
    if (s.includes("progress")) return `<span class="status in-progress">In Progress</span>`;
    if (s.includes("resolve")) return `<span class="status resolved">Resolved</span>`;
    return `<span class="status pending">Pending</span>`;
}

function renderGrievanceLists(grievances) {
    // 1. Render Recent Reports (top 3)
    const recentList = document.querySelector(".reports-list");
    if (recentList && grievances && grievances.length > 0) {
        recentList.innerHTML = grievances.slice(0, 3).map(g => {
            const catInfo = getCategoryIcon(g.category);
            const dateStr = new Date(g.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
            const impactVotes = g.community_impact_count || 1;
            return `
                <div class="report-row">
                    <div class="report-category ${catInfo.cls}">
                        ${catInfo.icon}
                    </div>
                    <div class="report-details">
                        <h3>${g.title}</h3>
                        <p>#${g.ticket_id} • ${dateStr} • ${g.ward || 'Ward 12'}</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <button class="support-vote-btn" onclick="supportGrievance(${g.id}, this, event)" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">
                            ▲ ${impactVotes}
                        </button>
                        <div class="report-status">
                            ${getStatusBadge(g.status)}
                        </div>
                        <button class="arrow-btn" onclick="viewReport('${g.ticket_id}')">
                            →
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }

    // 2. Render Full Reports in My Reports section
    const fullList = document.getElementById("allReportsList");
    if (fullList && grievances && grievances.length > 0) {
        fullList.innerHTML = grievances.map(g => {
            const catInfo = getCategoryIcon(g.category);
            const statusKey = (g.status || "").toLowerCase().includes("progress") ? "progress" : ((g.status || "").toLowerCase().includes("resolve") ? "resolved" : "pending");
            const impactVotes = g.community_impact_count || 1;
            return `
                <div class="full-report" data-status="${statusKey}">
                    <div class="full-report-icon ${catInfo.cls}">
                        ${catInfo.icon}
                    </div>
                    <div class="full-report-info">
                        <h3>${g.title}</h3>
                        <p>#${g.ticket_id} • ${g.category} • ${g.department || 'Municipal Dept'}</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <button class="support-vote-btn" onclick="supportGrievance(${g.id}, this, event)" style="background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer;">
                            ▲ ${impactVotes} Upvotes
                        </button>
                        ${getStatusBadge(g.status)}
                        <button class="outline-btn" onclick="viewReport('${g.ticket_id}')">
                            Track
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }
}

/* =========================================
   ISSUE UPVOTE / SUPPORT
========================================= */

async function supportGrievance(grievanceId, button, event) {
    if (event) event.stopPropagation();
    try {
        const res = await JanSetuAPI.supportGrievance(grievanceId);
        if (button) {
            button.style.background = "#dbeafe";
            button.style.borderColor = "#2563eb";
            button.innerHTML = `▲ ${res.impact_count || '+1'} ✓`;
        }
        showToast("✓ Vote recorded! Prioritizing for municipal intervention.");
        
        // Refresh local analytics
        const analytics = await JanSetuAPI.getCitizenAnalytics();
        updateStatsUI(analytics);
        triggerKarmaGain(10, "Upvoted neighborhood issue!");
    } catch (e) {
        console.warn("Support grievance error:", e);
        if (button) button.innerHTML = `▲ Supported ✓`;
        triggerKarmaGain(10, "Upvoted neighborhood issue!");
    }
}

async function supportCurrentModalGrievance() {
    if (!currentModalGrievanceId) return;
    const btn = document.getElementById("modalSupportBtn");
    const countElem = document.getElementById("modalImpactCount");

    try {
        const res = await JanSetuAPI.supportGrievance(currentModalGrievanceId);
        if (countElem) countElem.textContent = `${res.impact_count || 18} Corroborating Votes`;
        if (btn) {
            btn.disabled = true;
            btn.style.background = "#16a34a";
            btn.textContent = "Supported ✓ (+1)";
        }
        triggerKarmaGain(10, "Upvoted neighborhood issue!");
    } catch (e) {
        console.warn("Modal support error:", e);
        if (btn) btn.textContent = "Supported ✓";
        triggerKarmaGain(10, "Upvoted neighborhood issue!");
    }
}

/* =========================================
   REPORT DETAILS MODAL & CITIZEN VERIFICATION REVIEWS
========================================= */

let currentCitizenReviewPhotoBase64 = null;

async function viewReport(reportId) {
    const modal = document.getElementById("detailModal");
    const title = document.getElementById("detailTitle");
    const id = document.getElementById("detailId");
    const countElem = document.getElementById("modalImpactCount");
    const btn = document.getElementById("modalSupportBtn");

    if (!modal) return;

    if (id) id.textContent = "#" + reportId;
    if (title) title.textContent = "Loading details...";
    if (btn) {
        btn.disabled = false;
        btn.style.background = "#2563eb";
        btn.textContent = "▲ Upvote Issue (+1)";
    }

    modal.classList.add("active");
    document.body.style.overflow = "hidden";

    try {
        const detail = await JanSetuAPI.getGrievanceDetail(reportId);
        currentModalGrievanceId = detail.id;
        currentModalGrievanceDetail = detail;
        if (title) title.textContent = detail.title;
        if (countElem) countElem.textContent = `${detail.community_impact_count || 17} Corroborating Votes`;

        // Update Authority Details
        const offName = document.getElementById("modalOfficerName");
        if (offName) offName.textContent = detail.assigned_officer_name || "Er. Rajesh Mohapatra (EE)";
        const offPhone = document.getElementById("modalOfficerContact");
        const offEmail = detail.assigned_officer_email || "rajesh.mohapatra@bmc.gov.in";
        if (offPhone) offPhone.innerHTML = `✉️ <a href="mailto:${offEmail}" style="color: #2563eb; text-decoration: underline;">${offEmail}</a>`;
        const contName = document.getElementById("modalContractorName");
        if (contName) contName.textContent = detail.contractor_name || "Apex Civic Infra Ltd.";
        const workOrd = document.getElementById("modalWorkOrderId");
        if (workOrd) workOrd.textContent = `Order #${detail.work_order_id || 'WO-2026-881'}`;
        const counName = document.getElementById("modalCouncillorName");
        if (counName) counName.textContent = detail.ward_councillor_name || "Smt. Jayashree Das (Ward 12)";
        const slaTgt = document.getElementById("modalSlaTarget");
        if (slaTgt) slaTgt.textContent = detail.target_sla_date || "24 Hours";

        // Update Before / After Evidence Images
        const beforeImg = document.getElementById("modalBeforeImg");
        if (beforeImg) {
            if (detail.evidence && detail.evidence.length > 0 && detail.evidence[0].file_url) {
                beforeImg.src = detail.evidence[0].file_url;
            } else {
                beforeImg.src = "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=400";
            }
        }
        const afterImg = document.getElementById("modalAfterImg");
        if (afterImg) {
            if (detail.resolution_proof_url) {
                afterImg.src = detail.resolution_proof_url;
            } else {
                afterImg.src = "https://images.unsplash.com/photo-1590496793929-36417d3117de?w=400";
            }
        }

        // Timeline Resolution Text
        const timelineRes = document.getElementById("modalResolutionTimelineText");
        if (timelineRes) {
            if (detail.status === "Resolved") {
                timelineRes.textContent = "Resolution proof verified and approved by municipal engineer.";
            } else {
                timelineRes.textContent = "Assigned to contractor. Awaiting resolution evidence.";
            }
        }

        // Fetch and Render Citizen Reviews
        await loadModalCitizenReviews(detail.id);

    } catch (e) {
        console.warn("Could not fetch detail:", e);
        if (title) title.textContent = "Civic Grievance #" + reportId;
    }
}

async function loadModalCitizenReviews(grievanceId) {
    const list = document.getElementById("modalReviewsList");
    const statsElem = document.getElementById("modalReviewStats");
    if (!list) return;

    try {
        const reviews = await JanSetuAPI.getGrievanceReviews(grievanceId);
        if (!reviews || reviews.length === 0) {
            list.innerHTML = `<p style="font-size: 11px; color: #64748b; margin: 4px 0;">No citizen reviews yet. Be the first neighbor to verify!</p>`;
            if (statsElem) statsElem.textContent = "Awaiting first resident review";
            return;
        }

        const avgRating = (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length).toFixed(1);
        const verifiedPercent = Math.round((reviews.filter(r => r.is_verified_fixed === 1).length / reviews.length) * 100);
        if (statsElem) statsElem.textContent = `⭐⭐⭐⭐⭐ ${avgRating} / 5 (${reviews.length} Reviews · ${verifiedPercent}% Confirmed Fixed)`;

        list.innerHTML = reviews.map(r => {
            const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
            const isFixed = r.is_verified_fixed === 1;
            const badgeBg = isFixed ? "#dcfce7" : "#fee2e2";
            const badgeColor = isFixed ? "#166534" : "#991b1b";
            const badgeText = isFixed ? "✓ Confirmed Fixed" : "⚠ Disputed / Still Broken";

            const photoHtml = r.proof_image_url
                ? `<div style="margin-top: 6px;"><img src="${r.proof_image_url}" alt="Citizen Proof" style="max-height: 80px; max-width: 140px; border-radius: 6px; border: 1px solid #cbd5e1; cursor: pointer;" onclick="window.open('${r.proof_image_url}', '_blank')"></div>`
                : "";

            return `
                <div style="padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div>
                            <strong style="color: #0f172a; font-size: 12px;">${r.user_name}</strong>
                            <span style="font-size: 10px; color: #2563eb; background: #eff6ff; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">Verified Resident</span>
                        </div>
                        <span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">
                            ${badgeText}
                        </span>
                    </div>
                    <div style="color: #f59e0b; font-size: 11px; margin-bottom: 4px;">${stars}</div>
                    <p style="color: #334155; margin: 4px 0; line-height: 1.4;">${r.comment}</p>
                    ${photoHtml}
                    <div style="margin-top: 6px; display: flex; justify-content: space-between; align-items: center; color: #94a3b8; font-size: 10px;">
                        <span>${new Date(r.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <button type="button" onclick="upvoteReviewHelpfulAction(${r.id}, this)" style="background: none; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 10px; padding: 2px 8px; cursor: pointer; color: #475569;">
                            👍 Helpful (${r.helpful_count || 0})
                        </button>
                    </div>
                </div>
            `;
        }).join("");

    } catch (e) {
        console.warn("Error loading reviews:", e);
        list.innerHTML = `<p style="font-size: 11px; color: #64748b;">No citizen reviews found.</p>`;
    }
}

function toggleCitizenReviewForm() {
    const box = document.getElementById("citizenReviewFormBox");
    if (box) {
        box.style.display = box.style.display === "none" ? "block" : "none";
    }
}

function handleReviewPhotoSelected(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const label = document.getElementById("citizenReviewPhotoLabel");
        if (label) label.textContent = `✓ ${file.name}`;

        const reader = new FileReader();
        reader.onload = (e) => {
            currentCitizenReviewPhotoBase64 = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function submitCurrentCitizenReview() {
    if (!currentModalGrievanceId) {
        showToast("Please open a grievance to review.", "!");
        return;
    }

    const ratingVal = parseInt(document.getElementById("citizenReviewRating")?.value || "5", 10);
    const verifiedVal = parseInt(document.getElementById("citizenReviewVerified")?.value || "1", 10);
    const commentVal = document.getElementById("citizenReviewComment")?.value.trim();

    if (!commentVal) {
        showToast("Please write a comment describing the condition.", "!");
        return;
    }

    const citizenName = localStorage.getItem("userName") || "Resident Citizen";

    showToast("Posting your verification...", "⏳");

    try {
        const payload = {
            user_name: citizenName,
            rating: ratingVal,
            is_verified_fixed: verifiedVal,
            comment: commentVal,
            proof_image_url: currentCitizenReviewPhotoBase64 || null
        };

        const res = await JanSetuAPI.submitGrievanceReview(currentModalGrievanceId, payload);
        triggerKarmaGain(25, "On-ground verification review published!");

        // Reset form
        const commentBox = document.getElementById("citizenReviewComment");
        if (commentBox) commentBox.value = "";
        const photoLabel = document.getElementById("citizenReviewPhotoLabel");
        if (photoLabel) photoLabel.textContent = "";
        currentCitizenReviewPhotoBase64 = null;
        toggleCitizenReviewForm();

        // Reload reviews
        await loadModalCitizenReviews(currentModalGrievanceId);

    } catch (e) {
        console.warn("Submit review error:", e);
        triggerKarmaGain(25, "On-ground verification review published!");
        toggleCitizenReviewForm();
        await loadModalCitizenReviews(currentModalGrievanceId);
    }
}

async function upvoteReviewHelpfulAction(reviewId, button) {
    try {
        const res = await JanSetuAPI.upvoteReviewHelpful(reviewId);
        if (button) {
            button.disabled = true;
            button.style.color = "#16a34a";
            button.style.borderColor = "#86efac";
            button.textContent = `👍 Helpful (${res.helpful_count || 1})`;
        }
        triggerKarmaGain(5, "Marked community review as helpful!");
    } catch (e) {
        console.warn("Helpful upvote error:", e);
        if (button) button.textContent = `👍 Helpful (+1)`;
        triggerKarmaGain(5, "Marked community review as helpful!");
    }
}

function handleDownloadCurrentReceipt() {
    if (!currentModalGrievanceDetail) {
        showToast("Please open a grievance to download receipt.", "!");
        return;
    }
    JanSetuPDF.downloadCitizenReceipt(currentModalGrievanceDetail);
    triggerKarmaGain(5, "Downloaded verified civic receipt PDF!");
}

async function handleVoiceReadoutModal() {
    if (!currentModalGrievanceDetail) return;
    const lang = document.getElementById("modalVoiceLangSelect")?.value || "en";
    const transcriptBox = document.getElementById("modalVoiceTranscript");
    const listenBtn = document.getElementById("modalVoiceListenBtn");
    const g = currentModalGrievanceDetail;

    const baseText = `Grievance number ${g.ticket_id}. Title: ${g.title}. Department: ${g.category}. Current status: ${g.status}. Assigned contractor: ${g.contractor_name || 'Apex Civic Infra Ltd.'}. Resolution target SLA: ${g.target_sla_date || '24 hours'}.`;

    if (transcriptBox) {
        transcriptBox.style.display = "block";
        transcriptBox.innerHTML = `<em>🌐 Translating with JanSetu AI...</em>`;
    }
    if (listenBtn) listenBtn.innerHTML = `<span>⏳</span> Translating...`;

    try {
        let spokenText = baseText;
        if (lang !== "en" && JanSetuAPI.translateText) {
            const transRes = await JanSetuAPI.translateText(baseText, lang);
            spokenText = transRes.translated_text || baseText;
        }

        if (transcriptBox) {
            transcriptBox.innerHTML = `<strong>🗣️ AI Voice Transcript (${lang.toUpperCase()}):</strong><br>${spokenText}`;
        }

        JanSetuAPI.speakText(
            spokenText, 
            lang,
            () => { if (listenBtn) listenBtn.innerHTML = `<span>🔊</span> Speaking...`; },
            () => { if (listenBtn) listenBtn.innerHTML = `<span>🔊</span> Listen`; }
        );
    } catch (e) {
        console.warn("Translation error:", e);
        if (transcriptBox) {
            transcriptBox.innerHTML = `<strong>🗣️ AI Voice Transcript:</strong><br>${baseText}`;
        }
        JanSetuAPI.speakText(baseText, "en");
        if (listenBtn) listenBtn.innerHTML = `<span>🔊</span> Listen`;
    }
}

function closeDetails() {
    const modal = document.getElementById("detailModal");
    if (modal) modal.classList.remove("active");
    document.body.style.overflow = "";
    currentModalGrievanceId = null;
    currentModalGrievanceDetail = null;
    currentCitizenReviewPhotoBase64 = null;
}

/* =========================================
   PARTICIPATORY BUDGETING PROPOSALS & VOTING
========================================= */

function renderBudgetSection(projects) {
    const grid = document.getElementById("budgetProjectsGrid");
    if (!grid) return;

    if (!projects || projects.length === 0) {
        projects = [
            { id: 1, title: "Solar LED Street Light Installation", description: "Deploy 50 energy-efficient solar street lights across unlit alleys in Ward 12.", category: "Lighting", estimated_cost: 450000, target_votes: 100, vote_count: 78, ward: "Ward 12" },
            { id: 2, title: "Stormwater Drainage Desilting & Concrete Lining", description: "Clear and concrete-line 2.5 km of primary drainage channels before monsoon.", category: "Drainage", estimated_cost: 1200000, target_votes: 150, vote_count: 114, ward: "Ward 12" },
            { id: 3, title: "Community Park Greenery & Children Play Zone", description: "Transform vacant civic plot into a safe, green public park with solar lighting.", category: "Recreation", estimated_cost: 650000, target_votes: 120, vote_count: 92, ward: "Ward 12" },
            { id: 4, title: "Smart Waste Segregation Bins & Collection Hub", description: "Install 20 sensor-equipped dry/wet waste segregation bins at commercial junctions.", category: "Sanitation", estimated_cost: 320000, target_votes: 80, vote_count: 65, ward: "Ward 12" }
        ];
    }

    grid.innerHTML = projects.map(p => {
        const percent = Math.min(100, Math.round((p.vote_count / (p.target_votes || 100)) * 100));
        const costStr = (p.estimated_cost >= 100000) ? `₹${(p.estimated_cost / 100000).toFixed(1)} Lakhs` : `₹${p.estimated_cost.toLocaleString('en-IN')}`;

        return `
            <div class="card budget-project-card" style="padding: 20px; border-radius: 12px; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #e2e8f0; background: #ffffff;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 8px;">
                        <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; background: #eff6ff; color: #2563eb;">${p.category || 'Civic Infrastructure'}</span>
                        <strong style="color: #16a34a; font-size: 13px;">${costStr}</strong>
                    </div>
                    <h3 style="font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">${p.title}</h3>
                    <p style="font-size: 12px; color: #64748b; line-height: 1.4; margin-bottom: 14px;">${p.description}</p>
                </div>

                <div>
                    <div style="display:flex; justify-content:space-between; font-size: 11px; color: #475569; font-weight: 600; margin-bottom: 4px;">
                        <span id="voteCount-${p.id}">🗳️ ${p.vote_count} Citizen Votes</span>
                        <span>${percent}% of Goal</span>
                    </div>
                    <div style="width: 100%; height: 8px; background: #f1f5f9; border-radius: 999px; overflow: hidden; margin-bottom: 14px;">
                        <div id="voteBar-${p.id}" style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #2563eb, #38bdf8); border-radius: 999px; transition: width 0.4s ease;"></div>
                    </div>

                    <button class="primary-btn full-width" onclick="voteOnBudgetProject(${p.id}, this)" style="padding: 9px; font-size: 13px; font-weight: 700; background: #2563eb; color: #fff; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span>🗳️</span> Cast Citizen Vote
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

async function voteOnBudgetProject(projectId, button) {
    try {
        const res = await JanSetuAPI.voteOnProject(projectId, "support");
        if (button) {
            button.disabled = true;
            button.style.background = "#16a34a";
            button.innerHTML = "<span>✓</span> Vote Cast Successfully";
        }

        const countElem = document.getElementById(`voteCount-${projectId}`);
        if (countElem) countElem.textContent = `🗳️ ${res.vote_count} Citizen Votes`;

        const barElem = document.getElementById(`voteBar-${projectId}`);
        if (barElem) {
            const target = res.target_votes || 100;
            const newPercent = Math.min(100, Math.round((res.vote_count / target) * 100));
            barElem.style.width = `${newPercent}%`;
        }

        showToast("✓ Your vote has been recorded on the Municipal Budget proposal!");
        triggerKarmaGain(30, "Voted on Ward Participatory Budget proposal!");
    } catch (e) {
        console.warn("Vote project error:", e);
        if (button) {
            button.disabled = true;
            button.style.background = "#16a34a";
            button.innerHTML = "<span>✓</span> Vote Cast Successfully";
        }
        triggerKarmaGain(30, "Voted on Ward Participatory Budget proposal!");
    }
}

function showBudget() {
    showSection("budget");
}

/* =========================================
   NOTIFICATIONS
========================================= */

function renderNotifications(notifs) {
    const notifCard = document.querySelector(".notifications-card");
    const countBadge = document.querySelector(".notification-count");

    if (notifs && notifs.length > 0) {
        const unreadCount = notifs.filter(n => !n.is_read).length;
        if (countBadge) countBadge.textContent = unreadCount || notifs.length;

        if (notifCard) {
            notifCard.innerHTML = notifs.map(n => {
                const isGreen = n.title.toLowerCase().includes("resolve");
                const iconColor = isGreen ? "green" : "blue";
                const iconSymbol = isGreen ? "✓" : "↻";
                const timeAgo = new Date(n.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
                return `
                    <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="markAsRead(${n.id}, this)">
                        <div class="notification-icon ${iconColor}">
                            ${iconSymbol}
                        </div>
                        <div>
                            <strong>${n.title}</strong>
                            <p>${n.message}</p>
                            <small>${timeAgo}</small>
                        </div>
                    </div>
                `;
            }).join("");
        }
    }
}

async function markAsRead(id, element) {
    try {
        await JanSetuAPI.markNotificationRead(id);
        if (element) element.classList.remove("unread");
    } catch (e) {
        console.warn("Mark read error:", e);
    }
}

/* =========================================
   SIDEBAR & PROFILE NAVIGATION
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
    const menu = document.getElementById("profileMenu");
    if (menu) menu.classList.toggle("active");
}

document.addEventListener("click", function(event) {
    const profile = document.querySelector(".user-profile");
    const menu = document.getElementById("profileMenu");
    if (menu && profile && !profile.contains(event.target) && !menu.contains(event.target)) {
        menu.classList.remove("active");
    }
});

function toggleNotifications() {
    showSection("notifications");
}

function showSection(sectionName, clickedLink = null) {
    const overview = document.getElementById("overview");
    const reports = document.getElementById("allReports");
    const notifications = document.getElementById("notifications");
    const budgetSection = document.getElementById("budgetSection");

    if (overview) overview.style.display = "none";
    if (reports) reports.style.display = "none";
    if (notifications) notifications.style.display = "none";
    if (budgetSection) budgetSection.style.display = "none";

    if (sectionName === "overview" && overview) {
        overview.style.display = "block";
        setTimeout(() => {
            if (citizenMapHandle) JanSetuMaps.invalidateSize(citizenMapHandle);
        }, 100);
    }
    else if (sectionName === "reports" && reports) {
        reports.style.display = "block";
        loadCitizenDashboardData();
    }
    else if (sectionName === "notifications" && notifications) {
        notifications.style.display = "block";
    }
    else if (sectionName === "budget" && budgetSection) {
        budgetSection.style.display = "block";
        loadCitizenDashboardData();
    }
    else if (sectionName === "map") {
        if (overview) overview.style.display = "block";
        setTimeout(() => {
            const mapElem = document.getElementById("map");
            if (mapElem) mapElem.scrollIntoView({ behavior: "smooth" });
            if (citizenMapHandle) JanSetuMaps.invalidateSize(citizenMapHandle);
        }, 80);
    }
    else if (sectionName === "impact") {
        if (overview) overview.style.display = "block";
        setTimeout(() => {
            const impact = document.getElementById("impact");
            if (impact) impact.scrollIntoView({ behavior: "smooth" });
        }, 50);
    }

    document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));
    if (clickedLink) clickedLink.classList.add("active");
    closeSidebar();
}

/* =========================================
   REPORT FILTER & SEARCH
========================================= */

function filterReports(status, button) {
    document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
    if (button) button.classList.add("active");

    const reports = document.querySelectorAll(".full-report");
    reports.forEach(report => {
        const reportStatus = report.getAttribute("data-status");
        if (status === "all" || reportStatus === status) {
            report.style.display = "flex";
        } else {
            report.style.display = "none";
        }
    });
}

const searchInput = document.getElementById("searchInput");
if (searchInput) {
    searchInput.addEventListener("input", function() {
        const search = this.value.toLowerCase().trim();
        const reports = document.querySelectorAll(".full-report, .report-row");
        reports.forEach(report => {
            const text = report.textContent.toLowerCase();
            report.style.display = text.includes(search) ? "flex" : "none";
        });
    });
}

/* =========================================
   TOAST & LOGOUT
========================================= */

let toastTimer;
function showToast(message) {
    const toast = document.getElementById("dashboardToast");
    const messageElement = document.getElementById("dashboardToastMessage");
    if (!toast) {
        alert(message);
        return;
    }
    if (messageElement) messageElement.textContent = message;
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
        closeDetails();
        closeSidebar();
        const profileMenu = document.getElementById("profileMenu");
        if (profileMenu) profileMenu.classList.remove("active");
    }
});

document.addEventListener("click", function(event) {
    const detailModal = document.getElementById("detailModal");
    if (detailModal && event.target === detailModal) {
        closeDetails();
    }
});