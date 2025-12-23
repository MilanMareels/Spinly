export interface DiscogsImage {
  uri: string;
  type?: string;
  resource_url?: string;
}

export interface DiscogsArtist {
  name: string;
  id?: number;
  resource_url?: string;
}

export interface DiscogsLabel {
  name: string;
  catno?: string;
  id?: number;
}

export interface DiscogsTrack {
  position: string;
  title: string;
  duration: string;
}

export interface SearchResult {
  id: number;
  title: string;
  year?: string;
  thumb?: string;
  cover_image?: string;
  label?: string[];
  catno?: string;
  resource_url?: string;
  type?: string;
  labels?: DiscogsLabel[];
}

export interface ReleaseDetail {
  id: number;
  title: string;
  year?: string;
  released?: string;
  thumb?: string;
  cover_image?: string;
  images?: DiscogsImage[];
  artists?: DiscogsArtist[];
  labels?: DiscogsLabel[];
  genres?: string[];
  tracklist?: DiscogsTrack[];
  uri?: string;
  resource_url?: string;
  notes?: string;
  label?: string[];
  catno?: string;
}

export type CollectionItem = SearchResult | ReleaseDetail;

export interface PaginationData {
  page: number;
  pages: number;
  items: number;
  per_page: number;
}
