"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeVerification = initializeVerification;
const server_bot_1 = require("@rootsdk/server-bot");
const VERIFY_COMMAND = "/verify";
const MEMBER_ROLE_NAME = "Member";
let memberRoleId;
function initializeVerification(_state) {
    server_bot_1.rootServer.community.communities.on(server_bot_1.CommunityEvent.CommunityJoined, onMemberJoined);
    server_bot_1.rootServer.community.channelMessages.on(server_bot_1.ChannelMessageEvent.ChannelMessageCreated, onMessage);
}
async function getMemberRoleId() {
    if (memberRoleId)
        return memberRoleId;
    const roles = await server_bot_1.rootServer.community.communityRoles.list();
    const match = roles.find((r) => r.name === MEMBER_ROLE_NAME);
    if (match) {
        memberRoleId = match.id;
    }
    else {
        console.error(`Role "${MEMBER_ROLE_NAME}" not found — create it in your community settings first`);
    }
    return memberRoleId;
}
async function onMemberJoined(evt) {
    try {
        if (server_bot_1.RootGuidConverter.toRootGuidType(evt.userId) !== server_bot_1.RootGuidType.Person)
            return;
        const community = await server_bot_1.rootServer.community.communities.get();
        if (!community.defaultChannelId)
            return;
        const memberRequest = { userId: evt.userId };
        const member = await server_bot_1.rootServer.community.communityMembers.get(memberRequest);
        const messageRequest = {
            channelId: community.defaultChannelId,
            content: `Welcome, [@${member.nickname}](root://user/${evt.userId})! ` +
                `This community requires verification before you can access all channels. ` +
                `Type \`${VERIFY_COMMAND}\` here to confirm you're a real person and receive your Member role.`,
        };
        await server_bot_1.rootServer.community.channelMessages.create(messageRequest);
    }
    catch (xcpt) {
        handleError(xcpt, "onMemberJoined");
    }
}
async function onMessage(evt) {
    try {
        if (evt.messageType === server_bot_1.MessageType.System)
            return;
        if (evt.messageContent?.trim().toLowerCase() !== VERIFY_COMMAND)
            return;
        if (server_bot_1.RootGuidConverter.toRootGuidType(evt.userId) !== server_bot_1.RootGuidType.Person)
            return;
        const roleId = await getMemberRoleId();
        if (!roleId)
            return;
        await assignMemberRole(evt.userId, evt.channelId, roleId);
    }
    catch (xcpt) {
        handleError(xcpt, "onMessage");
    }
}
async function assignMemberRole(userId, channelId, roleId) {
    const roleRequest = {
        communityRoleId: roleId,
        userIds: [userId],
    };
    await server_bot_1.rootServer.community.communityMemberRoles.add(roleRequest);
    const memberRequest = { userId };
    const member = await server_bot_1.rootServer.community.communityMembers.get(memberRequest);
    const messageRequest = {
        channelId,
        content: `[@${member.nickname}](root://user/${userId}) has been verified and the **${MEMBER_ROLE_NAME}** role has been applied. Welcome to the community!`,
    };
    await server_bot_1.rootServer.community.channelMessages.create(messageRequest);
}
function handleError(xcpt, context) {
    if (xcpt instanceof server_bot_1.RootApiException) {
        switch (xcpt.errorCode) {
            case server_bot_1.ErrorCodeType.NoPermissionToCreate:
                console.error(`[${context}] Missing createMessage permission in root-manifest.json`);
                break;
            case server_bot_1.ErrorCodeType.TooManyRequests:
                console.error(`[${context}] Rate limited — commands max ~5 req/s`);
                break;
            default:
                console.error(`[${context}] RootApiException:`, xcpt.errorCode);
        }
    }
    else if (xcpt instanceof Error) {
        console.error(`[${context}] Unexpected error:`, xcpt.message);
    }
}
