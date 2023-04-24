// 載入模組
require('dotenv').config();

const line = require('@line/bot-sdk');
const express = require('express');
const { Configuration, OpenAIApi } = require('openai');

// line token 和 密鑰
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

// openai key
apiKey2 = process.env.OPENAI_API_KEY;

// 建立line端
const client = new line.Client(config);

// 建立伺服器
const app = express();

// 存儲用戶會話的對象
const userConversations = {};

// 監聽路由
app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

// 事件捕捉
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    // ignore non-text-message event
    return Promise.resolve(null);
  }

  const userId = event.source.userId;

  if (!userConversations[userId]) {
    userConversations[userId] = [
      { role: 'system', content: 'You are a helpful assistant.' },
    ];
  }

  userConversations[userId].push({ role: 'user', content: event.message.text });

  if (userConversations[userId].length > 6) {
    userConversations[userId].shift();
  }

  // 文本內容傳去open ai chat3.5
  const configuration = new Configuration({ apiKey: apiKey2 });
  const openai = new OpenAIApi(configuration);

  // 將用户的聊天历史传递给 OpenAI API
  const openaiResponse = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: userConversations[userId],
    max_tokens: 2000,
    temperature: 1,
  });

  // 讀取回傳內容文本
  const assistantReply = openaiResponse.data.choices[0].message.content;

  // 將 AI 助手的回复添加到用户的聊天历史中
  userConversations[userId].push({ role: 'assistant', content: assistantReply });

  if (event.message.text.slice(0, 2) === '畫圖') {
    const response = await openai.createImage({
      prompt: event.message.text,
      n: 1,
      size: '1024x1024',
    });

    const imageUrl = response.data.data[0].url;

    const imageMessage = {
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    };

    return client.replyMessage(event.replyToken, imageMessage);
  }

  // 建立回傳內容
  const reply = { type: 'text', text: assistantReply };

  // 回傳去line
  return client.replyMessage(event.replyToken, reply);
}
  
// listen on port
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});