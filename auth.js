/* Вікно входу й реєстрації — ОДНА реалізація на весь сайт.
 *
 * НАВІЩО ОКРЕМИЙ ФАЙЛ. Реєстрація жила всередині app.html за якорем #gate:
 * щоб її знайти, треба було здогадатись перейти на другу сторінку й
 * проскролити. Тепер вхід і реєстрація — дві кнопки в шапці на кожній
 * сторінці, а форма відкривається поверх, не забираючи людину зі сторінки,
 * яку вона читала.
 *
 * Файл спільний навмисно: сайт статичний, без збірки, і копія цієї логіки
 * на двох сторінках розійшлася б за перший же тиждень. На цьому лендінг уже
 * попікся — демо колись рахувало власний скоринг у JavaScript і показувало
 * не те, що продукт.
 *
 * ЩО ТУТ ВІДБУВАЄТЬСЯ НАСПРАВДІ
 *   Реєстрація — через API продукту: пошта → код у листі → одноразове
 *   посилання, яке відкриває кабінет. Куку на app.depositscope.com звідси
 *   поставити неможливо (інший домен), тому саме посилання, а не fetch.
 *
 *   Вхід — звичайний POST форми прямо на app.depositscope.com/login.
 *   Своєї форми входу тут НЕМАЄ і не має бути: друга реалізація авторизації
 *   означала б власну обробку помилок, свій Google SSO і свою поведінку на
 *   протухлій сесії. Браузер сам віднесе логін і пароль туди, де вони
 *   перевіряються, і там же поставить куку.
 */
