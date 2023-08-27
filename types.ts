export interface Address {
  zip: string;
  country: string;
  streetAddress: string;
  city: string;
  congressionalDistrict: string;
  streetAddress2: string;
  state: string;
}

export interface Suggestion {
  input: string[];
  contexts: { [key: string]: any; };
}

export interface Result {
  registrationStatus: string;
}

export interface Embedded {
  results: Result[];
}

export interface Self {
  href: string;
  templated: boolean;
}

export interface Page {
  size: number;
  totalElements: number;
  totalPages: number;
  number: number;
  maxAllowedRecords: number;
}

export interface Links {
  self: Self;
}

export interface Root {
  _embedded: Embedded;
}

export interface CompanyListForEntityInformation {
  CompanyID: number;
  CompanyName: string;
  RegistrationStatus: string;
  UpdateDate: string;
  Error: string;
}