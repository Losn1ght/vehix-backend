"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 3001;
app.use((0, cors_1.default)({ origin: 'http://localhost:3000' }));
app.use(express_1.default.json());
// Supabase client setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
const authMiddleware_1 = require("./middlewares/authMiddleware");
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});
// A protected route
app.get('/api/protected', authMiddleware_1.requireAuth, (req, res) => {
    res.json({ message: 'Welcome to the protected route!', user: req.user });
});
// Example route to test the connection
app.get('/api/test-db', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!supabaseUrl || !process.env.SUPABASE_ANON_KEY) {
        // Return 500 when the backend doesn't have the keys.
        // In Express 5, we must return the response. But actually res.status().json() is fine.
        res.status(500).json({ error: 'Supabase credentials not configured in backend .env' });
        return;
    }
    try {
        // You can replace 'your_table_name' with an actual table you have in Supabase
        // const { data, error } = await supabase.from('your_table_name').select('*').limit(5);
        // if (error) throw error;
        res.json({
            message: 'Supabase credentials detected! Backend is ready to query tables.',
            // data 
        });
    }
    catch (error) {
        res.status(500).json({ error: 'Database query failed', details: error });
    }
}));
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
