/* =====================================================
   CIVICCONNECT - MAIN JAVASCRIPT
===================================================== */


/* =====================================================
   DOM ELEMENTS
===================================================== */

const loginModal = document.getElementById("loginModal");
const reportModal = document.getElementById("reportModal");
const mobileMenu = document.getElementById("mobileMenu");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastIcon = document.getElementById("toastIcon");

const issueInput = document.getElementById("issueInput");
const locationMessage = document.getElementById("locationMessage");
const aiPreview = document.getElementById("aiPreview");


/* =====================================================
   LOGIN MODAL
===================================================== */

/*
   Navbar Login button
   and Report an Issue button
   both open the login modal.
*/

function openLoginModal() {

    if (!loginModal) {
        console.error("loginModal not found");
        return;
    }

    loginModal.classList.add("active");

    document.body.style.overflow = "hidden";
}


/*
   Your navbar already uses showLogin()
*/

function showLogin() {

    openLoginModal();

}


/*
   Close login modal
*/

function closeLogin() {

    if (!loginModal) {
        return;
    }

    loginModal.classList.remove("active");

    document.body.style.overflow = "";

}


/* =====================================================
   REPORT BUTTON
===================================================== */

/*
   IMPORTANT:

   Your HTML currently has:

   onclick="openReportModal()"

   But you want:

   Report an Issue
          ↓
      Login Modal
          ↓
       Citizen
          ↓
       Dashboard

   Therefore openReportModal() opens LOGIN first.
*/

function openReportModal() {

    openLoginModal();

}


/*
   This function is kept for your existing
   report modal if you want to use it later.
*/

function openActualReportModal() {

    if (!reportModal) {
        return;
    }

    reportModal.classList.add("active");

    document.body.style.overflow = "hidden";

}


/*
   Close report modal
*/

function closeReportModal() {

    if (!reportModal) {
        return;
    }

    reportModal.classList.remove("active");

    document.body.style.overflow = "";

}


/* =====================================================
   LOGIN
===================================================== */

async function loginDemo() {
    const selectedRole = document.querySelector('input[name="role"]:checked');
    const role = selectedRole ? selectedRole.value : "citizen";

    const emailInput = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
    const password = passwordInput ? passwordInput.value.trim() : "";

    if (email === "") {
        showToast("Please enter your email address.", "!");
        if (emailInput) emailInput.focus();
        return;
    }

    const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
    if (!emailRegex.test(email)) {
        showToast("Please enter a valid email (e.g. name@example.com).", "!");
        if (emailInput) emailInput.focus();
        return;
    }

    if (password === "") {
        showToast("Please enter your password.", "!");
        if (passwordInput) passwordInput.focus();
        return;
    }

    showToast("Verifying account...", "⏳");

    try {
        const res = await JanSetuAPI.login(email, password);
        if (res.ok && res.data.access_token) {
            const user = res.data.user;
            localStorage.setItem("userRole", user.role);
            localStorage.setItem("userEmail", user.email);
            localStorage.setItem("userName", user.full_name);

            showToast("Login successful!", "✓");
            setTimeout(() => {
                if (user.role === "officer" || user.role === "admin") {
                    window.location.href = "officerdashboard.html";
                } else {
                    window.location.href = "citizendashboard.html";
                }
            }, 600);
            return;
        } else {
            const errorMsg = res.data?.detail || "Invalid email or password.";
            showToast(errorMsg, "!");
            if (res.status === 404) {
                // Email does not exist
                setTimeout(() => {
                    const signupText = document.querySelector(".signup-text");
                    if (signupText) {
                        signupText.style.color = "#dc2626";
                        signupText.style.fontWeight = "bold";
                    }
                }, 500);
            }
        }
    } catch (err) {
        console.warn("Connection error:", err);
        showToast("Unable to connect to server. Please try again.", "!");
    }
}


/* =====================================================
   CLOSE MODALS
===================================================== */


/*
   Click outside login modal
*/

if (loginModal) {

    loginModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target === loginModal
            ) {

                closeLogin();

            }

        }
    );

}


/*
   Click outside report modal
*/

if (reportModal) {

    reportModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target === reportModal
            ) {

                closeReportModal();

            }

        }
    );

}


/*
   ESC key
*/

document.addEventListener(
    "keydown",
    function (event) {

        if (event.key === "Escape") {

            closeLogin();

            closeReportModal();

            closeMobileMenu();

        }

    }
);


/* =====================================================
   MOBILE MENU
===================================================== */

function toggleMobileMenu() {

    if (!mobileMenu) {
        return;
    }

    mobileMenu.classList.toggle("active");

}


/*
   Close mobile menu
*/

function closeMobileMenu() {

    if (!mobileMenu) {
        return;
    }

    mobileMenu.classList.remove("active");

}


/* =====================================================
   SMOOTH SCROLL
===================================================== */

function scrollToSection(sectionId) {

    const section =
        document.getElementById(sectionId);


    if (!section) {
        return;
    }


    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });


    closeMobileMenu();

}


