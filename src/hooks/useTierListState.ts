import { useState, useCallback, useMemo } from 'react';
import type { Character, TierList, TierKey } from '@/types';
import { TIERS, DEBUG } from '@/config';

/**
 * Persisted format (v2): maps each tier key (including 'unassigned') to an
 * ordered list of character IDs.  Using IDs (not full objects) means the
 * stored data survives character data changes, and group-switching works
 * correctly — IDs for inactive groups are silently skipped during derivation
 * but kept in storage so positions are restored when those groups become active.
 */
interface StoredAssignments {
  version: 2;
  tiers: Partial<Record<TierKey, string[]>>;
}

const V2_KEY = 'gi_tier_list_v2';
/** Legacy key used before v2 */
const V1_KEY = 'gi_tier_list_draft';

function loadStored(): StoredAssignments {
  // Prefer v2 storage
  const raw2 = localStorage.getItem(V2_KEY);
  if (raw2) {
    try {
      const parsed = JSON.parse(raw2) as StoredAssignments;
      if (parsed.version === 2 && parsed.tiers) return parsed;
    } catch {
      // fall through to migration
    }
  }

  // Migrate from v1 (stored full Character objects)
  const raw1 = localStorage.getItem(V1_KEY);
  if (raw1) {
    try {
      const old = JSON.parse(raw1) as {
        tierList?: Record<string, Array<{ id: string }>>;
        unassignedCharacters?: Array<{ id: string }>;
      };
      if (old.tierList && old.unassignedCharacters) {
        const tiers: Partial<Record<TierKey, string[]>> = {};
        for (const tier of TIERS) {
          const chars = old.tierList[tier];
          if (Array.isArray(chars) && chars.length > 0) {
            tiers[tier] = chars.map((c) => String(c.id));
          }
        }
        const unassigned = old.unassignedCharacters;
        if (unassigned.length > 0) {
          tiers['unassigned'] = unassigned.map((c) => String(c.id));
        }
        if (DEBUG) console.log('[useTierListState] Migrated v1 → v2 localStorage format');
        return { version: 2, tiers };
      }
    } catch {
      // corrupted, start fresh
    }
  }

  return { version: 2, tiers: {} };
}

function saveStored(assignments: StoredAssignments): void {
  try {
    localStorage.setItem(V2_KEY, JSON.stringify(assignments));
    if (DEBUG) console.log('[useTierListState] Saved v2 to localStorage');
  } catch (err) {
    console.error('[useTierListState] Failed to save state:', err);
  }
}

/**
 * Derive the display-ready tier list and unassigned pool from stored ID
 * assignments and the currently active character set.
 *
 * Characters whose IDs exist in storage but are not in `allCharacters`
 * (different group, removed character) are silently skipped — their stored
 * positions are preserved for when they become active again.
 *
 * Characters in `allCharacters` that have no stored assignment are appended
 * to the unassigned pool (new characters always start unassigned).
 */
function deriveState(
  stored: StoredAssignments,
  allCharacters: Character[]
): { tierList: TierList; unassignedCharacters: Character[] } {
  const charMap = new Map(allCharacters.map((c) => [c.id, c]));
  const placed = new Set<string>();

  const tierList: TierList = { S: [], A: [], B: [], C: [], D: [] };

  for (const tier of TIERS) {
    for (const id of stored.tiers[tier] ?? []) {
      const char = charMap.get(id);
      if (char) {
        tierList[tier].push(char);
        placed.add(id);
      }
    }
  }

  const unassignedCharacters: Character[] = [];

  // Characters explicitly stored as unassigned (respects saved order)
  for (const id of stored.tiers['unassigned'] ?? []) {
    const char = charMap.get(id);
    if (char && !placed.has(id)) {
      unassignedCharacters.push(char);
      placed.add(id);
    }
  }

  // Characters with no stored assignment at all (new / first load)
  for (const char of allCharacters) {
    if (!placed.has(char.id)) {
      unassignedCharacters.push(char);
    }
  }

  return { tierList, unassignedCharacters };
}

/**
 * Custom hook for managing tier list state.
 * Handles character assignments, reordering, and localStorage persistence.
 *
 * Storage format v2: persists only character IDs per tier, which means:
 * - Group switches preserve all previously made assignments
 * - Old format (v1) is automatically migrated on first load
 */
