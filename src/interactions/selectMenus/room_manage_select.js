const { ChannelType } = require('discord.js');
const { getRoomByChannelId, getMutedUsers, getDeafenedUsers } = require('../../database/db');
const { errorEmbed, canManageRoom } = require('../../utils/helpers');
const logger = require('../../utils/logger');

module.exports = {
    customId: 'room_manage_select',
    async execute(interaction) {
        try {
            const member = interaction.member;
            const voiceChannel = member.voice.channel;
            const selectedValue = interaction.values[0];

            if (!voiceChannel) {
                await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Вы должны находиться в голосовом канале.', interaction.guild)],
                    ephemeral: true
                });
                return;
            }

            const room = await getRoomByChannelId(voiceChannel.id);
            if (!room) {
                await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Это не приватная комната.', interaction.guild)],
                    ephemeral: true
                });
                return;
            }

            if (!canManageRoom(member, room.owner_id, voiceChannel)) {
                await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Вы не владелец этой комнаты.', interaction.guild)],
                    ephemeral: true
                });
                return;
            }

            switch (selectedValue) {
                case 'rename_room':
                    return await showRenameModal(interaction);
                case 'set_limit':
                    return await showLimitModal(interaction);
                case 'grant_access':
                    return await showGrantAccessModal(interaction);
                case 'revoke_access':
                    return await showRevokeAccessModal(interaction);
                case 'lock_room':
                    return await lockRoom(interaction, voiceChannel);
                case 'unlock_room':
                    return await unlockRoom(interaction, voiceChannel);
                case 'mute_member':
                    return await showMuteSelect(interaction, voiceChannel);
                case 'unmute_member':
                    return await showUnmuteSelect(interaction, voiceChannel);
                case 'deafen_member':
                    return await showDeafenSelect(interaction, voiceChannel);
                case 'undeafen_member':
                    return await showUndeafenSelect(interaction, voiceChannel);
                case 'transfer_owner':
                    return await showTransferSelect(interaction, voiceChannel);
                case 'delete_room':
                    return await deleteRoom(interaction, voiceChannel);
            }
        } catch (error) {
            logger.error('Ошибка select menu:', error.message);
            try {
                await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Произошла ошибка.', interaction.guild)],
                    ephemeral: true
                });
            } catch (e) {}
        }
    }
};

async function showRenameModal(interaction) {
    const modal = {
        custom_id: 'rename_room_modal',
        title: 'Переименовать комнату',
        components: [{
            type: 1,
            components: [{
                type: 4,
                custom_id: 'new_name_field',
                label: 'Новое название',
                style: 1,
                required: true,
                max_length: 100
            }]
        }]
    };
    await interaction.showModal(modal);
}

async function showLimitModal(interaction) {
    const modal = {
        custom_id: 'set_limit_modal',
        title: 'Установить лимит',
        components: [{
            type: 1,
            components: [{
                type: 4,
                custom_id: 'limit_field',
                label: 'Лимит (0 = Не ограничено)',
                style: 1,
                placeholder: '0-99',
                required: true
            }]
        }]
    };
    await interaction.showModal(modal);
}

async function showGrantAccessModal(interaction) {
    const modal = {
        custom_id: 'grant_access_modal',
        title: 'Выдать доступ',
        components: [{
            type: 1,
            components: [{
                type: 4,
                custom_id: 'user_mention_field',
                label: 'Упомяните пользователя (в формате username)',
                style: 1,
                required: true
            }]
        }]
    };
    await interaction.showModal(modal);
}

async function showRevokeAccessModal(interaction) {
    const modal = {
        custom_id: 'revoke_access_modal',
        title: 'Отозвать доступ',
        components: [{
            type: 1,
            components: [{
                type: 4,
                custom_id: 'user_mention_field',
                label: 'Упомяните пользователя (в формате username)',
                style: 1,
                required: true
            }]
        }]
    };
    await interaction.showModal(modal);
}

async function lockRoom(interaction, voiceChannel) {
    const everyoneRole = interaction.guild.roles.cache.find(r => r.name === '@everyone');
    if (everyoneRole) {
        await voiceChannel.permissionOverwrites.create(everyoneRole, { Connect: false });
    }
    await interaction.reply({
        content: 'Комната закрыта.',
        embeds: [],
        components: [],
        ephemeral: true
    });
}

