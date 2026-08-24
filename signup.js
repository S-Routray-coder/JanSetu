function isValidEmailFormat(email) {
    return /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(email);
}

async function createAccount() {
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (name === "" || email === "" || password === "" || confirmPassword === "") {
        alert("Please fill all the required fields.");
        return;
    }

    // Verify email format
    if (!isValidEmailFormat(email)) {
        alert(`'${email}' is not a valid email address. Please enter a valid email like user@example.com.`);
        document.getElementById("signupEmail").focus();
        return;
    }

    if (password.length < 6) {
        alert("Password should be at least 6 characters long.");
        document.getElementById("signupPassword").focus();
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match. Please re-enter your password.");
        document.getElementById("confirmPassword").focus();
        return;
    }

    const roleRadio = document.querySelector('input[name="role"]:checked');
    const role = roleRadio ? roleRadio.value : "citizen";

    const submitBtn = document.querySelector(".signup-btn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Verifying & Creating Account...";
    }

    try {
        // First verify email existence
        const emailCheck = await JanSetuAPI.verifyEmail(email);
        if (emailCheck && emailCheck.exists_in_database) {
            alert(`⚠️ An account with email '${email}' is already registered.\n\nPlease log in with your existing account.`);
            window.location.href = "index.html";
            return;
        }

        const response = await JanSetuAPI.signup(name, email, password, role);

        if (response.ok && response.data.access_token) {
            localStorage.setItem("userRole", role);
            localStorage.setItem("userEmail", email);
            localStorage.setItem("userName", name);

            alert(
                "✓ Account verified & created successfully!\n\n" +
                "Welcome to JanSetu, " + name + " (" + role + ")"
            );

            // Redirect to appropriate dashboard
            if (role === "officer") {
                window.location.href = "officerdashboard.html";
            } else {
                window.location.href = "citizendashboard.html";
            }
        } else {
            const errorMsg = response.data?.detail || "Registration failed. Please verify your email and try again.";
            alert(`⚠️ ${errorMsg}`);
        }
    } catch (error) {
        console.error("Signup error:", error);
        alert("⚠️ Unable to complete registration right now. Please check your connection and try again.");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Account →";
        }
    }
}