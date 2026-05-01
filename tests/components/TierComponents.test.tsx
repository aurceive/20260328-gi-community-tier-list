import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TierRow } from '@/components/TierRow';
import { CharacterItem } from '@/components/CharacterItem';
import { UnassignedPool } from '@/components/UnassignedPool';
import type { Character } from '@/types';

const createMockCharacters = (): Character[] => [
  { id: 'nahida', name: 'Nahida', element: 'dendro', rarity: 5, imageUrl: 'assets/nahida.webp', group: 'legendary' },
  { id: 'fischl', name: 'Fischl', element: 'electro', rarity: 4, imageUrl: 'assets/fischl.webp', group: 'epic' },
  { id: 'bennett', name: 'Bennett', element: 'pyro', rarity: 4, imageUrl: 'assets/bennett.webp', group: 'epic' },
];

/** Helper: render UnassignedPool with required props */
function renderPool(props: Partial<Parameters<typeof UnassignedPool>[0]> & { characters: Character[] }) {
  return render(
    <UnassignedPool
      defaultTier="S"
      onDefaultTierChange={vi.fn()}
      {...props}
    />
  );
}

describe('Tier List Components', () => {
  describe('TierRow', () => {
    it('should render tier label and title', () => {
      const mockCharacters = createMockCharacters();
      render(
        <TierRow
          tier="S"
          characters={[mockCharacters[0]]}
          count={1}
          onCharacterClick={vi.fn()}
        />
      );

      expect(screen.getByText('S')).toBeInTheDocument();
      expect(screen.getByText('Nahida')).toBeInTheDocument();
    });

    it('should display character count', () => {
      const mockCharacters = createMockCharacters();
      render(
        <TierRow
          tier="A"
          characters={mockCharacters.slice(0, 2)}
          count={2}
          onCharacterClick={vi.fn()}
        />
      );

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should render empty tier content when no characters', () => {
      const { container } = render(
        <TierRow
          tier="B"
          characters={[]}
          count={0}
          onCharacterClick={vi.fn()}
        />
      );

      const tierContent = container.querySelector('[data-tier="B"]');
      expect(tierContent).toBeInTheDocument();
      expect(tierContent?.children).toHaveLength(0);
    });

    it('should call onCharacterClick when character clicked', () => {
      const mockCharacters = createMockCharacters();
      const onClick = vi.fn();
      render(
        <TierRow
          tier="S"
          characters={[mockCharacters[0]]}
          count={1}
          onCharacterClick={onClick}
        />
      );

      const characterSlot = screen.getByLabelText(
        /Remove Nahida from tier S/
      );
      characterSlot.click();

      expect(onClick).toHaveBeenCalledWith(mockCharacters[0]);
    });

    it('should render all tier colors correctly', () => {
      const tiers = ['S', 'A', 'B', 'C', 'D'];
      const { rerender } = render(
        <TierRow
          tier="S"
          characters={[]}
          count={0}
          onCharacterClick={vi.fn()}
        />
      );

      for (const tier of tiers) {
        rerender(
          <TierRow
            tier={tier}
            characters={[]}
            count={0}
            onCharacterClick={vi.fn()}
          />
        );
        expect(screen.getByText(tier)).toBeInTheDocument();
      }
    });
  });

  describe('CharacterItem', () => {
    it('should render character name and element', () => {
      const mockCharacters = createMockCharacters();
      render(
        <CharacterItem
          character={mockCharacters[0]}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText('Nahida')).toBeInTheDocument();
      expect(screen.getByText('dendro')).toBeInTheDocument();
    });

    it('should display character rarity as stars', () => {
      const mockCharacters = createMockCharacters();
      render(
        <CharacterItem
          character={mockCharacters[0]}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText('★★★★★')).toBeInTheDocument();
    });

    it('should display correct rarity count', () => {
      const mockCharacters = createMockCharacters();
      render(
        <CharacterItem
          character={mockCharacters[1]}
          onClick={vi.fn()}
        />
      );

      expect(screen.getByText('★★★★')).toBeInTheDocument();
    });

    it('should call onClick when clicked', () => {
      const mockCharacters = createMockCharacters();
      const onClick = vi.fn();
      render(
        <CharacterItem
          character={mockCharacters[0]}
          onClick={onClick}
        />
      );

      screen.getByRole('button').click();

      expect(onClick).toHaveBeenCalledWith(mockCharacters[0]);
    });

    it('should be draggable by default', () => {
      const mockCharacters = createMockCharacters();
      const { container } = render(
        <CharacterItem
          character={mockCharacters[0]}
          onClick={vi.fn()}
        />
      );

      const element = container.querySelector('[draggable]');
      expect(element).toHaveAttribute('draggable', 'true');
    });

    it('should not be draggable when disabled', () => {
      const mockCharacters = createMockCharacters();
      const { container } = render(
        <CharacterItem
          character={mockCharacters[0]}
          onClick={vi.fn()}
          draggable={false}
        />
      );

      const element = container.querySelector('[draggable]');
      expect(element).toHaveAttribute('draggable', 'false');
    });
  });

  describe('UnassignedPool', () => {
    it('should render all characters', () => {
      const mockCharacters = createMockCharacters();
      renderPool({ characters: mockCharacters });

      expect(screen.getByText('Nahida')).toBeInTheDocument();
      expect(screen.getByText('Fischl')).toBeInTheDocument();
      expect(screen.getByText('Bennett')).toBeInTheDocument();
    });

    it('should display all characters in pool', () => {
      const mockCharacters = createMockCharacters();
      renderPool({ characters: mockCharacters });

      // All 3 characters should be visible
      expect(screen.getAllByText(/Nahida|Fischl|Bennett/)).toHaveLength(3);
    });

    it('should filter characters by search query', () => {
      const mockCharacters = createMockCharacters();
      renderPool({ characters: mockCharacters, searchQuery: 'fischl' });

      expect(screen.getByText('Fischl')).toBeInTheDocument();
      expect(screen.queryByText('Nahida')).not.toBeInTheDocument();
      expect(screen.queryByText('Bennett')).not.toBeInTheDocument();
    });

    it('should filter by element type', () => {
      const mockCharacters = createMockCharacters();
      renderPool({ characters: mockCharacters, searchQuery: 'pyro' });

      expect(screen.getByText('Bennett')).toBeInTheDocument();
      expect(screen.queryByText('Fischl')).not.toBeInTheDocument();
    });

    it('should show no results message when no matches', () => {
      const mockCharacters = createMockCharacters();
      renderPool({ characters: mockCharacters, searchQuery: 'nonexistent' });

      expect(screen.getByText(/No characters match/)).toBeInTheDocument();
    });

    it('should show empty state when no characters', () => {
      renderPool({ characters: [] });

      expect(screen.getByText(/All characters assigned/)).toBeInTheDocument();
    });

    it('should call onCharacterClick when character clicked', () => {
      const mockCharacters = createMockCharacters();
      const onClick = vi.fn();
      renderPool({ characters: [mockCharacters[0]], onCharacterClick: onClick });

      // Tier selector buttons come first; character button is the last button
      const buttons = screen.getAllByRole('button');
      const charButton = buttons[buttons.length - 1];
      charButton.click();

      expect(onClick).toHaveBeenCalledWith(mockCharacters[0]);
    });

    it('should update visible characters when filtered', () => {
      const mockCharacters = createMockCharacters();
      const { rerender } = renderPool({ characters: mockCharacters });

      expect(screen.getByText('Nahida')).toBeInTheDocument();
      expect(screen.getByText('Bennett')).toBeInTheDocument();

      rerender(
        <UnassignedPool
          characters={mockCharacters}
          searchQuery="pyro"
          defaultTier="S"
          onDefaultTierChange={vi.fn()}
        />
      );

      expect(screen.getByText('Bennett')).toBeInTheDocument();
      expect(screen.queryByText('Nahida')).not.toBeInTheDocument();
    });
  });
});
