require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Jimp = require('jimp');
const fs = require('fs');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');

const app = express();
app.use(express.json());

// Инициализация бота
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Загрузка шаблонов предсказаний
const predictions = JSON.parse(fs.readFileSync('predictions.json', 'utf8'));

// Gemini генерация предсказания
async function getGeminiPrediction(name, category) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "models/gemini-pro" });

        const prompt = `
Ты — TikTok-оракул Fortune Cookie Bot. Твоя задача — написать очень человечное, подробное, дружелюбное и вдохновляющее предсказание для пользователя по имени ${name}. Категория: ${category === 'humor' ? 'юмор (смешно, дерзко, с мемами)' : category === 'mystic' ? 'мистика (таинственно, загадочно, вдохновляюще)' : 'мемы (иронично, с вайбом TikTok)'}.

Пиши от первого лица, обращайся к пользователю по имени (${name}), добавляй детали, эмоции, TikTok-вайб. В КОНЦЕ КАЖДОГО ПРЕДЛОЖЕНИЯ ОБЯЗАТЕЛЬНО ставь подходящий эмодзи (например, 😎, 🌙, 🐱, ✨, 🚀, 😺, и т.д.). Ответ должен быть не короче 70 слов. Если ответ короче — обязательно дополни его! Не используй сухой стиль, не повторяй шаблоны. Сделай так, чтобы предсказание было похоже на длинное, тёплое, искреннее сообщение от близкого друга, а не на короткую фразу.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        // Gemini иногда возвращает пустой или слишком короткий ответ
        if (!text || text.length < 100) {
            throw new Error('Gemini вернул слишком короткий или пустой ответ');
        }

        console.log('Gemini ответ:', text);
        return text;
    } catch (error) {
        console.error('Ошибка при получении предсказания от Gemini:', error);
        // Fallback на шаблон
        return predictions[category][Math.floor(Math.random() * predictions[category].length)]
            .replace('{name}', name);
    }
}

// Генерация изображения
async function createPredictionImage(text, emoji) {
    const image = new Jimp(800, 400, 0xffffffff);
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
    const textWidth = Jimp.measureText(font, text);
    const textX = (800 - textWidth) / 2;
    image.print(font, textX, 150, text);
    image.print(font, 350, 250, emoji);
    return image.getBufferAsync(Jimp.MIME_PNG);
}

// Категория по эмодзи
function getCategoryByEmoji(emoji) {
    if (emoji === '😎') return 'humor';
    if (emoji === '🌙') return 'mystic';
    return 'meme';
}

// Команда /start
bot.onText(/\/start/, (msg) => {
    const welcomeMessage = `Привет, тиктокер! 🥠 Я бот-предсказатель!

Напиши /predict [твоё имя] [эмодзи], чтобы узнать, что тебя ждёт!
Например: /predict Катя 😎

Хочешь мемный вайб или мистику? Погнали! 🚀`;
    bot.sendMessage(msg.chat.id, welcomeMessage);
});

// Команда /predict
bot.onText(/\/predict (.+)/, async (msg, match) => {
    try {
        const args = match[1].split(' ');
        const name = args[0];
        const emoji = args[1] || ['😎', '🌙', '🐱'][Math.floor(Math.random() * 3)];
        const category = getCategoryByEmoji(emoji);

        const prediction = await getGeminiPrediction(name, category);
        const imageBuffer = await createPredictionImage(prediction, emoji);

        await bot.sendPhoto(msg.chat.id, imageBuffer, {
            caption: `${prediction}\n\nПоделись этим в TikTok! #предсказания`
        });
    } catch (e) {
        console.error('Ошибка в /predict:', e);
        bot.sendMessage(msg.chat.id, "Упс! Что-то пошло не так. Попробуй еще раз!");
    }
});

// Команда /share
bot.onText(/\/share/, (msg) => {
    const shareText = `Моё предсказание от @FortuneCookieBot! 
Проверь своё! 🥠 #предсказания`;
    bot.sendMessage(msg.chat.id, shareText);
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    const helpText = `Используй /predict [имя] [эмодзи] для предсказания! 
😎 — дерзкое
🌙 — мистическое
🐱 — мемное

Делись в TikTok! 🚀`;
    bot.sendMessage(msg.chat.id, helpText);
});

// Команда /donate
bot.onText(/\/donate/, (msg) => {
    const donateText = `Понравился бот? 😺 
Поддержи его через ЮMoney: [ссылка]
Даже 10 рублей помогут! 🙌`;
    bot.sendMessage(msg.chat.id, donateText);
});

// POST для Telegram webhook
app.post('/', (req, res) => {
    console.log('Получен запрос:', req.body);
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// GET для проверки Render/Telegram
app.get('/', (req, res) => {
    res.send('Bot is running!');
});

// Запуск сервера
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    try {
        await bot.deleteWebHook();
        const webhookUrl = process.env.WEBHOOK_URL;
        await bot.setWebHook(webhookUrl);
        console.log('Webhook успешно установлен:', webhookUrl);
        const webhookInfo = await bot.getWebHookInfo();
        console.log('Информация о webhook:', webhookInfo);
    } catch (error) {
        console.error('Ошибка при установке webhook:', error);
    }
}); 