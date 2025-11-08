const fs = require('fs');
const path = require('path');

// Create build info
const buildInfo = {
  version: '2.16.1',
  buildNumber: Date.now(),
  buildDate: new Date().toISOString(),
  environment: process.env.NODE_ENV || 'development',
  gitCommit: process.env.GIT_COMMIT || 'unknown',
  buildTime: new Date().toLocaleString('cs-CZ', {
    timeZone: 'Europe/Prague',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
};

// Write build info to public directory
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(
  path.join(publicDir, 'build-info.json'),
  JSON.stringify(buildInfo, null, 2)
);

// Create build info as TypeScript module for src directory
const srcDir = path.join(__dirname, 'src');
if (!fs.existsSync(srcDir)) {
  fs.mkdirSync(srcDir, { recursive: true });
}

const buildInfoTS = `// Auto-generated build info
export const buildInfo = ${JSON.stringify(buildInfo, null, 2)} as const;

export const getVersion = () => buildInfo.version;
export const getBuildNumber = () => buildInfo.buildNumber;
export const getBuildDate = () => new Date(buildInfo.buildDate);
export const getEnvironment = () => buildInfo.environment;
export const getGitCommit = () => buildInfo.gitCommit;
export const getBuildTime = () => buildInfo.buildTime;
`;

fs.writeFileSync(
  path.join(srcDir, 'buildInfo.ts'),
  buildInfoTS
);

console.log('✅ Build info generated successfully');
console.log(`📦 Version: ${buildInfo.version}`);
console.log(`🕐 Build time: ${buildInfo.buildTime}`);
console.log(`🌍 Environment: ${buildInfo.environment}`);
