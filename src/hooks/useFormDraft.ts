import { useState, useEffect } from 'react';

/**
 * A hook to automatically save form state to localStorage and recover it.
 * 
 * @param key The unique key to store the draft in localStorage
 * @param initialValue The initial state of the form
 * @returns [data, setData, clearDraft]
 */
export function useFormDraft<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  // Try to recover from localStorage on initial load
  const [data, setData] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`form_draft_${key}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge saved data with initialValue to ensure all properties exist
        return typeof initialValue === 'object' && initialValue !== null
          ? { ...initialValue, ...parsed }
          : parsed;
      }
    } catch (e) {
      console.error('Failed to parse form draft from localStorage', e);
    }
    return initialValue;
  });

  // Update localStorage whenever data changes
  useEffect(() => {
    if (data && Object.keys(data as object).length > 0) {
      localStorage.setItem(`form_draft_${key}`, JSON.stringify(data));
    }
  }, [key, data]);

  // Function to clear draft after successful submission
  const clearDraft = () => {
    localStorage.removeItem(`form_draft_${key}`);
  };

  return [data, setData, clearDraft];
}
