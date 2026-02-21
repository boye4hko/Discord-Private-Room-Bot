const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectionTimeout: 10000
});

async function initializeDatabase() {
    try {
        const connection = await pool.getConnection();
        
        await connection.execute(`
            CREATE TABLE IF NOT EXISTS private_rooms (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(50) NOT NULL,
                owner_id VARCHAR(50) NOT NULL,
                channel_id VARCHAR(50) NOT NULL,
                category_id VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await connection.execute(`
            CREATE TABLE IF NOT EXISTS room_voice_states (
                id INT AUTO_INCREMENT PRIMARY KEY,
                channel_id VARCHAR(50) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                muted BOOLEAN DEFAULT FALSE,
                deafened BOOLEAN DEFAULT FALSE
            )
        `);
        
        connection.release();
        console.log('База данных инициализирована');
    } catch (error) {
        console.error('Ошибка инициализации БД:', error);
        process.exit(1);
    }
}

async function getRoomByChannelId(channelId) {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM private_rooms WHERE channel_id = ?',
            [channelId]
        );
        connection.release();
        return rows[0] || null;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return null;
    }
}

async function getRoomsByGuildId(guildId) {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM private_rooms WHERE guild_id = ?',
            [guildId]
        );
        connection.release();
        return rows;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return [];
    }
}

async function createRoom(guildId, ownerId, channelId, categoryId) {
    try {
        const connection = await pool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO private_rooms (guild_id, owner_id, channel_id, category_id) VALUES (?, ?, ?, ?)',
            [guildId, ownerId, channelId, categoryId]
        );
        connection.release();
        return result.insertId;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return null;
    }
}

async function deleteRoom(channelId) {
    try {
        const connection = await pool.getConnection();
        await connection.execute('DELETE FROM private_rooms WHERE channel_id = ?', [channelId]);
        await connection.execute('DELETE FROM room_voice_states WHERE channel_id = ?', [channelId]);
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

async function updateRoomOwner(channelId, newOwnerId) {
    try {
        const connection = await pool.getConnection();
        await connection.execute(
            'UPDATE private_rooms SET owner_id = ? WHERE channel_id = ?',
            [newOwnerId, channelId]
        );
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

async function addMutedUser(channelId, userId, isMuted) {
    try {
        const connection = await pool.getConnection();
        await connection.execute(
            'INSERT INTO room_voice_states (channel_id, user_id, muted) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE muted = VALUES(muted)',
            [channelId, userId, isMuted ? 1 : 0]
        );
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

async function addDeafenedUser(channelId, userId, isDeafened) {
    try {
        const connection = await pool.getConnection();
        await connection.execute(
            'INSERT INTO room_voice_states (channel_id, user_id, deafened) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE deafened = VALUES(deafened)',
            [channelId, userId, isDeafened ? 1 : 0]
        );
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

async function removeMutedUser(channelId, userId) {
    try {
        const connection = await pool.getConnection();
        await connection.execute(
            'UPDATE room_voice_states SET muted = FALSE WHERE channel_id = ? AND user_id = ?',
            [channelId, userId]
        );
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

async function removeDeafenedUser(channelId, userId) {
    try {
        const connection = await pool.getConnection();
        await connection.execute(
            'UPDATE room_voice_states SET deafened = FALSE WHERE channel_id = ? AND user_id = ?',
            [channelId, userId]
        );
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

async function getMutedUsers(channelId) {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT user_id FROM room_voice_states WHERE channel_id = ? AND muted = TRUE',
            [channelId]
        );
        connection.release();
        return rows.map(r => r.user_id);
    } catch (error) {
        console.error('Ошибка БД:', error);
        return [];
    }
}

async function getDeafenedUsers(channelId) {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT user_id FROM room_voice_states WHERE channel_id = ? AND deafened = TRUE',
            [channelId]
        );
        connection.release();
        return rows.map(r => r.user_id);
    } catch (error) {
        console.error('Ошибка БД:', error);
        return [];
    }
}

async function clearVoiceStates(channelId) {
    try {
        const connection = await pool.getConnection();
        await connection.execute(
            'DELETE FROM room_voice_states WHERE channel_id = ?',
            [channelId]
        );
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

module.exports = {
    pool,
    initializeDatabase,
    getRoomByChannelId,
    getRoomsByGuildId,
    createRoom,
    deleteRoom,
    updateRoomOwner,
    addMutedUser,
    addDeafenedUser,
    removeMutedUser,
    removeDeafenedUser,
    getMutedUsers,
    getDeafenedUsers,
    clearVoiceStates
};
