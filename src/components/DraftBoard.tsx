import { DraftState } from '../types';
import { PackView } from './PackView';
import { getActivePackIndex } from '../lib/draft';

interface DraftBoardProps {
  state: DraftState;
  onPickCard: (cardIndex: number) => void;
}

export function DraftBoard({ state, onPickCard }: DraftBoardProps) {
  const currentRound = state.rounds[state.rounds.length - 1];
  const activePackIndex = getActivePackIndex(state.currentTurn);
  const activePack = currentRound.packs[activePackIndex];

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="bg-gray-800 px-4 py-2 rounded-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Round {state.currentRound}/6 — Turn {state.currentTurn}/12
          </h2>
          <p className="text-sm text-yellow-400 font-semibold">
            Pack #{activePackIndex + 1}
          </p>
        </div>
      </div>

      {/* Pack Status - Thin Line Indicator */}
      <div className="relative bg-gray-800 rounded-full h-2 overflow-hidden">
        <div className="absolute inset-0 flex">
          {currentRound.packs.map((pack, idx) => {
            const totalCards = 12;
            const remainingCards = pack.cards.length;
            const fillPercentage = (remainingCards / totalCards) * 100;
            
            return (
              <div
                key={pack.id}
                className="relative flex-1 border-r border-gray-900 last:border-r-0"
              >
                {/* Background (empty) */}
                <div className="absolute inset-0 bg-gray-700"></div>
                {/* Fill (remaining cards) */}
                <div
                  className={`absolute inset-0 transition-all duration-300 ${
                    idx === activePackIndex
                      ? 'bg-yellow-400'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${fillPercentage}%` }}
                ></div>
                {/* Active indicator pulse */}
                {idx === activePackIndex && (
                  <div className="absolute inset-0 bg-yellow-400 animate-pulse opacity-50"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Pack labels below the line */}
      <div className="grid grid-cols-6 gap-2 -mt-2">
        {currentRound.packs.map((pack, idx) => (
          <div
            key={pack.id}
            className={`text-center text-xs ${
              idx === activePackIndex
                ? 'text-yellow-400 font-bold'
                : 'text-gray-500'
            }`}
          >
            P{idx + 1}: {pack.cards.length}
          </div>
        ))}
      </div>

      {/* Active Pack - Large Display */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <PackView
          pack={activePack}
          isActive={true}
          onPickCard={onPickCard}
          showCards={true}
        />
      </div>
    </div>
  );
}
