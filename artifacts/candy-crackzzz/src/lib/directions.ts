export function formatAddressForMaps(address: string): string {
  return address.trim().replace(/\s+/g, ' ');
}

export function hasUsableAddress(address: string): boolean {
  return formatAddressForMaps(address).length > 4;
}

export function buildGoogleMapsDirectionsUrl(originAddress: string, destinationAddress: string): string {
  const origin = encodeURIComponent(formatAddressForMaps(originAddress));
  const destination = encodeURIComponent(formatAddressForMaps(destinationAddress));
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;
}