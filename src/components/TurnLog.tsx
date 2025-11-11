import { PickLogEntry } from '../types';

interface TurnLogProps {
  log: PickLogEntry[];
  maxEntries?: number;
}

export function TurnLog({ log, maxEntries = 10 }: TurnLogProps) {
  const displayLog = log.slice(-maxEntries).reverse();

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-3">Recent Picks</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {displayLog.map((entry, idx) => (
          <div key={idx} className="text-sm text-gray-300 border-l-2 border-blue-500 pl-3 py-1">
            <span className="font-semibold text-blue-400">
              R{entry.round} T{entry.turn}:
            </span>{' '}
            Picked <span className="text-white font-semibold">{entry.picked.fullName}</span>{' '}
            ({entry.picked.color}).{' '}
            {entry.removedCounts > 0 && (
              <span className="text-gray-400">
                Removed {entry.removedCounts} from other packs.
              </span>
            )}
          </div>
        ))}
        {displayLog.length === 0 && (
          <p className="text-gray-500 text-sm">No picks yet</p>
        )}
      </div>
    </div>
  );
}

