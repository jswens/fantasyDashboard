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
  
  if (percentage > 100) return 'bg-sleeper-red';
  if (percentage > 90) return 'bg-sleeper-yellow';
  return 'bg-sleeper-teal';
}

export function getCapStatusText(capUsed: number, maxCap: number): string {
  const remaining = maxCap - capUsed;
  
  if (remaining < 0) {
    return `Over by ${formatIntAsCurrency(Math.abs(remaining))}`;
  }
  
  return `${formatIntAsCurrency(remaining)} remaining`;
}
