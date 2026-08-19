import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceParams = [
    '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'
];
const destParams = [
    '..', 'public', 'assets'
];

const source = path.resolve(__dirname, ...sourceParams);
const destDir = path.resolve(__dirname, ...destParams);
const dest = path.join(destDir, 'sql-wasm.wasm');

console.log(`Copying WASM from ${source} to ${dest}`);

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

fs.copyFile(source, dest, (err) => {
    if (err) {
        console.error("Error copying WASM:", err);
        process.exit(1);
    }
    console.log("sql-wasm.wasm copied successfully!");
});
