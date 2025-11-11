import { useState } from 'react';
import { Card } from '../types';

interface CardLoaderProps {
  onCardsLoaded: (cards: Card[]) => void;
}

export function CardLoader({ onCardsLoaded }: CardLoaderProps) {
  const [jsonText, setJsonText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        parseAndLoad(text);
      } catch (err) {
        setError('Failed to read file: ' + String(err));
      }
    };
    reader.readAsText(file);
  };

  const handleParseJson = () => {
    if (!jsonText.trim()) {
      setError('Please enter JSON text');
      return;
    }
    parseAndLoad(jsonText);
  };

  const parseAndLoad = (text: string) => {
    try {
      const data = JSON.parse(text);
      
      if (!data.cards || !Array.isArray(data.cards)) {
        throw new Error('Invalid JSON format: missing "cards" array');
      }

      const allCards = data.cards as Card[];
      
      // Validate that cards have required fields
      const hasValidCards = allCards.every(
        card => card.id && card.fullName && card.color
      );
      
      if (!hasValidCards) {
        throw new Error('Cards must have id, fullName, and color fields');
      }

      // Filter to only include baseCard: true (exclude duplicates)
      // If baseCard is undefined, include it (for backwards compatibility)
      const baseCards = allCards.filter(card => card.baseCard !== false);
      
      setError(null);
      onCardsLoaded(baseCards);
    } catch (err) {
      setError('Failed to parse JSON: ' + String(err));
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
      <h2 className="text-xl font-bold text-white">Load Cards</h2>
      
      <div className="space-y-2">
        <label className="block text-sm text-gray-300">
          Upload setdata.10.cleaned.json:
        </label>
        <input
          type="file"
          accept=".json"
          onChange={handleFileInput}
          className="block w-full text-sm text-gray-300 
            file:mr-4 file:py-2 file:px-4 
            file:rounded-lg file:border-0 
            file:text-sm file:font-semibold 
            file:bg-blue-600 file:text-white 
            hover:file:bg-blue-700 
            file:cursor-pointer"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-gray-300">
          Or paste JSON here:
        </label>
        <textarea
          value={jsonText}
          onChange={(e) => setJsonText(e.target.value)}
          placeholder='{"cards": [...]}'
          className="w-full h-32 px-3 py-2 bg-gray-900 text-white 
            border border-gray-700 rounded-lg 
            focus:ring-2 focus:ring-blue-500 focus:border-transparent 
            font-mono text-sm"
        />
        <button
          onClick={handleParseJson}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg 
            hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 
            font-semibold"
        >
          Parse JSON
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-900/50 border border-red-500 
          rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

