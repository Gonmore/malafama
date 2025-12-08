const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Save a base64 or data URI string to disk and return the public URL path (/uploads/filename)
async function saveBase64ToUploads(base64OrDataUri, prefix = 'img') {
  if (!base64OrDataUri || typeof base64OrDataUri !== 'string') {
    throw new Error('Invalid image data');
  }

  // If it's already a URL (http or /uploads/...), return as-is
  if (/^https?:\/\//i.test(base64OrDataUri) || /^\/uploads\//.test(base64OrDataUri)) {
    return base64OrDataUri;
  }

  // Extract the mime type if it's a data URI
  let matches = base64OrDataUri.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
  let mime = 'image/png';
  let data = base64OrDataUri;
  if (matches) {
    mime = matches[1];
    data = matches[2];
  }

  // Determine extension
  let ext = 'png';
  if (/jpeg|jpg/i.test(mime)) ext = 'jpg';
  else if (/png/i.test(mime)) ext = 'png';
  else if (/webp/i.test(mime)) ext = 'webp';
  else if (/gif/i.test(mime)) ext = 'gif';

  // Create filename
  const id = crypto.randomBytes(10).toString('hex');
  const filename = `${prefix}_${Date.now()}_${id}.${ext}`;
  const filePath = path.join(UPLOADS_DIR, filename);

  // Write file
  const buffer = Buffer.from(data, 'base64');
  await fs.promises.writeFile(filePath, buffer);

  // Return public path (relative to server root, mapped to /uploads)
  return `/uploads/${filename}`;
}

module.exports = {
  saveBase64ToUploads
};
