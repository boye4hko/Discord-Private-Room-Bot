const { PresenceUpdateStatus } = require('discord.js');
const logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        await client.user.setStatus(PresenceUpdateStatus.DoNotDisturb); // DoNotDistrub, Online, Idle, Invisible
        logger.success(`Бот запущен ${client.user.tag}`);
    }
};
