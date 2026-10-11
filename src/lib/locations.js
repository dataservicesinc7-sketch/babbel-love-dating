// Curated major countries + major cities – free, offline, works on slow phones.
// Easy to extend later. Focus on Cameroon pilot + diaspora + global reach.

export const COUNTRIES = [
  { code: 'CM', name: 'Cameroon' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'SN', name: 'Senegal' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'BE', name: 'Belgium' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'PT', name: 'Portugal' },
  { code: 'BR', name: 'Brazil' },
  { code: 'IN', name: 'India' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AU', name: 'Australia' },
  { code: 'CN', name: 'China' },
  { code: 'JP', name: 'Japan' },
  { code: 'OTHER', name: 'Other / Not listed' },
]

export const CITIES_BY_COUNTRY = {
  CM: ['Douala', 'Yaoundé', 'Buea', 'Bamenda', 'Limbe', 'Kribi', 'Bafoussam', 'Garoua', 'Maroua', 'Ngaoundéré'],
  NG: ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Calabar', 'Benin City'],
  GH: ['Accra', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast'],
  KE: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru'],
  ZA: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth'],
  CI: ['Abidjan', 'Yamoussoukro', 'Bouaké'],
  SN: ['Dakar', 'Thiès', 'Saint-Louis'],
  FR: ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes'],
  GB: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh'],
  US: ['New York', 'Los Angeles', 'Houston', 'Chicago', 'Atlanta', 'Washington DC', 'Dallas', 'Miami'],
  CA: ['Toronto', 'Montreal', 'Vancouver', 'Ottawa', 'Calgary'],
  DE: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne'],
  BE: ['Brussels', 'Antwerp', 'Ghent'],
  CH: ['Zurich', 'Geneva', 'Lausanne', 'Bern'],
  IT: ['Rome', 'Milan', 'Naples', 'Turin'],
  ES: ['Madrid', 'Barcelona', 'Valencia'],
  PT: ['Lisbon', 'Porto'],
  BR: ['São Paulo', 'Rio de Janeiro', 'Brasília'],
  IN: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'],
  AE: ['Dubai', 'Abu Dhabi', 'Sharjah'],
  SA: ['Riyadh', 'Jeddah', 'Dammam'],
  AU: ['Sydney', 'Melbourne', 'Brisbane'],
  CN: ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen'],
  JP: ['Tokyo', 'Osaka', 'Kyoto'],
  OTHER: [],
}

export function getCitiesForCountry(countryCode) {
  return CITIES_BY_COUNTRY[countryCode] || []
}

export function getCountryName(code) {
  const c = COUNTRIES.find(x => x.code === code)
  return c ? c.name : code || ''
}

export function formatLocation(city, country) {
  if (!city && !country) return '—'
  const countryName = getCountryName(country)
  if (city && countryName) return `${city}, ${countryName}`
  return city || countryName || '—'
}
