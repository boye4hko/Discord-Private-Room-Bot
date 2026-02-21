const { ChannelType } = require('discord.js');
const { getRoomByChannelId, deleteRoom, clearVoiceStates } = require('../database/db');
const logger = require('../utils/logger');

const timers = new Map();

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        try {
            const channel = oldState.channel;
            
            if (oldState.channel && !newState.channel) {
                if (channel.type === ChannelType.GuildVoice && channel.parent?.name === '[PRIVATE ROOMS]') {
                    if (channel.members.size === 0) {
                        const existingTimer = timers.get(channel.id);
                        if (!existingTimer) {
                            const timer = setTimeout(async () => {
                                try {
                                    const room = await getRoomByChannelId(channel.id);
                                    if (room && channel.members.size === 0) {
                                        await clearVoiceStates(channel.id);
                                        await deleteRoom(channel.id);
                                        await channel.delete().catch(() => {});
                                        logger.info('Пустая комната удалена', { channelId: channel.id });
                                    }
                                } catch (error) {
                                    logger.error('Ошибка при удалении пустой комнаты:', error.message);
                                } finally {
                                    timers.delete(channel.id);
                                }
                            }, 30 * 60 * 1000);
                            
                            timers.set(channel.id, timer);
                        }
                    }
                }
            }

            if (oldState.channel && newState.channel !== oldState.channel) {
                const oldChannel = oldState.channel;
                if (oldChannel.parent?.name === '[PRIVATE ROOMS]') {
                    if (oldChannel.members.size > 0) {
                        const existingTimer = timers.get(oldChannel.id);
                        if (existingTimer) {
                            clearTimeout(existingTimer);
                            timers.delete(oldChannel.id);
                        }
                    } else if (oldChannel.members.size === 0) {
                        const existingTimer = timers.get(oldChannel.id);
                        if (!existingTimer) {
                            const timer = setTimeout(async () => {
                                try {
                                    const room = await getRoomByChannelId(oldChannel.id);
                                    if (room && oldChannel.members.size === 0) {
                                        await clearVoiceStates(oldChannel.id);
                                        await deleteRoom(oldChannel.id);
                                        await oldChannel.delete().catch(() => {});
                                        logger.info('Пустая комната удалена', { channelId: oldChannel.id });
                                    }
                                } catch (error) {
                                    logger.error('Ошибка при удалении пустой комнаты:', error.message);
                                } finally {
                                    timers.delete(oldChannel.id);
                                }
                            }, 30 * 60 * 1000);
                            
                            timers.set(oldChannel.id, timer);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('Ошибка обновления голосового статуса:', error.message);
        }
    }
};
