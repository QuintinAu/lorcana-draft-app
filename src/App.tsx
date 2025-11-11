import { useState, useEffect } from 'react';
import { Card, DraftState } from './types';
import { DraftBoard } from './components/DraftBoard';
import { PickedCards } from './components/PickedCards';
import { TurnLog } from './components/TurnLog';
import { ResultsTable } from './components/ResultsTable';
import { SavedDecks } from './components/SavedDecks';
import { Toast } from './components/Toast';
import {
  createNewDraft,
  pickCard,
  undoLastPick,
  resetRound,
  resetDraft,
  getActivePackIndex,
  enrichDraftStateWithBaseCard,
} from './lib/draft';
import { saveState, loadState, clearState } from './lib/storage';

type Tab = 'draft' | 'saved-decks';

function App() {
  const [masterCards, setMasterCards] = useState<Card[] | null>(null);
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('draft');
  const [hasSavedState, setHasSavedState] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // Load cards and check for saved state on mount
  useEffect(() => {
    let cancelled = false;
    let loadedMasterCards: Card[] | null = null;
    let allCardsForLookup: Card[] | null = null;
    let savedDraftWaiting: DraftState | null = null;

    const enrichAndLoadSavedDraft = (saved: DraftState, masterCards: Card[], allCards: Card[]) => {
      if (cancelled) return;
      const enriched = enrichDraftStateWithBaseCard(saved, allCards);
      setMasterCards(masterCards);
      setDraftState(enriched);
      setHasSavedState(true);
    };

    const loadCards = async () => {
      try {
        const response = await fetch('/setdata.10.cleaned.json');
        const data = await response.json();
        if (!cancelled && data.cards && Array.isArray(data.cards)) {
          // Keep all cards for lookup (needed to enrich saved drafts)
          allCardsForLookup = data.cards;
          
          // Filter to only include baseCard: true (exclude duplicates) for new drafts
          const baseCards = data.cards.filter((card: Card) => card.baseCard !== false);
          loadedMasterCards = baseCards;
          setMasterCards(baseCards);
          showToast(`Loaded ${baseCards.length} base cards (${data.cards.length} total)!`);
          
          // If we have a saved draft waiting, enrich it now
          if (savedDraftWaiting && loadedMasterCards && allCardsForLookup) {
            enrichAndLoadSavedDraft(savedDraftWaiting, loadedMasterCards, allCardsForLookup);
            savedDraftWaiting = null;
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load cards:', err);
          showToast('Failed to load card data');
        }
      }
    };

    const loadSavedDraft = async () => {
      try {
        const saved = await loadState();
        if (cancelled) return;
        setHasSavedState(!!saved);
        if (saved) {
          if (loadedMasterCards && allCardsForLookup) {
            // Master cards already loaded, enrich immediately
            enrichAndLoadSavedDraft(saved, loadedMasterCards, allCardsForLookup);
          } else {
            // Master cards not loaded yet, wait for them
            savedDraftWaiting = saved;
          }
        }
      } catch (err) {
        console.error('Failed to load saved draft:', err);
      }
    };

    void loadCards();
    void loadSavedDraft();

    return () => {
      cancelled = true;
    };
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (!draftState) return;

    let cancelled = false;

    void (async () => {
      try {
        await saveState(draftState);
        if (!cancelled) {
          setHasSavedState(true);
        }
      } catch (err) {
        console.error('Failed to persist draft state:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftState]);


  const handleNewDraft = () => {
    if (!masterCards) return;
    
    if (draftState && !draftState.isComplete) {
      if (!confirm('Are you sure you want to start a new draft? Current progress will be lost.')) {
        return;
      }
    }
    
    const newState = createNewDraft(masterCards);
    setDraftState(newState);
    showToast('New draft started!');
  };

  const handleResumeDraft = async () => {
    try {
      const saved = await loadState();
      if (saved) {
        if (masterCards) {
          // Need to reload all cards for lookup
          try {
            const response = await fetch('/setdata.10.cleaned.json');
            const data = await response.json();
            if (data.cards && Array.isArray(data.cards)) {
              const allCards = data.cards;
              // Enrich the saved draft with baseCard data using all cards for lookup
              const enriched = enrichDraftStateWithBaseCard(saved, allCards);
              setMasterCards(masterCards);
              setDraftState(enriched);
              setHasSavedState(true);
              showToast('Draft resumed!');
            }
          } catch (err) {
            console.error('Failed to load cards for enrichment:', err);
            // Fallback: just load without enrichment
            setMasterCards(saved.masterCards);
            setDraftState(saved);
            setHasSavedState(true);
            showToast('Draft resumed!');
          }
        } else {
          // Master cards not loaded yet, just load the saved draft
          setMasterCards(saved.masterCards);
          setDraftState(saved);
          setHasSavedState(true);
          showToast('Draft resumed!');
        }
      } else {
        setHasSavedState(false);
        showToast('No saved draft found');
      }
    } catch (err) {
      console.error('Failed to resume draft:', err);
      showToast('Failed to resume draft');
    }
  };

  const handlePickCard = (cardIndex: number) => {
    if (!draftState) return;
    const newState = pickCard(draftState, cardIndex);
    setDraftState(newState);
  };

  const handleUndo = () => {
    if (!draftState) return;
    const newState = undoLastPick(draftState);
    if (newState) {
      setDraftState(newState);
      showToast('Undo successful');
    } else {
      showToast('Nothing to undo');
    }
  };

  const handleResetRound = () => {
    if (!draftState) return;
    if (!confirm('Reset the current round? All picks from this round will be lost.')) {
      return;
    }
    const newState = resetRound(draftState);
    setDraftState(newState);
    showToast('Round reset');
  };

  const handleResetDraft = () => {
    if (!draftState || !masterCards) return;
    if (!confirm('Reset the entire draft? All progress will be lost.')) {
      return;
    }
    const newState = resetDraft(masterCards);
    setDraftState(newState);
    showToast('Draft reset');
  };

  const handleQuickSim = () => {
    if (!draftState) return;
    
    let currentState = draftState;
    
    // Auto-pick first card until draft is complete
    while (!currentState.isComplete) {
      const currentRound = currentState.rounds[currentState.rounds.length - 1];
      const activePackIndex = getActivePackIndex(currentState.currentTurn);
      const activePack = currentRound.packs[activePackIndex];
      
      if (activePack.cards.length > 0) {
        currentState = pickCard(currentState, 0);
      } else {
        console.error('Active pack is empty, cannot continue sim');
        break;
      }
    }
    
    setDraftState(currentState);
    showToast('Quick sim complete!');
  };

  const savedStateExists = hasSavedState;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Top Bar */}
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img 
              src="/logo.svg" 
              alt="Lorcana Logo" 
              className="w-16 h-16 md:w-20 md:h-20"
            />
            <h1 className="text-4xl font-bold text-center">
              Lorcana Sealed Draft
            </h1>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center gap-2 mb-6">
            <button
              onClick={() => setActiveTab('draft')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'draft'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent border-2 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => setActiveTab('saved-decks')}
              className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                activeTab === 'saved-decks'
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent border-2 border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              Saved Drafts
            </button>
          </div>

          {masterCards && (
            <div className="bg-gray-800 p-4 rounded-lg space-y-3">
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={handleNewDraft}
                  className="px-6 py-3 bg-transparent border-2 border-green-500 text-green-500 rounded-lg 
                    hover:bg-green-500/10 focus:ring-2 focus:ring-green-500 
                    font-semibold transition-colors"
                >
                  New Draft
                </button>

                {savedStateExists && !draftState && (
                  <button
                    onClick={() => { void handleResumeDraft(); }}
                    className="px-6 py-3 bg-transparent border-2 border-blue-500 text-blue-500 rounded-lg 
                      hover:bg-blue-500/10 focus:ring-2 focus:ring-blue-500 
                      font-semibold transition-colors"
                  >
                    Resume Last Draft
                  </button>
                )}

                {draftState && !draftState.isComplete && (
                  <>
                    <button
                      onClick={handleUndo}
                      disabled={!draftState.undoBuffer}
                      className="px-4 py-2 bg-transparent border-2 border-yellow-500 text-yellow-500 rounded-lg 
                        hover:bg-yellow-500/10 focus:ring-2 focus:ring-yellow-500 
                        font-semibold transition-colors disabled:opacity-30 
                        disabled:cursor-not-allowed"
                    >
                      Undo Last Pick
                    </button>

                    <button
                      onClick={handleResetRound}
                      className="px-4 py-2 bg-transparent border-2 border-orange-500 text-orange-500 rounded-lg 
                        hover:bg-orange-500/10 focus:ring-2 focus:ring-orange-500 
                        font-semibold transition-colors"
                    >
                      Reset Round
                    </button>

                    <button
                      onClick={handleResetDraft}
                      className="px-4 py-2 bg-transparent border-2 border-red-500 text-red-500 rounded-lg 
                        hover:bg-red-500/10 focus:ring-2 focus:ring-red-500 
                        font-semibold transition-colors"
                    >
                      Reset Draft
                    </button>

                    <button
                      onClick={handleQuickSim}
                      className="px-4 py-2 bg-transparent border-2 border-purple-500 text-purple-500 rounded-lg 
                        hover:bg-purple-500/10 focus:ring-2 focus:ring-purple-500 
                        font-semibold transition-colors text-sm"
                      title="Dev: Auto-complete the draft"
                    >
                      Quick Sim
                    </button>
                  </>
                )}
              </div>

              <div className="text-center text-gray-400 text-sm">
                {masterCards.length} cards loaded
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        {activeTab === 'draft' && (
          <>
            {draftState && !draftState.isComplete && (
              <div className="space-y-6">
                <DraftBoard state={draftState} onPickCard={handlePickCard} />
                <PickedCards picks={draftState.picks} />
                <TurnLog log={draftState.log} />
              </div>
            )}

            {draftState && draftState.isComplete && (
              <ResultsTable
                draftState={draftState}
                onNewDraft={async () => {
                  try {
                    await clearState();
                    setHasSavedState(false);
                  } catch (err) {
                    console.error('Failed to clear saved draft:', err);
                  }
                  handleNewDraft();
                }}
                onDeckSaved={() => {
                  showToast('Draft saved! Check the Saved Drafts tab.');
                }}
              />
            )}

            {!draftState && !masterCards && (
              <div className="text-center text-gray-400 mt-12">
                <p className="text-lg">Loading cards...</p>
              </div>
            )}

            {!draftState && masterCards && (
              <div className="text-center text-gray-400 mt-12">
                <p className="text-lg">Click "New Draft" to begin!</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'saved-decks' && <SavedDecks masterCards={masterCards} />}

        <Toast message={toast || ''} visible={!!toast} />
      </div>
    </div>
  );
}

export default App;

