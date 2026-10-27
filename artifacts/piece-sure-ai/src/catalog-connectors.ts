/**
 * Extension point for future catalogue integrations.
 *
 * No provider is connected in this first version. Implementations must use a
 * provider-approved API or an export the user is authorized to import. Do not
 * add scraping, access-control bypasses, or undocumented endpoints here.
 */
export type CatalogProviderId =
  | 'bosch-aftermarket'
  | 'valeo-service'
  | 'oscaro'
  | 'distriauto';

export type CatalogSearchRequest = {
  query: string;
  vehicleId?: string;
  referenceType?: 'oe' | 'aftermarket';
};

export type CatalogSearchResult = {
  providerId: CatalogProviderId;
  designation: string;
  oeReference?: string;
  aftermarketBrand?: string;
  aftermarketReference?: string;
  sourceReference: string;
  sourceUrl?: string;
};

export interface AuthorizedCatalogConnector {
  readonly providerId: CatalogProviderId;
  authorize(): Promise<void>;
  search(request: CatalogSearchRequest): Promise<readonly CatalogSearchResult[]>;
}

export type CatalogProviderInfo = {
  id: CatalogProviderId;
  name: string;
  accessPolicy: 'Accès officiel ou export explicitement autorisé';
};

export const CATALOG_PROVIDERS: readonly CatalogProviderInfo[] = [
  { id: 'bosch-aftermarket', name: 'Bosch Aftermarket', accessPolicy: 'Accès officiel ou export explicitement autorisé' },
  { id: 'valeo-service', name: 'Valeo Service', accessPolicy: 'Accès officiel ou export explicitement autorisé' },
  { id: 'oscaro', name: 'Oscaro', accessPolicy: 'Accès officiel ou export explicitement autorisé' },
  { id: 'distriauto', name: 'Distriauto', accessPolicy: 'Accès officiel ou export explicitement autorisé' },
];
