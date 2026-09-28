export type Story = {
  slug: string;
  title: string;
  dek: string;
  section: string;
  date: string;
  read: string;
  image: string;
  imageAlt: string;
  author: string;
  authorSlug: string;
  body: string[];
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ContributorProfile = {
  slug: string;
  name: string;
  role: string;
  bio: string;
  photo: string | null;
  seoDescription: string | null;
};

export type Event = {
  day: string;
  month: string;
  date: string;
  title: string;
  detail: string;
  type: string;
  time: string;
  location: string | null;
  organizer: string | null;
  description: string | null;
  eventUrl: string | null;
  imageUrl: string | null;
  isSample: boolean;
};

export type Opportunity = {
  label: string;
  title: string;
  detail: string;
  action: string;
  actionHref: string;
  actionLabel: string;
  category: string;
  organization: string;
  deadlineDay: string;
  deadlineMonth: string;
  deadline: string;
  eligibility: string;
  location: string;
  isSample: boolean;
};

export type Section = { id: string; slug: string; name: string };
