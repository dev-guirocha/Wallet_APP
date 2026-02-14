const fs = require('fs');
const path = require('path');

const wrapperPath = path.join(
  process.cwd(),
  'android',
  'gradle',
  'wrapper',
  'gradle-wrapper.properties'
);

const fromPrefix = 'distributionUrl=https\\://services.gradle.org/distributions/';
const toPrefix = 'distributionUrl=https\\://downloads.gradle.org/distributions/';

if (!fs.existsSync(wrapperPath)) {
  console.log(`[eas-build-post-install] gradle wrapper not found at ${wrapperPath}, skipping.`);
  process.exit(0);
}

const current = fs.readFileSync(wrapperPath, 'utf8');

if (current.includes(toPrefix)) {
  console.log('[eas-build-post-install] gradle distribution URL already patched.');
  process.exit(0);
}

if (!current.includes(fromPrefix)) {
  console.log('[eas-build-post-install] gradle distribution URL format not recognized, skipping.');
  process.exit(0);
}

const next = current.replace(fromPrefix, toPrefix);
fs.writeFileSync(wrapperPath, next, 'utf8');
console.log('[eas-build-post-install] patched gradle distribution URL to downloads.gradle.org');
