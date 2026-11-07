// Injected into every recorded page (read from disk as text, so tsx never compiles it).
// Cursor dot + click ripple (Playwright doesn't draw the mouse), a "signed in as" pill, and a safety net
// that blurs any e-mail address that isn't a @demo.freshshare.de demo account.
(function () {
  var LABEL = window.__demoLabel || "";
  var EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
  var DEMO = /@demo\.freshshare\.de$/i;

  function scan(root) {
    if (!root) return;
    if (root.nodeType === 3) root = root.parentNode;
    if (!root || root.nodeType !== 1) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (var n = walker.nextNode(); n; n = walker.nextNode()) {
      var ms = (n.textContent || "").match(EMAIL);
      if (!ms) continue;
      for (var i = 0; i < ms.length; i++) {
        if (!DEMO.test(ms[i]) && n.parentElement) {
          n.parentElement.classList.add("__demo_blur");
          break;
        }
      }
    }
    // Inputs: a demo address being typed ("...@demo.fr") counts as demo; re-checked as the value changes.
    var inputs = root.querySelectorAll("input,textarea");
    for (var j = 0; j < inputs.length; j++) {
      var mv = (inputs[j].value || "").match(EMAIL);
      var domain = mv ? mv[0].split("@")[1].toLowerCase() : "";
      var real = mv && !DEMO.test(mv[0]) && "demo.freshshare.de".indexOf(domain) !== 0;
      inputs[j].classList.toggle("__demo_blur", !!real);
    }
  }

  function install() {
    if (document.getElementById("__demo_cursor")) return;
    var style = document.createElement("style");
    style.textContent =
      "#__demo_cursor{position:fixed;left:-40px;top:-40px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;" +
      "background:rgba(232,147,68,.9);border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);z-index:2147483647;pointer-events:none;transition:transform .12s}" +
      "#__demo_cursor.down{transform:scale(.7)}" +
      ".__demo_ripple{position:fixed;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:3px solid #e89344;" +
      "z-index:2147483646;pointer-events:none;animation:__demo_r .55s ease-out forwards}" +
      "@keyframes __demo_r{to{transform:scale(4.5);opacity:0}}" +
      "#__demo_who{position:fixed;right:14px;bottom:96px;z-index:2147483645;pointer-events:none;font:600 15px/1 'Segoe UI',system-ui,sans-serif;" +
      "color:#fff;background:rgba(63,107,53,.92);padding:8px 14px;border-radius:999px;box-shadow:0 2px 8px rgba(0,0,0,.25)}" +
      ".__demo_blur{filter:blur(7px)!important}";
    document.documentElement.appendChild(style);

    var dot = document.createElement("div");
    dot.id = "__demo_cursor";
    document.documentElement.appendChild(dot);
    if (LABEL) {
      var who = document.createElement("div");
      who.id = "__demo_who";
      who.textContent = LABEL;
      document.documentElement.appendChild(who);
    }
    addEventListener("mousemove", function (e) {
      dot.style.left = e.clientX + "px";
      dot.style.top = e.clientY + "px";
    }, true);
    addEventListener("mousedown", function (e) {
      dot.classList.add("down");
      var r = document.createElement("div");
      r.className = "__demo_ripple";
      r.style.left = e.clientX + "px";
      r.style.top = e.clientY + "px";
      document.documentElement.appendChild(r);
      setTimeout(function () { r.remove(); }, 600);
    }, true);
    addEventListener("mouseup", function () { dot.classList.remove("down"); }, true);

    scan(document.body);
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i++) {
        scan(ms[i].target);
        ms[i].addedNodes.forEach(scan);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    setInterval(function () { scan(document.body); }, 250); // backstop
  }

  if (document.body) install();
  else addEventListener("DOMContentLoaded", install);
})();

// Stopwatch for the posting chapter (window.__demoTimer.start() / .stop()).
window.__demoTimer = {
  start: function () {
    var t = document.createElement("div");
    t.id = "__demo_timer";
    t.style.cssText = "position:fixed;right:18px;top:84px;z-index:2147483645;font:800 30px/1 'Segoe UI',system-ui;color:#fff;background:#e89344;padding:12px 18px;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,.25)";
    document.documentElement.appendChild(t);
    var start = performance.now();
    (function tick() {
      if (t.dataset.stopped) return;
      t.textContent = "⏱ " + ((performance.now() - start) / 1000).toFixed(1) + " s";
      requestAnimationFrame(tick);
    })();
  },
  stop: function () {
    var t = document.getElementById("__demo_timer");
    if (!t) return;
    t.dataset.stopped = "1";
    t.textContent += " ✓ posted";
    t.style.background = "#3f6b35";
  },
};

// Fake address bar, because Playwright recordings have no browser chrome.
window.__demoAddressBar = function (u) {
  var bar = document.createElement("div");
  bar.style.cssText = "position:fixed;left:0;right:0;top:0;height:56px;background:#f1f3f4;border-bottom:1px solid #ccc;z-index:2147483640;display:flex;align-items:center;padding:0 18px;font:16px 'Segoe UI',system-ui";
  var lock = document.createElement("span");
  lock.style.cssText = "color:#188038;margin-right:10px";
  lock.textContent = "🔒";
  var url = document.createElement("span");
  url.style.cssText = "background:#fff;border-radius:999px;padding:8px 18px;flex:1;color:#202124";
  url.textContent = u;
  bar.appendChild(lock);
  bar.appendChild(url);
  document.body.style.paddingTop = "64px";
  document.documentElement.appendChild(bar);
};
