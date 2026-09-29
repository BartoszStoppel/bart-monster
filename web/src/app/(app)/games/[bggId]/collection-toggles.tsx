"use client";

import { useState } from "react";
import { OwnershipToggle } from "./ownership-toggle";
import { WishlistToggle } from "./wishlist-toggle";

interface PersonInfo {
  displayName: string;
  userId: string;
}

interface CollectionTogglesProps {
  bggId: number;
  currentUserId: string;
  initialOwned: boolean;
  initialOwners: PersonInfo[];
  initialWishlisted: boolean;
  initialWishlisters: PersonInfo[];
}

export function CollectionToggles({
  bggId,
  currentUserId,
  initialOwned,
  initialOwners,
  initialWishlisted,
  initialWishlisters,
}: CollectionTogglesProps) {
  const [owned, setOwned] = useState(initialOwned);

  return (
    <>
      <OwnershipToggle
        bggId={bggId}
        initialOwners={initialOwners}
        initialOwned={initialOwned}
        currentUserId={currentUserId}
        onOwnedChange={setOwned}
      />
      <WishlistToggle
        bggId={bggId}
        initialWishlisters={initialWishlisters}
        initialWishlisted={initialWishlisted}
        currentUserId={currentUserId}
        owned={owned}
      />
    </>
  );
}
