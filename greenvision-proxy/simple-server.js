// 简化版后端服务 - 只使用Node.js内置模块
const http = require('http');
const https = require('https');
const url = require('url');

// 配置
const PORT = 3001;
const API_KEY = '2f8d8d11ce314b4ba62fbec2dac95d41.BWy26AcOEysXDpk5';
const API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const CLIENT_KEY = 'greenvision-secret-key-2024';

// 创建服务器
const server = http.createServer((req, res) => {
  // 解析请求
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  
  // 健康检查端点
  if (path === '/health' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  
  // 聊天API端点
  if (path === '/api/chat' && req.method === 'POST') {
    // 验证API密钥
    const clientKey = req.headers['x-api-key'];
    if (!clientKey || clientKey !== CLIENT_KEY) {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }
    
    // 读取请求体
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });
    
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const message = data.message;
        
        // 系统提示
        const systemPrompt = `你是小绿，GreenVision的专业智能助手，专注于城市绿色建设和碳吸收计算。你的任务是：
1. 准确解答用户关于GreenVision所有功能的问题
2. 提供详细的操作指导和使用建议
3. 解释技术原理和数据来源
4. 帮助用户解决使用过程中遇到的各种问题

GreenVision功能详解：
- 核心测算：
  * 操作步骤：上传生态照片 → 系统分析植被覆盖 → 计算碳吸收量 → 生成报告
  * 支持格式：JPG、PNG、WEBP
  * 最佳实践：确保照片清晰，包含明显的植被区域，避免过度曝光或模糊

- 图纸绿化建议：
  * 操作步骤：上传工程图纸 → 选择地理位置 → 分析环境参数 → 生成绿化方案
  * 地理位置选择：可通过搜索框输入城市名称或拼音首字母，系统按拼音首字母排序
  * 环境参数：包括土壤类型（壤土、沙土、黏土、泥炭土）和核心优化诉求（碳汇最大化、经济效益优先、综合考量、景观美化）

- 城市绿化建议：
  * 操作步骤：上传工程图纸 → 填写详细环境参数 → 获取详细绿建方案
  * 详细参数：气候类型、年降水量、平均温度、土壤类型、优化目标

常见问题及解答：
Q: 为什么上传的照片无法分析？
A: 请确保照片清晰，包含明显的植被区域，避免过度曝光或模糊。系统会自动验证并可能拒绝普通风景照。

Q: 如何选择合适的地理位置？
A: 可以通过搜索框输入城市名称或拼音首字母，系统会按拼音首字母排序展示城市列表。输入单个字母后按回车可快速跳转到对应分组。

Q: 土壤类型如何选择？
A: 系统会根据选择的城市自动推荐土壤类型，你也可以根据实际情况手动选择：
  * 壤土 (Loam)：最适合大多数植物生长
  * 沙土 (Sandy)：排水良好，适合耐旱植物
  * 黏土 (Clay)：保水性好，适合喜湿植物
  * 泥炭土 (Peat)：富含有机质，适合酸性植物

Q: 优化诉求如何选择？
A: 根据项目目标选择：
  * 碳汇最大化：优先考虑植被的碳吸收能力
  * 经济效益优先：考虑植物的养护成本和经济价值
  * 综合考量：平衡各方面因素
  * 景观美化：优先考虑植物的观赏价值

技术原理：
- 植被覆盖分析：基于前端图像识别算法，提取绿色像素浓度
- 碳吸收计算：根据植被类型和覆盖面积，使用生态算法计算
- 绿化方案生成：结合气候、土壤、降水等环境参数，推荐适合的植物种类和配置

请以专业、友好的语气回答用户问题，提供准确详细的信息，并引导用户正确使用系统功能。对于复杂问题，请分步骤解答，确保用户能够理解和操作。`;
        
        // 构建API请求
        const apiOptions = {
          hostname: 'open.bigmodel.cn',
          path: '/api/paas/v4/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          }
        };
        
        // 发送请求到智谱AI
        const apiReq = https.request(apiOptions, (apiRes) => {
          let apiBody = '';
          apiRes.on('data', chunk => {
            apiBody += chunk;
          });
          apiRes.on('end', () => {
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = apiRes.statusCode;
            res.end(apiBody);
          });
        });
        
        apiReq.on('error', (error) => {
          console.error('API请求错误:', error);
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 500;
          res.end(JSON.stringify({ error: '服务器内部错误' }));
        });
        
        // 发送请求体
        apiReq.write(JSON.stringify({
          model: 'glm-4-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ],
          max_tokens: 500
        }));
        
        apiReq.end();
        
      } catch (error) {
        console.error('请求处理错误:', error);
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 400;
        res.end(JSON.stringify({ error: '无效的请求数据' }));
      }
    });
    
    return;
  }
  
  // 404响应
  res.statusCode = 404;
  res.end('Not Found');
});

// 启动服务器
server.listen(PORT, () => {
  console.log(`简化版代理服务运行在 http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`聊天接口: http://localhost:${PORT}/api/chat`);
});