import { useState } from 'react';
import { DraftState } from '../types';
import { getTally, generateCopyTextWithoutColor } from '../lib/draft';
import { saveDraft } from '../lib/database';

interface ResultsTableProps {
  draftState: DraftState;
  onNewDraft: () => void | Promise<void>;
  onDeckSaved?: () => void;
}

export function ResultsTable({ draftState, onNewDraft, onDeckSaved }: ResultsTableProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const picks = draftState.picks;
  const tally = getTally(picks);

  const handleCopyAll = async () => {
    const text = generateCopyTextWithoutColor(picks);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  const handleSaveDraft = async () => {
    const draftName = prompt('Enter a name for this draft:');
    if (!draftName || !draftName.trim()) return;

    setSaving(true);
    try {
      await saveDraft(draftName.trim(), draftState);
      alert('Draft saved successfully!');
      onDeckSaved?.();
    } catch (err) {
      console.error('Failed to save draft:', err);
      alert('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-3xl font-bold text-white mb-4 text-center">
          Draft Complete!
        </h2>
        <p className="text-gray-300 text-center mb-6">
          Total cards picked: <span className="font-bold text-white">{picks.length}</span>
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="px-4 py-3 text-gray-300 font-semibold">Count</th>
                <th className="px-4 py-3 text-gray-300 font-semibold">Card Name</th>
                <th className="px-4 py-3 text-gray-300 font-semibold">Color</th>
              </tr>
            </thead>
            <tbody>
              {tally.map((entry, idx) => (
                <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="px-4 py-3 text-white font-bold">{entry.count}</td>
                  <td className="px-4 py-3 text-white">{entry.fullName}</td>
                  <td className="px-4 py-3 text-gray-300">{entry.color}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-4 justify-center flex-wrap">
          <button
            onClick={handleSaveDraft}
            disabled={saving}
            className="px-6 py-3 bg-transparent border-2 border-purple-500 text-purple-500 rounded-lg 
              hover:bg-purple-500/10 focus:ring-2 focus:ring-purple-500 
              font-semibold transition-colors disabled:opacity-30"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={handleCopyAll}
            className="px-6 py-3 bg-transparent border-2 border-green-500 text-green-500 rounded-lg 
              hover:bg-green-500/10 focus:ring-2 focus:ring-green-500 
              font-semibold transition-colors"
          >
            {copied ? 'Copied! ✓' : 'Copy All Lines'}
          </button>
          <button
            onClick={onNewDraft}
            className="px-6 py-3 bg-transparent border-2 border-blue-500 text-blue-500 rounded-lg 
              hover:bg-blue-500/10 focus:ring-2 focus:ring-blue-500 
              font-semibold transition-colors"
          >
            New Draft
          </button>
        </div>
      </div>
    </div>
  );
}

