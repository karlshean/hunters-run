import { useEffect, useState } from 'react';

export function useFlags() {
  const [flags, setFlags] = useState<{ photoFlowEnabled: boolean } | null>(null);
  
  useEffect(() => {
    fetch('/api/flags')
      .then(r => r.json())
      .then(setFlags)
      .catch(() => setFlags({ photoFlowEnabled: false }));
  }, []);
  
  return flags;
}