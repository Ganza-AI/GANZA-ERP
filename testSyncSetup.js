import dotenv from 'dotenv';
dotenv.config();

// Patch process.env to global variables since src/supabaseClient.js might use import.meta.env in Vite
// Wait, supabaseClient.js uses import.meta.env. Let's create a stub.
import fs from 'fs';
const clientCode = fs.readFileSync('./src/supabaseClient.js', 'utf8');
const patchedCode = clientCode.replace(/import\.meta\.env/g, 'process.env');
fs.writeFileSync('./src/supabaseClient_node.js', patchedCode);

// Now patch supabaseData.js to use supabaseClient_node.js
const dataCode = fs.readFileSync('./src/supabaseData.js', 'utf8');
const patchedDataCode = dataCode.replace('./supabaseClient.js', './supabaseClient_node.js');
fs.writeFileSync('./src/supabaseData_node.js', patchedDataCode);
