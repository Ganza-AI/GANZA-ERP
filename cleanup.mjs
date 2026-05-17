import { readFileSync, writeFileSync } from 'fs';

const filePath = 'D:/Ganza-Erp/src/main.js';
const content = readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Find the end of testPrintInvoice (line with just "}" after "catch")
// and the real printInvoiceWithVAT function
let removeStart = -1;
let removeEnd = -1;

for (let i = 0; i < lines.length; i++) {
    // Find the orphaned CSS code right after testPrintInvoice ends
    if (lines[i].trim() === '}' && i > 10800 && i < 10815) {
        // Check if next non-empty line is orphaned CSS or code
        let j = i + 1;
        while (j < lines.length && lines[j].trim() === '') j++;
        if (j < lines.length && !lines[j].includes('printInvoiceWithVAT(index)')) {
            removeStart = i + 1;
        }
    }
    
    // Find the SECOND occurrence of "printInvoiceWithVAT(index)" - that's the real one
    if (removeStart > 0 && i > removeStart && lines[i].includes('printInvoiceWithVAT(index)') && lines[i].trim().startsWith('printInvoiceWithVAT')) {
        removeEnd = i;
        break;
    }
}

console.log('Lines to remove:', removeStart, 'to', removeEnd - 1);
console.log('Total lines before:', lines.length);

if (removeStart > 0 && removeEnd > removeStart) {
    // Check the line before removeEnd for the comment
    if (lines[removeEnd - 1].includes('Professional Vietnamese Invoice Print Function with VAT')) {
        removeEnd = removeEnd - 1; // Also include the comment line
    }
    
    const newLines = [...lines.slice(0, removeStart), '', ...lines.slice(removeEnd)];
    console.log('Total lines after:', newLines.length);
    console.log('Removed', lines.length - newLines.length, 'lines');
    writeFileSync(filePath, newLines.join('\n'), 'utf-8');
    console.log('File saved successfully!');
} else {
    console.log('Could not find boundaries. Manual check needed.');
    // Let's print lines around the area
    for (let i = 10808; i < 10820; i++) {
        console.log(i + ':', lines[i]);
    }
}
