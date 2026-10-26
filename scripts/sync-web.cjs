const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const name of fs.readdirSync(path.join(root, 'web'))) {
  if (/\.(html|css|js|txt)$/.test(name)) fs.copyFileSync(path.join(root, 'web', name), path.join(root, 'android/app/src/main/assets', name));
}
console.log('Android web assets synchronized.');
