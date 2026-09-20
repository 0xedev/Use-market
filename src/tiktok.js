const PIXEL_ID = "7663114510684749844";

function ensurePixel() {
  if (window.ttq?.track) return window.ttq;

  const ttq = window.ttq || [];
  ttq.methods = [
    "page",
    "track",
    "identify",
    "instances",
    "debug",
    "on",
    "off",
    "once",
    "ready",
    "alias",
    "group",
    "enableCookie",
    "disableCookie",
    "holdConsent",
    "revokeConsent",
    "grantConsent",
  ];
  ttq.setAndDefer = (queue, method) => {
    queue[method] = (...args) => queue.push([method, ...args]);
  };
  ttq.methods.forEach((method) => ttq.setAndDefer(ttq, method));
  ttq.load = (id) => {
    const source = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {};
    ttq._i[id] = [];
    ttq._i[id]._u = source;
    ttq._t = ttq._t || {};
    ttq._t[id] = +new Date();
    ttq._o = ttq._o || {};
    ttq._o[id] = {};
    const script = document.createElement("script");
    script.async = true;
    script.src = source + "?sdkid=" + id + "&lib=ttq";
    document.head.appendChild(script);
  };
  ttq.load(PIXEL_ID);
  window.ttq = ttq;
  return ttq;
}

export function trackTikTokEvent(name, data = {}) {
  if (typeof window === "undefined") return;
  ensurePixel().track(name, data);
}
