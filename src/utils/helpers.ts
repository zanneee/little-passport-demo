export function setResult(setter: (v: any) => void, value: any, type: string, setDisplayOrder: (v: string[]) => void) {
  setter(value);
  setDisplayOrder([type]);
}

export function setError(setter: (v: any) => void, error: any, type: string, setDisplayOrder: (v: string[]) => void, description?: string) {
  setter({
    method: type,
    description,
    error: error.message || error || 'Unknown error occurred'
  });
  setDisplayOrder([type]);
}

export function resetDisplayOrder(setDisplayOrder: (v: string[]) => void) {
  setDisplayOrder([]);
} 