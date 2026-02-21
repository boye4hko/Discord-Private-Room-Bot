const EMBED_COLOR = 0x2B2D31;
const SUCCESS_COLOR = 0x57F287;
const ERROR_COLOR = 0xED4245;

function createEmbed(title, description, guild, color = EMBED_COLOR) {
    return {
        color: color,
        title: title,
        description: description || ''
    };
}

function successEmbed(title, description, guild) {
    return createEmbed(title, description, guild, SUCCESS_COLOR);
}

function errorEmbed(title, description, guild) {
    return createEmbed(title, description, guild, ERROR_COLOR);
}

function infoEmbed(title, description, guild) {
    return createEmbed(title, description, guild, EMBED_COLOR);
}

function canManageRoom(member, roomOwnerId, voiceChannel) {
    if (member.id !== roomOwnerId) return false;
    if (!member.voice.channel || member.voice.channelId !== voiceChannel.id) return false;
    return true;
}

module.exports = {
    EMBED_COLOR,
    SUCCESS_COLOR,
    ERROR_COLOR,
    createEmbed,
    successEmbed,
    errorEmbed,
    infoEmbed,
    canManageRoom
};
