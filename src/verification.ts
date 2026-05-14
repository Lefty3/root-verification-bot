import {
  rootServer,
  RootApiException,
  ErrorCodeType,
  RootGuidConverter,
  RootGuidType,
  RootBotStartState,
  Community,
  CommunityMember,
  CommunityRole,
  CommunityEvent,
  CommunityJoinedEvent,
  CommunityMemberGetRequest,
  CommunityMemberRoleAddRequest,
  CommunityRoleGuid,
  UserGuid,
  ChannelGuid,
  MessageType,
  ChannelMessageEvent,
  ChannelMessageCreatedEvent,
  ChannelMessageCreateRequest,
} from "@rootsdk/server-bot";

const VERIFY_COMMAND = "/verify";
const MEMBER_ROLE_NAME = "Member";

let memberRoleId: CommunityRoleGuid | undefined;

export function initializeVerification(_state: RootBotStartState): void {
  rootServer.community.communities.on(CommunityEvent.CommunityJoined, onMemberJoined);
  rootServer.community.channelMessages.on(ChannelMessageEvent.ChannelMessageCreated, onMessage);
}

async function getMemberRoleId(): Promise<CommunityRoleGuid | undefined> {
  if (memberRoleId) return memberRoleId;

  const roles: CommunityRole[] = await rootServer.community.communityRoles.list();
  const match = roles.find((r) => r.name === MEMBER_ROLE_NAME);

  if (match) {
    memberRoleId = match.id;
  } else {
    console.error(`Role "${MEMBER_ROLE_NAME}" not found — create it in your community settings first`);
  }

  return memberRoleId;
}

async function onMemberJoined(evt: CommunityJoinedEvent): Promise<void> {
  try {
    if (RootGuidConverter.toRootGuidType(evt.userId) !== RootGuidType.Person) return;

    const community: Community = await rootServer.community.communities.get();
    if (!community.defaultChannelId) return;

    const memberRequest: CommunityMemberGetRequest = { userId: evt.userId };
    const member: CommunityMember = await rootServer.community.communityMembers.get(memberRequest);

    const messageRequest: ChannelMessageCreateRequest = {
      channelId: community.defaultChannelId,
      content:
        `Welcome, [@${member.nickname}](root://user/${evt.userId})! ` +
        `This community requires verification before you can access all channels. ` +
        `Type \`${VERIFY_COMMAND}\` here to confirm you're a real person and receive your Member role.`,
    };

    await rootServer.community.channelMessages.create(messageRequest);
  } catch (xcpt: unknown) {
    handleError(xcpt, "onMemberJoined");
  }
}

async function onMessage(evt: ChannelMessageCreatedEvent): Promise<void> {
  try {
    if (evt.messageType === MessageType.System) return;
    if (evt.messageContent?.trim().toLowerCase() !== VERIFY_COMMAND) return;
    if (RootGuidConverter.toRootGuidType(evt.userId) !== RootGuidType.Person) return;

    const roleId = await getMemberRoleId();
    if (!roleId) return;

    await assignMemberRole(evt.userId, evt.channelId, roleId);
  } catch (xcpt: unknown) {
    handleError(xcpt, "onMessage");
  }
}

async function assignMemberRole(userId: UserGuid, channelId: ChannelGuid, roleId: CommunityRoleGuid): Promise<void> {
  const roleRequest: CommunityMemberRoleAddRequest = {
    communityRoleId: roleId,
    userIds: [userId],
  };

  await rootServer.community.communityMemberRoles.add(roleRequest);

  const memberRequest: CommunityMemberGetRequest = { userId };
  const member: CommunityMember = await rootServer.community.communityMembers.get(memberRequest);

  const messageRequest: ChannelMessageCreateRequest = {
    channelId,
    content:
      `[@${member.nickname}](root://user/${userId}) has been verified and the **${MEMBER_ROLE_NAME}** role has been applied. Welcome to the community!`,
  };

  await rootServer.community.channelMessages.create(messageRequest);
}

function handleError(xcpt: unknown, context: string): void {
  if (xcpt instanceof RootApiException) {
    switch (xcpt.errorCode) {
      case ErrorCodeType.NoPermissionToCreate:
        console.error(`[${context}] Missing createMessage permission in root-manifest.json`);
        break;
      case ErrorCodeType.TooManyRequests:
        console.error(`[${context}] Rate limited — commands max ~5 req/s`);
        break;
      default:
        console.error(`[${context}] RootApiException:`, xcpt.errorCode);
    }
  } else if (xcpt instanceof Error) {
    console.error(`[${context}] Unexpected error:`, xcpt.message);
  }
}