(function () {
  "use strict";

  var API = "https://app.depositscope.com";
  var STORAGE_KEY = "ds_api_key";

  var MODAL = [
    '<div class="auth-backdrop" id="authBackdrop" hidden>',
    '  <div class="auth-card" role="dialog" aria-modal="true" aria-labelledby="authTitle">',
    '    <button class="auth-x" id="authClose" aria-label="Close">&times;</button>',
    '    <div class="auth-logo">Deposit<span>Scope</span></div>',
    '    <h2 class="auth-title" id="authTitle">Create your account</h2>',
    '    <div class="auth-tabs" role="tablist">',
    '      <button class="auth-tab on" data-tab="signup" role="tab">Sign up</button>',
    '      <button class="auth-tab" data-tab="login" role="tab">Log in</button>',
    '    </div>',
    '    <a class="auth-google" href="' + API + '/auth/google?next=/app">',
    '      <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">',
    '        <path fill="#4285F4" d="M45 24.5c0-1.6-.1-2.8-.4-4H24v7.5h12c-.2 2-1.5 5-4.4 7l6.7 5.2c4-3.7 6.7-9.1 6.7-15.7z"/>',
    '        <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.9 1.3-4.4 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-7.1 5.5C8 40.4 15.4 46 24 46z"/>',
    '        <path fill="#FBBC05" d="M11.5 28.4a13.5 13.5 0 0 1 0-8.8l-7.1-5.5a22 22 0 0 0 0 19.8z"/>',
    '        <path fill="#EA4335" d="M24 9.5c3.2 0 6 1.1 8.2 3.2l6.1-6.1C34.9 3.1 29.9 1 24 1 15.4 1 8 6.6 4.4 14.1l7.1 5.5C13.3 14.3 18.2 9.5 24 9.5z"/>',
    '      </svg><span>Continue with Google</span></a>',
    '    <div class="auth-or"><span>or</span></div>',

    /* --- реєстрація --- */
    '    <form class="auth-pane" id="paneSignup" novalidate>',
    '      <label for="authEmail">Work email</label>',
    '      <input id="authEmail" type="email" autocomplete="email" placeholder="you@casino.com" required>',
    '      <label for="authCompany">Casino <span class="auth-opt">(optional)</span></label>',
    '      <input id="authCompany" autocomplete="organization" placeholder="Brand or company">',
    '      <button class="auth-go" id="authSignup" type="submit">Create account</button>',
    '      <p class="auth-fine">Confirming your email opens the product itself — the same',
    '         scoring and the same label database that answers every API call.</p>',
    '    </form>',

    /* --- код із листа --- */
    '    <form class="auth-pane" id="paneCode" hidden novalidate>',
    '      <p class="auth-sent" id="authSentTo"></p>',
    '      <label for="authCode">6-digit code</label>',
    '      <input id="authCode" inputmode="numeric" maxlength="6" placeholder="000000" required>',
    '      <button class="auth-go" id="authVerify" type="submit">Confirm</button>',
    '      <p class="auth-fine">Didn\'t arrive? <a href="#" id="authResend">Send it again</a></p>',
    '    </form>',

    /* --- вхід: форма веде прямо в продукт --- */
    '    <form class="auth-pane" id="paneLogin" hidden method="post" action="' + API + '/login">',
    '      <input type="hidden" name="next" value="/app">',
    '      <label for="authUser">Email</label>',
    '      <input id="authUser" name="username" type="email" autocomplete="email" required>',
    '      <label for="authPass">Password</label>',
    '      <input id="authPass" name="password" type="password" autocomplete="current-password" required>',
    '      <button class="auth-go" type="submit">Sign in</button>',
    '      <p class="auth-fine"><a href="' + API + '/forgot">Forgot your password?</a></p>',
    '    </form>',

    '    <p class="auth-err" id="authErr" hidden></p>',
    '  </div>',
    '</div>'
  ].join("");

  var CSS = [
    '.auth-backdrop{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;',
    '  justify-content:center;padding:20px;background:rgba(4,3,10,.82);backdrop-filter:blur(6px)}',
    '.auth-backdrop[hidden]{display:none}',
    '.auth-card{position:relative;width:100%;max-width:380px;background:#12111f;',
    '  border:1px solid #26243d;border-radius:18px;padding:28px 26px;',
    '  max-height:calc(100vh - 40px);overflow-y:auto}',
    '.auth-x{position:absolute;top:12px;right:14px;background:none;border:0;color:#8f93ad;',
    '  font-size:24px;line-height:1;cursor:pointer;padding:4px 8px}',
    '.auth-x:hover{color:#eef0fa}',
    '.auth-logo{font-size:19px;font-weight:800;text-align:center;color:#eef0fa;margin-bottom:4px}',
    '.auth-logo span{background:linear-gradient(90deg,#7c5cff,#22d3ee);-webkit-background-clip:text;',
    '  background-clip:text;color:transparent}',
    '.auth-title{font-size:15px;font-weight:600;text-align:center;color:#8f93ad;margin:0 0 18px}',
    '.auth-tabs{display:flex;gap:6px;background:#1a1830;border-radius:11px;padding:4px;margin-bottom:18px}',
    '.auth-tab{flex:1;background:none;border:0;border-radius:8px;color:#8f93ad;font:inherit;',
    '  font-size:13.5px;font-weight:600;padding:8px;cursor:pointer}',
    '.auth-tab.on{background:#12111f;color:#eef0fa}',
    '.auth-google{display:flex;align-items:center;justify-content:center;gap:9px;',
    '  border:1px solid #26243d;border-radius:11px;padding:11px;color:#eef0fa;',
    '  text-decoration:none;font-size:13.5px;font-weight:600}',
    '.auth-google:hover{border-color:#7c5cff}',
    '.auth-or{display:flex;align-items:center;gap:10px;color:#8f93ad;font-size:12px;margin:14px 0}',
    '.auth-or::before,.auth-or::after{content:"";flex:1;height:1px;background:#26243d}',
    '.auth-pane label{display:block;font-size:12px;color:#8f93ad;margin-bottom:6px}',
    '.auth-opt{opacity:.6}',
    '.auth-pane input{width:100%;background:#1a1830;border:1px solid #26243d;border-radius:10px;',
    '  color:#eef0fa;padding:11px 13px;font:inherit;font-size:14px;margin-bottom:14px}',
    '.auth-pane input:focus{outline:none;border-color:#7c5cff}',
    '.auth-go{width:100%;background:linear-gradient(90deg,#7c5cff,#22d3ee);border:0;border-radius:11px;',
    '  color:#fff;font:inherit;font-size:14px;font-weight:700;padding:12px;cursor:pointer}',
    '.auth-go[disabled]{opacity:.55;cursor:default}',
    '.auth-fine{color:#8f93ad;font-size:12px;line-height:1.5;margin:12px 0 0}',
    '.auth-fine a{color:#22d3ee;text-decoration:none}',
    '.auth-sent{color:#8f93ad;font-size:13px;line-height:1.5;margin:0 0 14px}',
    '.auth-err{background:#2a1520;color:#ff5c7a;border-radius:10px;padding:10px 13px;',
    '  font-size:12.5px;line-height:1.45;margin:14px 0 0}',
    '.auth-err[hidden]{display:none}',
    '@media (prefers-reduced-motion:no-preference){.auth-card{animation:authIn .16s ease-out}}',
    '@keyframes authIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}'
  ].join("");

  function inject() {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    var host = document.createElement("div");
    host.innerHTML = MODAL;
    document.body.appendChild(host.firstChild);
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else { fn(); }
  }

  ready(function () {
    inject();

    var $ = function (id) { return document.getElementById(id); };
    var back = $("authBackdrop");
    var err = $("authErr");
    var panes = { signup: $("paneSignup"), code: $("paneCode"), login: $("paneLogin") };
    var TITLES = { signup: "Create your account", code: "Check your inbox", login: "Sign in to your account" };
    var pendingEmail = "";
    var lastFocus = null;

    function fail(text) { err.textContent = text; err.hidden = false; }
    function clearErr() { err.hidden = true; }

    function pane(name) {
      Object.keys(panes).forEach(function (k) { panes[k].hidden = k !== name; });
      $("authTitle").textContent = TITLES[name];
      // Google має сенс і для входу, і для реєстрації, а на кроці з кодом
      // він збиває: людина вже почала одну дорогу.
      var showSocial = name !== "code";
      document.querySelector(".auth-google").hidden = !showSocial;
      document.querySelector(".auth-or").hidden = !showSocial;
      document.querySelector(".auth-tabs").hidden = name === "code";
      Array.prototype.forEach.call(document.querySelectorAll(".auth-tab"), function (t) {
        t.classList.toggle("on", t.dataset.tab === name);
      });
      clearErr();
      var first = panes[name].querySelector("input:not([type=hidden])");
      if (first) { try { first.focus(); } catch (e) { /* ігноруємо */ } }
    }

    function open(which) {
      lastFocus = document.activeElement;
      back.hidden = false;
      document.body.style.overflow = "hidden";
      pane(which || "signup");
    }

    function close() {
      back.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    // Тригери: будь-який елемент із data-auth. Так сторінці не треба знати
    // нічого про внутрішній устрій вікна.
    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-auth]") : null;
      if (!t) return;
      e.preventDefault();
      open(t.getAttribute("data-auth"));
    });

    $("authClose").addEventListener("click", close);
    back.addEventListener("mousedown", function (e) { if (e.target === back) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !back.hidden) close();
    });
    Array.prototype.forEach.call(document.querySelectorAll(".auth-tab"), function (t) {
      t.addEventListener("click", function () { pane(t.dataset.tab); });
    });

    /* ---------- реєстрація ---------- */

    function refusal(body, fallback) {
      var d = body && body.detail;
      if (d && typeof d === "object" && d.code) {
        var EN = {
          invalid_email: "That does not look like an email address.",
          disposable_email: "Please use a work email, not a disposable one.",
          ip_quota: "Too many sign-ups from this network today. Write to us instead.",
          code_expired: "The code expired. Ask for a new one — it is quick.",
          code_mismatch: "That code does not match. Check the email and try again.",
          too_many_attempts: "Too many attempts. Ask for a new code.",
          no_signup: "Enter your email first — we will send a code.",
          already_verified: "This email is already confirmed. Use Log in.",
          resend_too_soon: "A code was just sent. Wait a moment before asking for another.",
          send_failed: "Could not send the email. Try again in a minute, or write to us."
        };
        // ЖОДНОГО d.message тут: сервер віддає його українською (DemoError
        // навмисно розділяє код для машини й текст для людей на нашому
        // боці — див. depositscope/core/demo.py). Якщо колись зʼявиться
        // код без запису в EN, хай покаже загальний fallback, а не кирилицю.
        return EN[d.code] || fallback;
      }
      return fallback;
    }

    panes.signup.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("authEmail").value.trim();
      if (!email) return;
      var btn = $("authSignup");
      btn.disabled = true;
      clearErr();
      fetch(API + "/v1/demo/signup", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email, company: $("authCompany").value.trim() || null })
      }).then(function (r) {
        return r.json().then(function (b) { return { ok: r.ok, body: b }; });
      }).then(function (res) {
        if (!res.ok) throw new Error(refusal(res.body, "Sign-up failed"));
        pendingEmail = email;
        if (res.body.verification_required) {
          $("authSentTo").textContent = "We sent a 6-digit code to " + email +
            ". It expires in 15 minutes.";
          pane("code");
        } else {
          done(res.body);
        }
      }).catch(function (e2) {
        fail(e2.message || "Sign-up failed");
      }).then(function () { btn.disabled = false; });
    });

    panes.code.addEventListener("submit", function (e) {
      e.preventDefault();
      var code = $("authCode").value.trim();
      if (!code) return;
      var btn = $("authVerify");
      btn.disabled = true;
      clearErr();
      fetch(API + "/v1/demo/verify", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, code: code })
      }).then(function (r) {
        return r.json().then(function (b) { return { ok: r.ok, body: b }; });
      }).then(function (res) {
        if (!res.ok) throw new Error(refusal(res.body, "Could not confirm the code"));
        done(res.body);
      }).catch(function (e2) {
        fail(e2.message || "Could not confirm the code");
      }).then(function () { btn.disabled = false; });
    });

    $("authResend").addEventListener("click", function (e) {
      e.preventDefault();
      clearErr();
      fetch(API + "/v1/demo/resend", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: pendingEmail })
      }).then(function (r) {
        return r.json().then(function (b) { return { ok: r.ok, body: b }; });
      }).then(function (res) {
        if (!res.ok) throw new Error(refusal(res.body, "Could not resend the code"));
        $("authSentTo").textContent = "A new code is on its way to " + pendingEmail + ".";
      }).catch(function (e2) { fail(e2.message || "Could not resend the code"); });
    });

    function done(body) {
      // Куку на app.depositscope.com звідси не поставити — інший домен.
      // Сервер віддає одноразове посилання входу, і ми ведемо людину туди,
      // поки її інтерес найгарячіший.
      if (body.api_key) {
        try { localStorage.setItem(STORAGE_KEY, body.api_key); } catch (e) { /* приватний режим */ }
      }
      if (body.enter_url) {
        $("authSentTo").textContent = "Done — opening your dashboard…";
        window.location = body.enter_url;
        return;
      }
      window.location = API + "/login";
    }
  });
})();
