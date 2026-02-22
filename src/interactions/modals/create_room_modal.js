const { ChannelType } = require('discord.js');
const { createRoom } = require('../../database/db');
const { successEmbed, errorEmbed } = require('../../utils/helpers');
const logger = require('../../utils/logger');

module.exports = {
    customId: 'create_room_modal',
    async execute(interaction) {
        try {
            const roomName = interaction.fields.getTextInputValue('room_name_field').trim();
            const guild = interaction.guild;
            const owner = interaction.user;

            let category = guild.channels.cache.find(
                ch => ch.name === 'Приватные комнаты' && ch.type === ChannelType.GuildCategory
            );

            if (!category) {
                category = await guild.channels.create({
                    name: 'Приватные комнаты',
                    type: ChannelType.GuildCategory
                });
            }

            const voiceChannel = await guild.channels.create({
                name: roomName,
                type: ChannelType.GuildVoice,
                parent: category.id,
                userLimit: 0
            });

            const everyoneRole = guild.roles.cache.find(r => r.name === '@everyone');
            if (everyoneRole) {
                await voiceChannel.permissionOverwrites.create(everyoneRole, {
                    ViewChannel: true,
                    Connect: false
                });
            }

            await voiceChannel.permissionOverwrites.create(owner, {
                ViewChannel: true,
                Connect: true,
                Speak: true,
                MuteMembers: true,
                DeafenMembers: true,
                MoveMembers: true
            });

            await createRoom(guild.id, owner.id, voiceChannel.id, category.id);

            const member = interaction.member;
            if (member.voice.channel) {
                await member.voice.setChannel(voiceChannel).catch(() => {});
            }

            await interaction.reply({
                embeds: [successEmbed(
                    'Комната создана',
                    `Приватная комната **${roomName}** успешно создана.\n\nДля настроек комнаты перейдите в соответствующий канал.`,
                    guild
                )],
                ephemeral: true
            });

            logger.success('Комната создана', { 
                roomName, 
                channelId: voiceChannel.id, 
                ownerId: owner.id
            });
        } catch (error) {
            logger.error('Ошибка создания комнаты:', error.message);
            try {
                await interaction.reply({
                    embeds: [errorEmbed('Ошибка', 'Не удалось создать комнату.', interaction.guild)],
                    ephemeral: true
                });
            } catch (e) {}
        }
    }
};
