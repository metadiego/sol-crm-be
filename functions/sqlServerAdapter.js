const mysql = require('promise-mysql');

const pool = mysql.createPool({
    connectionLimit: 1,
    socketPath: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
});

async function getRows(tokens) {
    const queryPool = await pool;
    let stringifiedValues = JSON.stringify(tokens.flat()).replace(/\[|\]/g,'');
    let query = `SELECT * FROM community_data WHERE mint_id IN (${stringifiedValues})`;
    return queryPool.query(query);
}


///TODO: await this somehow, otherwise the write wont happen
async function writeRows(rows) {
    const queryPool = await pool;
    var sql = 'INSERT INTO community_data (public_key, mint_id, ammount_owned, purchase_events) VALUES ?';
    return queryPool.query(sql, [rows]);
}

module.exports = { getRows, writeRows };