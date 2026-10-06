#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Exact banned terms from task specification:
// demo, sample, mock, dummy, placeholder, lorem, Alex Rivera, alex.rivera, community.org, pathfinder.app, 849201, PL-884920, Test SOS
const BANNED_PATTERNS = [
  { name: 'Alex Rivera', regex: /Alex\s+Rivera/i },
  { name: 'alex.rivera', regex: /alex\.rivera/i },
  { name: 'community.org', regex: /community\.org/i },
  { name: 'pathfinder.app', regex: /pathfinder\.app/i },
  { name: '849201', regex: /849201/ },
  { name: 'PL-884920', regex: /PL-884920/i },
  { name: 'Test SOS', regex: /Test\s+SOS/i },
  { name: 'lorem', regex: /lorem\s+ipsum|lorem/i },
  { name: 'dummy', regex: /\bdummy\b/i },
];

// Target directories to scan (outside of seed/ and tests/)
const TARGET_DIRS = [
  path.join(projectRoot, 'src', 'app'),
  path.join(projectRoot, 'src', 'components'),
  path.join(projectRoot, 'app'),
  path.join(projectRoot, 'components'),
];

const EXCLUDED_DIR_NAMES = new Set(['seed', 'tests', '__tests__', 'node_modules', '.next']);

function walk(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (/\.(tsx|ts|jsx|js)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const allFiles = TARGET_DIRS.flatMap(dir => walk(dir));
const violations = [];

for (const filePath of allFiles) {
  const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // Skip comment lines
    if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
      return;
    }

    // 1. Check strict banned patterns
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.regex.test(line)) {
        violations.push({
          file: relPath,
          line: lineNum,
          rule: `Banned string '${pattern.name}'`,
          content: trimmed,
        });
      }
    }

    // 2. Check visible UI text for banned words: "demo", "sample", "mock", "placeholder"
    // We check JSX content or visible string literals, excluding env variables like NEXT_PUBLIC_DEMO_MODE,
    // standard HTML attributes like placeholder="...", or function arguments
    const isHtmlPlaceholderAttr = /placeholder\s*=\s*["'{]/.test(line);
    const isCssPlaceholder = /\bplaceholder-|\bplaceholder:/.test(line);
    const isPropDecl = /placeholder\??\s*:/.test(line);

    // Visible UI text containing "Placeholder" (e.g. >...Placeholder...< or 'Placeholder')
    if (/\bplaceholder\b/i.test(line) && !isHtmlPlaceholderAttr && !isCssPlaceholder && !isPropDecl) {
      // Allow if it's purely aria or doc
      if (!line.includes('aria-placeholder')) {
        violations.push({
          file: relPath,
          line: lineNum,
          rule: `Visible UI 'Placeholder' text`,
          content: trimmed,
        });
      }
    }

    // Visible UI text containing "Demo" (e.g. >...Demo...< or "Demo ...")
    // Exclude env checks: DEMO_MODE, process.env
    if (/(>|'|")[^<>'"]*\bdemo\b[^<>'"]*(<|'|")/i.test(line)) {
      const isEnvCheck = line.includes('DEMO_MODE') || line.includes('process.env');
      if (!isEnvCheck) {
        violations.push({
          file: relPath,
          line: lineNum,
          rule: `Visible UI 'Demo' text`,
          content: trimmed,
        });
      }
    }

    // Visible UI text containing "Mock"
    if (/(>|'|")[^<>'"]*\bmock\b[^<>'"]*(<|'|")/i.test(line)) {
      violations.push({
        file: relPath,
        line: lineNum,
        rule: `Visible UI 'Mock' text`,
        content: trimmed,
      });
    }

    // Visible UI text containing "Sample"
    if (/(>|'|")[^<>'"]*\bsample\b[^<>'"]*(<|'|")/i.test(line)) {
      violations.push({
        file: relPath,
        line: lineNum,
        rule: `Visible UI 'Sample' text`,
        content: trimmed,
      });
    }
  });
}

console.log('='.repeat(70));
console.log('Production UI Cleanliness Audit: check:demo-strings');
console.log(`Scanned ${allFiles.length} files across /app and /components`);
console.log('='.repeat(70));

if (violations.length > 0) {
  console.error(`\n❌ FAILED: Found ${violations.length} banned demo/placeholder string violations:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} - [${v.rule}]`);
    console.error(`    > ${v.content}\n`);
  }
  process.exit(1);
} else {
  console.log('\n✅ PASSED: No banned demo, placeholder, or fake identity strings found in production UI!\n');
  process.exit(0);
}
