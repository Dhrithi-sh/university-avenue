export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ContentStatus = "draft" | "pending_review" | "changes_requested" | "published" | "rejected" | "archived";
export type ProfileRole = "contributor" | "admin";
export type ProfileStatus = "active" | "suspended";

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, RequiredInsert extends keyof Row, Relationships extends Relationship[] = []> = {
  Row: Row;
  Insert: Pick<Row, RequiredInsert> & Partial<Omit<Row, RequiredInsert>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type Timestamps = { created_at: string; updated_at: string };

type SectionRow = Timestamps & {
  id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
};

type AuthorRow = Timestamps & {
  id: string;
  slug: string;
  name: string;
  role_title: string;
  bio: string;
  photo_url: string | null;
  email: string | null;
  seo_description: string | null;
  is_public: boolean;
};

type ArticleRow = Timestamps & {
  id: string;
  slug: string;
  title: string;
  dek: string;
  excerpt: string | null;
  body: Json;
  published_at: string | null;
  read_time_minutes: number | null;
  image_url: string | null;
  image_alt: string | null;
  section_id: string;
  author_id: string | null;
  owner_profile_id: string | null;
  is_featured: boolean;
  sort_order: number;
  is_sample: boolean;
  status: ContentStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

type EventRow = Timestamps & {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  category: string;
  image_url: string | null;
  event_url: string | null;
  organizer: string | null;
  is_sample: boolean;
  status: ContentStatus;
};

type OpportunityRow = Timestamps & {
  id: string;
  slug: string;
  title: string;
  category: string;
  organization: string;
  description: string;
  opens_at: string | null;
  deadline: string | null;
  eligibility: string | null;
  location: string | null;
  mode: string | null;
  application_url: string | null;
  action_label: string;
  image_url: string | null;
  is_sample: boolean;
  status: ContentStatus;
};

type ProfileRow = Timestamps & {
  id: string;
  email: string | null;
  display_name: string;
  slug: string;
  bio: string;
  avatar_url: string | null;
  role: ProfileRole;
  status: ProfileStatus;
  author_id: string | null;
};

type ArticleReviewNoteRow = {
  id: string;
  article_id: string;
  reviewer_profile_id: string;
  decision: "changes_requested" | "rejected" | "published" | "archived";
  note: string | null;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      sections: Table<SectionRow, "slug" | "name">;
      authors: Table<AuthorRow, "slug" | "name">;
      profiles: Table<
        ProfileRow,
        "id" | "display_name" | "slug",
        [{ foreignKeyName: "profiles_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "authors"; referencedColumns: ["id"] }]
      >;
      article_review_notes: Table<ArticleReviewNoteRow, "article_id" | "reviewer_profile_id" | "decision">;
      articles: Table<
        ArticleRow,
        "slug" | "title" | "dek" | "section_id",
        [
          { foreignKeyName: "articles_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "authors"; referencedColumns: ["id"] },
          { foreignKeyName: "articles_section_id_fkey"; columns: ["section_id"]; isOneToOne: false; referencedRelation: "sections"; referencedColumns: ["id"] },
          { foreignKeyName: "articles_owner_profile_id_fkey"; columns: ["owner_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      >;
      events: Table<EventRow, "slug" | "title" | "event_date" | "category">;
      opportunities: Table<OpportunityRow, "slug" | "title" | "category" | "organization" | "description">;
    };
    Views: Record<string, never>;
    Functions: {
      submit_article_for_review: { Args: { target_article_id: string }; Returns: undefined };
      editorial_review_article: { Args: { target_article_id: string; decision: string; target_author_id?: string | null; reviewer_note?: string | null }; Returns: undefined };
      set_contributor_author: { Args: { target_profile_id: string; target_author_id: string | null }; Returns: undefined };
      delete_editorial_article: { Args: { target_article_id: string }; Returns: undefined };
      is_editorial_story_section: { Args: { target_section_id: string }; Returns: boolean };
    };
    Enums: { content_status: ContentStatus };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];
