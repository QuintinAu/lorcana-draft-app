import { useState } from 'react';
import { Card } from '../types';

interface PickedCardsProps {
  picks: Card[];
  title?: string;
}

// Color mapping for Lorcana colors
const getColorStyles = (color: string) => {
  const colorMap: Record<string, string> = {
    'Amber': 'bg-yellow-500 hover:bg-yellow-600 border-yellow-600',
    'Amethyst': 'bg-purple-500 hover:bg-purple-600 border-purple-600',
    'Emerald': 'bg-green-500 hover:bg-green-600 border-green-600',
    'Ruby': 'bg-red-500 hover:bg-red-600 border-red-600',
    'Sapphire': 'bg-blue-500 hover:bg-blue-600 border-blue-600',
    'Steel': 'bg-gray-500 hover:bg-gray-600 border-gray-600',
  };
  return colorMap[color] || 'bg-gray-500 hover:bg-gray-600 border-gray-600';
};

export function PickedCards({ picks, title = 'My Picks' }: PickedCardsProps) {
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);

  // Group cards by cost
  const cardsByCost: Record<number, Card[]> = {};
  picks.forEach(card => {
    const cost = card.cost ?? 0;
    if (!cardsByCost[cost]) {
      cardsByCost[cost] = [];
    }
    cardsByCost[cost].push(card);
  });

  // Get unique cards per cost with counts
  const costGroups = Object.keys(cardsByCost)
    .map(Number)
    .sort((a, b) => a - b)
    .map(cost => {
      const cardsAtCost = cardsByCost[cost];
      const cardCounts: Record<string, { card: Card; count: number }> = {};
      
      cardsAtCost.forEach(card => {
        const key = card.fullName;
        if (cardCounts[key]) {
          cardCounts[key].count++;
        } else {
          cardCounts[key] = { card, count: 1 };
        }
      });

      return {
        cost,
        cards: Object.values(cardCounts),
        totalCount: cardsAtCost.length
      };
    });

  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h3 className="text-2xl font-bold text-white mb-4">
        {title} ({picks.length} cards)
      </h3>
      
      {/* Organize by cost in columns, max 4 per row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {costGroups.map(({ cost, cards, totalCount }) => (
          <div key={cost} className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-yellow-400 font-bold text-sm">
                Cost {cost}
              </h4>
              <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                <span className="text-gray-900 font-bold text-sm">{totalCount}</span>
              </div>
            </div>
            <div className="space-y-2">
              {cards.map(({ card, count }, idx) => (
                <div
                  key={`${card.id}-${idx}`}
                  className="relative group"
                  onMouseEnter={() => setHoveredCard(card)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className={`px-3 py-2 rounded-lg border transition-colors cursor-default ${getColorStyles(card.color)}`}>
                    <span className="text-white font-bold mr-2">
                      {count}×
                    </span>
                    <span className="text-white text-sm">
                      {card.fullName}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        
        {picks.length === 0 && (
          <p className="text-gray-500 text-sm col-span-full">No cards picked yet</p>
        )}
      </div>

      {/* Floating card preview - Top Right */}
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
  );
}
