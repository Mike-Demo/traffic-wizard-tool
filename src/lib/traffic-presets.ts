export type BrowserPreset = {
  id: string;
  label: string;
  kind: "desktop" | "mobile";
  caps: Record<string, unknown>;
};

export const BROWSER_PRESETS: BrowserPreset[] = [
  {
    id: "chrome-win11",
    label: "Chrome · Windows 11",
    kind: "desktop",
    caps: { browserName: "Chrome", browserVersion: "latest", os: "Windows", osVersion: "11" },
  },
  {
    id: "edge-win11",
    label: "Edge · Windows 11",
    kind: "desktop",
    caps: { browserName: "Edge", browserVersion: "latest", os: "Windows", osVersion: "11" },
  },
  {
    id: "firefox-win10",
    label: "Firefox · Windows 10",
    kind: "desktop",
    caps: { browserName: "Firefox", browserVersion: "latest", os: "Windows", osVersion: "10" },
  },
  {
    id: "safari-sonoma",
    label: "Safari · macOS Sonoma",
    kind: "desktop",
    caps: { browserName: "Safari", browserVersion: "latest", os: "OS X", osVersion: "Sonoma" },
  },
  {
    id: "chrome-mac",
    label: "Chrome · macOS Sonoma",
    kind: "desktop",
    caps: { browserName: "Chrome", browserVersion: "latest", os: "OS X", osVersion: "Sonoma" },
  },
  {
    id: "iphone-15",
    label: "Safari · iPhone 15",
    kind: "mobile",
    caps: { deviceName: "iPhone 15", osVersion: "17", realMobile: "true", browserName: "safari" },
  },
  {
    id: "iphone-14",
    label: "Safari · iPhone 14",
    kind: "mobile",
    caps: { deviceName: "iPhone 14", osVersion: "16", realMobile: "true", browserName: "safari" },
  },
  {
    id: "galaxy-s23",
    label: "Chrome · Galaxy S23",
    kind: "mobile",
    caps: { deviceName: "Samsung Galaxy S23", osVersion: "13.0", realMobile: "true", browserName: "chrome" },
  },
  {
    id: "pixel-8",
    label: "Chrome · Pixel 8",
    kind: "mobile",
    caps: { deviceName: "Google Pixel 8", osVersion: "14.0", realMobile: "true", browserName: "chrome" },
  },
];

export const COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "BR", label: "Brazil" },
  { code: "IN", label: "India" },
  { code: "JP", label: "Japan" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "SG", label: "Singapore" },
  { code: "ZA", label: "South Africa" },
];

export const LIMITS = {
  maxSessions: 25,
  maxPagesPerSession: 5,
  maxDwellSeconds: 15,
  minDwellSeconds: 2,
};

export type TrafficConfig = {
  browsers: string[];
  countries: string[];
  sessions: number;
  paths: string[];
  pagesPerSession: number;
  dwellMin: number;
  dwellMax: number;
  bouncePercent: number;
};

export const DEFAULT_CONFIG: TrafficConfig = {
  browsers: ["chrome-win11", "safari-sonoma", "iphone-15", "galaxy-s23"],
  countries: ["US", "GB", "DE"],
  sessions: 6,
  paths: ["/", "/pricing", "/about"],
  pagesPerSession: 3,
  dwellMin: 3,
  dwellMax: 8,
  bouncePercent: 30,
};

export function presetById(id: string): BrowserPreset | undefined {
  return BROWSER_PRESETS.find((b) => b.id === id);
}
