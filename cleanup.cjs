// Cleanup script to remove orphaned old invoice code from main.js
// Lines 10822 through 10978 (0-indexed: 10821-10977) need to be removed
const fs = require('fs');

const filePath = 'D:/Ganza-Erp/src/main.js';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

console.log('Total lines before:', lines.length);

// Remove lines 10811 through 10978 (1-indexed), which is 10810-10977 (0-indexed)
// Keep line 10810 (0-indexed: 10809) which is "            }"
// Remove lines 10811-10978 (the empty lines + orphan code + orphan closing brace)  
// Keep line 10979+ which has blank line then real printInvoiceWithVAT

const keepBefore = lines.slice(0, 10810); // lines 1-10810
const keepAfter = lines.slice(10978);     // lines 10979+

console.log('Keeping first', keepBefore.length, 'lines');
console.log('Removing lines 10811-10978 (' + (10978 - 10810) + ' lines)');
console.log('Keeping last', keepAfter.length, 'lines');

// Verify boundaries
console.log('\nLast kept line before:', JSON.stringify(keepBefore[keepBefore.length - 1].substring(0, 60)));
console.log('First removed line:', JSON.stringify(lines[10810].substring(0, 60)));
console.log('Last removed line:', JSON.stringify(lines[10977].substring(0, 60)));
console.log('First kept line after:', JSON.stringify(keepAfter[0].substring(0, 60)));

const newLines = [...keepBefore, '', ...keepAfter];
console.log('\nTotal lines after:', newLines.length);

fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
console.log('✅ File saved successfully!');
