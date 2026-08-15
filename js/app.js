"use strict";

/* SOME CONSTANTS */

let endpoint01 = "https://nlz9p5ho9k.execute-api.us-east-1.amazonaws.com/default/project5vaid";

/* SUPPORTING FUNCTIONS */

// Global login controller
let loginController = () => {
    // Clear any previous messages
    $('#login_message').html("");
    $('#login_message').removeClass();

    // Client-side error trapping
    let username = $("#username").val();
    let password = $("#password").val();
    if (username == "" || password == "") {
        $('#login_message').html('The user name and password are both required.');
        $('#login_message').addClass("alert alert-danger text-center");
        return;
    }

    let the_serialized_data = $("#form-login").serialize();
    console.log(the_serialized_data);

    $.ajax({
        url: endpoint01 + "/login",
        method: "POST",
        data: the_serialized_data,
        success: (results) => {
            // The login endpoint still returns an array of user objects
            if (Array.isArray(results) && results.length > 0) {
                localStorage.setItem("token", results[0].lasttoken);
                $(".content-wrapper").hide();
                $("#div-welcome").show();
                $(".secured").removeClass("locked");
                $(".secured").addClass("unlocked");
            } else {
                $('#login_message').html("Login Failed. Try again.");
                $('#login_message').addClass("alert alert-danger text-center");
                $("#password").val(""); // Clear password field on error
            }
        },
        error: (xhr) => {
            let msg = "Login Failed. Try again.";
            if (xhr.responseJSON && xhr.responseJSON.message) {
                msg = xhr.responseJSON.message;
            } else if (xhr.responseText) {
                msg = xhr.responseText;
            }
            $('#login_message').html(msg);
            $('#login_message').addClass("alert alert-danger text-center");
            $("#password").val(""); // Clear password field on error
        }
    });

    $("html, body").animate({ scrollTop: "0px" });
};

// Global signup controller
let signupController = () => {
    $('#signup_message').html("").removeClass();

    let data = $("#form-signup").serialize();

    $.ajax({
        url: endpoint01 + "/signup",
        method: "POST",
        data: data,
        success: () => {
            $('#signup_message')
                .html("Account created successfully! Please login.")
                .addClass("alert alert-success text-center");

            // Reset the form
            $("#form-signup")[0].reset();
        },
        error: (xhr) => {
            let msg = "Signup failed.";
            if (xhr.responseText) msg = xhr.responseText;
            $('#signup_message')
                .html(msg)
                .addClass("alert alert-danger text-center");
        }
    });
};

let startGameController = () => {
    // Clear previous messages
    $('#welcome_message').html("");
    $('#welcome_message').removeClass();

    // Get token from localStorage
    let token = localStorage.getItem("token");
    if (!token || token.trim() === "") {
        $('#welcome_message').html("Token is missing. Please login again.");
        $('#welcome_message').addClass("alert alert-danger text-center");
        return;
    }

    // Serialize token as URL-encoded data
    let data = "token=" + encodeURIComponent(token);

    $.ajax({
        url: endpoint01 + "/startgame",
        method: "POST",
        data: data,
        success: (results) => {
            // The web service returns an array of objects
            let game = Array.isArray(results) ? results[0] : results;
            $(".content-wrapper").hide();
            $("#div-game").show();

            // Populate game intro and questions/messages
            $('#intro').text(game.intro || "");
            $('#q1').text(game.q1 || "");
            $('#q2').text(game.q2 || "");
            $('#q3').text(game.q3 || "");
            $('#msg1').text(game.msg1 || "");
            $('#msg2').text(game.msg2 || "");
            $('#msg3').text(game.msg3 || "");

            // Clear previous answers and feedback
            $('#a1').val('');
            $('#a2').val('');
            $('#a3').val('');
            $('#msg1, #msg2, #msg3').css("color", "").text('');

            $("html, body").animate({ scrollTop: "0px" });
        },
        error: (xhr) => {
            let msg = "Failed to start game.";
            if (xhr.responseJSON && xhr.responseJSON.message) {
                msg = xhr.responseJSON.message;
            } else if (xhr.responseText) {
                msg = xhr.responseText;
            }
            $('#welcome_message').html(msg);
            $('#welcome_message').addClass("alert alert-danger text-center");
        }
    });
};

