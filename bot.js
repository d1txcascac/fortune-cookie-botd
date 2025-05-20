require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Jimp = require('jimp');
const fs = require('fs');
const axios = require('axios');
const express = require('express');

const app = express();
app.use(express.json());

// Инициализация бота с токеном
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Загрузка предсказаний из JSON
const predictions = JSON.parse(fs.readFileSync('predictions.json', 'utf8'));

// Функция для получения предсказания от Grok
async function getGrokPrediction(name, category) {
    try {
        const prompt = `Ты — весёлый TikTok-оракул, который пишет очень человечные, подробные и дружелюбные предсказания для пользователей. Тебя зовут Fortune Cookie Bot. Твоя задача — придумать интересное, оригинальное и позитивное предсказание для пользователя по имени ${name}. Категория: ${category === 'humor' ? 'юмор (смешно, дерзко, с мемами)' : category === 'mystic' ? 'мистика (таинственно, загадочно, вдохновляюще)' : 'мемы (иронично, с вайбом TikTok)'}.

Пиши от первого лица, обращайся к пользователю по имени (${name}), добавляй детали, эмоции, TikTok-вайб. В конце каждого предложения обязательно ставь подходящий эмодзи. Сделай так, чтобы предсказание было похоже на совет или вдохновляющее сообщение от друга. Не повторяй шаблоны, не используй сухой стиль. Ответ должен быть не короче 50 слов.`;

        const response = await axios.post('https://api.grok.ai/v1/chat/completions', {
            messages: [{ role: 'user', content: prompt }],
            model: 'grok-1',
            temperature: 0.95,
            max_tokens: 350
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error('Ошибка при получении предсказания от Grok:', error);
        // В случае ошибки возвращаем предсказание из JSON
        return predictions[category][Math.floor(Math.random() * predictions[category].length)]
            .replace('{name}', name);
    }
}

// Создание изображения с предсказанием
async function createPredictionImage(text, emoji) {
    // Создаем новое изображение
    const image = new Jimp(800, 400, 0xffffffff);
    
    // Загружаем шрифт
    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
    
    // Вычисляем позицию текста для центрирования
    const textWidth = Jimp.measureText(font, text);
    const textX = (800 - textWidth) / 2;
    
    // Рисуем текст
    image.print(font, textX, 150, text);
    image.print(font, 350, 250, emoji);
    
    // Конвертируем в буфер
    return image.getBufferAsync(Jimp.MIME_PNG);
}

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
    const welcomeMessage = `Привет, тиктокер! 🥠 Я бот-предсказатель! 

Напиши /predict [твоё имя] [эмодзи], чтобы узнать, что тебя ждёт! 
Например: /predict Катя 😎

Хочешь мемный вайб или мистику? Погнали! 🚀`;
    
    bot.sendMessage(msg.chat.id, welcomeMessage);
});

// Обработка команды /predict
bot.onText(/\/predict (.+)/, async (msg, match) => {
    try {
        const args = match[1].split(' ');
        const name = args[0];
        const emoji = args[1] || ['😎', '🌙', '🐱'][Math.floor(Math.random() * 3)];

        // Выбираем категорию предсказания на основе эмодзи
        let category;
        if (emoji === '😎') category = 'humor';
        else if (emoji === '🌙') category = 'mystic';
        else category = 'meme';

        // Получаем предсказание от Grok
        const prediction = await getGrokPrediction(name, category);

        // Создаем и отправляем изображение
        const imageBuffer = await createPredictionImage(prediction, emoji);
        await bot.sendPhoto(msg.chat.id, imageBuffer, {
            caption: `${prediction}\n\nПоделись этим в TikTok! #предсказания`
        });
    } catch (e) {
        console.error('Ошибка:', e);
        bot.sendMessage(msg.chat.id, "Упс! Что-то пошло не так. Попробуй еще раз!");
    }
});

// Обработка команды /share
bot.onText(/\/share/, (msg) => {
    const shareText = `Моё предсказание от @FortuneCookieBot! 
Проверь своё! 🥠 #предсказания`;
    
    bot.sendMessage(msg.chat.id, shareText);
});

// Обработка команды /help
bot.onText(/\/help/, (msg) => {
    const helpText = `Используй /predict [имя] [эмодзи] для предсказания! 
😎 — дерзкое
🌙 — мистическое
🐱 — мемное

Делись в TikTok! 🚀`;
    
    bot.sendMessage(msg.chat.id, helpText);
});

// Обработка команды /donate
bot.onText(/\/donate/, (msg) => {
    const donateText = `Понравился бот? 😺 
Поддержи его через ЮMoney: [ссылка]
Даже 10 рублей помогут! 🙌`;
    
    bot.sendMessage(msg.chat.id, donateText);
});

// Обработка всех POST запросов
app.post('/', (req, res) => {
    console.log('Получен запрос:', req.body);
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Запуск сервера
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    
    try {
        // Удаляем старый webhook если есть
        await bot.deleteWebHook();
        
        // Устанавливаем новый webhook
        const webhookUrl = process.env.WEBHOOK_URL;
        await bot.setWebHook(webhookUrl);
        console.log('Webhook успешно установлен:', webhookUrl);
        
        // Проверяем информацию о webhook
        const webhookInfo = await bot.getWebHookInfo();
        console.log('Информация о webhook:', webhookInfo);
    } catch (error) {
        console.error('Ошибка при установке webhook:', error);
    }
}); 