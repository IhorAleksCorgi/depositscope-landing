/* Вікно «Book a demo» — заявка на розмову з командою.
 *
 * Це НЕ реєстрація: акаунт і перевірки дає auth.js («Get 10 free verdicts»).
 * Тут людина лише просить зателефонувати, і заявка йде в продукт
 * (POST /v1/demo/request) — там вона лягає в базу й одразу в Telegram
 * команди. Пошти звідси не шлемо: mailto губив заявку, якщо в людини не
 * налаштований поштовий клієнт, і ми про неї навіть не дізнавались.
 *
 * Тригер — будь-який елемент із data-demo; значення атрибута («pilot»,
 * «enterprise», «nav») їде в заявку як source, щоб знати, з якої кнопки
 * прийшла людина.
 */
(function () {
  "use strict";

  var API = "https://app.depositscope.com";

  var MODAL = [
    '<div class="demo-backdrop" id="demoBackdrop" hidden>',
    '  <div class="demo-card" role="dialog" aria-modal="true" aria-labelledby="demoTitle">',
    '    <button class="demo-x" id="demoClose" aria-label="Close">&times;</button>',
    '    <div id="demoFormWrap">',
    '      <h2 class="demo-title" id="demoTitle">Request a personal demo</h2>',
    '      <p class="demo-lede">On the call we\'ll look at how you handle first deposits today and run',
    '        DepositScope on real wallets — VIP score, risk and gambling footprint, live.</p>',
    '      <form class="demo-form" id="demoForm" novalidate>',
    '        <div class="demo-f"><input id="dName" name="name" placeholder=" " autocomplete="name" required maxlength="120">',
    '          <label for="dName">First and last name *</label></div>',
    '        <div class="demo-f"><input id="dEmail" name="email" type="email" placeholder=" " autocomplete="email" required maxlength="200">',
    '          <label for="dEmail">Work email *</label></div>',
    '        <div class="demo-f"><input id="dPhone" name="phone" placeholder=" " autocomplete="tel" required maxlength="64">',
    '          <label for="dPhone">Phone or Telegram *</label></div>',
    '        <div class="demo-row">',
    '          <div class="demo-f"><input id="dCompany" name="company" placeholder=" " autocomplete="organization" required maxlength="160">',
    '            <label for="dCompany">Company *</label></div>',
    '          <div class="demo-f"><input id="dPosition" name="position" placeholder=" " autocomplete="organization-title" maxlength="120">',
    '            <label for="dPosition">Position</label></div>',
    '        </div>',
    '        <div class="demo-f"><textarea id="dMessage" name="message" placeholder=" " rows="2" maxlength="2000"></textarea>',
    '          <label for="dMessage">Message</label></div>',
    // Пастка для ботів: людина цього поля не бачить і не дістанеться табом.
    '        <div class="demo-hp" aria-hidden="true"><input id="dWebsite" name="website" tabindex="-1" autocomplete="off"></div>',
    '        <div class="demo-err" id="demoErr" role="alert" hidden></div>',
    '        <button class="demo-go" id="demoGo" type="submit">Book a demo <span aria-hidden="true">&rarr;</span></button>',
    '        <p class="demo-fine">We use these details only to arrange the call — see our',
    '          <a href="/privacy.html">Privacy Policy</a>.</p>',
    '      </form>',
    '    </div>',
    '    <div class="demo-done" id="demoDone" hidden>',
    '      <div class="demo-ok" aria-hidden="true">&#10003;</div>',
    '      <h2 class="demo-title">Thank you — we\'ll be in touch</h2>',
    '      <p class="demo-lede">We\'ll reach out within one business day to pick a time.',
    '        Can\'t wait? Write to <a href="mailto:hello@depositscope.com">hello@depositscope.com</a>.</p>',
    '      <button class="demo-go demo-go-ghost" id="demoDoneClose" type="button">Close</button>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join("");

  var CSS = [
    '.demo-backdrop{position:fixed;inset:0;z-index:100;background:rgba(4,3,10,.72);',
    '  backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.demo-backdrop[hidden]{display:none}',
    '.demo-card{position:relative;width:100%;max-width:640px;background:#12111f;',
    '  border:1px solid #26243d;border-radius:22px;padding:48px 56px 36px;',
    '  max-height:calc(100vh - 32px);overflow-y:auto;color:#eef0fa;',
    '  box-shadow:0 30px 80px rgba(0,0,0,.5),0 0 0 1px rgba(124,92,255,.08)}',
    '.demo-x{position:absolute;top:14px;right:16px;background:none;border:0;color:#8f93ad;',
    '  font-size:26px;line-height:1;cursor:pointer;padding:4px 8px}',
    '.demo-x:hover{color:#eef0fa}',
    '.demo-title{font-size:clamp(26px,4.4vw,36px);font-weight:800;letter-spacing:-1px;',
    '  line-height:1.12;text-align:center;margin:0}',
    '.demo-lede{color:#9297b3;font-size:15px;line-height:1.55;text-align:center;',
    '  max-width:460px;margin:14px auto 0}',
    '.demo-lede a{color:#22d3ee}',
    '.demo-form{margin-top:30px}',
    '.demo-row{display:grid;grid-template-columns:1fr 1fr;gap:28px}',
    /* Поле як на макеті: без рамки, лише лінія знизу; підпис стоїть
       плейсхолдером і підіймається, коли в полі щось є або на ньому фокус. */
    '.demo-f{position:relative;margin-bottom:22px}',
    '.demo-f input,.demo-f textarea{width:100%;background:transparent;border:0;',
    '  border-bottom:1px solid #2f2c4a;border-radius:0;color:#eef0fa;font:inherit;',
    '  font-size:16px;padding:22px 0 9px;outline:none;resize:vertical;transition:border-color .15s}',
    '.demo-f textarea{min-height:52px}',
    '.demo-f input:focus,.demo-f textarea:focus{border-bottom-color:#7c5cff}',
    '.demo-f label{position:absolute;left:0;top:22px;color:#8f93ad;font-size:16px;',
    '  pointer-events:none;transition:all .15s}',
    '.demo-f input:focus+label,.demo-f input:not(:placeholder-shown)+label,',
    '.demo-f textarea:focus+label,.demo-f textarea:not(:placeholder-shown)+label{',
    '  top:0;font-size:12px;color:#a594ff}',
    '.demo-f.bad input,.demo-f.bad textarea{border-bottom-color:#ff5c7a}',
    '.demo-f.bad label{color:#ff5c7a}',
    '.demo-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}',
    '.demo-go{width:100%;margin-top:8px;background:linear-gradient(90deg,#7c5cff,#22d3ee);',
    '  border:0;border-radius:13px;color:#fff;font:inherit;font-size:14px;font-weight:700;',
    '  letter-spacing:1.6px;text-transform:uppercase;padding:18px;cursor:pointer;',
    '  box-shadow:0 4px 24px rgba(124,92,255,.35);transition:.18s}',
    '.demo-go:hover{filter:brightness(1.12)}',
    '.demo-go[disabled]{opacity:.55;cursor:default;filter:none}',
    '.demo-go-ghost{background:none;border:1px solid #26243d;box-shadow:none;margin-top:28px}',
    '.demo-go-ghost:hover{border-color:#7c5cff}',
    '.demo-fine{color:#8f93ad;font-size:12px;text-align:center;margin:14px 0 0}',
    '.demo-fine a{color:#22d3ee}',
    '.demo-err{background:#2a1520;color:#ff5c7a;border-radius:10px;padding:10px 13px;',
    '  font-size:13px;line-height:1.45;margin:0 0 6px}',
    '.demo-err[hidden]{display:none}',
    '.demo-done{text-align:center;padding:12px 0 4px}',
    '.demo-done[hidden]{display:none}',
    '.demo-ok{width:58px;height:58px;margin:0 auto 18px;border-radius:50%;display:flex;',
    '  align-items:center;justify-content:center;font-size:28px;color:#2ee6a8;',
    '  background:rgba(46,230,168,.12);border:1px solid rgba(46,230,168,.35)}',
    '@media (max-width:600px){.demo-card{padding:40px 20px 24px;border-radius:18px}',
    '  .demo-row{grid-template-columns:1fr;gap:0}}',
    '@media (prefers-reduced-motion:no-preference){.demo-card{animation:demoIn .18s ease-out}}',
    '@keyframes demoIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'
  ].join("");

  // Коди відмов сервера → англійський текст. d.message не показуємо ніколи:
  // сервер віддає його українською (див. depositscope/core/leads.py).
  var EN = {
    invalid_email: "That does not look like an email address.",
    disposable_email: "Please use a work email, not a disposable one.",
    name_required: "Please tell us your name.",
    phone_required: "Please leave a phone number or Telegram handle.",
    company_required: "Please tell us which company you are with.",
    too_long: "One of the fields is too long — please shorten it.",
    ip_quota: "We already have several requests from your network today. Write to hello@depositscope.com instead."
  };
  var FALLBACK = "Could not send the request. Try again, or write to hello@depositscope.com.";

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  ready(function () {
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    var host = document.createElement("div");
    host.innerHTML = MODAL;
    document.body.appendChild(host.firstChild);

    var $ = function (id) { return document.getElementById(id); };
    var back = $("demoBackdrop"), form = $("demoForm"), err = $("demoErr");
    var source = "", lastFocus = null;

    function fail(text) { err.textContent = text; err.hidden = false; }

    function open(src) {
      source = src || "";
      lastFocus = document.activeElement;
      $("demoFormWrap").hidden = false;
      $("demoDone").hidden = true;
      err.hidden = true;
      back.hidden = false;
      document.body.style.overflow = "hidden";
      try { $("dName").focus(); } catch (e) { /* ігноруємо */ }
    }

    function close() {
      back.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("[data-demo]") : null;
      if (!t) return;
      e.preventDefault();
      open(t.getAttribute("data-demo"));
    });
    $("demoClose").addEventListener("click", close);
    $("demoDoneClose").addEventListener("click", close);
    back.addEventListener("mousedown", function (e) { if (e.target === back) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !back.hidden) close();
    });
    Array.prototype.forEach.call(form.querySelectorAll("input,textarea"), function (el) {
      el.addEventListener("input", function () { el.parentNode.classList.remove("bad"); });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var v = function (id) { return $(id).value.trim(); };
      // Сервер перевірить сам; тут — лише щоб підсвітити порожнє поле,
      // а не ганяти запит заради відмови.
      var missing = ["dName", "dEmail", "dPhone", "dCompany"].filter(function (id) { return !v(id); });
      missing.forEach(function (id) { $(id).parentNode.classList.add("bad"); });
      if (missing.length) {
        fail("Please fill in the fields marked with *.");
        $(missing[0]).focus();
        return;
      }
      var btn = $("demoGo");
      btn.disabled = true;
      fetch(API + "/v1/demo/request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: v("dName"), email: v("dEmail"), phone: v("dPhone"), company: v("dCompany"),
          position: v("dPosition") || null, message: v("dMessage") || null,
          source: source || null, website: $("dWebsite").value || null
        })
      }).then(function (r) {
        return r.json().then(function (b) { return { ok: r.ok, body: b }; });
      }).then(function (res) {
        if (!res.ok) {
          var d = res.body && res.body.detail;
          throw { shown: (d && d.code && EN[d.code]) || FALLBACK };
        }
        form.reset();
        $("demoFormWrap").hidden = true;
        $("demoDone").hidden = false;
      }).catch(function (e2) {
        // Мережева помилка браузера («Failed to fetch», «Load failed»…) — це
        // текст для розробника, а не для людини: показуємо лише свої.
        fail((e2 && e2.shown) || FALLBACK);
      }).then(function () { btn.disabled = false; });
    });
  });
})();
