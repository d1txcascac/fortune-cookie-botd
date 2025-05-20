import os
import json
import random
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes
from dotenv import load_dotenv
from PIL import Image, ImageDraw, ImageFont
import io

# Load environment variables
load_dotenv()

# Load predictions from JSON
def load_predictions():
    with open('predictions.json', 'r', encoding='utf-8') as f:
        return json.load(f)

# Create prediction image
def create_prediction_image(text, emoji):
    # Create a new image with a white background
    img = Image.new('RGB', (800, 400), color='white')
    d = ImageDraw.Draw(img)
    
    # Add text to image
    try:
        font = ImageFont.truetype("arial.ttf", 36)
    except:
        font = ImageFont.load_default()
    
    d.text((400, 200), text, fill='black', font=font, anchor="mm")
    d.text((400, 300), emoji, fill='black', font=font, anchor="mm")
    
    # Save to bytes
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    return img_byte_arr

# Start command
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    welcome_message = """Привет, тиктокер! 🥠 Я бот-предсказатель! 

Напиши /predict [твоё имя] [эмодзи], чтобы узнать, что тебя ждёт! 
Например: /predict Катя 😎

Хочешь мемный вайб или мистику? Погнали! 🚀"""
    await update.message.reply_text(welcome_message)

# Predict command
async def predict_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        # Parse command arguments
        args = context.args
        if len(args) < 1:
            await update.message.reply_text("Пожалуйста, укажи своё имя! Например: /predict Катя 😎")
            return
        
        name = args[0]
        emoji = args[1] if len(args) > 1 else random.choice(['😎', '🌙', '🐱'])
        
        # Load predictions
        predictions = load_predictions()
        
        # Select prediction based on emoji
        if emoji == '😎':
            category = 'humor'
        elif emoji == '🌙':
            category = 'mystic'
        else:
            category = 'meme'
            
        prediction = random.choice(predictions[category]).format(name=name)
        
        # Create and send image
        img = create_prediction_image(prediction, emoji)
        await update.message.reply_photo(
            photo=img,
            caption=f"{prediction}\n\nПоделись этим в TikTok! #предсказания"
        )
        
    except Exception as e:
        await update.message.reply_text("Упс! Что-то пошло не так. Попробуй еще раз!")

# Share command
async def share_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    share_text = """Моё предсказание от @FortuneCookieBot! 
Проверь своё! 🥠 #предсказания"""
    await update.message.reply_text(share_text)

# Help command
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    help_text = """Используй /predict [имя] [эмодзи] для предсказания! 
😎 — дерзкое
🌙 — мистическое
🐱 — мемное

Делись в TikTok! 🚀"""
    await update.message.reply_text(help_text)

# Donate command
async def donate_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    donate_text = """Понравился бот? 😺 
Поддержи его через ЮMoney: [ссылка]
Даже 10 рублей помогут! 🙌"""
    await update.message.reply_text(donate_text)

async def main():
    # Create application
    application = Application.builder().token(os.getenv('TELEGRAM_BOT_TOKEN')).build()

    # Add command handlers
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("predict", predict_command))
    application.add_handler(CommandHandler("share", share_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("donate", donate_command))

    # Start the bot
    await application.run_polling()

if __name__ == '__main__':
    import asyncio
    asyncio.run(main()) 