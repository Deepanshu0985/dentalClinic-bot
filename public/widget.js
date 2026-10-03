/*
 * Brightsmile chat widget loader.
 * Add the chatbot to ANY website with one line before </body>:
 *   <script src="https://YOUR-DEPLOYMENT.vercel.app/widget.js" defer></script>
 */
(function () {
  if (window.__brightsmileChat) return;
  window.__brightsmileChat = true;

  var script = document.currentScript;
  var origin = new URL(script ? script.src : "/", window.location.href).origin;
  var color = (script && script.getAttribute("data-color")) || "#0f766e";
  var label = (script && script.getAttribute("data-label")) || "Ask us anything";

  var style = document.createElement("style");
  style.textContent =
    "#bs-chat-btn{position:fixed;right:24px;bottom:24px;z-index:2147483646;display:flex;align-items:center;gap:8px;height:56px;padding:0 20px 0 16px;border:0;border-radius:9999px;background:" +
    color +
    ";color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 25px rgba(0,0,0,.2)}" +
    "#bs-chat-btn:hover{filter:brightness(.92)}" +
    "#bs-chat-frame{position:fixed;right:24px;bottom:96px;z-index:2147483647;width:400px;height:620px;max-height:calc(100vh - 128px);border:0;border-radius:16px;box-shadow:0 25px 50px rgba(0,0,0,.25);background:#fff;display:none}" +
    "@media (max-width:640px){#bs-chat-frame{inset:auto 0 0 0;width:100%;height:85vh;max-height:none;border-radius:16px 16px 0 0}}";
  document.head.appendChild(style);

  var frame = document.createElement("iframe");
  frame.id = "bs-chat-frame";
  frame.title = "Chat with our assistant";
  frame.setAttribute("loading", "lazy");

  var btn = document.createElement("button");
  btn.id = "bs-chat-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10h8M8 14h5M21 12a9 9 0 01-13.3 7.9L3 21l1.1-4.7A9 9 0 1121 12z"/></svg><span></span>';
  btn.querySelector("span").textContent = label;

  var open = false;
  function setOpen(next) {
    open = next;
    // Load the chat lazily on first open so it costs nothing until used.
    if (open && !frame.src) frame.src = origin + "/embed";
    frame.style.display = open ? "block" : "none";
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    btn.style.display = open && window.innerWidth <= 640 ? "none" : "flex";
  }

  btn.addEventListener("click", function () {
    setOpen(!open);
  });
  window.addEventListener("message", function (e) {
    if (e.origin === origin && e.data && e.data.type === "brightsmile-chat:close") setOpen(false);
  });

  document.body.appendChild(frame);
  document.body.appendChild(btn);
})();
