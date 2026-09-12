import {
  DbClient,
  createCollection,
  localOnlyCollectionOptions,
} from "@tanstack/react-db";
import type {
  CollectionConfig,
  LocalOnlyCollectionUtils,
} from "@tanstack/react-db";

import type { CommunityMessage } from "./api";

export type CommunityMessageRow = CommunityMessage & {
  channelId: string;
} & Record<string, unknown>;

/**
 * TanStack DB is deliberately a client-side projection here. D1 remains the
 * source of truth; this collection gives the channel UI live queries and
 * optimistic message reconciliation while the Durable Object fans out events.
 */
export const communityMessageCollection = createCollection<
  CommunityMessageRow,
  string,
  LocalOnlyCollectionUtils
>(
  localOnlyCollectionOptions<CommunityMessageRow, string>({
    getKey: (message) => message.id,
    id: "community-message-feed",
  }) as unknown as CollectionConfig<
    CommunityMessageRow,
    string,
    never,
    LocalOnlyCollectionUtils
  >
);

export const communityDbClient = new DbClient();

export const upsertCommunityMessage = (message: CommunityMessageRow): void => {
  if (communityMessageCollection.get(message.id)) {
    communityMessageCollection.update(message.id, (draft) => {
      Object.assign(draft, message);
    });
    return;
  }
  communityMessageCollection.insert(message);
};

export const removeCommunityMessage = (id: string): void => {
  if (communityMessageCollection.get(id)) {
    communityMessageCollection.delete(id);
  }
};
