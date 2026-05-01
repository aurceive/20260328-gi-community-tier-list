import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTierListState } from '@/hooks/useTierListState';
import type { Character } from '@/types';

const createMockCharacters = (): Character[] => [
  { id: 'nahida', name: 'Nahida', element: 'dendro', rarity: 5, imageUrl: 'assets/nahida.webp', group: 'legendary' },
  { id: 'fischl', name: 'Fischl', element: 'electro', rarity: 4, imageUrl: 'assets/fischl.webp', group: 'epic' },
  { id: 'bennett', name: 'Bennett', element: 'pyro', rarity: 4, imageUrl: 'assets/bennett.webp', group: 'epic' },
  { id: 'hu-tao', name: 'Hu Tao', element: 'pyro', rarity: 5, imageUrl: 'assets/hu-tao.webp', group: 'legendary' },
];

describe('useTierListState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with all characters unassigned', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    expect(result.current.unassignedCharacters).toHaveLength(4);
    expect(result.current.tierList.S).toHaveLength(0);
    expect(result.current.tierList.A).toHaveLength(0);
    expect(result.current.isComplete()).toBe(false);
  });

  it('should move character to tier', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    act(() => {
      result.current.moveCharacterToTier(mockCharacters[0], 'S');
    });

    expect(result.current.tierList.S).toHaveLength(1);
    expect(result.current.tierList.S[0].id).toBe('nahida');
    expect(result.current.unassignedCharacters).toHaveLength(3);
  });

  it('should move character from tier to another tier', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    act(() => {
      result.current.moveCharacterToTier(mockCharacters[0], 'S');
    });

    act(() => {
      result.current.moveCharacterToTier(mockCharacters[0], 'A');
    });

    expect(result.current.tierList.S).toHaveLength(0);
    expect(result.current.tierList.A).toHaveLength(1);
    expect(result.current.unassignedCharacters).toHaveLength(3);
  });

  it('should move character back to unassigned', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    act(() => {
      result.current.moveCharacterToTier(mockCharacters[0], 'S');
    });

    act(() => {
      result.current.moveCharacterToTier(mockCharacters[0], 'unassigned');
    });

    expect(result.current.tierList.S).toHaveLength(0);
    expect(result.current.unassignedCharacters).toHaveLength(4);
  });

  it('should swap items in tier', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    act(() => {
      result.current.moveCharacterToTier(mockCharacters[0], 'S');
      result.current.moveCharacterToTier(mockCharacters[1], 'S');
    });

    act(() => {
      result.current.swapInTier('S', 0, 1);
    });

    expect(result.current.tierList.S[0].id).toBe('fischl');
    expect(result.current.tierList.S[1].id).toBe('nahida');
  });

  it('should reorder unassigned characters', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    act(() => {
      result.current.reorderUnassigned(0, 3);
    });

    expect(result.current.unassignedCharacters[0].id).toBe('hu-tao');
    expect(result.current.unassignedCharacters[3].id).toBe('nahida');
  });

  it('should detect when tier list is complete', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    expect(result.current.isComplete()).toBe(false);

    act(() => {
      mockCharacters.forEach((char) => {
        result.current.moveCharacterToTier(char, 'S');
      });
    });

    expect(result.current.isComplete()).toBe(true);
  });

  it('should return correct tier count', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    act(() => {
      result.current.moveCharacterToTier(mockCharacters[0], 'S');
      result.current.moveCharacterToTier(mockCharacters[1], 'S');
      result.current.moveCharacterToTier(mockCharacters[2], 'A');
    });

    expect(result.current.getTierCount('S')).toBe(2);
    expect(result.current.getTierCount('A')).toBe(1);
    expect(result.current.getTierCount('B')).toBe(0);
  });

  it('should reset to initial state', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    act(() => {
      mockCharacters.forEach((char) => {
        result.current.moveCharacterToTier(char, 'S');
      });
    });

    expect(result.current.unassignedCharacters).toHaveLength(0);

    act(() => {
      result.current.reset();
    });

    expect(result.current.unassignedCharacters).toHaveLength(4);
    expect(result.current.tierList.S).toHaveLength(0);
  });

  it('should persist state to localStorage', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    act(() => {
      result.current.moveCharacterToTier(mockCharacters[0], 'S');
    });

    const stored = localStorage.getItem('gi_tier_list_v2');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.version).toBe(2);
    expect(parsed.tiers.S).toHaveLength(1);
    expect(parsed.tiers.S[0]).toBe('nahida');

    // Rerender with new hook instance should load from localStorage
    const { result: result2 } = renderHook(() => useTierListState(mockCharacters));
    expect(result2.current.tierList.S).toHaveLength(1);
    expect(result2.current.tierList.S[0].id).toBe('nahida');
  });

  it('should handle invalid stored state gracefully', () => {
    const mockCharacters = createMockCharacters();
    localStorage.setItem('gi_tier_list_draft', 'invalid json');

    const { result } = renderHook(() => useTierListState(mockCharacters));

    expect(result.current.unassignedCharacters).toHaveLength(4);
    expect(result.current.tierList.S).toHaveLength(0);
  });

  it('should not allow invalid swap indices', () => {
    const mockCharacters = createMockCharacters();
    const { result } = renderHook(() => useTierListState(mockCharacters));

    act(() => {
      result.current.moveCharacterToTier(mockCharacters[0], 'S');
    });

    act(() => {
      result.current.swapInTier('S', 0, 5);
    });

    expect(result.current.tierList.S).toHaveLength(1);
    expect(result.current.tierList.S[0].id).toBe('nahida');
  });
});