function showGuessResult(selector, msg) {
    // Remove quotes and trim whitespace
    let cleanMsg = msg.replace(/['"]+/g, '').trim().toLowerCase();

    // Capitalize first letter for display
    let displayMsg = cleanMsg.charAt(0).toUpperCase() + cleanMsg.slice(1);

    // Decide color and output
    if (
        cleanMsg.includes("incorrect") ||
        cleanMsg.includes("wrong") ||
        cleanMsg.includes("fail") ||
        cleanMsg.includes("try again")
    ) {
        $(selector).text(displayMsg).css("color", "red");
    } else if (
        cleanMsg.includes("correct") ||
        cleanMsg.includes("right") ||
        cleanMsg.includes("success") ||
        cleanMsg.includes("well done")
    ) {
        $(selector).text(displayMsg).css("color", "green");
    } else {
        // Neutral/other feedback
        $(selector).text(msg).css("color", "#333");
    }
}

function submitGuess(questionNum) {
    let token = localStorage.getItem("token");
    let guess = $(`#a${questionNum}`).val();
    if (!guess || guess.trim() === "") {
        showGuessResult(`#msg${questionNum}`, "Please enter an answer before submitting.");
        return;
    }
    let data = "token=" + encodeURIComponent(token) + "&guess=" + encodeURIComponent(guess);

    console.log(`[submitGuess] Submitting guess for question ${questionNum}:`, guess);

    $.ajax({
        url: `${endpoint01}/guess${questionNum}`,
        method: "PATCH",
        data: data,
        success: (results) => {
            console.log(`[submitGuess] Response for question ${questionNum}:`, results);
            let msg = results.result || results.message || results.responsetext || results.CORRECT || results.INCORRECT || JSON.stringify(results);
            showGuessResult(`#msg${questionNum}`, msg);
        },
        error: (xhr) => {
            console.log(`[submitGuess] Error for question ${questionNum}:`, xhr);
            let msg = "Error submitting guess.";
            if (xhr.responseJSON && xhr.responseJSON.message) {
                msg = xhr.responseJSON.message;
            } else if (xhr.responseJSON && xhr.responseJSON.error) {
                msg = xhr.responseJSON.error;
            } else if (xhr.responseText) {
                msg = xhr.responseText;
            }
            $(`#msg${questionNum}`).text(msg)
                .removeClass().addClass("alert alert-danger text-center")
                .css("color", "");
        }
    });
}

/* Simple confetti launcher for game completion */
function fireConfetti() {
    if (typeof confetti !== "function") {
        console.warn("[confetti] Library not loaded or unavailable.");
        return;
    }

    // Small burst + a fan for a "win" feeling
    confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
    });

    setTimeout(() => {
        confetti({
            particleCount: 80,
            spread: 120,
            scalar: 0.9,
            origin: { y: 0.2 }
        });
    }, 300);
}

function endGameController() {
    let token = localStorage.getItem("token");
    if (!token || token.trim() === "") {
        $('#confirm_message').html("Token is missing. Please login again.");
        $('#confirm_message').addClass("alert alert-danger text-center");
        $(".content-wrapper").hide();
        $("#div-login").show();
        return;
    }
    let data = "token=" + encodeURIComponent(token);

    console.log("[endGameController] Sending end game request with token:", token);

    $.ajax({
        url: endpoint01 + "/endgame",
        method: "POST",
        data: data,
        success: (results) => {
            console.log("[endGameController] End game response:", results);

            $(".content-wrapper").hide();
            $("#div-confirm").show();

            let msg = (typeof results === "string")
                ? results
                : (results.message || results.responsetext || JSON.stringify(results));

            $('#confirm_message')
                .hide()
                .html(`
                    <img src="images/check_high.png" alt="Checkmark" 
                         style="display:block; margin-left:auto; margin-right:auto; max-width:80%; height:auto;">
                    <strong>${msg}</strong>
                `)
                .removeClass()
                .addClass("text-center")
                .fadeIn(400);

            // Make the Quit button green to match success
            $('#btnQuit3')
                .removeClass("btn-primary")
                .addClass("btn-success");

            // 🎉 Fire confetti on successful completion
            fireConfetti();

            // Clear token after successful endgame
            localStorage.removeItem("token");

            $("html, body").animate({ scrollTop: "0px" });
        },
        error: (xhr) => {
            console.log("[endGameController] End game error:", xhr);
            let msg = "Error ending game.";

            if (xhr.responseJSON && xhr.responseJSON.message) {
                msg = xhr.responseJSON.message;
            } else if (xhr.responseJSON && xhr.responseJSON.error) {
                msg = xhr.responseJSON.error;
            } else if (xhr.responseText) {
                msg = xhr.responseText;
            }

            if (msg.includes("Keep Hunting")) {
                $('#endgame_message')
                    .html("Not so soon! Keep hunting and answer all the questions!")
                    .removeClass()
                    .addClass("alert alert-danger text-center");
            } else {
                $('#endgame_message')
                    .html(msg)
                    .removeClass("alert alert-success alert-danger text-center")
                    .addClass("alert alert-danger text-center mt-3 mb-3");
            }
        }
    });
}

