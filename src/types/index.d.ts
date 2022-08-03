type SFMLabAuthCredentials = {
  login: string | unknown;
  password: string | unknown;
}

type SFMLabAuthResponse = {
  cookies: string;
  userId: number;
  username: string;
  avatar: string;
}

type SFMLabUser = {
  id: number;
  username: string;
  avatar: string;
  created_at: number;
}

type SFMLabModel = {
  id: number;
  title: string;
  author: string;
  thumbnail: string;
  extension: string;
  description: string;
  mature_content: boolean;
  created_at: number;
  updated_at: number;
  images: string[];
  links: ModelLink[];
  tags: string[];
  commentaries: Comment[];
  file_size: string;
}


type ModelLink = {
  url: string;
  title: string;
  file_size: string;
}

type SFMLabSimpleModel = {
  id: number;
  title: string;
  thumbnail: string;
  extension: string;
  mature_content: boolean;
}

type Comment = {
  name: string;
  avatar: string;
  message: string;
  date: number;
}

type SFMLabResponse = {
  models: SFMLabModel[];
  pagination: {
    page: number;
    totalPages: number;
  },
  parser?: cheerio.Root;
}

type SFMLabParams = {
  category?: number;
  order_by?: string;
  search_text?: string;
  page?: number;
  adult_content?: boolean;
  furry_content?: boolean;
  general_tag?: number[];
  property_tag?: number[];
  character_tag?: number[];
}

type SmutbaseParams = {
  search_text?: string;
  page?: number;
  order_by?: string;
  general_tag?: number[];
  property_tag?: number[];
  character_tag?: number[];
  software_tag?: number[];
}

type Open3DLabParams = SmutbaseParams

type SFMLabAvailableSorting = 'created' | '-created' | 'published_date' | '-published_date' | 'last_file_date' | '-last_file_date' | 'views' | '-views' | 'popularity' | '-popularity'

type SFMLabQuery = {
  category?: number;
  order?: SFMLabAvailableSorting;
  search?: string;
  page?: number;
  adultContent?: boolean;
  furryContent?: boolean;
  tags?: number[];
  universe?: number[];
  character?: number[];
}

type SmutbaseQuery = {
  order?: SFMLabAvailableSorting;
  search?: string;
  page?: number;
  tags?: number[];
  universe?: number[];
  character?: number[];
  software?: number[];
}

type Open3DLabQuery = SmutbaseQuery

type SelectOption = {
  text: string;
  value: string;
}

type SFMLabFilters = {
  categories: SelectOption[];
  characters: SelectOption[];
  software: SelectOption[];
  tags: SelectOption[];
  universes: SelectOption[];
}
