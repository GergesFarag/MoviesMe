  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
  import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    RecaptchaVerifier,
    signInWithPhoneNumber,
  } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

  const firebaseConfig = {
    apiKey: "AIzaSyAVdx4hQAviTmiE7_vVmoaSyb3lx1hachY",
    authDomain: "ttov-a9677.firebaseapp.com",
    projectId: "ttov-a9677",
    appId: "1:57747989938:web:e4af38b054fd30014130ab",
  };
  
  let confirmationResult;
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
    size: "normal",
    callback: (response) => {
      console.log("reCAPTCHA solved:", response);
    },
  });

  window.sendOTP = async function () {
    const phone = document.getElementById("phone").value;
    try {
      confirmationResult = await signInWithPhoneNumber(
        auth,
        phone,
        window.recaptchaVerifier
      );
      alert("OTP sent!");
    } catch (err) {
      console.log("Confirmation Result:", confirmationResult);
      alert("Error sending OTP: " + err.message);
    }
  };

  window.verifyOTP = async function () {
    const code = document.getElementById("otp").value;
    try {
      const result = await confirmationResult.confirm(code);
      const idToken = await result.user.getIdToken();

      console.log("ID Token:", idToken);

      // Send to backend
      // fetch("http://localhost:3000/api/v1/auth/phoneLogin", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //     Authorization: `Bearer ${idToken}`,
      //   },
      // })
      //   .then((res) => res.json())
      //   .then((data) => console.log("RESPONSE: ", JSON.stringify(data)))
      //   .catch((err) => console.error("Error from backend:", err));
    } catch (err) {
      alert("Invalid OTP: " + err.message);
    }
  };
