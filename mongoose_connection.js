/**
 * Mongoose Connection Utility and Database Models - RedLine
 * -------------------------------------------------------------
 * ملف إدارة الاتصالات والموديلات لقواعد بيانات MongoDB Atlas 
 */

const mongoose = require('mongoose');

// رابط الاتصال المباشر لقاعدة معلومات أطلس السحابية الخاصة بك
const MONGO_URI = "mongodb+srv://admin:N1a5nZ8IhU4BJ2c7@cluster0.odxgej5.mongodb.net/RedLineDB?retryWrites=true&w=majority&appName=Cluster0";

const connectDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log("🚀 Connected successfully to MongoDB Atlas: RedLineDB");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);
        process.exit(1);
    }
};

// 1. موديل المشرفين
const AdminUserSchema = new mongoose.Schema({
    userId: { type: Number, default: 1, unique: true },
    username: { type: String, required: true },
    passwordHash: { type: String, required: true },
    lastLogin: { type: Date, default: Date.now }
}, { timestamps: true });

const AdminUser = mongoose.model('AdminUser', AdminUserSchema);

// 2. موديل الإعلانات والحملات
const AdvertisementSchema = new mongoose.Schema({
    title: { type: String, required: true },
    mediaType: { type: String, enum: ['IMAGE', 'VIDEO'], required: true },
    mediaUrl: { type: String, required: true },
    priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], required: true },
    duration: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiryAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

const Advertisement = mongoose.model('Advertisement', AdvertisementSchema);

// 3. موديل حسابات المستخدمين ومقارنتها بتطبيق الأندرويد الآخر
const UserAccountSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // تطابق المعرف المخصص للمشترك
    username: { type: String, required: true },
    subscriptionType: { type: String, enum: ['None', 'Day', 'Week', 'Month', 'Year'], default: 'None' },
    subscriptionExpiry: { type: Date, default: null },
    activatedCode: { type: String, default: null }
}, { timestamps: true });

const UserAccount = mongoose.model('UserAccount', UserAccountSchema);

// 4. موديل أكواد الاشتراك والتفعيل
const ActivationCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    userId: { type: String, ref: 'UserAccount', required: true },
    subscriptionType: { type: String, enum: ['Day', 'Week', 'Month', 'Year'], required: true },
    isUsed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    redeemedAt: { type: Date, default: null }
}, { timestamps: true });

const ActivationCode = mongoose.model('ActivationCode', ActivationCodeSchema);

module.exports = {
    connectDatabase,
    AdminUser,
    Advertisement,
    UserAccount,
    ActivationCode,
    mongoose
};