export function useTierListState(allCharacters: Character[]) {
  const [assignments, setAssignments] = useState<StoredAssignments>(loadStored);

  const { tierList, unassignedCharacters } = useMemo(
    () => deriveState(assignments, allCharacters),
    [assignments, allCharacters]
  );

  const mutate = useCallback(
    (updater: (prev: StoredAssignments) => StoredAssignments) => {
      setAssignments((prev) => {
        const next = updater(prev);
        saveStored(next);
        return next;
      });
    },
    []
  );

  /** Remove `id` from every tier array in the stored assignments */
  function removeId(tiers: Partial<Record<TierKey, string[]>>, id: string): void {
    for (const k of Object.keys(tiers) as TierKey[]) {
      const arr = tiers[k];
      if (arr) {
        const idx = arr.indexOf(id);
        if (idx !== -1) {
          arr.splice(idx, 1);
          return;
        }
      }
    }
  }

  const moveCharacterToTier = useCallback(
    (character: Character, targetTier: TierKey, insertBeforeId?: string | null) => {
      mutate((prev) => {
        const tiers: Partial<Record<TierKey, string[]>> = {};
        for (const k of Object.keys(prev.tiers) as TierKey[]) {
          tiers[k] = [...(prev.tiers[k] ?? [])];
        }

        removeId(tiers, character.id);

        const target = [...(tiers[targetTier] ?? [])];
        if (!target.includes(character.id)) {
          if (insertBeforeId) {
            const idx = target.indexOf(insertBeforeId);
            if (idx !== -1) {
              target.splice(idx, 0, character.id);
            } else {
              target.push(character.id);
            }
          } else {
            target.push(character.id);
          }
        }
        tiers[targetTier] = target;

        if (DEBUG) console.log(`[useTierListState] Moved ${character.name} → ${targetTier}`);
        return { version: 2, tiers };
      });
    },
    [mutate]
  );

  /** Swap two characters within the same tier (by their display indices) */
  const swapInTier = useCallback(
    (tierKey: keyof TierList, fromIndex: number, toIndex: number) => {
      mutate((prev) => {
        const { tierList: derived } = deriveState(prev, allCharacters);
        const tier = derived[tierKey];
        if (
          fromIndex < 0 ||
          fromIndex >= tier.length ||
          toIndex < 0 ||
          toIndex >= tier.length
        ) {
          return prev;
        }

        const fromId = tier[fromIndex].id;
        const toId = tier[toIndex].id;
        const arr = [...(prev.tiers[tierKey] ?? [])];
        const fi = arr.indexOf(fromId);
        const ti = arr.indexOf(toId);
        if (fi !== -1 && ti !== -1) [arr[fi], arr[ti]] = [arr[ti], arr[fi]];

        return { version: 2, tiers: { ...prev.tiers, [tierKey]: arr } };
      });
    },
    [mutate, allCharacters]
  );

  /** Reorder unassigned characters (by their display indices) */
  const reorderUnassigned = useCallback(
    (fromIndex: number, toIndex: number) => {
      mutate((prev) => {
        const { unassignedCharacters: derived } = deriveState(prev, allCharacters);
        if (
          fromIndex < 0 ||
          fromIndex >= derived.length ||
          toIndex < 0 ||
          toIndex >= derived.length
        ) {
          return prev;
        }

        const reordered = [...derived];
        [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex], reordered[fromIndex]];

        const activeIds = new Set(allCharacters.map((c) => c.id));
        // Preserve inactive IDs at the front, then the reordered active IDs
        const inactive = (prev.tiers['unassigned'] ?? []).filter((id) => !activeIds.has(id));
        const newUnassigned = [...inactive, ...reordered.map((c) => c.id)];

        return { version: 2, tiers: { ...prev.tiers, unassigned: newUnassigned } };
      });
    },
    [mutate, allCharacters]
  );

  /** Reset all active character assignments back to unassigned */
  const reset = useCallback(() => {
    mutate((prev) => {
      const activeIds = new Set(allCharacters.map((c) => c.id));
      const tiers: Partial<Record<TierKey, string[]>> = {};
      for (const k of Object.keys(prev.tiers) as TierKey[]) {
        const filtered = (prev.tiers[k] ?? []).filter((id) => !activeIds.has(id));
        if (filtered.length > 0) tiers[k] = filtered;
      }
      if (DEBUG) console.log('[useTierListState] Reset tier list');
      return { version: 2, tiers };
    });
  }, [mutate, allCharacters]);

  const isComplete = useCallback(
    (): boolean => unassignedCharacters.length === 0,
    [unassignedCharacters]
  );

  const getTierCount = useCallback(
    (tierKey: keyof TierList): number => tierList[tierKey].length,
    [tierList]
  );

  return {
    tierList,
    unassignedCharacters,
    moveCharacterToTier,
    swapInTier,
    reorderUnassigned,
    isComplete,
    getTierCount,
    reset,
  };
}

