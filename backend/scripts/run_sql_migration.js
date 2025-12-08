const fs = require('fs');
const path = require('path');

// Load environment variables from backend/.env so DB credentials are available
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { sequelize } = require('../src/config/database');

async function runMigration(filename) {
  try {
    // Resolve the migration file path robustly:
    // - If an absolute path is provided, use it
    // - If the caller passed a path that already includes 'migrations' (or any path separators), resolve it relative to cwd
    // - Otherwise look in the local 'migrations' folder (process.cwd()/migrations/<filename>)
    const input = filename || '';
    let filePath;
    if (path.isAbsolute(input)) {
      filePath = input;
    } else if (input.includes('migrations') || input.includes(path.sep) || input.includes('/')) {
      filePath = path.resolve(process.cwd(), input);
    } else {
      filePath = path.resolve(process.cwd(), 'migrations', input);
    }

    if (!fs.existsSync(filePath)) {
      console.error('Migration file not found:', filePath);
      process.exit(1);
    }

    const sql = fs.readFileSync(filePath, 'utf8');
    console.log('Running migration:', filename);

    // Split by semicolon to run multiple statements safely
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      console.log('Executing statement...');
      await sequelize.query(stmt);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

const filename = process.argv[2] || '20251202_add_foto_url_and_logo_url.sql';
runMigration(filename);
