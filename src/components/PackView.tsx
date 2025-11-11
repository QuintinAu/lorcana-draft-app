import { useState } from 'react';
import { Pack, Card } from '../types';

interface PackViewProps {
  pack: Pack;
  isActive: boolean;
  onPickCard?: (cardIndex: number) => void;
  showCards: boolean;
}

export function PackView({ pack, isActive, onPickCard, showCards }: PackViewProps) {
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);

  if (!showCards || !isActive) {
    return null;
  }

  return (
    <div className="relative">
      {/* 4 cards per row for larger images */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {pack.cards.map((card, idx) => (
          <CardTile
            key={`${card.id}-${idx}`}
            card={card}
            onPick={() => onPickCard?.(idx)}
            onHover={setHoveredCard}
          />
        ))}
      </div>

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
    </div>
  );
}

interface CardTileProps {
  card: Card;
  onPick: () => void;
  onHover: (card: Card | null) => void;
}

function CardTile({ card, onPick, onHover }: CardTileProps) {
  const imageUrl = card.images?.full;
  const rarityValue = card.rarity || 'unknown';

  return (
    <button
      onClick={onPick}
      onMouseEnter={() => onHover(card)}
      onMouseLeave={() => onHover(null)}
      className="bg-gray-900 rounded-lg overflow-hidden shadow-xl 
        border-2 border-gray-700 hover:border-yellow-400 transition-all 
        hover:scale-105 hover:shadow-2xl group cursor-pointer relative
        focus:outline-none focus:ring-2 focus:ring-yellow-500"
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={card.fullName}
          className="w-full aspect-[2.5/3.5] object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full aspect-[2.5/3.5] bg-gray-900 flex items-center justify-center">
          <span className="text-gray-500 text-sm">No image</span>
        </div>
      )}
      {/* rarity indicator - bottom right */}
      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded font-mono">
        rarity: {rarityValue}
      </div>
    </button>
  );
}
