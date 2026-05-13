/**
 * Calculate how long ago a timestamp was, with live recalculation.
 * Always calculates from raw timestamp vs current time, never stale.
 * 
 * @param timestamp - ISO timestamp string or null
 * @returns formatted time string (e.g. "2h 14m ago", "Just now", "--")
 */
export function getTimeAgo(timestamp: string | null): string {
  if (!timestamp) return '--';
  
  try {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (mins === 0) return `${hours}h ago`;
    return `${hours}h ${mins}m ago`;
  } catch (error) {
    console.error('Error parsing timestamp:', error);
    return '--';
  }
}
