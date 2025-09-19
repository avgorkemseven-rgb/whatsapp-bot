const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());

// Render.com'un bize verdiği portu kullanmamız lazım
const PORT = process.env.PORT || 3000;
// Render'da belirlediğimiz gizli şifre
const SECRET_KEY = process.env.SECRET_KEY || 'default_secret';

console.log('WhatsApp istemcisi başlatılıyor...');
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    console.log('Giriş yapmak için bu QR kodu telefonunuzdan okutun:');
    qrcode.generate(qr, { small: false });
});

client.on('ready', () => {
    console.log('WhatsApp istemcisi hazır ve bağlandı!');
});

// Güvenlik için bir ara katman (middleware)
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null || token !== SECRET_KEY) {
        console.log('Yetkisiz istek engellendi.');
        return res.sendStatus(403); // Forbidden
    }
    next();
};

// Mesaj gönderme endpoint'i
app.post('/send-message', authMiddleware, async (req, res) => {
    const { groupId, message } = req.body;
    if (!groupId || !message) {
        return res.status(400).json({ success: false, error: 'groupId ve message alanları zorunludur.' });
    }
    try {
        await client.sendMessage(groupId, message);
        res.json({ success: true, message: 'Mesaj başarıyla gönderildi.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Mesaj gönderilemedi.' });
    }
});

// Grup ID'sini öğrenmek için özel komut
client.on('message', async msg => {
    if (msg.body === '@grup-id' && msg.from.endsWith('@g.us')) {
        console.log(`Grup ID isteği geldi: ${msg.from}`);
        const chat = await msg.getChat();
        if (chat.isGroup) {
             // Cevabı isteği gönderen kişiye özelden atalım
            client.sendMessage(msg.author, `İstediğiniz grubun ID'si:\n${msg.from}`);
        }
    }
});

client.initialize();
app.listen(PORT, () => console.log(`Bot sunucusu port ${PORT} üzerinde dinlemede.`));
