import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  getAllDrafts,
  deleteDraft,
  saveDraft,
  updateDraftName,
  exportDatabase,
  importDatabase,
  getAllDecks,
  SavedDraft,
  SavedDeck,
  saveDeck,
  deleteUnassignedDecks,
  updateDeckCards,
  updateDeckName,
} from '../lib/database';
import { Card, DraftState } from '../types';
import { generateCopyTextWithoutColor } from '../lib/draft';
import { PickedCards } from './PickedCards';
import { resolveCardType, matchesFilters, getSortComparator, __TYPE_ORDER } from '../lib/deckUtils';

interface SavedDecksProps {
  masterCards: Card[] | null;
}

export function SavedDecks({ masterCards }: SavedDecksProps) {
  const [drafts, setDrafts] = useState<SavedDraft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<SavedDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importingDb, setImportingDb] = useState(false);
  const [dbImportError, setDbImportError] = useState<string | null>(null);
  const [deletingUnassigned, setDeletingUnassigned] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyDeckTimeoutRef = useRef<number | null>(null);
  const [decksByDraft, setDecksByDraft] = useState<Record<number, SavedDeck[]>>({});
  const [orphanDecks, setOrphanDecks] = useState<SavedDeck[]>([]);
  const [copiedDeckId, setCopiedDeckId] = useState<number | null>(null);
  const [editingDeckId, setEditingDeckId] = useState<number | null>(null);
  const [editingDeckName, setEditingDeckName] = useState('');
  const [editingDeckCards, setEditingDeckCards] = useState<SavedDeck | null>(null);

  const regroupDecks = useCallback((decks: SavedDeck[], draftList: SavedDraft[]) => {
    const validDraftIds = new Set(draftList.map(d => d.id));
    const grouped: Record<number, SavedDeck[]> = {};
    const orphan: SavedDeck[] = [];

    decks.forEach(deck => {
      if (deck.draft_id != null && validDraftIds.has(deck.draft_id)) {
        if (!grouped[deck.draft_id]) {
          grouped[deck.draft_id] = [];
        }
        grouped[deck.draft_id].push(deck);
      } else {
        orphan.push(deck);
      }
    });

    Object.values(grouped).forEach(list => {
      list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });
    orphan.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { grouped, orphan };
  }, []);

  const loadDecks = useCallback(async () => {
    const allDecks = await getAllDecks();
    const { grouped, orphan } = regroupDecks(allDecks, drafts);
    setDecksByDraft(grouped);
    setOrphanDecks(orphan);
  }, [drafts, regroupDecks]);

  const loadDrafts = useCallback(async () => {
    const allDrafts = await getAllDrafts();
    const visibleDrafts = allDrafts.filter(d => d.name !== 'Current Draft');
    setDrafts(visibleDrafts);
  }, []);

  const fetchDraftsAndDecks = useCallback(async () => {
    const [allDrafts, allDecks] = await Promise.all([getAllDrafts(), getAllDecks()]);
    const visibleDrafts = allDrafts.filter(d => d.name !== 'Current Draft');
    const { grouped, orphan } = regroupDecks(allDecks, visibleDrafts);
    return { visibleDrafts, grouped, orphan };
  }, [regroupDecks]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { visibleDrafts, grouped, orphan } = await fetchDraftsAndDecks();
      setDrafts(visibleDrafts);
      setDecksByDraft(grouped);
      setOrphanDecks(orphan);
    } finally {
      setLoading(false);
    }
  }, [fetchDraftsAndDecks]);

  const refreshDraftsAndDecks = useCallback(async () => {
    const { visibleDrafts, grouped, orphan } = await fetchDraftsAndDecks();
    setDrafts(visibleDrafts);
    setDecksByDraft(grouped);
    setOrphanDecks(orphan);
  }, [fetchDraftsAndDecks]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    return () => {
      if (copyDeckTimeoutRef.current) {
        window.clearTimeout(copyDeckTimeoutRef.current);
      }
    };
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;
    
    await deleteDraft(id);
    await refreshDraftsAndDecks();
    if (selectedDraft?.id === id) {
      setSelectedDraft(null);
    }
  };

  const handleViewDraft = (draft: SavedDraft) => {
    setSelectedDraft(draft);
  };

  const handleStartEdit = (draft: SavedDraft) => {
    setEditingDraftId(draft.id);
    setEditingName(draft.name);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editingName.trim()) {
      setEditingDraftId(null);
      return;
    }

    try {
      await updateDraftName(id, editingName.trim());
      await loadDrafts();
      if (selectedDraft?.id === id) {
        const updated = await getAllDrafts();
        const updatedDraft = updated.find((d: SavedDraft) => d.id === id);
        if (updatedDraft) {
          setSelectedDraft(updatedDraft);
        }
      }
      setEditingDraftId(null);
    } catch (err) {
      console.error('Failed to update draft name:', err);
      alert('Failed to update draft name');
    }
  };

  const handleCancelEdit = () => {
    setEditingDraftId(null);
    setEditingName('');
  };

  const handleCopySavedDeck = useCallback(async (deck: SavedDeck) => {
    try {
      const parsed = JSON.parse(deck.cards_json) as Card[];
      const text = generateCopyTextWithoutColor(parsed);
      await navigator.clipboard.writeText(text);
      if (copyDeckTimeoutRef.current) {
        window.clearTimeout(copyDeckTimeoutRef.current);
      }
      setCopiedDeckId(deck.id);
      copyDeckTimeoutRef.current = window.setTimeout(() => setCopiedDeckId(null), 2000);
    } catch (err) {
      console.error('Failed to copy saved deck:', err);
      alert('Failed to copy deck to clipboard');
    }
  }, []);

  const handleStartEditDeckName = useCallback((deck: SavedDeck) => {
    setEditingDeckId(deck.id);
    setEditingDeckName(deck.name);
  }, []);

  const handleSaveDeckName = useCallback(async (deckId: number) => {
    if (!editingDeckName.trim()) {
      setEditingDeckId(null);
      return;
    }

    try {
      await updateDeckName(deckId, editingDeckName.trim());
      await refreshDraftsAndDecks();
      setEditingDeckId(null);
    } catch (err) {
      console.error('Failed to update deck name:', err);
      alert('Failed to update deck name');
    }
  }, [editingDeckName, refreshDraftsAndDecks]);

  const handleCancelEditDeckName = useCallback(() => {
    setEditingDeckId(null);
    setEditingDeckName('');
  }, []);

  const handleStartEditDeckCards = useCallback((deck: SavedDeck) => {
    setEditingDeckCards(deck);
  }, []);

  const handleCancelEditDeckCards = useCallback(() => {
    setEditingDeckCards(null);
  }, []);

  const parseDeckText = (text: string): { count: number; fullName: string; color: string | null }[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const parsed: { count: number; fullName: string; color: string | null }[] = [];

    for (const line of lines) {
      // Try new format first: "3 Cinderella - Dream Come True" (no color, no first dash)
      const newFormatMatch = line.match(/^(\d+)\s+(.+)$/);
      if (newFormatMatch) {
        const count = parseInt(newFormatMatch[1], 10);
        const fullName = newFormatMatch[2].trim();
        if (!isNaN(count) && count > 0 && fullName) {
          parsed.push({ count, fullName, color: null });
          continue;
        }
      }

      // Try old format: "3 - Cinderella - Dream Come True - Sapphire"
      const parts = line.split(' - ');
      if (parts.length >= 3) {
        const count = parseInt(parts[0].trim(), 10);
        if (isNaN(count) || count <= 0) continue;

        // If last part looks like a color, use old format
        const lastPart = parts[parts.length - 1].trim();
        const colors = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];
        if (colors.includes(lastPart)) {
          const color = lastPart;
          const fullName = parts.slice(1, -1).join(' - ').trim();
          if (fullName && color) {
            parsed.push({ count, fullName, color });
            continue;
          }
        }
      }

      // Try format without color: "3 - Cinderella - Dream Come True"
      if (parts.length >= 2) {
        const count = parseInt(parts[0].trim(), 10);
        if (!isNaN(count) && count > 0) {
          const fullName = parts.slice(1).join(' - ').trim();
          if (fullName) {
            parsed.push({ count, fullName, color: null });
          }
        }
      }
    }

    return parsed;
  };

  const handleImportDeck = async () => {
    if (!masterCards || masterCards.length === 0) {
      setImportError('Card data not loaded. Please wait for cards to load.');
      return;
    }

    if (!importText.trim()) {
      setImportError('Please paste deck text');
      return;
    }

    setImporting(true);
    setImportError(null);

    try {
      const parsed = parseDeckText(importText);
      if (parsed.length === 0) {
        setImportError('No valid cards found in the text. Format: "3 Cinderella - Dream Come True" or "3 - Cinderella - Dream Come True - Sapphire"');
        setImporting(false);
        return;
      }

      console.log('Parsed cards:', parsed.length, parsed.slice(0, 3));

      // Match cards against masterCards
      const cards: Card[] = [];
      const unmatched: string[] = [];

      for (const { count, fullName, color } of parsed) {
        let matchedCard: Card | undefined;

        if (color) {
          // Old format with color - match by name and color
          matchedCard = masterCards.find(
            card => card.fullName === fullName && card.color === color
          );
        } else {
          // New format without color - match by name only (take first match)
          matchedCard = masterCards.find(card => card.fullName === fullName);
        }

        if (matchedCard) {
          // Add the card count times
          for (let i = 0; i < count; i++) {
            cards.push(matchedCard);
          }
        } else {
          unmatched.push(`${count}× ${fullName}${color ? ` - ${color}` : ''}`);
        }
      }

      console.log('Matched cards:', cards.length, 'Unmatched:', unmatched.length);

      if (cards.length === 0) {
        setImportError(`No cards matched. Found ${parsed.length} card entries but none matched. Please check card names.`);
        setImporting(false);
        return;
      }

      // Prompt for draft name
      const draftName = prompt('Enter a name for this draft:');
      if (!draftName || !draftName.trim()) {
        setImporting(false);
        return;
      }

      // Create a DraftState from the imported cards
      // We'll create a minimal draft state with the picks
      const draftState: DraftState = {
        masterCards: masterCards,
        rounds: [],
        currentRound: 6,
        currentTurn: 13,
        picks: cards,
        log: [],
        isComplete: true,
        undoBuffer: null,
      };

      console.log('Saving draft:', draftName, 'with', cards.length, 'cards');
      await saveDraft(draftName.trim(), draftState);
      console.log('Draft saved successfully');
      
      if (unmatched.length > 0) {
        alert(`Draft saved! ${unmatched.length} card(s) could not be matched:\n${unmatched.slice(0, 5).join('\n')}${unmatched.length > 5 ? '\n...' : ''}`);
      } else {
        alert('Draft imported successfully!');
      }

      setImportText('');
      setShowImport(false);
      await refreshDraftsAndDecks();
    } catch (err) {
      console.error('Failed to import draft:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setImportError(`Failed to import draft: ${errorMessage}. Please check the format and try again.`);
    } finally {
      setImporting(false);
    }
  };

  const handleExportDatabase = async () => {
    setExporting(true);
    setDbImportError(null);
    try {
      await exportDatabase();
      alert('Database exported successfully!');
    } catch (err) {
      console.error('Failed to export database:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setDbImportError(`Failed to export database: ${errorMessage}`);
    } finally {
      setExporting(false);
    }
  };

  const handleImportDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file extension
    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite') && !file.name.endsWith('.sqlite3')) {
      setDbImportError('Invalid file type. Please select a .db, .sqlite, or .sqlite3 file.');
      return;
    }

    if (!confirm('Importing a database will replace all current saved drafts. Are you sure you want to continue?')) {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setImportingDb(true);
    setDbImportError(null);

    try {
      await importDatabase(file);
      alert('Database imported successfully!');
      await refreshDraftsAndDecks();
      if (selectedDraft) {
        setSelectedDraft(null);
      }
    } catch (err) {
      console.error('Failed to import database:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setDbImportError(`Failed to import database: ${errorMessage}`);
    } finally {
      setImportingDb(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteUnassignedDecks = async () => {
    const count = orphanDecks.length;
    if (count === 0) {
      alert('No unassigned decks to delete.');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${count} unassigned deck(s)? This action cannot be undone.`)) {
      return;
    }

    setDeletingUnassigned(true);
    setDbImportError(null);

    try {
      const deletedCount = await deleteUnassignedDecks();
      alert(`Successfully deleted ${deletedCount} unassigned deck(s).`);
      await refreshDraftsAndDecks();
    } catch (err) {
      console.error('Failed to delete unassigned decks:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setDbImportError(`Failed to delete unassigned decks: ${errorMessage}`);
    } finally {
      setDeletingUnassigned(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-12">
        <p>Loading saved drafts...</p>
      </div>
    );
  }

  if (selectedDraft) {
    return (
      <SavedDraftDetail
        draft={selectedDraft}
        onBack={() => {
          setSelectedDraft(null);
          void loadDecks();
        }}
        onDeckSaved={() => {
          void loadDecks();
        }}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-bold text-white">Saved Drafts</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportDatabase}
            disabled={exporting}
            className="px-4 py-2 bg-transparent border-2 border-blue-500 text-blue-500 rounded-lg 
              hover:bg-blue-500/10 focus:ring-2 focus:ring-blue-500 
              font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Export database as .db file"
          >
            {exporting ? 'Exporting...' : 'Export DB'}
          </button>
          <label className="px-4 py-2 bg-transparent border-2 border-purple-500 text-purple-500 rounded-lg 
            hover:bg-purple-500/10 focus:ring-2 focus:ring-purple-500 
            font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
            <input
              ref={fileInputRef}
              type="file"
              accept=".db,.sqlite,.sqlite3"
              onChange={handleImportDatabase}
              disabled={importingDb}
              className="hidden"
            />
            {importingDb ? 'Importing...' : 'Import DB'}
          </label>
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-4 py-2 bg-transparent border-2 border-green-500 text-green-500 rounded-lg 
              hover:bg-green-500/10 focus:ring-2 focus:ring-green-500 
              font-semibold transition-colors"
          >
            {showImport ? 'Cancel Import' : 'Import Draft'}
          </button>
          {orphanDecks.length > 0 && (
            <button
              onClick={handleDeleteUnassignedDecks}
              disabled={deletingUnassigned}
              className="px-4 py-2 bg-transparent border-2 border-red-500 text-red-500 rounded-lg 
                hover:bg-red-500/10 focus:ring-2 focus:ring-red-500 
                font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={`Delete ${orphanDecks.length} unassigned deck(s)`}
            >
              {deletingUnassigned ? 'Deleting...' : `Delete Unassigned (${orphanDecks.length})`}
            </button>
          )}
        </div>
      </div>

      {dbImportError && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 
          rounded-lg text-red-200 text-sm">
          {dbImportError}
        </div>
      )}

      {showImport && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-bold text-white mb-4">Import Draft</h3>
          <p className="text-gray-400 text-sm mb-4">
            Paste your deck list. Supports formats:
            <br />
            <code className="text-yellow-400">3 Cinderella - Dream Come True</code> (new format)
            <br />
            <code className="text-yellow-400">3 - Cinderella - Dream Come True - Sapphire</code> (old format)
          </p>
          <textarea
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              setImportError(null);
            }}
            placeholder="3 Cinderella - Dream Come True&#10;3 Megara - Secret Keeper&#10;..."
            className="w-full h-48 px-3 py-2 bg-gray-900 text-white 
              border border-gray-700 rounded-lg 
              focus:ring-2 focus:ring-green-500 focus:border-transparent 
              font-mono text-sm mb-4"
          />
          {importError && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-500 
              rounded-lg text-red-200 text-sm">
              {importError}
            </div>
          )}
          <button
            onClick={handleImportDeck}
            disabled={importing || !importText.trim()}
            className="px-6 py-3 bg-transparent border-2 border-green-500 text-green-500 rounded-lg 
              hover:bg-green-500/10 focus:ring-2 focus:ring-green-500 
              font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing...' : 'Import Draft'}
          </button>
        </div>
      )}
      
      {drafts.length === 0 && !showImport ? (
        <div className="bg-gray-800 p-12 rounded-lg text-center">
          <p className="text-gray-400 text-lg">No saved drafts yet.</p>
          <p className="text-gray-500 text-sm mt-2">
            Complete a draft and save it to see it here!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {drafts.map(draft => {
            let cardCount = 0;
            try {
              const draftState: DraftState = JSON.parse(draft.draft_state_json);
              cardCount = draftState.picks.length;
            } catch (e) {
              // Ignore parse errors
            }
            const draftDecks = decksByDraft[draft.id] ?? [];

            return (
              <div
                key={draft.id}
                className="bg-gray-800 border-2 border-gray-700 rounded-lg hover:border-blue-500 transition-colors"
              >
                <div className="flex flex-col lg:flex-row gap-4 p-4">
                  <div className="flex-1 space-y-3">
                    {editingDraftId === draft.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleSaveEdit(draft.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveEdit(draft.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        autoFocus
                        className="w-full px-2 py-1 bg-gray-900 text-white border border-gray-600 rounded 
                          focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ) : (
                      <h3
                        onDoubleClick={() => handleStartEdit(draft)}
                        className="text-xl font-bold text-white cursor-pointer hover:text-blue-400 transition-colors"
                        title="Double-click to edit"
                      >
                        {draft.name}
                      </h3>
                    )}
                    <div className="text-sm text-gray-400 space-x-2">
                      <span>{new Date(draft.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{cardCount} cards</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleViewDraft(draft)}
                        className="px-3 py-2 bg-transparent border-2 border-blue-500 text-blue-500 rounded-lg 
                          hover:bg-blue-500/10 focus:ring-2 focus:ring-blue-500 
                          font-semibold transition-colors text-sm"
                      >
                        View Draft
                      </button>
                      <button
                        onClick={() => handleDelete(draft.id)}
                        className="px-3 py-2 bg-transparent border-2 border-red-500 text-red-500 rounded-lg 
                          hover:bg-red-500/10 focus:ring-2 focus:ring-red-500 
                          font-semibold transition-colors text-sm"
                      >
                        Delete Draft
                      </button>
                    </div>
                  </div>
                  <div className="lg:w-72 xl:w-80 bg-gray-900/60 border border-gray-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                        Saved Decks
                      </h4>
                      <span className="text-xs text-gray-400">
                        {draftDecks.length}
                      </span>
                    </div>
                    {draftDecks.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No decks saved for this draft yet.
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {draftDecks.map(deck => (
                          <li
                            key={deck.id}
                            className="flex items-start justify-between gap-3 rounded-lg bg-gray-900/90 p-3 border border-gray-700"
                          >
                            <div className="flex-1 min-w-0">
                              {editingDeckId === deck.id ? (
                                <input
                                  type="text"
                                  value={editingDeckName}
                                  onChange={(e) => setEditingDeckName(e.target.value)}
                                  onBlur={() => handleSaveDeckName(deck.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveDeckName(deck.id);
                                    } else if (e.key === 'Escape') {
                                      handleCancelEditDeckName();
                                    }
                                  }}
                                  autoFocus
                                  className="w-full px-2 py-1 bg-gray-800 text-white border border-gray-600 rounded text-sm
                                    focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                              ) : (
                                <>
                                  <p 
                                    onDoubleClick={() => handleStartEditDeckName(deck)}
                                    className="text-sm font-semibold text-white cursor-pointer hover:text-blue-400 transition-colors"
                                    title="Double-click to edit name"
                                  >
                                    {deck.name}
                                  </p>
                                  <p className="text-xs text-gray-400">
                                    {deck.total_cards} cards • {new Date(deck.created_at).toLocaleDateString()}
                                  </p>
                                </>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStartEditDeckCards(deck)}
                                className="px-3 py-1 rounded-md border border-blue-500 text-xs text-blue-300 hover:bg-blue-500/10 focus:ring-2 focus:ring-blue-400 transition-colors"
                                title="Edit deck cards"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => { void handleCopySavedDeck(deck); }}
                                className="px-3 py-1 rounded-md border border-green-500 text-xs text-green-300 hover:bg-green-500/10 focus:ring-2 focus:ring-green-400 transition-colors"
                              >
                                {copiedDeckId === deck.id ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {orphanDecks.length > 0 && (
        <div className="mt-8 bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Unassigned Decks</h3>
            <span className="text-sm text-gray-400">{orphanDecks.length}</span>
          </div>
          <p className="text-sm text-gray-400">
            These decks were saved without a linked draft. You can still copy them for later use.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {orphanDecks.map(deck => (
              <div
                key={deck.id}
                className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 space-y-2"
              >
                <div>
                  {editingDeckId === deck.id ? (
                    <input
                      type="text"
                      value={editingDeckName}
                      onChange={(e) => setEditingDeckName(e.target.value)}
                      onBlur={() => handleSaveDeckName(deck.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveDeckName(deck.id);
                        } else if (e.key === 'Escape') {
                          handleCancelEditDeckName();
                        }
                      }}
                      autoFocus
                      className="w-full px-2 py-1 bg-gray-800 text-white border border-gray-600 rounded text-sm
                        focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                    />
                  ) : (
                    <>
                      <p 
                        onDoubleClick={() => handleStartEditDeckName(deck)}
                        className="text-sm font-semibold text-white cursor-pointer hover:text-blue-400 transition-colors"
                        title="Double-click to edit name"
                      >
                        {deck.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {deck.total_cards} cards • {new Date(deck.created_at).toLocaleDateString()}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleStartEditDeckCards(deck)}
                    className="px-3 py-1 rounded-md border border-blue-500 text-xs text-blue-300 hover:bg-blue-500/10 focus:ring-2 focus:ring-blue-400 transition-colors"
                    title="Edit deck cards"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { void handleCopySavedDeck(deck); }}
                    className="px-3 py-1 rounded-md border border-green-500 text-xs text-green-300 hover:bg-green-500/10 focus:ring-2 focus:ring-green-400 transition-colors"
                  >
                    {copiedDeckId === deck.id ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {editingDeckCards && (
        <EditDeckCards
          deck={editingDeckCards}
          draft={editingDeckCards.draft_id ? drafts.find(d => d.id === editingDeckCards.draft_id) ?? null : null}
          onSave={async (cards: Card[]) => {
            await updateDeckCards(editingDeckCards.id, cards);
            await refreshDraftsAndDecks();
            setEditingDeckCards(null);
          }}
          onCancel={handleCancelEditDeckCards}
        />
      )}
    </div>
  );
}

type SortOption = 'default' | 'cost-asc' | 'cost-desc' | 'name' | 'color';

type CardFiltersState = {
  colors: string[];
  costs: number[];
  types: string[];
  evasiveOnly: boolean;
};

const MAX_DECK_SIZE = 40;

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'default', label: 'Type → Cost Asc' },
  { value: 'cost-asc', label: 'Cost Asc' },
  { value: 'cost-desc', label: 'Cost Desc' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'color', label: 'Color' },
];

const makeEmptyFilters = (): CardFiltersState => ({
  colors: [],
  costs: [],
  types: [],
  evasiveOnly: false,
});

interface SavedDraftDetailProps {
  draft: SavedDraft;
  onBack: () => void;
  onDeckSaved?: () => void | Promise<void>;
}

interface CardEntry {
  card: Card;
  index: number;
}

function SavedDraftDetail({ draft, onBack, onDeckSaved }: SavedDraftDetailProps) {
  const draftState: DraftState | null = useMemo(() => {
    try {
      return JSON.parse(draft.draft_state_json) as DraftState;
    } catch (err) {
      console.error('Failed to parse draft state:', err);
      return null;
    }
  }, [draft]);

  const cards = draftState?.picks ?? [];

  const [filters, setFilters] = useState<CardFiltersState>(() => makeEmptyFilters());
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [deckName, setDeckName] = useState(() => `${draft.name} Deck`);
  const [status, setStatus] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);

  const cardEntries: CardEntry[] = useMemo(
    () => cards.map((card, index) => ({ card, index })),
    [cards]
  );

  const availableColors = useMemo(() => {
    const unique = new Set<string>();
    cardEntries.forEach(({ card }) => {
      if (card.color) unique.add(card.color);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [cardEntries]);

  const availableCosts = useMemo(() => {
    const unique = new Set<number>();
    cardEntries.forEach(({ card }) => {
      if (typeof card.cost === 'number') unique.add(card.cost);
    });
    return Array.from(unique).sort((a, b) => a - b);
  }, [cardEntries]);

  const availableTypes = useMemo(() => {
    const unique = new Set<string>();
    cardEntries.forEach(({ card }) => {
      unique.add(resolveCardType(card));
    });
    const priority = __TYPE_ORDER as string[];
    const ordered: string[] = [];
    priority.forEach(type => {
      if (unique.has(type)) {
        ordered.push(type);
        unique.delete(type);
      }
    });
    const remaining = Array.from(unique).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...remaining];
  }, [cardEntries]);

  const filteredEntries = useMemo(
    () => cardEntries.filter(({ card }) => matchesFilters(card, filters)),
    [cardEntries, filters]
  );

  const sortComparator = useMemo(() => getSortComparator(sortOption), [sortOption]);

  const groupedEntries = useMemo(() => {
    const buckets = new Map<string, CardEntry[]>();
    filteredEntries.forEach(entry => {
      const type = resolveCardType(entry.card);
      if (!buckets.has(type)) {
        buckets.set(type, []);
      }
      buckets.get(type)!.push(entry);
    });

    const comparator = (a: CardEntry, b: CardEntry) => {
      const result = sortComparator(a.card, b.card);
      if (result !== 0) return result;
      return a.index - b.index;
    };

    const groups: Array<{ type: string; entries: CardEntry[] }> = [];
    (__TYPE_ORDER as string[]).forEach(type => {
      if (buckets.has(type)) {
        const entries = buckets.get(type)!;
        buckets.delete(type);
        groups.push({ type, entries: [...entries].sort(comparator) });
      }
    });

    const remainingTypes = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b));
    remainingTypes.forEach(type => {
      const entries = buckets.get(type)!;
      groups.push({ type, entries: [...entries].sort(comparator) });
    });

    return groups;
  }, [filteredEntries, sortComparator]);

  const selectedCards = useMemo(
    () => selectedIndices.map(idx => cards[idx]).filter(Boolean),
    [selectedIndices, cards]
  );

  const selectedSet = useMemo(() => new Set(selectedIndices), [selectedIndices]);

  // Calculate cost summary for selected cards
  const costSummary = useMemo(() => {
    const costCounts: Record<number, number> = {};
    selectedCards.forEach(card => {
      const cost = typeof card.cost === 'number' ? card.cost : 0;
      costCounts[cost] = (costCounts[cost] || 0) + 1;
    });
    return Object.keys(costCounts)
      .map(Number)
      .sort((a, b) => a - b)
      .map(cost => ({ cost, count: costCounts[cost] }));
  }, [selectedCards]);

  const handleToggleFilter = useCallback((key: 'colors' | 'types', value: string) => {
    setFilters(prev => {
      const nextValues = prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value];
      return { ...prev, [key]: nextValues };
    });
  }, []);

  const handleToggleCost = useCallback((value: number) => {
    setFilters(prev => {
      const nextValues = prev.costs.includes(value)
        ? prev.costs.filter(item => item !== value)
        : [...prev.costs, value];
      return { ...prev, costs: nextValues };
    });
  }, []);

  const handleToggleEvasive = useCallback(() => {
    setFilters(prev => ({ ...prev, evasiveOnly: !prev.evasiveOnly }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(makeEmptyFilters());
  }, []);

  const handleToggleCard = useCallback((index: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        setStatus(null);
        return prev.filter(i => i !== index);
      }
      if (prev.length >= MAX_DECK_SIZE) {
        setStatus({ tone: 'error', message: `You can only select up to ${MAX_DECK_SIZE} cards.` });
        return prev;
      }
      setStatus(null);
      return [...prev, index];
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIndices([]);
    setStatus(null);
  }, []);

  const handleSaveDeck = useCallback(async () => {
    if (selectedCards.length === 0) {
      setStatus({ tone: 'error', message: 'Select at least one card before saving.' });
      return;
    }
    const trimmedName = deckName.trim();
    if (!trimmedName) {
      setStatus({ tone: 'error', message: 'Please enter a deck name.' });
      return;
    }
    setSaving(true);
    try {
      await saveDeck(trimmedName, selectedCards, draft.id);
      await onDeckSaved?.();
      setStatus({ tone: 'success', message: 'Deck saved successfully!' });
      setSelectedIndices([]);
    } catch (err) {
      console.error('Failed to save deck:', err);
      setStatus({ tone: 'error', message: 'Failed to save deck. Please try again.' });
    } finally {
      setSaving(false);
    }
  }, [deckName, selectedCards, draft.id, onDeckSaved]);

  const handleCopyDeck = useCallback(async () => {
    if (selectedCards.length === 0) {
      setStatus({ tone: 'error', message: 'Select at least one card to copy.' });
      return;
    }
    try {
      const text = generateCopyTextWithoutColor(selectedCards);
      await navigator.clipboard.writeText(text);
      setStatus({ tone: 'success', message: 'Deck copied to clipboard.' });
    } catch (err) {
      console.error('Failed to copy deck:', err);
      setStatus({ tone: 'error', message: 'Failed to copy deck to clipboard.' });
    }
  }, [selectedCards]);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!draftState) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-transparent border-2 border-gray-500 text-gray-300 rounded-lg 
              hover:bg-gray-500/10 focus:ring-2 focus:ring-gray-500 
              font-semibold transition-colors"
          >
            ← Back to Drafts
          </button>
          <span className="text-red-300 text-sm">Unable to load this draft.</span>
        </div>
      </div>
    );
  }

  const totalCards = cards.length;
  const showingCount = filteredEntries.length;

  return (
    <div className="max-w-[90rem] mx-auto space-y-6 pb-8 px-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <button
          onClick={onBack}
          className="self-start px-4 py-2 bg-transparent border-2 border-gray-500 text-gray-300 rounded-lg 
            hover:bg-gray-500/10 focus:ring-2 focus:ring-gray-500 
            font-semibold transition-colors"
        >
          ← Back to Drafts
        </button>
        <div className="flex-1 text-left">
          <h2 className="text-3xl font-bold text-white">{draft.name}</h2>
          <p className="text-sm text-gray-300 mt-1">
            Created {new Date(draft.created_at).toLocaleString()} • {totalCards} cards saved
          </p>
        </div>
      </div>

      {totalCards === 0 ? (
        <div className="bg-gray-800 p-6 rounded-lg text-center text-gray-400">
          This draft has no saved cards yet.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[8fr_5fr]">
          <div className="bg-gray-800 p-6 rounded-lg space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-sm text-gray-300">
                Showing <span className="text-white font-semibold">{showingCount}</span> of{' '}
                <span className="text-white font-semibold">{totalCards}</span> cards
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <span>Sort by</span>
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as SortOption)}
                    className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-1 text-sm text-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  >
                    {sortOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={handleClearFilters}
                  className="px-3 py-1 border border-gray-600 rounded-lg text-sm text-gray-200 hover:border-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            <div className="bg-gray-900/50 p-4 rounded-lg">
              <div className="flex flex-wrap items-start gap-6">
                {availableColors.length > 0 && (
                  <div className="flex-shrink-0">
                    <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">Colors</h4>
                    <div className="flex flex-wrap gap-2">
                      {availableColors.map(color => {
                        const isActive = filters.colors.includes(color);
                        return (
                          <FilterChip
                            key={color}
                            active={isActive}
                            onClick={() => handleToggleFilter('colors', color)}
                          >
                            {color}
                          </FilterChip>
                        );
                      })}
                    </div>
                  </div>
                )}

                {availableCosts.length > 0 && (
                  <div className="flex-shrink-0">
                    <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">Cost</h4>
                    <div className="flex flex-wrap gap-2">
                      {availableCosts.map(cost => {
                        const isActive = filters.costs.includes(cost);
                        return (
                          <FilterChip
                            key={cost}
                            active={isActive}
                            onClick={() => handleToggleCost(cost)}
                          >
                            {cost}
                          </FilterChip>
                        );
                      })}
                    </div>
                  </div>
                )}

                {availableTypes.length > 0 && (
                  <div className="flex-shrink-0">
                    <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">Type</h4>
                    <div className="flex flex-wrap gap-2">
                      {availableTypes.map(type => {
                        const isActive = filters.types.includes(type);
                        return (
                          <FilterChip
                            key={type}
                            active={isActive}
                            onClick={() => handleToggleFilter('types', type)}
                          >
                            {type}
                          </FilterChip>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex-shrink-0">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2">Keywords</h4>
                  <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filters.evasiveOnly}
                      onChange={handleToggleEvasive}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-900 text-yellow-400 focus:ring-yellow-400"
                    />
                    Evasive only
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {groupedEntries.length === 0 ? (
                <div className="text-center text-gray-400 py-8 border border-dashed border-gray-600 rounded-lg">
                  No cards match the current filters.
                </div>
              ) : (
                groupedEntries.map(group => (
                  <div key={group.type} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-white">{group.type}</h3>
                      <span className="text-sm text-gray-400">{group.entries.length} cards</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                      {group.entries.map(({ card, index }) => {
                        const selected = selectedSet.has(index);
                        const imageUrl = card.images?.full;
                        return (
                          <button
                            key={`${card.id}-${index}`}
                            onClick={() => handleToggleCard(index)}
                            onMouseEnter={() => setHoveredCard(card)}
                            onMouseLeave={() => setHoveredCard(null)}
                            className={`relative overflow-hidden rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                              selected
                                ? 'border-yellow-400 shadow-lg shadow-yellow-400/40'
                                : 'border-gray-700 hover:border-yellow-300 hover:shadow-lg hover:shadow-yellow-400/20'
                            }`}
                            title="Click to toggle selection"
                          >
                            {imageUrl ? (
                              <img
                                src={imageUrl}
                                alt={card.fullName}
                                className="w-full aspect-[2.5/3.5] object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="w-full aspect-[2.5/3.5] bg-gray-900 flex items-center justify-center text-sm text-gray-400">
                                No image
                              </div>
                            )}
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-gray-950/80 text-xs font-semibold text-yellow-200">
                              {typeof card.cost === 'number' ? card.cost : '?'}
                            </div>
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-gray-950 via-gray-900/70 to-transparent p-2">
                              <p className="text-sm font-semibold text-white leading-tight">
                                {card.fullName}
                              </p>
                              <p className="text-xs text-gray-300">
                                {card.color} • {resolveCardType(card)}
                              </p>
                            </div>
                            {selected && (
                              <div className="absolute inset-0 bg-yellow-300/15 pointer-events-none" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg space-y-4">
              <div>
                <label htmlFor="deck-name" className="block text-sm font-semibold text-gray-200 mb-1">
                  Deck Name
                </label>
                <input
                  id="deck-name"
                  type="text"
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-white focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                  placeholder="Enter deck name"
                />
              </div>

              <div className="text-sm text-gray-300">
                Selected{' '}
                <span className={`font-semibold ${selectedCards.length > MAX_DECK_SIZE ? 'text-red-400' : 'text-white'}`}>
                  {selectedCards.length}
                </span>{' '}
                / {MAX_DECK_SIZE}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleSaveDeck}
                  disabled={saving || selectedCards.length === 0}
                  className="px-4 py-2 rounded-lg border-2 border-purple-500 text-purple-300 hover:bg-purple-500/10 focus:ring-2 focus:ring-purple-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Deck'}
                </button>
                <button
                  onClick={handleCopyDeck}
                  className="px-4 py-2 rounded-lg border-2 border-green-500 text-green-300 hover:bg-green-500/10 focus:ring-2 focus:ring-green-400 transition-colors"
                >
                  Copy Deck
                </button>
                <button
                  onClick={handleClearSelection}
                  disabled={selectedCards.length === 0}
                  className="px-4 py-2 rounded-lg border-2 border-gray-500 text-gray-300 hover:bg-gray-500/10 focus:ring-2 focus:ring-gray-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Clear Deck
                </button>
              </div>

              {status && (
                <div
                  className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
                    status.tone === 'success'
                      ? 'border-green-500 text-green-300 bg-green-500/10'
                      : status.tone === 'error'
                        ? 'border-red-500 text-red-300 bg-red-500/10'
                        : 'border-yellow-500 text-yellow-300 bg-yellow-500/10'
                  }`}
                >
                  {status.message}
                </div>
              )}
            </div>

            <PickedCards picks={selectedCards} title="Deck Picks" />
          </div>
        </div>
      )}

      {/* Hover Preview - Top Right Corner */}
      {hoveredCard && hoveredCard.images?.full && (
        <div className="fixed top-4 right-4 z-50 pointer-events-none">
          <img
            src={hoveredCard.images.full}
            alt={hoveredCard.fullName}
            className="w-[640px] rounded-xl shadow-2xl border-4 border-yellow-400"
          />
        </div>
      )}

      {/* Cost Summary Bar - Bottom Right */}
      {selectedCards.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
          <div className="w-[640px] bg-gray-800/95 backdrop-blur-sm border-2 border-yellow-400 rounded-lg shadow-2xl px-4 py-2">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs font-semibold text-yellow-400 uppercase tracking-wide whitespace-nowrap">
                Cost Summary ({selectedCards.length})
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {costSummary.map(({ cost, count }) => (
                  <div
                    key={cost}
                    className="flex items-center gap-1.5 px-2 py-1 bg-gray-900/80 rounded border border-yellow-400/30"
                  >
                    <span className="text-yellow-300 font-bold text-xs">Cost {cost}</span>
                    <span className="text-white font-semibold text-xs">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface EditDeckCardsProps {
  deck: SavedDeck;
  draft: SavedDraft | null;
  onSave: (cards: Card[]) => Promise<void>;
  onCancel: () => void;
}

function EditDeckCards({ deck, draft, onSave, onCancel }: EditDeckCardsProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);
  const [saving, setSaving] = useState(false);

  const availableCards = useMemo(() => {
    if (draft) {
      try {
        const draftState: DraftState = JSON.parse(draft.draft_state_json);
        return draftState.picks;
      } catch (err) {
        console.error('Failed to parse draft state:', err);
      }
    }
    return [];
  }, [draft]);

  const currentDeckCards = useMemo(() => {
    try {
      return JSON.parse(deck.cards_json) as Card[];
    } catch (err) {
      console.error('Failed to parse deck cards:', err);
      return [];
    }
  }, [deck]);

  useEffect(() => {
    if (availableCards.length === 0) return;
    const indices: number[] = [];
    currentDeckCards.forEach(deckCard => {
      const index = availableCards.findIndex(
        c => c.fullName === deckCard.fullName && c.color === deckCard.color
      );
      if (index !== -1) {
        indices.push(index);
      }
    });
    setSelectedIndices(indices);
  }, [availableCards, currentDeckCards]);

  const selectedCards = useMemo(
    () => selectedIndices.map(idx => availableCards[idx]).filter(Boolean),
    [selectedIndices, availableCards]
  );

  const selectedSet = useMemo(() => new Set(selectedIndices), [selectedIndices]);

  const handleToggleCard = useCallback((index: number) => {
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      if (prev.length >= MAX_DECK_SIZE) {
        alert(`You can only select up to ${MAX_DECK_SIZE} cards.`);
        return prev;
      }
      return [...prev, index];
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (selectedCards.length === 0) {
      alert('Select at least one card before saving.');
      return;
    }
    setSaving(true);
    try {
      await onSave(selectedCards);
    } catch (err) {
      console.error('Failed to save deck:', err);
      alert('Failed to save deck. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [selectedCards, onSave]);

  if (availableCards.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-gray-800 p-6 rounded-lg max-w-md">
          <h3 className="text-xl font-bold text-white mb-4">Cannot Edit Deck</h3>
          <p className="text-gray-300 mb-4">
            {draft
              ? 'Unable to load draft cards for editing.'
              : 'This deck is not associated with a draft. Please edit it from its draft page.'}
          </p>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-transparent border-2 border-gray-500 text-gray-300 rounded-lg 
              hover:bg-gray-500/10 focus:ring-2 focus:ring-gray-500 
              font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg max-w-[90rem] w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Edit Deck: {deck.name}</h2>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-transparent border-2 border-gray-500 text-gray-300 rounded-lg 
              hover:bg-gray-500/10 focus:ring-2 focus:ring-gray-500 
              font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[8fr_5fr]">
          <div className="bg-gray-900/50 p-6 rounded-lg space-y-6">
            <div className="text-sm text-gray-300">
              Select cards from the draft ({availableCards.length} available)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
              {availableCards.map((card, index) => {
                const selected = selectedSet.has(index);
                const imageUrl = card.images?.full;
                return (
                  <button
                    key={`${card.id}-${index}`}
                    onClick={() => handleToggleCard(index)}
                    onMouseEnter={() => setHoveredCard(card)}
                    onMouseLeave={() => setHoveredCard(null)}
                    className={`relative overflow-hidden rounded-xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-yellow-400 ${
                      selected
                        ? 'border-yellow-400 shadow-lg shadow-yellow-400/40'
                        : 'border-gray-700 hover:border-yellow-300 hover:shadow-lg hover:shadow-yellow-400/20'
                    }`}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={card.fullName}
                        className="w-full aspect-[2.5/3.5] object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full aspect-[2.5/3.5] bg-gray-900 flex items-center justify-center text-sm text-gray-400">
                        No image
                      </div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-gray-950/80 text-xs font-semibold text-yellow-200">
                      {typeof card.cost === 'number' ? card.cost : '?'}
                    </div>
                    {selected && (
                      <div className="absolute inset-0 bg-yellow-300/15 pointer-events-none" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-900/50 p-6 rounded-lg space-y-4">
              <div className="text-sm text-gray-300">
                Selected{' '}
                <span className={`font-semibold ${selectedCards.length > MAX_DECK_SIZE ? 'text-red-400' : 'text-white'}`}>
                  {selectedCards.length}
                </span>{' '}
                / {MAX_DECK_SIZE}
              </div>
              <button
                onClick={handleSave}
                disabled={saving || selectedCards.length === 0}
                className="w-full px-4 py-2 rounded-lg border-2 border-purple-500 text-purple-300 hover:bg-purple-500/10 focus:ring-2 focus:ring-purple-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
            <PickedCards picks={selectedCards} title="Selected Cards" />
          </div>
        </div>

        {hoveredCard && hoveredCard.images?.full && (
          <div className="fixed top-4 right-4 z-50 pointer-events-none">
            <img
              src={hoveredCard.images.full}
              alt={hoveredCard.fullName}
              className="w-[640px] rounded-xl shadow-2xl border-4 border-yellow-400"
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterChip({ active, onClick, children }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full border text-sm transition-colors ${
        active
          ? 'border-yellow-400 text-yellow-200 bg-yellow-400/10'
          : 'border-gray-600 text-gray-300 hover:border-yellow-400 hover:text-yellow-200'
      }`}
      type="button"
    >
      {children}
    </button>
  );
}
