/**
 * County parcel GIS endpoint registry.
 * Maps county FIPS codes to their public ArcGIS REST parcel boundary endpoints.
 * Add new counties as needed — format:
 *   "FIPS": { url: "full_layer_url", type: "FeatureServer"|"MapServer", county: "Name", state: "ST" }
 *
 * These are publicly published by county/city governments — no API keys needed.
 * All endpoints support the standard ArcGIS REST query with geometry intersection.
 */
const COUNTY_PARCELS = {
  // North Carolina
  '37183': { url: 'https://maps.wakegov.com/arcgis/rest/services/Property/Parcels/MapServer/0', type: 'MapServer', county: 'Wake County', state: 'NC' },
  '37063': { url: 'https://services2.arcgis.com/G5vR3cOjh6g2Ed8E/arcgis/rest/services/Parcels_NEW/FeatureServer/0', type: 'FeatureServer', county: 'Durham County', state: 'NC' },
  '37087': { url: 'https://maps.haywoodcountync.gov/arcgis/rest/services/Land_Records/Open_Data/MapServer/3', type: 'MapServer', county: 'Haywood County', state: 'NC' },

  // Minnesota
  '27053': { url: 'https://gis.hennepin.us/arcgis/rest/services/Maps/PROPERTY/MapServer/0', type: 'MapServer', county: 'Hennepin County', state: 'MN' },
  '27141': { url: 'https://gis.co.sherburne.mn.us/arcgis4/rest/services/OpenData/Parcels/FeatureServer/0', type: 'FeatureServer', county: 'Sherburne County', state: 'MN' },

  // Washington
  '53033': { url: 'https://gismaps.kingcounty.gov/arcgis/rest/services/Property/KingCo_Parcels/MapServer/0', type: 'MapServer', county: 'King County', state: 'WA' },

  // Colorado
  '08107': { url: 'https://services6.arcgis.com/VxFGFP4XeHMTNgVs/arcgis/rest/services/Parcels/FeatureServer/0', type: 'FeatureServer', county: 'Routt County', state: 'CO' },

  // Pennsylvania
  '42101': { url: 'https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/PWD_PARCELS/FeatureServer/0', type: 'FeatureServer', county: 'Philadelphia County', state: 'PA' },

  // Maryland
  '24510': { url: 'https://services.arcgis.com/njFNhDsUCentVYJW/ArcGIS/rest/services/Parcels/FeatureServer/0', type: 'FeatureServer', county: 'Baltimore City', state: 'MD' },
  '24003': { url: 'https://gis.aacounty.org/arcgis/rest/services/OpenData/Planning_OpenData/MapServer/34', type: 'MapServer', county: 'Anne Arundel County', state: 'MD' },

  // Illinois
  '17113': { url: 'https://www.mcgisweb.org/mcgc/rest/services/OpenData/OpenData/MapServer/2', type: 'MapServer', county: 'McLean County', state: 'IL' },

  // California
  '06077': { url: 'https://services2.arcgis.com/GQhSReJEO6f7tsvy/arcgis/rest/services/Parcels/FeatureServer/0', type: 'FeatureServer', county: 'San Joaquin County', state: 'CA' },

  // Missouri
  '29189': { url: 'https://maps.stlouisco.com/hosting/rest/services/Maps/AGS_Parcels/MapServer/0', type: 'MapServer', county: 'St. Louis County', state: 'MO' },

  // Wisconsin
  '55059': { url: 'https://mapping.kenoshacountywi.gov/server/rest/services/Interactive_Mapping_2022/Cadastral2/MapServer/25', type: 'MapServer', county: 'Kenosha County', state: 'WI' },

  // Arizona
  '04013': { url: 'https://services7.arcgis.com/CRH3aZydoRH1XVod/arcgis/rest/services/Parcels/FeatureServer/0', type: 'FeatureServer', county: 'Maricopa County', state: 'AZ' },
};

/**
 * Statewide parcel GIS endpoint registry.
 * Maps 2-digit state FIPS codes to public ArcGIS REST statewide parcel endpoints.
 * Checked before county-level endpoints (broader coverage, same accuracy).
 */
const STATE_PARCELS = {
  // Utah — AGRC statewide parcels (updated monthly)
  '49': { url: 'https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/UtahStatewideParcels/FeatureServer/0', state: 'UT' },
  // Washington — WA Geospatial Portal statewide parcels (updated annually)
  '53': { url: 'https://services.arcgis.com/jsIt88o09Q0r1j8h/arcgis/rest/services/Current_Parcels/FeatureServer/0', state: 'WA' },
  // Alaska — DNR combined parcels
  '02': { url: 'https://services1.arcgis.com/7HDiw78fcUiM2BWn/arcgis/rest/services/AK_Parcels/FeatureServer/0', state: 'AK' },
  // Florida — FDOR statewide cadastral (10.8M parcels, may be slow)
  '12': { url: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0', state: 'FL' },
};

module.exports = { COUNTY_PARCELS, STATE_PARCELS };
