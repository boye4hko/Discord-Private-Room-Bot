const { ChannelType } = require('discord.js');
const { getRoomByChannelId, deleteRoom, clearVoiceStates, getVoiceState, removeVoiceState } = require('../database/db');
const logger = require('../utils/logger');

const timers = new Map();
const pendingRemovals = new Map(); // userId -> { channelId, muted, deafened, timeout }

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        try {
            if (!oldState.channel && newState.channel) {
                const pending = pendingRemovals.get(newState.member.id);
                if (pending) {
                    try {
                        if (pending.muted) await newState.member.voice.setMute(false);
                        if (pending.deafened) await newState.member.voice.setDeaf(false);
                        await removeVoiceState(pending.channelId, newState.member.id);
                        logger.info('Отложенные ограничения сняты при повторном подключении', { userId: newState.member.id, channelId: pending.channelId });
                    } catch (error) {
                        logger.error('Ошибка при снятии отложенных ограничений:', error.message);
                    } finally {
                        clearTimeout(pending.timeout);
                        pendingRemovals.delete(newState.member.id);
                    }
                    return;
                }

                if (newState.channel.type === ChannelType.GuildVoice && newState.channel.parent?.name === 'Приватные комнаты') {
                    const voiceState = await getVoiceState(newState.channel.id, newState.member.id);
                    if (voiceState.muted || voiceState.deafened) {
                        try {
                            if (voiceState.muted) {
                                await newState.member.voice.setMute(true);
                            }
                            if (voiceState.deafened) {
                                await newState.member.voice.setDeaf(true);
                            }
                            logger.info('Ограничения применены при входе в комнату', { userId: newState.member.id, channelId: newState.channel.id });
                        } catch (error) {
                            logger.error('Ошибка применения ограничений при входе:', error.message);
                        }
                    }
                }
            }

            const channel = oldState.channel;
            
            if (oldState.channel && !newState.channel) {
                if (channel.type === ChannelType.GuildVoice && channel.parent?.name === 'Приватные комнаты') {
                    const voiceState = await getVoiceState(channel.id, oldState.member.id);
                    if (voiceState.muted || voiceState.deafened) {
                        const member = await channel.guild.members.fetch(oldState.member.id).catch(() => null);
                        const isConnected = member && member.voice && member.voice.channel;
                        if (isConnected) {
                            try {
                                if (voiceState.muted) await member.voice.setMute(false);
                                if (voiceState.deafened) await member.voice.setDeaf(false);
                                await removeVoiceState(channel.id, oldState.member.id);
                                logger.info('Ограничения сняты при выходе (пользователь всё ещё подключён)', { userId: oldState.member.id, channelId: channel.id });
                            } catch (error) {
                                logger.error('Ошибка снятия ограничений при выходе (пользователь подключён):', error.message);
                            }
                        } else {
                            if (pendingRemovals.has(oldState.member.id)) {
                                clearTimeout(pendingRemovals.get(oldState.member.id).timeout);
                            }
                            const timeout = setTimeout(async () => {
                                try {
                                    await removeVoiceState(channel.id, oldState.member.id);
                                    pendingRemovals.delete(oldState.member.id);
                                    logger.info('Отложенная запись удалена из БД по таймауту', { userId: oldState.member.id, channelId: channel.id });
                                } catch (error) {
                                    logger.error('Ошибка при удалении отложенной записи:', error.message);
                                }
                            }, 1000 * 60 * 60); // 1 час

                            pendingRemovals.set(oldState.member.id, { channelId: channel.id, muted: voiceState.muted, deafened: voiceState.deafened, timeout });
                            logger.info('Пользователь отключился — снятие ограничений отложено до следующего подключения', { userId: oldState.member.id, channelId: channel.id });
                        }
                    }

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
                if (oldChannel.parent?.name === 'Приватные комнаты') {
                    const voiceState = await getVoiceState(oldChannel.id, oldState.member.id);
                    if (voiceState.muted || voiceState.deafened) {
                        try {
                            if (voiceState.muted) await newState.member.voice.setMute(false);
                            if (voiceState.deafened) await newState.member.voice.setDeaf(false);
                            await removeVoiceState(oldChannel.id, oldState.member.id);
                            logger.info('Ограничения сняты при переходе в другую комнату', { userId: oldState.member.id, oldChannelId: oldChannel.id, newChannelId: newState.channel.id });
                        } catch (error) {
                            logger.error('Ошибка снятия ограничений при переходе в другую комнату:', error.message);
                            if (pendingRemovals.has(oldState.member.id)) {
                                clearTimeout(pendingRemovals.get(oldState.member.id).timeout);
                            }
                            const timeout = setTimeout(async () => {
                                try {
                                    await removeVoiceState(oldChannel.id, oldState.member.id);
                                    pendingRemovals.delete(oldState.member.id);
                                    logger.info('Отложенная запись удалена из БД по таймауту (после неудачной попытки снять ограничения при переходе)', { userId: oldState.member.id, channelId: oldChannel.id });
                                } catch (err) {
                                    logger.error('Ошибка при удалении отложенной записи (переход):', err.message);
                                }
                            }, 1000 * 60 * 60);

                            pendingRemovals.set(oldState.member.id, { channelId: oldChannel.id, muted: voiceState.muted, deafened: voiceState.deafened, timeout });
                        }
                    }

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
