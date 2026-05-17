const fs = require('fs');
const path = 'c:/Users/admin/Downloads/index.html/Supabase/New folder/index.html';
const html = fs.readFileSync(path, 'utf8');
const startToken = '<script type="module">';
const endToken = '</script>';
const start = html.indexOf(startToken);
const end = html.lastIndexOf(endToken);
if (start === -1 || end === -1 || end <= start) {
  console.error('Could not find module script markers');
  process.exit(1);
}
const script = html.slice(start + startToken.length, end).trimStart();
fs.writeFileSync('src/main.js', script, 'utf8');
const replacement = `${startToken}\n<script type=\"module\" src=\"/src/main.js\"></script>\n`;
const newHtml = html.slice(0, start) + replacement + html.slice(end + endToken.length);
fs.writeFileSync(path, newHtml, 'utf8');
console.log('Extracted inline module to src/main.js and updated index.html');
