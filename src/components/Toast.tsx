interface ToastProps {
  message: string;
  visible: boolean;
}

export function Toast({ message, visible }: ToastProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 
      rounded-lg shadow-lg border border-gray-700 animate-fade-in">
      {message}
    </div>
  );
}

