async function createAccount() {
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (name === "" || email === "" || password === "" || confirmPassword === "") {
        alert("Please fill all the fields.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    const roleRadio = document.querySelector('input[name="role"]:checked');
    const role = roleRadio ? roleRadio.value : "citizen";

    const submitBtn = document.querySelector(".signup-btn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Creating Account...";
    }

    try {
        const response = await JanSetuAPI.signup(name, email, password, role);

        if (response.ok && response.data.access_token) {
            localStorage.setItem("userRole", role);
            localStorage.setItem("userEmail", email);
            localStorage.setItem("userName", name);

            alert(
                "Account created successfully!\n\n" +
                "Welcome to JanSetu, " + name + " (" + role + ")"
            );

            // Redirect to appropriate dashboard
            if (role === "officer") {
                window.location.href = "officerdashboard.html";
            } else {
                window.location.href = "citizendashboard.html";
            }
        } else {
            const errorMsg = response.data?.detail || "Registration failed. Please try again.";
            alert(errorMsg);
        }
    } catch (error) {
        console.error("Signup error:", error);
        // Fallback for offline demo
        localStorage.setItem("userRole", role);
        localStorage.setItem("userEmail", email);
        localStorage.setItem("userName", name);
        alert("Account created in demo mode!");
        window.location.href = role === "officer" ? "officerdashboard.html" : "citizendashboard.html";
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Create Account →";
        }
    }
}