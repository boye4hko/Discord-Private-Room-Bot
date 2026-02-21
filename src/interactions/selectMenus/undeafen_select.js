const { removeDeafenedUser } = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
    customId: 'undeafen_select',
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

            await member.voice.setDeaf(false);
            await removeDeafenedUser(voiceChannel.id, userId);

            await interaction.editReply({
                content: `${member.user.username} больше не задисаблен.`
            });

            logger.info('Участник больше не задисаблен', { userId, channelId: voiceChannel.id });
        } catch (error) {
            logger.error('Ошибка undeafen select:', error.message);
            await interaction.editReply('Произошла ошибка.');
        }
    }
};
