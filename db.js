const { Pool } = require('pg');
require('dotenv').config();

// Ensure DATABASE_URL is configured
if (!process.env.DATABASE_URL) {
    console.warn('⚠️ DATABASE_URL environment variable is missing. Database is offline.');
}

const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        // SSL check for cloud databases
        ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1') 
            ? false 
            : { rejectUnauthorized: false }
      })
    : null;

let isConnected = false;

// Simple in-memory fallback user database for degraded testing mode
let memoryDb = {
    users: [
        {
            facebook_id: "123456789",
            email: "merchant@example.com",
            name: "Mock Merchant BD",
            access_token: "mock_access_token_12345",
            tier: "free"
        }
    ]
};

// Verify connection on startup
if (pool) {
    pool.connect((err, client, release) => {
        if (err) {
            console.error('❌ DATABASE WARNING: PostgreSQL connection failed. Falling back to In-Memory Simulator.');
            console.error('Error Details:', err.message);
        } else {
            console.log('✅ Connected to PostgreSQL production database.');
            isConnected = true;
            release();
            initDb();
        }
    });
} else {
    console.warn('⚠️ No database connection pool. Running in In-Memory Simulator Mode.');
}

async function initDb() {
    if (!isConnected) return;
    try {
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                facebook_id VARCHAR(255) UNIQUE,
                email VARCHAR(255),
                name VARCHAR(255),
                access_token TEXT,
                tier VARCHAR(50) DEFAULT 'free',
                whatsapp_number VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        // Add index on facebook_id for fast queries
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_users_facebook_id ON users(facebook_id);
        `);
        
        console.log('✅ PostgreSQL database tables and indexes initialized.');
    } catch (err) {
        console.error('❌ Failed to initialize PostgreSQL tables:', err.message);
    }
}

// Hybrid Query Runner (Real DB vs. Memory Simulator Fallback)
async function query(text, params) {
    if (!isConnected) {
        console.warn('⚠️ DB Simulator Mode: Running in-memory query.');

        // 1. Check if user exists
        if (text.includes('SELECT * FROM users WHERE facebook_id = $1')) {
            const user = memoryDb.users.find(u => u.facebook_id === params[0]);
            return { rows: user ? [user] : [] };
        }
        
        // 2. Insert new user record
        if (text.includes('INSERT INTO users')) {
            const newUser = {
                facebook_id: params[0],
                email: params[1],
                name: params[2],
                access_token: params[3],
                tier: params[4] || 'free',
                created_at: new Date()
            };
            memoryDb.users.push(newUser);
            return { rows: [newUser] };
        }
        
        // 3. Update access token
        if (text.includes('UPDATE users SET access_token = $1 WHERE facebook_id = $2')) {
            const user = memoryDb.users.find(u => u.facebook_id === params[1]);
            if (user) user.access_token = params[0];
            return { rows: user ? [user] : [] };
        }

        // 4. Update user subscription tier (e.g. on bKash success)
        if (text.includes('UPDATE users SET tier = $1 WHERE facebook_id = $2')) {
            const user = memoryDb.users.find(u => u.facebook_id === params[1]);
            if (user) user.tier = params[0];
            return { rows: user ? [user] : [] };
        }
        
        // 5. Select name of user
        if (text.includes('SELECT name FROM users WHERE facebook_id = $1')) {
            const user = memoryDb.users.find(u => u.facebook_id === params[0]);
            return { rows: user ? [{ name: user.name }] : [] };
        }

        return { rows: [] };
    }
    
    return pool.query(text, params);
}

module.exports = {
    query,
    pool,
    isConnected: () => isConnected
};
