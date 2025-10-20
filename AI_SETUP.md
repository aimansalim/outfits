# AI Outfit Generator Setup

## 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create account
3. Click "Create new secret key"
4. Copy the API key (starts with `sk-proj-...`)

## 2. Configure API Key

1. Open `docs/config.js`
2. Replace `YOUR_API_KEY_HERE` with your actual API key:

```javascript
window.CONFIG = {
  OPENAI_API_KEY: 'sk-proj-your-actual-api-key-here',
  OPENAI_MODEL: 'gpt-5-nano-2025-08-07'
};
```

## 3. Test the AI

1. Go to your outfit generator
2. Click [AI FIT] button
3. Type a prompt like "minimal" or "streetwear"
4. Click [GENERATE]

## 4. Troubleshooting

- **401 Error**: API key is invalid or expired
- **No response**: Check your internet connection
- **Fallback mode**: AI will use local logic if API fails

## 5. Cost

- Each outfit generation costs ~$0.01-0.05
- Free tier: $5 credit (enough for testing)
- Pay as you go after free tier
