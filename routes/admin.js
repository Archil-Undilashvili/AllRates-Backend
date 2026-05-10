const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { verifyToken, isAdmin } = require('../middleware/auth');

// GET /api/admin/users
// აბრუნებს ყველა მომხმარებლის სიას (მხოლოდ ადმინისტრატორებისთვის)
router.get('/users', verifyToken, isAdmin, async (req, res) => {
    try {
        // მოგვაქვს ყველა იუზერი, მაგრამ პაროლის ველს (-password) არ ვუგზავნით ფრონტს უსაფრთხოებისთვის
        // ვასორტირებთ რეგისტრაციის თარიღის მიხედვით კლებადობით (ახლები პირველ რიგში)
        const users = await User.find({}, '-password').sort({ createdAt: -1 });

        // დავთვალოთ სტატისტიკაც რომ ზემოთ გამოვაჩინოთ
        const totalUsers = users.length;
        const verifiedUsers = users.filter(u => u.isVerified).length;

        res.json({
            stats: {
                total: totalUsers,
                verified: verifiedUsers,
                unverified: totalUsers - verifiedUsers
            },
            users: users
        });
    } catch (error) {
        console.error("ადმინ პანელის შეცდომა:", error);
        res.status(500).json({ message: "სერვერის შეცდომა მონაცემების წამოღებისას" });
    }
});

module.exports = router;