// CancelGameController for user actions
async function cancelGameController() {
    const token = localStorage.getItem("token");
    if (!token || token.trim() === "") {
        console.warn("[cancelGameController] No token found, cancel game not sent.");
        return { ok: true, skipped: true };
    }

    console.log("[cancelGameController] Sending cancel game request with token:", token);

    // Build both query string AND body; some proxies are finicky with DELETE bodies.
    const qs = "?token=" + encodeURIComponent(token);
    const body = "token=" + encodeURIComponent(token);

    try {
        const response = await fetch(endpoint01 + "/cancelgame" + qs, {
            method: "DELETE",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            keepalive: true,
            body
        });

        let data = null;
        try { data = await response.json(); } catch (e) { /* non-JSON safe */ }

        if (response.ok) {
            console.log("[cancelGameController] Cancel game success:", data || "(no body)");
            return { ok: true };
        } else {
            console.error("[cancelGameController] Cancel game error:", data || response.status);
            return { ok: false, status: response.status, data };
        }
    } catch (err) {
        console.error("[cancelGameController] Cancel game fetch exception:", err);
        return { ok: false, error: String(err) };
    }
}

// For page unload, attempt a best-effort DELETE with keepalive.
window.addEventListener("beforeunload", function () {
    const token = localStorage.getItem("token");
    if (!token || token.trim() === "") {
        console.warn("[beforeunload] No token found, cancel game not sent.");
        return;
    }
    console.log("[beforeunload] Sending cancel game (DELETE keepalive).");

    const qs = "?token=" + encodeURIComponent(token);
    const body = "token=" + encodeURIComponent(token);

    try {
        fetch(endpoint01 + "/cancelgame" + qs, {
            method: "DELETE",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            keepalive: true,
            body
        }).catch(() => {});
    } catch (_) {}
});

let allResults = [];   // kept for possible future use
let improvementChart = null; // not currently used, left for future

let leaderboardBarChart = null;

function loadLeaderboard() {
    $.ajax({
        url: endpoint01 + "/leaderboard",
        method: "GET",
        success: (results) => {
            console.log("[Leaderboard] Top 5:", results);

            /* ----------------------
               PODIUM (Top 3 users)
               ---------------------- */
            $("#podiumContainer").show();
            $("#podium1").text(results[0]?.username ?? "");
            $("#podium2").text(results[1]?.username ?? "");
            $("#podium3").text(results[2]?.username ?? "");

            /* ----------------------
               HORIZONTAL BAR CHART
               ---------------------- */

            if (leaderboardBarChart !== null) {
                leaderboardBarChart.destroy();
            }

            let ctx = document.getElementById("leaderboardBarChart").getContext("2d");

            leaderboardBarChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: results.map(r => r.username),
                    datasets: [{
                        label: "Seconds",
                        data: results.map(r => r.seconds),
                        backgroundColor: [
                            "rgba(255, 215, 0, 0.7)",   // Gold
                            "rgba(192, 192, 192, 0.7)", // Silver
                            "rgba(205, 127, 50, 0.7)",  // Bronze
                            "rgba(220, 53, 69, 0.6)",   // Temple Red
                            "rgba(220, 53, 69, 0.6)"    // Temple Red
                        ],
                        borderColor: [
                            "gold",
                            "silver",
                            "#cd7f32",
                            "rgb(220,53,69)",
                            "rgb(220,53,69)"
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            title: { display: true, text: "Seconds" }
                        }
                    }
                }
            });
        },
        error: (xhr) => {
            console.error("[Leaderboard] Error:", xhr);
            $("#leaderboard_message").html(
                `<div class="alert alert-danger text-center">Error loading leaderboard.</div>`
            );
        }
    });
}

