import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadCharacters,
  sortCharactersByRarity,
  groupCharactersByRarity,
  searchCharacters,
} from '@/utils/characterLoader';
import { Character } from '@/types';

interface MockFetchResponse {
  ok: boolean;
  status?: number;
  statusText?: string;
  json: () => Promise<unknown>;
}

// Mock data
const mockCharacters: Character[] = [
  {
    id: 'nahida',
    name: 'Nahida',
    element: 'dendro',
    rarity: 5,
    imageUrl: 'assets/avatars/nahida.webp',
    group: 'legendary',
  },
  {
    id: 'fischl',
    name: 'Fischl',
    element: 'electro',
    rarity: 4,
    imageUrl: 'assets/avatars/fischl.webp',
    group: 'epic',
  },
  {
    id: 'kazuha',
    name: 'Kazuha',
    element: 'anemo',
    rarity: 5,
    imageUrl: 'assets/avatars/kazuha.webp',
    group: 'legendary',
  },
  {
    id: 'barbara',
    name: 'Barbara',
    element: 'hydro',
    rarity: 4,
    imageUrl: 'assets/avatars/barbara.webp',
    group: 'epic',
  },
];

describe('characterLoader', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    // Mock fetch
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
  });

  describe('loadCharacters', () => {
    it('should load and parse character data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCharacters),
      } as MockFetchResponse);

      const characters = await loadCharacters();

      expect(characters).toEqual(mockCharacters);
      expect(characters.length).toBe(4);
    });

    it('should throw error on network failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as MockFetchResponse);

      await expect(loadCharacters()).rejects.toThrow('Failed to load characters');
    });

    it('should throw error on invalid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as MockFetchResponse);

      await expect(loadCharacters()).rejects.toThrow('Failed to load characters');
    });

    it('should filter out invalid characters', async () => {
      const invalidData = [
        ...mockCharacters,
        { id: 'invalid', name: 'Invalid' }, // Missing element and rarity
        { id: 'invalid2', name: 'Invalid2', element: 'invalid_element', rarity: 5 }, // Invalid element
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(invalidData),
      } as MockFetchResponse);

      const characters = await loadCharacters();

      expect(characters).toEqual(mockCharacters);
      expect(characters.length).toBe(4);
    });
  });

  describe('sortCharactersByRarity', () => {
    it('should sort characters by rarity descending then by name', () => {
      const sorted = sortCharactersByRarity(mockCharacters);

      expect(sorted[0].rarity).toBe(5);
      expect(sorted[1].rarity).toBe(5);
      expect(sorted[0].name).toBe('Kazuha'); // Alphabetically before Nahida
      expect(sorted[1].name).toBe('Nahida');
      expect(sorted[2].rarity).toBe(4);
      expect(sorted[3].rarity).toBe(4);
    });

    it('should not mutate original array', () => {
      const original = [...mockCharacters];
      sortCharactersByRarity(mockCharacters);

      expect(mockCharacters).toEqual(original);
    });
  });

  describe('groupCharactersByRarity', () => {
    it('should group characters by rarity', () => {
      const grouped = groupCharactersByRarity(mockCharacters);

      expect(grouped['5']).toHaveLength(2);
      expect(grouped['4']).toHaveLength(2);
      expect(grouped['5']).toContainEqual(mockCharacters[0]);
      expect(grouped['5']).toContainEqual(mockCharacters[2]);
    });

    it('should handle empty array', () => {
      const grouped = groupCharactersByRarity([]);

      expect(grouped).toEqual({});
    });
  });

  describe('searchCharacters', () => {
    it('should search by character name', () => {
      const results = searchCharacters(mockCharacters, 'nahida');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Nahida');
    });

    it('should search by character id', () => {
      const results = searchCharacters(mockCharacters, 'fischl');

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('fischl');
    });

    it('should be case-insensitive', () => {
      const results = searchCharacters(mockCharacters, 'KAZUHA');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Kazuha');
    });

    it('should return all matches', () => {
      const results = searchCharacters(mockCharacters, 'a');

      expect(results.length).toBeGreaterThan(1);
      expect(results).toContainEqual(mockCharacters[0]); // Nahida
      expect(results).toContainEqual(mockCharacters[2]); // Kazuha
      expect(results).toContainEqual(mockCharacters[3]); // Barbara
    });

    it('should return empty array for no matches', () => {
      const results = searchCharacters(mockCharacters, 'zzzzz');

      expect(results).toEqual([]);
    });
  });
});