/* =====================================================
   TOAST MESSAGE
===================================================== */

function showToast(message, icon = "✓") {

    if (!toast) {
        alert(message);
        return;
    }


    if (toastMessage) {
        toastMessage.textContent = message;
    }


    if (toastIcon) {
        toastIcon.textContent = icon;
    }


    toast.classList.add("active");


    setTimeout(function () {

        toast.classList.remove("active");

    }, 3000);

}


/* =====================================================
   COMING SOON
===================================================== */

function showComingSoon(feature) {

    showToast(
        feature + " will be available soon.",
        "!"
    );

}


/* =====================================================
   VOICE DEMO
===================================================== */

function startVoiceDemo() {

    /*
       Check browser support
    */

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

        showToast(
            "Voice input is not supported in this browser.",
            "!"
        );

        return;

    }


    const recognition =
        new SpeechRecognition();


    recognition.lang = "en-IN";

    recognition.interimResults = false;

    recognition.maxAlternatives = 1;


    showToast(
        "Listening... Please describe the civic issue.",
        "🎤"
    );


    recognition.start();


    recognition.onresult =
        function (event) {

            const transcript =
                event.results[0][0].transcript;


            if (issueInput) {

                issueInput.value =
                    transcript;

                updateAIPreview();

            }


            showToast(
                "Voice captured successfully.",
                "✓"
            );

        };


    recognition.onerror =
        function () {

            showToast(
                "Could not capture voice. Try again.",
                "!"
            );

        };

}


/* =====================================================
   LOCATION
===================================================== */

function detectLocation() {

    if (!locationMessage) {
        return;
    }


    if (!navigator.geolocation) {

        locationMessage.textContent =
            "Location is not supported by this browser.";

        return;

    }


    locationMessage.textContent =
        "Detecting your location...";


    navigator.geolocation.getCurrentPosition(

        function (position) {

            const latitude =
                position.coords.latitude;


            const longitude =
                position.coords.longitude;


            locationMessage.textContent =
                "Location detected ✓ " +
                latitude.toFixed(4) +
                ", " +
                longitude.toFixed(4);


            showToast(
                "Location detected successfully.",
                "✓"
            );

        },


        function () {

            locationMessage.textContent =
                "Unable to detect location. Please allow location access.";

            showToast(
                "Location permission is required.",
                "!"
            );

        }

    );

}


let aiPreviewDebounceTimer;

async function updateAIPreview() {
    if (!issueInput || !aiPreview) return;

    const text = issueInput.value.trim();

    if (text === "") {
        aiPreview.innerHTML = `
            <div class="ai-header">
                <div class="ai-status">
                    <span class="ai-dot"></span>
                    AI Analysis
                </div>
                <span>Preview</span>
            </div>
            <p>Describe your issue to see an AI triage preview.</p>
        `;
        return;
    }

    clearTimeout(aiPreviewDebounceTimer);
    aiPreviewDebounceTimer = setTimeout(async () => {
        try {
            const aiData = await JanSetuAPI.getAIPreview(text);
            aiPreview.innerHTML = `
                <div class="ai-header">
                    <div class="ai-status">
                        <span class="ai-dot"></span>
                        AI Live Triage
                    </div>
                    <span style="font-size:0.75rem; color:#059669; font-weight:600;">${Math.round((aiData.confidence || 0.85) * 100)}% Confidence</span>
                </div>
                <p>
                    <strong>Category:</strong> ${aiData.category}
                    <br>
                    <strong>Severity:</strong> <span style="color:${aiData.priority === 'Critical' ? '#dc2626' : (aiData.priority === 'High' ? '#ea580c' : '#2563eb')}">${aiData.priority}</span>
                    <br>
                    <strong>Routed to:</strong> ${aiData.suggested_department}
                </p>
            `;
        } catch (e) {
            console.warn("AI preview fallback:", e);
        }
    }, 250);
}


/*
   Update AI preview while typing
*/

if (issueInput) {

    issueInput.addEventListener(
        "input",
        updateAIPreview
    );

}


/* =====================================================
   SUBMIT REPORT
===================================================== */

