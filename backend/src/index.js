require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// 路由
app.use(require('./routes/auth'));
app.use(require('./routes/walletAuth'));
app.use(require('./routes/user'));
app.use(require('./routes/relationship'));
app.use(require('./routes/diary'));
app.use(require('./routes/comment'));
app.use(require('./routes/follow'));
app.use(require('./routes/feed'));
app.use(require('./routes/upload'));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'diary-backend' });
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(err.status || 500).json({ error: err.message || '服务器错误' });
});

app.listen(PORT, () => {
  console.log(`日记后端服务运行在 http://localhost:${PORT}`);
});