async function unlockRoom(interaction, voiceChannel) {
    const everyoneRole = interaction.guild.roles.cache.find(r => r.name === '@everyone');
    if (everyoneRole) {
        await voiceChannel.permissionOverwrites.delete(everyoneRole).catch(() => {});
    }
    await interaction.reply({
        content: 'Комната открыта.',
        embeds: [],
        components: [],
        ephemeral: true
    });
}

async function showMuteSelect(interaction, voiceChannel) {
    const members = voiceChannel.members.filter(m => m.id !== interaction.user.id);
    if (members.size === 0) {
        return await interaction.reply({
            embeds: [errorEmbed('Ошибка', 'Нет других участников в комнате.', interaction.guild)],
            ephemeral: true
        });
    }

    const options = members.map(m => ({
        label: m.user.username,
        value: m.id
    })).slice(0, 25);

    await interaction.reply({
        content: 'Выберите участника для замьючивания:',
        embeds: [],
        components: [{
            type: 1,
            components: [{
                type: 3,
                custom_id: 'mute_select',
                options: options
            }]
        }],
        ephemeral: true
    });
}

async function showUnmuteSelect(interaction, voiceChannel) {
    const mutedUsers = await getMutedUsers(voiceChannel.id);
    const members = voiceChannel.members.filter(m => mutedUsers.includes(m.id));
    
    if (members.size === 0) {
        return await interaction.reply({
            embeds: [errorEmbed('Ошибка', 'Нет замьюченных участников в комнате.', interaction.guild)],
            ephemeral: true
        });
    }

    const options = members.map(m => ({
        label: m.user.username,
        value: m.id
    })).slice(0, 25);

    await interaction.reply({
        content: 'Выберите участника для размьючивания:',
        embeds: [],
        components: [{
            type: 1,
            components: [{
                type: 3,
                custom_id: 'unmute_select',
                options: options
            }]
        }],
        ephemeral: true
    });
}

async function showDeafenSelect(interaction, voiceChannel) {
    const members = voiceChannel.members.filter(m => m.id !== interaction.user.id);
    if (members.size === 0) {
        return await interaction.reply({
            embeds: [errorEmbed('Ошибка', 'Нет других участников в комнате.', interaction.guild)],
            ephemeral: true
        });
    }

    const options = members.map(m => ({
        label: m.user.username,
        value: m.id
    })).slice(0, 25);

    await interaction.reply({
        content: 'Выберите участника для задисабливания:',
        embeds: [],
        components: [{
            type: 1,
            components: [{
                type: 3,
                custom_id: 'deafen_select',
                options: options
            }]
        }],
        ephemeral: true
    });
}

async function showUndeafenSelect(interaction, voiceChannel) {
    const deafenedUsers = await getDeafenedUsers(voiceChannel.id);
    const members = voiceChannel.members.filter(m => deafenedUsers.includes(m.id));
    
    if (members.size === 0) {
        return await interaction.reply({
            embeds: [errorEmbed('Ошибка', 'Нет задисабленных участников в комнате.', interaction.guild)],
            ephemeral: true
        });
    }

    const options = members.map(m => ({
        label: m.user.username,
        value: m.id
    })).slice(0, 25);

    await interaction.reply({
        content: 'Выберите участника для включения наушников:',
        embeds: [],
        components: [{
            type: 1,
            components: [{
                type: 3,
                custom_id: 'undeafen_select',
                options: options
            }]
        }],
        ephemeral: true
    });
}

async function showTransferSelect(interaction, voiceChannel) {
    const members = voiceChannel.members.filter(m => m.id !== interaction.user.id);
    if (members.size === 0) {
        return await interaction.reply({
            embeds: [errorEmbed('Ошибка', 'Нет других участников в комнате.', interaction.guild)],
            ephemeral: true
        });
    }

    const options = members.map(m => ({
        label: m.user.username,
        value: m.id
    })).slice(0, 25);

    await interaction.reply({
        content: 'Выберите участника для передачи владения:',
        embeds: [],
        components: [{
            type: 1,
            components: [{
                type: 3,
                custom_id: 'transfer_select',
                options: options
            }]
        }],
        ephemeral: true
    });
}

async function deleteRoom(interaction, voiceChannel) {
    const { deleteRoom: deleteRoomFromDb } = require('../../database/db');
    
    const roomName = voiceChannel.name;
    await deleteRoomFromDb(voiceChannel.id);
    await voiceChannel.delete().catch(() => {});

    await interaction.reply({
        content: `Комната "${roomName}" удалена.`,
        embeds: [],
        components: [],
        ephemeral: true
    });

    logger.info('Комната удалена', { channelId: voiceChannel.id });
}
