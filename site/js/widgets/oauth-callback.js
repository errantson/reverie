import a from "./oauth-manager.js";
(async () => {
  const o = document.getElementById("status"), e = document.getElementById("error");
  function n(t) {
    o && (o.textContent = t), console.log("OAuth Callback:", t);
  }
  function r(t) {
    e && (e.textContent = t), console.error("OAuth Callback Error:", t);
  }
  try {
    if (n("Processing authorization..."), await a.init(), a.getSession()) {
      n("Login successful! Redirecting...");
      const s = new URLSearchParams(window.location.search).get("state") || "/story";
      console.log("🏠 Redirecting to:", s), setTimeout(() => {
        window.location.href = s;
      }, 500);
    } else
      r("No session created"), setTimeout(() => {
        window.location.href = "/";
      }, 2e3);
  } catch (t) {
    console.error("Callback error:", t), r(`Login failed: ${t.message}`), setTimeout(() => {
      window.location.href = "/";
    }, 3e3);
  }
})();
