import type { NextConfig } from "next";
import fs from "node:fs";
import path from "node:path";

function resolveEnvFileName(): string {
  const appEnv = process.env.NEXT_PUBLIC_ENV;
  if (appEnv === "test") {
    return ".env.test";
  }
  if (appEnv === "production") {
    return ".env.production";
  }
  return ".env.local";
}

function parseEnvValue(rawValue: string): string {
  const value = rawValue.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFromSelectedFile(): void {
  const envFileName = resolveEnvFileName();
  const envPath = path.join(process.cwd(), envFileName);
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1);
    process.env[key] = parseEnvValue(rawValue);
  }
}

loadEnvFromSelectedFile();

function stripApiPath(value: string): string {
  return value.replace(/\/api\/v\d+\/?$/i, "").replace(/\/+$/, "");
}

function resolveApiOrigin(isDev: boolean, isTest: boolean): string {
  if (isDev) {
    // Use IPv4 loopback to avoid localhost resolving to ::1 on Windows.
    return "http://127.0.0.1:8000";
  }

  if (isTest) {
    return "http://meblog-backend:8000";
  }

  const explicitOrigin = process.env.API_ORIGIN || process.env.NEXT_PUBLIC_API_ORIGIN;
  if (explicitOrigin) {
    return explicitOrigin.replace(/\/+$/, "");
  }

  const legacyBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (legacyBaseUrl) {
    return stripApiPath(legacyBaseUrl);
  }

  return "https://api.yourdomain.com";
}

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  // Only required for local development with 127.0.0.1 origin.
  allowedDevOrigins: process.env.NODE_ENV === 'development' ? ['127.0.0.1'] : undefined,

  // Enable strict mode for better React practices
  reactStrictMode: true,

  // Image optimization - use remotePatterns instead of deprecated domains
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
    unoptimized: true,
  },

  // Headers for API proxy
  async rewrites() {
    const isDev = process.env.NODE_ENV === 'development';
    const isTest = process.env.NEXT_PUBLIC_ENV === 'test';
    const apiOrigin = resolveApiOrigin(isDev, isTest);

    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ];
  },

};

export default nextConfig;