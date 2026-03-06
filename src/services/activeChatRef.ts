/** Tracks which friendship chat the user currently has open, to suppress in-app banners. */
export let activeChatFriendshipId: string | null = null;

export function setActiveChatFriendshipId(id: string | null) {
  activeChatFriendshipId = id;
}
