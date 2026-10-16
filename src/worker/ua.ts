export interface ParsedUA {
  device: "mobile" | "tablet" | "desktop";
  browser: string;
  os: string;
}

const BROWSERS: [string, RegExp][] = [
  ["Edge", /Edg(e|A|iOS)?\//],
  ["Opera", /OPR\/|Opera/],
  ["Samsung Internet", /SamsungBrowser\//],
  ["Firefox", /Firefox\/|FxiOS\//],
  ["Chrome", /Chrome\/|CriOS\//],
  ["Safari", /Version\/[\d.]+.*Safari\//],
];

const OSES: [string, RegExp][] = [
  ["iOS", /iPhone|iPad|iPod/],
  ["Android", /Android/],
  ["Windows", /Windows/],
  ["ChromeOS", /CrOS/],
  ["macOS", /Mac OS X|Macintosh/],
  ["Linux", /Linux/],
];

export function parseUA(ua: string): ParsedUA {
  const browser = BROWSERS.find(([, re]) => re.test(ua))?.[0] ?? "Other";
  const os = OSES.find(([, re]) => re.test(ua))?.[0] ?? "Other";
  const tablet = /iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua));
  const mobile = !tablet && /Mobi|iPhone|iPod|Android/.test(ua);
  return { device: tablet ? "tablet" : mobile ? "mobile" : "desktop", browser, os };
}
