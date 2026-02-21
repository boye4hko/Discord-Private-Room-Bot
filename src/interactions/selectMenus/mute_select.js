const { addMutedUser } = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
    customId: 'mute_select',
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

            const voiceState = member.voice;
            if (!voiceState.channel) {
                return await interaction.editReply('Пользователь не в голосовом канале.');
            }

            await member.voice.setMute(true);
            await addMutedUser(voiceChannel.id, userId, true);

            await interaction.editReply({
                content: `${member.user.username} замьючен.`
            });

            logger.info('Участник замьючен', { userId, channelId: voiceChannel.id });
        } catch (error) {
            logger.error('Ошибка mute select:', error.message);
            await interaction.editReply('Произошла ошибка.');
        }
    }
};
