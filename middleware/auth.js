const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    // ტოკენი მოდის Authorization ჰედერიდან, ფორმატით: "Bearer [token]"
    const token = req.header('Authorization');
    if (!token) return res.status(401).json({ message: "წვდომა შეზღუდულია. ტოკენი არ მოიძებნა." });

    try {
        const verified = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'secret_key_for_testing_123');
        req.user = verified;
        next();
    } catch (error) {
        res.status(400).json({ message: "არასწორი ან ვადაგასული ტოკენი." });
    }
};

const isAdmin = (req, res, next) => {
    // req.user შეივსება verifyToken მიდლვეარის მიერ
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: "წვდომა უარყოფილია. თქვენ არ გაქვთ ადმინისტრატორის უფლებები." });
    }
};

module.exports = { verifyToken, isAdmin };
