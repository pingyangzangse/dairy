const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { auth } = require('../lib/authz');

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subdir = path.join(UPLOAD_DIR, 'images');
    if (!fs.existsSync(subdir)) fs.mkdirSync(subdir, { recursive: true });
    cb(null, subdir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    cb(null, crypto.randomUUID() + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只能上传图片文件'));
    }
  }
});

router.post('/api/upload/image', auth, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '没有上传文件' });
    const url = `/uploads/images/${req.file.filename}`;
    res.json({ success: true, url });
  } catch (err) {
    console.error('[api] /upload/image error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
