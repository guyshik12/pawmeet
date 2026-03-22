/** Tracks which friendship chat the user currently has open, to suppress in-app banners. */
export let activeChatFriendshipId: string | null = null;

export function setActiveChatFriendshipId(id: string | null) {
  activeChatFriendshipId = id;
}

type ChatParams = { friendshipId: string; friendName: string; friendDogName: string; isUserA: boolean };

/**
 * Registered by FriendsScreen so external callers (MatchModal, banners) can open
 * a chat cleanly — always resetting the FriendsStack to [Friends, Chat] first.
 */
export let openFriendsChat: ((params: ChatParams) => void) | null = null;

export function setOpenFriendsChat(fn: ((params: ChatParams) => void) | null) {
  openFriendsChat = fn;
}
