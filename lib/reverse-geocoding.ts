export interface ReverseGeocodeResult {
  placeName: string;
  countryName: string;
  displayAddress?: string;
  source: "nominatim" | "photon" | "arcgis";
}

function firstNonEmpty(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

function placeFromAddress(address: Record<string, unknown>): string {
  return firstNonEmpty(
    address.hamlet,
    address.village,
    address.locality,
    address.suburb,
    address.town,
    address.neighbourhood,
    address.city,
    address.municipality,
    address.district,
    address.county,
    address.state,
  );
}

function placeFromPhoton(properties: Record<string, unknown>): string {
  return firstNonEmpty(
    properties.hamlet,
    properties.village,
    properties.locality,
    properties.suburb,
    properties.town,
    properties.city,
    properties.municipality,
    properties.county,
    properties.state,
    properties.name,
  );
}

function placeFromArcGIS(address: Record<string, unknown>): string {
  return firstNonEmpty(
    address.Village,
    address.Hamlet,
    address.Locality,
    address.Neighborhood,
    address.City,
    address.Municipality,
    address.Subregion,
    address.County,
    address.Region,
    address.Address,
  );
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&accept-language=ar`;
  const photonUrl = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`;
  const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${longitude},${latitude}&f=json&langCode=ARA`;

  const [nominatimResult, photonResult, arcgisResult] = await Promise.allSettled([
    fetch(nominatimUrl, {
      headers: { "Accept-Language": "ar" },
      signal: AbortSignal.timeout(5000),
    }).then((response) => (response.ok ? response.json() : null)),
    fetch(photonUrl, {
      headers: { "Accept-Language": "ar" },
      signal: AbortSignal.timeout(5000),
    }).then((response) => (response.ok ? response.json() : null)),
    fetch(arcgisUrl, { signal: AbortSignal.timeout(5000) }).then((response) =>
      response.ok ? response.json() : null,
    ),
  ]);

  const nominatim = nominatimResult.status === "fulfilled" ? nominatimResult.value : null;
  const photon = photonResult.status === "fulfilled" ? photonResult.value : null;
  const arcgis = arcgisResult.status === "fulfilled" ? arcgisResult.value : null;

  const nominatimAddress = nominatim?.address || {};
  const photonProperties = photon?.features?.[0]?.properties || {};
  const arcgisAddress = arcgis?.address || {};

  const candidates: ReverseGeocodeResult[] = [
    {
      placeName: placeFromAddress(nominatimAddress),
      countryName: firstNonEmpty(nominatimAddress.country),
      displayAddress: firstNonEmpty(nominatim?.display_name),
      source: "nominatim",
    },
    {
      placeName: placeFromPhoton(photonProperties),
      countryName: firstNonEmpty(photonProperties.country),
      displayAddress: firstNonEmpty(photonProperties.name, photonProperties.street, photonProperties.country),
      source: "photon",
    },
    {
      placeName: placeFromArcGIS(arcgisAddress),
      countryName: firstNonEmpty(arcgisAddress.Country),
      displayAddress: firstNonEmpty(arcgisAddress.Match_addr, arcgisAddress.Address),
      source: "arcgis",
    },
  ];

  return candidates.find((candidate) => candidate.placeName || candidate.countryName) || null;
}

export function formatReverseGeocodeFallback(): ReverseGeocodeResult {
  return {
    placeName: "موقع محدد على الخريطة",
    countryName: "",
    source: "nominatim",
  };
}
