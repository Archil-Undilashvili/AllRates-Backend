const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const VerificationCode = require('../models/VerificationCode');
const { verifyToken } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_key_for_testing_123';
const REQUIRE_EMAIL_VERIFICATION = process.env.AUTH_REQUIRE_EMAIL_VERIFICATION === 'true';

function buildToken(user) {
    return jwt.sign(
        { userId: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function publicUser(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        status: user.status
    };
}

// =========================================================================
// ✉️ იმეილის გამგზავნი სისტემის კონფიგურაცია (Nodemailer)
// =========================================================================
const transporter = nodemailer.createTransport({
    service: 'gmail', // მაგალითად ვიყენებთ ჯიმეილს
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
        // აქ დაგვჭირდება Google App Password-ის ჩაწერა მომავალში
    }
});

// =========================================================================
// 1️⃣ მომხმარებლის რეგისტრაცია (Sign Up)
// ლინკი: POST /api/auth/register
// =========================================================================
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const normalizedEmail = String(email || '').toLowerCase().trim();

        if (!name || !normalizedEmail || !password) {
            return res.status(400).json({ message: "შეავსეთ სახელი, ელ-ფოსტა და პაროლი" });
        }

        if (password.length < 6) {
            return res.status(400).json({ message: "პაროლი უნდა იყოს მინიმუმ 6 სიმბოლო" });
        }

        // 1. შევამოწმოთ, ხომ არ არსებობს უკვე ეს იმეილი ბაზაში?
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: "ეს იმეილი უკვე რეგისტრირებულია" });
        }

        // 2. პაროლის დაშიფრვა (რათა ბაზაში ღიად არ გამოჩნდეს)
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. ახალი იუზერის შექმნა ბაზაში (სტატუსი: isVerified = false)
        const newUser = new User({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: 'user', // ნაგულისხმევად ყველა ჩვეულებრივი იუზერია
            isVerified: !REQUIRE_EMAIL_VERIFICATION
        });
        await newUser.save();

        if (!REQUIRE_EMAIL_VERIFICATION) {
            const token = buildToken(newUser);
            return res.status(201).json({
                message: "რეგისტრაცია წარმატებულია.",
                emailVerificationRequired: false,
                token,
                user: publicUser(newUser)
            });
        }

        // 4. 6-ნიშნა ვერიფიკაციის კოდის გენერაცია
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 5. კოდის შენახვა ბაზაში 15 წუთით
        const verificationEntry = new VerificationCode({
            userId: newUser._id,
            code: code
        });
        await verificationEntry.save();

        // 6. კოდის გაგზავნა იმეილზე
        const mailOptions = {
            from: process.env.EMAIL_USER || 'your-email@gmail.com',
            to: normalizedEmail,
            subject: 'Allrates.ge - ვერიფიკაციის კოდი',
            text: `გამარჯობა ${name}, შენი ვერიფიკაციის კოდია: ${code}. კოდი აქტიურია 15 წუთის განმავლობაში.`
        };

        // სანამ იმეილს გავმართავთ რეალურად, კონსოლშიც გამოვიტანოთ რომ დავინახოთ
        console.log(`[ტესტირება] გაიგზავნა კოდი ${code} იმეილზე: ${normalizedEmail}`);

        try {
            await transporter.sendMail(mailOptions);
        } catch (mailError) {
            console.log("იმეილის გაგზავნა ვერ მოხერხდა (ალბათ პაროლი არ გვიწერია .env-ში):", mailError.message);
        }

        res.status(201).json({
            message: "რეგისტრაცია წარმატებულია. ვერიფიკაციის კოდი გაგზავნილია იმეილზე.",
            emailVerificationRequired: true
        });

    } catch (error) {
        console.error("რეგისტრაციის შეცდომა:", error);
        res.status(500).json({ message: "სერვერის შეცდომა" });
    }
});

// =========================================================================
// 2️⃣ იმეილის ვერიფიკაცია კოდით (Verify Email)
// ლინკი: POST /api/auth/verify
// =========================================================================
router.post('/verify', async (req, res) => {
    try {
        const { email, code } = req.body;
        const normalizedEmail = String(email || '').toLowerCase().trim();

        // 1. მოვძებნოთ იუზერი ამ იმეილით
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) return res.status(404).json({ message: "იუზერი ვერ მოიძებნა" });

        if (user.isVerified) {
            return res.status(400).json({ message: "ეს იმეილი უკვე ვერიფიცირებულია" });
        }

        // 2. მოვძებნოთ ამ იუზერის შესაბამისი კოდი ბაზაში
        const verificationRecord = await VerificationCode.findOne({ userId: user._id, code: code });

        if (!verificationRecord) {
            return res.status(400).json({ message: "კოდი არასწორია ან ვადა გაუვიდა" });
        }

        // 3. თუ კოდი სწორია, იუზერს გავუხადოთ isVerified = true
        user.isVerified = true;
        await user.save();

        // 4. წავშალოთ გამოყენებული კოდი ბაზიდან
        await VerificationCode.deleteOne({ _id: verificationRecord._id });

        res.json({ message: "იმეილი წარმატებით დადასტურდა! ახლა შეგიძლიათ გაიაროთ ავტორიზაცია." });

    } catch (error) {
        console.error("ვერიფიკაციის შეცდომა:", error);
        res.status(500).json({ message: "სერვერის შეცდომა" });
    }
});

// =========================================================================
// 3️⃣ ავტორიზაცია (Login)
// ლინკი: POST /api/auth/login
// =========================================================================
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = String(email || '').toLowerCase().trim();

        // 1. მოვძებნოთ იუზერი იმეილით
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.status(400).json({ message: "არასწორი იმეილი ან პაროლი" });
        }

        if (user.status === 'blocked') {
            return res.status(403).json({ message: "თქვენი ანგარიში დაბლოკილია" });
        }

        // 2. შევამოწმოთ ვერიფიცირებულია თუ არა
        if (REQUIRE_EMAIL_VERIFICATION && !user.isVerified) {
            return res.status(403).json({ message: "გთხოვთ ჯერ დაადასტუროთ იმეილი კოდით" });
        }

        // 3. შევამოწმოთ პაროლი (შევადაროთ შეყვანილი პაროლი ბაზაში დაშიფრულს)
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({ message: "არასწორი იმეილი ან პაროლი" });
        }

        // 4. დავაგენერიროთ JWT ტოკენი (სესია)
        // ტოკენი ინახავს იუზერის ID-ს და როლს, და ძალაშია 7 დღე
        user.lastLoginAt = new Date();
        await user.save();

        const token = buildToken(user);

        // 5. დავუბრუნოთ პასუხი იუზერის მონაცემებით და ტოკენით
        res.json({
            message: "ავტორიზაცია წარმატებულია!",
            token: token,
            user: publicUser(user)
        });

    } catch (error) {
        console.error("ავტორიზაციის შეცდომა:", error);
        res.status(500).json({ message: "სერვერის შეცდომა" });
    }
});

// =========================================================================
// 4️⃣ მიმდინარე მომხმარებლის მონაცემები
// ლინკი: GET /api/auth/me
// =========================================================================
router.get('/me', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: "იუზერი ვერ მოიძებნა" });
        if (user.status === 'blocked') return res.status(403).json({ message: "თქვენი ანგარიში დაბლოკილია" });

        res.json({ user: publicUser(user) });
    } catch (error) {
        console.error("მომხმარებლის მონაცემების წამოღების შეცდომა:", error);
        res.status(500).json({ message: "სერვერის შეცდომა" });
    }
});

module.exports = router;
