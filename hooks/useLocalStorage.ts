import { useState, useEffect } from 'react';

/**
 * A hook that syncs state with localStorage.
 * Supports a custom deserializer for reviving complex types (e.g., Date objects).
 */
function useLocalStorage<T>(
  key: string,
  initialValue: T,
  deserialize?: (parsed: any) => T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return initialValue;
      const parsed = JSON.parse(item);
      return deserialize ? deserialize(parsed) : parsed;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Storage full or unavailable — silently ignore
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
