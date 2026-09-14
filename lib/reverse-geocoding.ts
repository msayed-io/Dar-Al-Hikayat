export interface ReverseGeocodeResult {
  placeName: string;
  countryName: string;
  displayAddress?: string;
  source: "nominatim" | "bigdatacloud" | "arcgis" | "photon";
}

function firstNonEmpty(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

/**
 * استخراج أدق وأوضح اسم محلي للموقع (مسجد، معلم، عزبة، قرية، نجع، حي، شارع)
 * بحيث يعبر عن المكان المحدد نفسه بدقة متناهية وليس مجرد اسم المدينة الكبرى
 */
function placeFromAddress(address: Record<string, unknown>): string {
  return firstNonEmpty(
    // معالم ونقاط اهتمام ومساجد ومبانٍ
    address.amenity,
    address.place_of_worship,
    address.mosque,
    address.building,
    address.shop,
    address.tourism,
    address.historic,
    address.office,
    address.leisure,
    // قرى وعزب ونجوع وأحياء وشوارع
    address.hamlet,
    address.isolated_dwelling,
    address.village,
    address.neighbourhood,
    address.quarter,
    address.suburb,
    address.residential,
    address.road,
    address.pedestrian,
    // مراكز ومدن ومناطق
    address.locality,
    address.town,
    address.city_district,
    address.district,
    address.borough,
    address.city,
    address.municipality,
    address.county,
    address.state_district,
    address.state,
  );
}

function placeFromBigDataCloud(data: Record<string, unknown>): string {
  const localityInfo = (data.localityInfo as Record<string, unknown>) || {};
  const informative = Array.isArray(localityInfo.informative) ? localityInfo.informative : [];
  const administrative = Array.isArray(localityInfo.administrative) ? localityInfo.administrative : [];

  // البحث عن أصغر وحدة جغرافية (قرية، حي، عزبة، شارع)
  for (const item of [...informative, ...administrative]) {
    if (item && typeof item === "object" && typeof item.name === "string" && item.name.trim()) {
      if (item.order >= 6 || item.adminLevel >= 8 || ["village", "hamlet", "suburb", "neighbourhood"].includes(item.description)) {
        return item.name.trim();
      }
    }
  }

  return firstNonEmpty(
    data.locality,
    data.city,
    data.principalSubdivision,
  );
}

function placeFromArcGIS(address: Record<string, unknown>): string {
  return firstNonEmpty(
    address.PlaceName,
    address.PointOfInterest,
    address.Address,
    address.Street,
    address.Village,
    address.Hamlet,
    address.Neighborhood,
    address.Locality,
    address.Subregion,
    address.City,
    address.District,
    address.Municipality,
    address.County,
    address.Region,
  );
}

function placeFromPhoton(properties: Record<string, unknown>): string {
  return firstNonEmpty(
    properties.name,
    properties.street,
    properties.hamlet,
    properties.village,
    properties.neighbourhood,
    properties.suburb,
    properties.locality,
    properties.town,
    properties.district,
    properties.city,
    properties.municipality,
    properties.county,
    properties.state,
  );
}

export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1&namedetails=1&accept-language=ar`;
  const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ar`;
  const arcgisUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${longitude},${latitude}&f=json&langCode=ARA`;
  const photonUrl = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}`;

  const [nominatimResult, bdcResult, arcgisResult, photonResult] = await Promise.allSettled([
    fetch(nominatimUrl, {
      headers: { "Accept-Language": "ar" },
      signal: AbortSignal.timeout(4500),
    }).then((response) => (response.ok ? response.json() : null)),
    fetch(bdcUrl, {
      signal: AbortSignal.timeout(4500),
    }).then((response) => (response.ok ? response.json() : null)),
    fetch(arcgisUrl, { signal: AbortSignal.timeout(4500) }).then((response) =>
      response.ok ? response.json() : null,
    ),
    fetch(photonUrl, {
      headers: { "Accept-Language": "ar" },
      signal: AbortSignal.timeout(4500),
    }).then((response) => (response.ok ? response.json() : null)),
  ]);

  const nominatim = nominatimResult.status === "fulfilled" ? nominatimResult.value : null;
  const bdc = bdcResult.status === "fulfilled" ? bdcResult.value : null;
  const arcgis = arcgisResult.status === "fulfilled" ? arcgisResult.value : null;
  const photon = photonResult.status === "fulfilled" ? photonResult.value : null;

  const nominatimAddress = (nominatim?.address as Record<string, unknown>) || {};
  const arcgisAddress = (arcgis?.address as Record<string, unknown>) || {};
  const photonProperties = (photon?.features?.[0]?.properties as Record<string, unknown>) || {};

  // استخراج أدق اسم مباشر للمكان المحدد
  const nominatimSpecificName = firstNonEmpty(
    nominatim?.name,
    placeFromAddress(nominatimAddress),
  );

  const bdcSpecificName = bdc ? placeFromBigDataCloud(bdc as Record<string, unknown>) : "";
  const arcgisSpecificName = placeFromArcGIS(arcgisAddress);
  const photonSpecificName = placeFromPhoton(photonProperties);

  const candidates: ReverseGeocodeResult[] = [
    {
      placeName: nominatimSpecificName,
      countryName: firstNonEmpty(nominatimAddress.country),
      displayAddress: firstNonEmpty(nominatim?.display_name),
      source: "nominatim",
    },
    {
      placeName: bdcSpecificName,
      countryName: firstNonEmpty(bdc?.countryName),
      displayAddress: firstNonEmpty(bdc?.locality, bdc?.city, bdc?.countryName),
      source: "bigdatacloud",
    },
    {
      placeName: arcgisSpecificName,
      countryName: firstNonEmpty(arcgisAddress.Country),
      displayAddress: firstNonEmpty(arcgisAddress.Match_addr, arcgisAddress.Address),
      source: "arcgis",
    },
    {
      placeName: photonSpecificName,
      countryName: firstNonEmpty(photonProperties.country),
      displayAddress: firstNonEmpty(photonProperties.name, photonProperties.street, photonProperties.country),
      source: "photon",
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
