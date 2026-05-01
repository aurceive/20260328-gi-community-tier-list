import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { TierList } from '@/components/TierList';
import { loadCharacters, filterByGroups } from '@/utils/characterLoader';
import { ACTIVE_CHARACTER_GROUPS } from '@/config';
import type { Character } from '@/types';
import styles from './App.module.css';

/**
 * Main App component
 */
function App() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCharacters()
      .then((chars) => {
        setCharacters(filterByGroups(chars, ACTIVE_CHARACTER_GROUPS));
        setIsLoadingCharacters(false);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load characters';
        setError(message);
        setIsLoadingCharacters(false);
      });
  }, []);

  return (
    <div className={styles.app}>
      <Navbar />

      {isLoadingCharacters && (
        <p className={styles.loadingMessage}>⏳ Loading character data...</p>
      )}

      {error && (
        <p className={styles.errorMessage}>❌ {error}</p>
      )}

      {!isLoadingCharacters && !error && characters.length > 0 && (
        <div className={styles.mainContent}>
          <TierList characters={characters} />
        </div>
      )}
    </div>
  );
}

export default App;
