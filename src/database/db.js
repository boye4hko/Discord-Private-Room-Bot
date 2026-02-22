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
            CREATE TABLE IF NOT EXISTS banned_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                guild_id VARCHAR(50) NOT NULL,
                user_id VARCHAR(50) NOT NULL,
                reason VARCHAR(255),
                expires_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_ban (guild_id, user_id)
            )
        `);

        try {
            const [cols] = await connection.execute("SHOW COLUMNS FROM banned_users LIKE 'expires_at'");
            if (!cols || cols.length === 0) {
                await connection.execute('ALTER TABLE banned_users ADD COLUMN expires_at DATETIME NULL');
                console.log('Миграция: добавлено поле banned_users.expires_at');
            }
        } catch (e) {
        }

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

async function getRoomByName(guildId, name) {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT * FROM private_rooms WHERE guild_id = ? AND channel_id IS NOT NULL',
            [guildId]
        );
        connection.release();
        const found = rows.find(r => r.channel_id && r.channel_id.toString() === name);
        return found || null;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return null;
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

async function getVoiceState(channelId, userId) {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT muted, deafened FROM room_voice_states WHERE channel_id = ? AND user_id = ?',
            [channelId, userId]
        );
        connection.release();
        return rows[0] || { muted: false, deafened: false };
    } catch (error) {
        console.error('Ошибка БД:', error);
        return { muted: false, deafened: false };
    }
}

async function removeVoiceState(channelId, userId) {
    try {
        const connection = await pool.getConnection();
        await connection.execute(
            'DELETE FROM room_voice_states WHERE channel_id = ? AND user_id = ?',
            [channelId, userId]
        );
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

async function banUser(guildId, userId, reason, expiresAt = null) {
    try {
        const connection = await pool.getConnection();
        await connection.execute(
            'INSERT INTO banned_users (guild_id, user_id, reason, expires_at) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE reason = VALUES(reason), expires_at = VALUES(expires_at)',
            [guildId, userId, reason || null, expiresAt]
        );
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

async function unbanUser(guildId, userId) {
    try {
        const connection = await pool.getConnection();
        await connection.execute('DELETE FROM banned_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        connection.release();
        return true;
    } catch (error) {
        console.error('Ошибка БД:', error);
        return false;
    }
}

async function isUserBanned(guildId, userId) {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.execute('SELECT * FROM banned_users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        connection.release();
        return rows.length > 0;
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
    getVoiceState,
    removeVoiceState,
    getRoomByName,
    banUser,
    unbanUser,
    isUserBanned,
};
