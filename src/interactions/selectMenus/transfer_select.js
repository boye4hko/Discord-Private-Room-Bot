const { updateRoomOwner } = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
    customId: 'transfer_select',
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const userId = interaction.values[0];
            const voiceChannel = interaction.member.voice.channel;
            
            if (!voiceChannel) {
                return await interaction.editReply('Вы должны находиться в голосовом канале.');
            }

            const member = voiceChannel.guild.members.cache.get(userId);
            if (!member) {
                return await interaction.editReply('Пользователь не найден.');
            }

            await updateRoomOwner(voiceChannel.id, userId);

            await voiceChannel.permissionOverwrites.delete(interaction.user.id).catch(() => {});
            await voiceChannel.permissionOverwrites.create(userId, {
                ViewChannel: true,
                Connect: true,
                Speak: true,
                MuteMembers: true,
                DeafenMembers: true,
                MoveMembers: true
            });

            await interaction.editReply({
                content: `Владение передано ${member.user.username}.`
            });

            logger.info('Владение передано', { newOwnerId: userId, channelId: voiceChannel.id });
        } catch (error) {
            logger.error('Ошибка transfer select:', error.message);
            await interaction.editReply('Произошла ошибка.');
        }
    }
};
