// Currency conversion functions from the Python application
export function convertCurrencyToInt(currencyStr: string | null): number {
  if (currencyStr === null || currencyStr === undefined) {
    return 0;
  }
  const cleanStr = currencyStr.replace(/[$,]/g, '');
  return parseInt(cleanStr, 10) || 0;
}

export function formatIntAsCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getCapStatusColor(capUsed: number, maxCap: number): string {
  const percentage = (capUsed / maxCap) * 100;
  
  if (percentage > 100) return 'bg-red-500';
  if (percentage > 90) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function getCapStatusText(capUsed: number, maxCap: number): string {
  const remaining = maxCap - capUsed;
  
  if (remaining < 0) {
    return `Over by ${formatIntAsCurrency(Math.abs(remaining))}`;
  }
  
  return `${formatIntAsCurrency(remaining)} remaining`;
}
