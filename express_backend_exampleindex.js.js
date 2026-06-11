/**
 * Express.js Backend Server - RedLine
 * -------------------------------------------------------------
 * هذا هو الملف الرئيسي الذي يستقبل الطلبات من تطبيق الأندرويد
 * ويتعامل مع قاعدة بيانات MongoDB Atlas لإدارة الإعلانات، المستخدمين، الأكواد.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { 
    connectDatabase, 
    Advertisement, 
    UserAccount, 
    ActivationCode, 
    AdminUser 
} = require('./mongoose_connection');

const app = express();
const PORT = process.env.PORT || 3000;

// تفعيل CORS لتمكين لوحة التحكم من الاتصال السلس بالخادم
app.use(cors());
app.use(bodyParser.json());

// الاتصال المباشر بقاعدة البيانات السحابية MongoDB Atlas 
connectDatabase();

// ==========================================
// API ENDPOINTS FOR THE ANDROID DASHBOARD
// ==========================================

// نقطة فحص جودة الاتصال والتحقق من صحة الخادم
app.get('/api/health', (req, res) => {
    res.json({ status: "OK", database: "MongoDB Atlas connected successfully!" });
});

// 1. جلب كافة حسابات المستخدمين النشطين
app.get('/api/users', async (req, res) => {
    try {
        const users = await UserAccount.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. تفعيل حساب مستخدم جديد
app.post('/api/users', async (req, res) => {
    try {
        const { id, username } = req.body;
        const userId = id || req.body._id;
        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const existing = await UserAccount.findById(userId);
        if (existing) {
            return res.status(400).json({ error: "User ID already exists in Atlas DB" });
        }
        const newUser = new UserAccount({
            _id: userId,
            username: username || "anonymous",
            subscriptionType: 'None',
            subscriptionExpiry: null
        });
        const saved = await newUser.save();
        res.status(201).json({ success: true, data: saved });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. جلب أكواد التفعيل وتاريخها
app.get('/api/activation-codes', async (req, res) => {
    try {
        const codes = await ActivationCode.find().sort({ createdAt: -1 });
        res.json(codes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. جلب الحملات الإعلانية الحية
app.get('/api/advertisements', async (req, res) => {
    try {
        const ads = await Advertisement.find().sort({ createdAt: -1 });
        res.json(ads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. نشر حملة إعلانية جديدة من التطبيق
app.post('/api/advertisements', async (req, res) => {
    try {
        const { title, mediaType, mediaUrl, priority, duration } = req.body;
        
        const now = new Date();
        let expiryAt = new Date();
        if (duration.includes("Day")) expiryAt.setDate(now.getDate() + 1);
        else if (duration.includes("Week")) expiryAt.setDate(now.getDate() + 7);
        else if (duration.includes("Month") || duration.includes("Months")) expiryAt.setMonth(now.getMonth() + 1);
        else if (duration.includes("Year")) expiryAt.setFullYear(now.getFullYear() + 1);
        else expiryAt.setDate(now.getDate() + 30); // الافتراضي شهر واحد

        const newAd = new Advertisement({
            title,
            mediaType,
            mediaUrl,
            priority,
            duration,
            createdAt: now,
            expiryAt,
            isActive: true
        });

        const savedAd = await newAd.save();
        res.status(201).json({ success: true, message: "Campaign published successfully to MongoDB", data: savedAd });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 6. حذف حملة إعلانية بشكل نهائي
app.delete('/api/advertisements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Advertisement.findByIdAndDelete(id);
        res.json({ success: true, message: "Campaign deleted from cloud storage" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 7. توليد كود اشتراك سحابي جديد وربطه بالمستفيد
app.post('/api/activation-codes/generate', async (req, res) => {
    try {
        const { userId, subscriptionType } = req.body;
        
        const user = await UserAccount.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "Linked user ID not found in Atlas DB" });
        }

        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const numbers = "0123456789";
        let code = "";
        for (let i = 0; i < 4; i++) code += letters.charAt(Math.floor(Math.random() * letters.length));
        for (let i = 0; i < 3; i++) code += numbers.charAt(Math.floor(Math.random() * numbers.length));

        const newCode = new ActivationCode({
            code,
            userId,
            subscriptionType,
            isUsed: false
        });

        await newCode.save();
        res.json({ success: true, code: newCode });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 8. فحص وتفعيل كود اشتراك في لوحة المحاكاة
app.post('/api/activation-codes/redeem', async (req, res) => {
    try {
        const { code, targetUserId } = req.body;
        
        const codeDoc = await ActivationCode.findOne({ code: code.trim().toUpperCase() });
        if (!codeDoc) {
            return res.status(404).json({ error: "Activation code not found." });
        }
        if (codeDoc.isUsed) {
            return res.status(400).json({ error: "This activation code has already been redeemed." });
        }
        if (codeDoc.userId !== targetUserId) {
            return res.status(403).json({ error: "Access Denied: Code is bound to an alternate client account." });
        }

        const user = await UserAccount.findById(targetUserId);
        if (!user) {
            return res.status(404).json({ error: "Target User ID no longer exists in DB." });
        }

        const expDate = new Date();
        const type = codeDoc.subscriptionType;
        if (type.includes("Day")) expDate.setDate(expDate.getDate() + 1);
        else if (type.includes("Week")) expDate.setDate(expDate.getDate() + 7);
        else if (type.includes("Month")) expDate.setMonth(expDate.getMonth() + 1);
        else if (type.includes("Year")) expDate.setFullYear(expDate.getFullYear() + 1);

        user.subscriptionType = type;
        user.subscriptionExpiry = expDate;
        user.activatedCode = codeDoc.code;
        await user.save();

        codeDoc.isUsed = true;
        codeDoc.redeemedAt = new Date();
        await codeDoc.save();

        res.json({
            success: true,
            username: user.username,
            subscriptionType: type,
            expiryTime: expDate.getTime()
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`📡 Server dynamically listening on port ${PORT}`);
});
