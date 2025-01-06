const {Pool} = require('pg');
const dotenv = require('dotenv');

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT,
    max: 100,
    idleTimeoutMillis: 3000
});

async function saveMessage({sender_id, receiver_id, message}) {
    console.log("sender_id, receiver_id, message", sender_id, receiver_id, message)
    const query = `
    INSERT INTO opkn.chat (sender_id, receiver_id, text) VALUES ($1, $2, $3);
  `;
    const values = [sender_id, receiver_id, message];
    try {
        const result = await pool.query(query, values);
        return result.rows[0];
    } catch (error) {
        console.error('Error saving message:', error);
        throw error;
    }
}

module.exports = {saveMessage};