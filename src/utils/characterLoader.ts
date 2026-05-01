import type { Character, CharacterGroup } from '@/types';
import { CHARACTER_DATA_URL, DEBUG } from '@/config';

/**
 * Load character data from static JSON file
 * @returns Promise resolving to array of characters
 * @throws Error if loading fails
 */
export async function loadCharacters(): Promise<Character[]> {
  try {
    if (DEBUG) {
      console.log('[CharacterLoader] Loading characters from', CHARACTER_DATA_URL);
    }

    const response = await fetch(CHARACTER_DATA_URL);

    if (!response.ok) {
      throw new Error(
        `Failed to load characters: ${response.status} ${response.statusText}`
      );
    }

    const raw: unknown = await response.json();

    if (!Array.isArray(raw)) {
      throw new Error('Invalid character data format: expected array');
    }

    // Assign group first (so validateCharacter can check it), then validate
    const validCharacters = raw
      .map(assignGroup)
      .filter(validateCharacter);

    if (DEBUG) {
      console.log(`[CharacterLoader] Loaded ${validCharacters.length} valid characters`);
    }

    return validCharacters;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error loading characters';
    console.error('[CharacterLoader] Error:', message);
    throw new Error(`Failed to load characters: ${message}`);
  }
}

/**
 * Assign the character group based on rarity, with explicit JSON override for
 * special cases (Travelers are rarity 5 but belong to the 'epic' group).
 * Operates on raw unknown JSON data — must be called before validateCharacter.
 */
function assignGroup(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  if (obj.group === 'epic' || obj.group === 'legendary') {
    return obj;
  }
  return { ...obj, group: obj.rarity === 5 ? 'legendary' : 'epic' };
}

/**
 * Filter characters by one or more active groups.
 * Pass the full character list and the groups to include.
 */
export function filterByGroups(
  characters: Character[],
  groups: CharacterGroup[]
): Character[] {
  if (groups.length === 0) return [];
  const groupSet = new Set<CharacterGroup>(groups);
  return characters.filter((c) => groupSet.has(c.group));
}

/**
 * Validate if a character has required fields
 */
function validateCharacter(character: unknown): character is Character {
  if (typeof character !== 'object' || character === null) {
    return false;
  }

  const obj = character as Record<string, unknown>;

  const hasRequiredFields =
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.element === 'string' &&
    typeof obj.rarity === 'number' &&
    (obj.rarity === 4 || obj.rarity === 5) &&
    typeof obj.imageUrl === 'string' &&
    (obj.group === 'legendary' || obj.group === 'epic');

  const validElements = [
    'pyro',
    'hydro',
    'electro',
    'cryo',
    'anemo',
    'geo',
    'dendro',
  ];
  const hasValidElement = validElements.includes(obj.element as string);

  return hasRequiredFields && hasValidElement;
}

/**
 * Sort characters by rarity (descending) then by name
 */
export function sortCharactersByRarity(characters: Character[]): Character[] {
  return [...characters].sort((a, b) => {
    if (b.rarity !== a.rarity) {
      return b.rarity - a.rarity;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Group characters by rarity
 */
export function groupCharactersByRarity(
  characters: Character[]
): Record<string, Character[]> {
  return characters.reduce(
    (groups, character) => {
      const rarity = String(character.rarity);
      if (!groups[rarity]) {
        groups[rarity] = [];
      }
      groups[rarity].push(character);
      return groups;
    },
    {} as Record<string, Character[]>
  );
}

/**
 * Search characters by name or id
 */
export function searchCharacters(
  characters: Character[],
  query: string
): Character[] {
  const lowerQuery = query.toLowerCase();
  return characters.filter(
    (char) =>
      char.name.toLowerCase().includes(lowerQuery) ||
      char.id.toLowerCase().includes(lowerQuery)
  );
}