// document ready section
$(document).ready(() => {

    $("html, body").animate({ scrollTop: "0px" });

    /* ----------------- start up navigation -----------------*/

    $(".secured").removeClass("unlocked");
    $(".secured").addClass("locked");

    if (localStorage.token) {
        $(".secured").removeClass("locked");
        $(".secured").addClass("unlocked");
        $("#div-welcome").show();
    } else {
        $("#div-login").show();
    }

    /* ------------------  basic navigation -----------------*/

    // Collapse navbar on any nav-link click
    $('.nav-link').click(() => {
        $("html, body").animate({ scrollTop: "0px" });
        $(".navbar-collapse").collapse('hide');
    });

    // Leaderboard link in nav
    $('#link-leaderboard').click(() => {
        $(".content-wrapper").hide();
        $("#div-leaderboard").show();
        loadLeaderboard();
    });

    // Home button on leaderboard
    $('#btnHome').click(() => {
        $(".content-wrapper").hide();
        $("#div-welcome").show();
    });

    // Leaderboard button on welcome
    $('#btnLeaderboard').click(() => {
        $(".content-wrapper").hide();
        $("#div-leaderboard").show();
        loadLeaderboard();
    });

    // Login button
    $('#btnLogin').click(() => {
        loginController();
    });

    // Quit / Logout links
    $('#btnQuit,#link-logout').click(() => {
        cancelGameController();
        $(".content-wrapper").hide();
        localStorage.removeItem("token");
        window.location = "./index.html";
    });

    $('#btnQuit2,#link-logout').click(() => {
        cancelGameController();
        $(".content-wrapper").hide();
        localStorage.removeItem("token");
        window.location = "./index.html";
    });

    $('#btnQuit3,#link-logout').click(() => {
        cancelGameController();
        $(".content-wrapper").hide();
        localStorage.removeItem("token");
        window.location = "./index.html";
    });

    // Home link in nav
    $('#link-home').click(() => {
        $(".content-wrapper").hide();
        $("#div-welcome").show();
    });

    // Start game button
    $('#btnStartGame').click(() => {
        startGameController();
    });

    // End game button
    $('#btnEndGame').click(() => {
        endGameController();
    });

    // (Legacy) Button for extra leaderboard view if present
    $('#btnLeaderboard2').click(() => {
        $(".content-wrapper").hide();
        $("#div-leaderboard").show();
        loadLeaderboard();
    });

    // Guess buttons
    $('#btnCheck1').click(() => submitGuess(1));
    $('#btnCheck2').click(() => submitGuess(2));
    $('#btnCheck3').click(() => submitGuess(3));

    // Open signup page
    $("#link-signup").click(function (e) {
        e.preventDefault();
        $(".content-wrapper").hide();
        $("#div-signup").show();
    });

    // Signup button
    $("#btnSignup").click(function () {
        signupController();
    });

    // Back to Login from signup
    $("#btnSignupBack").click(function () {
        $("#signup_message").html("").removeClass();
        $(".content-wrapper").hide();
        $("#div-login").show();
    });

    // Accessibility: ARIA attributes
    $('.navbar').attr('role', 'navigation').attr('aria-label', 'Main Navigation');
    $('.nav-link').attr('role', 'link');
    $('input[type="button"]').attr('role', 'button');
    $('#form-login').attr('aria-label', 'Login Form');
    $('#username').attr('aria-label', 'User name');
    $('#password').attr('aria-label', 'Password');
}); /* end the document ready event */
