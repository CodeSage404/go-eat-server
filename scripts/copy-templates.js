const fs = require('fs');
const path = require('path');

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const srcDir = path.join(__dirname, '../src/templates');
const destDir = path.join(__dirname, '../dist/templates');

console.log(`Copying email templates from: ${srcDir} to: ${destDir}...`);

try {
  if (fs.existsSync(srcDir)) {
    copyDirSync(srcDir, destDir);
    console.log('✅ Email templates copied successfully!');
  } else {
    console.warn(`⚠️ Warning: Source templates directory not found at: ${srcDir}`);
  }
} catch (err) {
  console.error('❌ Failed to copy email templates:', err.message);
  process.exit(1);
}
