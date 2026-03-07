"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const health_1 = __importDefault(require("./routes/health"));
const protected_1 = __importDefault(require("./routes/protected"));
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express_1.default.json());
// Rate limiting — 100 requests per 15 minutes per IP
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', limiter);
// Routes
app.use('/api', health_1.default);
app.use('/api', protected_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});
// Global error handler
app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});
const server = app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
// Graceful shutdown
function shutdown() {
    console.log('Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
