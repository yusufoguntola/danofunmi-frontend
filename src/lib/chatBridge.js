// Lets any component ask the globally-mounted <ChatWidget> (see App.jsx) to
// open itself and send a message on the customer's behalf — e.g. the "Bulk
// requests welcome" note asking it to relay "I'd like to make a bulk/custom
// request". A plain window event rather than React context/props, since
// ChatWidget is mounted once at the app root, far from where these requests
// originate (MenuGrid, used from both LandingPage and MenuPage).
const EVENT = 'dfm-chat-send-prompt';

export function sendChatPrompt(text) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text } }));
}

export function onChatPromptRequest(handler) {
  const listener = (e) => handler(e.detail.text);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
