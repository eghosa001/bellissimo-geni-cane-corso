import fs from 'node:fs';
import path from 'node:path';

const raw = String(process.argv[2] || '').trim().toLowerCase();
const domain = raw.replace(/^https?:\/\//, '').replace(/\/+$/, '');
if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) {
  console.error('Usage: node scripts/set-production-domain.mjs bellissimogeni.com');
  process.exit(2);
}

const oldBase = 'https://eghosa001.github.io/bellissimo-geni-cane-corso';
const newBase = 'https://' + domain;
const root = process.cwd();

for (const name of fs.readdirSync(root)) {
  if (!name.endsWith('.html')) continue;
  const file = path.join(root, name);
  const before = fs.readFileSync(file, 'utf8');
  const after = before.split(oldBase).join(newBase);
  if (after !== before) fs.writeFileSync(file, after);
}

for (const name of ['sitemap.xml']) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  const before = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, before.split(oldBase).join(newBase));
}

const robotsPath = path.join(root, 'robots.txt');
if (fs.existsSync(robotsPath)) {
  const before = fs.readFileSync(robotsPath, 'utf8');
  const next = before.replace(/^Sitemap:.*$/m, 'Sitemap: ' + newBase + '/sitemap.xml');
  fs.writeFileSync(robotsPath, next);
}

const workflowPath = path.join(root, '.github', 'workflows', 'screenshots.yml');
if (fs.existsSync(workflowPath)) {
  const before = fs.readFileSync(workflowPath, 'utf8');
  const next = before.replace(
    /echo "BASE_URL=https:\/\/eghosa001\.github\.io\/bellissimo-geni-cane-corso\/" >> "\$GITHUB_ENV"/,
    'echo "BASE_URL=' + newBase + '/" >> "$GITHUB_ENV"'
  );
  fs.writeFileSync(workflowPath, next);
}

fs.writeFileSync(path.join(root, 'CNAME'), domain + '\n');

console.log('Prepared GitHub Pages custom domain: ' + domain);
