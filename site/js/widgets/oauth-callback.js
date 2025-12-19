import a from "./oauth-manager.js";
(async () => {
  document.getElementById("status");
  const n = document.getElementById("error");
  function s(t, e = !1) {
    n && (n.textContent = t, n.classList.remove("hidden")), e || console.warn("OAuth callback:", t);
  }
  try {
    if (await a.init(), a.getSession()) {
      const c = new URLSearchParams(window.location.search).get("state") || "/story";
      window.location.replace(c);
    } else
      s("Login was cancelled", !0), setTimeout(() => window.location.replace("/"), 1500);
  } catch (t) {
    let e = t.message || "Login failed";
    const o = e.includes("rejected") || e.includes("cancelled");
    o && (e = "Login was cancelled"), s(e, o), setTimeout(() => window.location.replace("/"), 1500);
  }
})();
