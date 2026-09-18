export interface ParsedUA {
  device: "mobile" | "tablet" | "desktop";
  browser: string;
  os: string;
}

export function parseUserAgent(ua: string | null): ParsedUA {
  const s = ua ?? "";

  let device: ParsedUA["device"] = "desktop";
  if (/iPad|Tablet(?!.*Mobile)/i.test(s)) device = "tablet";
  else if (/Mobi|Android(?=.*Mobile)|iPhone|iPod/i.test(s)) device = "mobile";

  let os = "Other";
  if (/Windows/i.test(s)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(s)) os = "iOS";
  else if (/Android/i.test(s)) os = "Android";
  else if (/Mac OS X/i.test(s)) os = "macOS";
  else if (/CrOS/i.test(s)) os = "ChromeOS";
  else if (/Linux/i.test(s)) os = "Linux";

  let browser = "Other";
  if (/Edg\//i.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(s)) browser = "Opera";
  else if (/Chrome\//i.test(s) && !/Chromium/i.test(s)) browser = "Chrome";
  else if (/CriOS/i.test(s)) browser = "Chrome";
  else if (/FxiOS|Firefox\//i.test(s)) browser = "Firefox";
  else if (/Safari\//i.test(s) && /Version\//i.test(s)) browser = "Safari";
  else if (/bot|crawler|spider|facebookexternalhit|Slackbot|Discordbot/i.test(s)) browser = "Bot";

  return { device, browser, os };
}

export function refererHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname;
  } catch {
    return null;
  }
}
