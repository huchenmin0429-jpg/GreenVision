require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');

const app = express();

const PORT = process.env.PORT || 3001;
const API_KEY = process.env.API_KEY;
const API_URL = process.env.API_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const CLIENT_KEY = process.env.CLIENT_KEY || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (origin === 'null') return true;
  return ALLOWED_ORIGINS.some(allowed => {
    if (allowed === '*') return true;
    if (allowed === origin) return true;
    if (allowed.startsWith('*.')) {
      return origin.endsWith(allowed.slice(1));
    }
    return false;
  });
}

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`CORS blocked origin: ${origin}`));
  },
  methods: ['POST', 'GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));

app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX || 50),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试。' },
  skip: req => req.path === '/health'
});

function authenticate(req, res, next) {
  if (!CLIENT_KEY) {
    next();
    return;
  }

  const clientKey = req.headers['x-api-key'];
  if (clientKey !== CLIENT_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

const systemPrompt = `你是“小绿”，GreenVision 的智能助手。你的任务是用普通群众听得懂的话解释城市绿化、图片识别、绿视率、碳汇估算、绿化建议和项目功能。

回答规则：
1. 先理解用户真实意图，再回答。用户说“绿不绿、树多不多、绿色多不多”，通常是在问绿视率或可视绿量。
2. 用户说“能吸多少二氧化碳、低碳、环保价值”，通常是在问碳汇或生态效益。
3. 用户说“哪里种树、怎么改、太晒怎么办”，通常是在问绿化优化建议。
4. 回答时先用通俗表达，再补充专业术语。不要一开始堆术语。
5. 碳汇结果只能作为辅助估算，不等同于官方碳核算报告。严格核算需要树种、胸径、树高、年龄、土壤、气候和养护条件等数据。
6. 不要编造政策、论文或精确数值。如果没有依据，说明需要补充资料或专业核算。
7. 如果前端提供了“参考知识块”或“用户意图”，优先基于这些上下文回答；不要偏离上下文自由发挥。
8. 区分三类内容：确定事实、估算判断、操作建议。确定事实可以直接说；估算判断要说明前提；操作建议要给可执行步骤。
9. 用户没有上传图片、地点或参数时，不要假装已经分析了具体对象。可以说明“如果你上传图片，我可以进一步判断”。
10. 回答尽量精准短小：一般 2 到 4 段即可；除非用户要求详细方案，不要写长篇。

GreenVision 项目知识：
- GreenVision 是一个面向普通群众、学校、社区和城市绿化场景的智能视觉工具。
- 它可以识别图片中的树木、草地、灌木等绿色植物区域，估算绿化程度和低碳价值，并给出绿化改善建议。
- 绿视率 GVI 的核心思想是：绿色植被像素数 / 图像总像素数。它代表人眼视角下能看到多少绿色。
- 语义分割可以把图像中的树木、草地、道路、建筑、天空等区域区分开，比单纯看颜色更稳健。
- DeepLabv3 / DeepLabv3+ 是常用于语义分割的模型思路，可用于解释项目的技术路线。
- i-Tree 是城市树木生态效益评估工具，可作为碳储存、碳汇、空气质量、雨洪等生态效益表达的参考。
- 城市园林绿化具有生态环保、休闲游憩、景观营造、防灾避险和改善人居环境等价值。

请用简洁、友好、可靠的中文回答。`;

function buildUserMessage(message, context) {
  if (!context || (!context.knowledge && !context.intent)) {
    return message;
  }

  const parts = [`用户原问题：${message}`];

  if (context.knowledge?.reference) {
    parts.push(`前端检索到的参考知识块：\n${context.knowledge.reference}`);
    if (Array.isArray(context.knowledge.matchedKeywords) && context.knowledge.matchedKeywords.length) {
      parts.push(`命中关键词：${context.knowledge.matchedKeywords.join('、')}`);
    }
  }

  if (context.intent?.guidance) {
    parts.push(`前端判断的用户通俗意图：\n${context.intent.guidance}`);
    if (Array.isArray(context.intent.matchedKeywords) && context.intent.matchedKeywords.length) {
      parts.push(`意图关键词：${context.intent.matchedKeywords.join('、')}`);
    }
  }

  parts.push('请基于以上上下文精准回答用户问题；如果上下文不足，请说明缺少什么信息，不要编造。');
  return parts.join('\n\n');
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'greenvision-proxy',
    allowedOrigins: ALLOWED_ORIGINS
  });
});

app.post('/api/chat', authenticate, limiter, async (req, res) => {
  try {
    if (!API_KEY) {
      res.status(500).json({ error: 'Server API_KEY is not configured.' });
      return;
    }

    const message = String(req.body?.message || '').trim();
    const context = req.body?.context || null;
    if (!message) {
      res.status(400).json({ error: 'message is required.' });
      return;
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.MODEL || 'glm-4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildUserMessage(message, context) }
        ],
        temperature: 0.25,
        max_tokens: 700
      })
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json(data);
      return;
    }

    res.json(data);
  } catch (error) {
    console.error('GreenVision proxy error:', error);
    res.status(500).json({ error: '服务器暂时无法回答，请稍后再试。' });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`GreenVision proxy listening on port ${PORT}`);
    console.log(`Health check: /health`);
  });
}

module.exports = app;