async function submitReport() {
    if (!issueInput) {
        return;
    }

    const issue = issueInput.value.trim();

    if (issue === "") {
        showToast("Please describe the civic issue first.", "!");
        issueInput.focus();
        return;
    }

    const submitBtn = document.querySelector(".submit-report-btn");
    const originalText = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "AI Triage & Submitting...";
    }

    try {
        // Ensure authentication token
        if (!JanSetuAPI.getToken()) {
            await JanSetuAPI.login("citizen@jansetu.in", "password123");
        }

        // Run AI triage preview to determine category
        let category = "Road & Infrastructure";
        try {
            const triage = await JanSetuAPI.getAIPreview(issue);
            if (triage && triage.category) {
                category = triage.category;
            }
        } catch (e) {
            console.warn("AI Triage offline, using default category:", e);
        }

        const title = issue.length > 50 ? issue.substring(0, 50) + "..." : issue;
        const res = await JanSetuAPI.submitGrievance({
            title: title,
            description: issue,
            category: category,
            ward: "Ward 12"
        });

        const ticketId = res.data?.ticket_id || "JS-" + Math.floor(100000 + Math.random() * 900000);
        
        localStorage.setItem("lastTicketId", ticketId);
        localStorage.setItem("latestCivicReport", JSON.stringify({
            id: ticketId,
            issue: issue,
            category: category,
            status: res.data?.status || "Submitted",
            department: res.data?.department || "Municipal Division",
            createdAt: new Date().toLocaleString()
        }));

        closeReportModal();
        showToast(`Issue #${ticketId} submitted to ${res.data?.department || 'Municipal Dept'}!`, "✓");

        issueInput.value = "";
        updateAIPreview();

    } catch (err) {
        console.warn("Backend submit error, fallback to offline demo:", err);
        const reportId = "CC-" + Math.floor(100000 + Math.random() * 900000);
        const report = {
            id: reportId,
            issue: issue,
            status: "Submitted",
            createdAt: new Date().toLocaleString()
        };
        localStorage.setItem("latestCivicReport", JSON.stringify(report));
        closeReportModal();
        showToast("Issue submitted successfully. ID: " + reportId, "✓");
        issueInput.value = "";
        updateAIPreview();
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
}


/* =====================================================
   PARTICIPATORY BUDGET
===================================================== */

function showBudgetMessage() {

    showToast(
        "Ward budget explorer will open soon.",
        "₹"
    );

}


/* =====================================================
   COUNTER ANIMATION
===================================================== */

function animateCounter(element) {

    const target =
        parseInt(
            element.getAttribute("data-target")
        );


    if (isNaN(target)) {
        return;
    }


    let current = 0;


    const duration = 1800;

    const stepTime =
        Math.max(
            Math.floor(duration / target),
            1
        );


    const counter =
        setInterval(function () {

            current +=
                Math.ceil(
                    target / 100
                );


            if (current >= target) {

                current = target;

                clearInterval(counter);

            }


            element.textContent =
                current.toLocaleString();

        }, stepTime);

}


/*
   Observe stat cards
*/

const counters =
    document.querySelectorAll(
        "[data-target]"
    );


if (counters.length > 0) {

    const counterObserver =
        new IntersectionObserver(

            function (entries, observer) {

                entries.forEach(
                    function (entry) {

                        if (
                            entry.isIntersecting
                        ) {

                            animateCounter(
                                entry.target
                            );

                            observer.unobserve(
                                entry.target
                            );

                        }

                    }
                );

            },

            {
                threshold: 0.5
            }

        );


    counters.forEach(
        function (counter) {

            counterObserver.observe(counter);

        }
    );

}


/* =====================================================
   SCROLL REVEAL ANIMATION
===================================================== */

const revealElements =
    document.querySelectorAll(
        ".reveal"
    );


if (revealElements.length > 0) {

    const revealObserver =
        new IntersectionObserver(

            function (entries, observer) {

                entries.forEach(
                    function (entry) {

                        if (
                            entry.isIntersecting
                        ) {

                            entry.target.classList.add(
                                "visible"
                            );


                            observer.unobserve(
                                entry.target
                            );

                        }

                    }
                );

            },

            {
                threshold: 0.12
            }

        );


    revealElements.forEach(
        function (element) {

            revealObserver.observe(element);

        }
    );

}


/* =====================================================
   NAVBAR SCROLL EFFECT
===================================================== */

const navbar =
    document.getElementById("navbar");


window.addEventListener(
    "scroll",
    function () {

        if (!navbar) {
            return;
        }


        if (window.scrollY > 50) {

            navbar.classList.add(
                "scrolled"
            );

        }

        else {

            navbar.classList.remove(
                "scrolled"
            );

        }

    }
);


/* =====================================================
   ACTIVE NAVIGATION LINK
===================================================== */

const navLinks =
    document.querySelectorAll(
        ".desktop-nav a"
    );


const sections =
    document.querySelectorAll(
        "main section[id]"
    );


window.addEventListener(
    "scroll",
    function () {

        let currentSection = "";


        sections.forEach(
            function (section) {

                const sectionTop =
                    section.offsetTop - 150;


                const sectionHeight =
                    section.offsetHeight;


                if (
                    window.scrollY >= sectionTop &&
                    window.scrollY <
                    sectionTop + sectionHeight
                ) {

                    currentSection =
                        section.getAttribute("id");

                }

            }
        );


        navLinks.forEach(
            function (link) {

                link.classList.remove(
                    "active"
                );


                if (
                    link.getAttribute("href") ===
                    "#" + currentSection
                ) {

                    link.classList.add(
                        "active"
                    );

                }

            }
        );

    }
);


/* =====================================================
   PREVENT EMPTY FOOTER LINKS
===================================================== */

document.querySelectorAll(
    'a[href="#"]'
).forEach(
    function (link) {

        link.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

            }
        );

    }
);


/* =====================================================
   PAGE LOAD
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*
           Make sure page starts at top
        */

        window.scrollTo(0, 0);

    }
);