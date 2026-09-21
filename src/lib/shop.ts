export const SHOP = {
  name: "কর্ণফুলী সেলস সেন্টার",
  tagline: "গবাদি পশুর খাদ্য সরবরাহ",
  branch: "প্রধান শাখা",
  address: "পল্লি বিদ্যুৎ অফিসের পাশে, বুড়া মসজিদ রোড, আমুচিয়া, বোয়ালখালী, চট্টগ্রাম",
  phones: ["01821989717", "01811808294"],
  logo: `${import.meta.env.BASE_URL}brand/karnaphuli-mark.jpg`,
  printLogo: `${import.meta.env.BASE_URL}brand/karnaphuli-mark-mono.png`,
  /** আবহাওয়ার জন্য দোকানের অবস্থান (আমুচিয়া, বোয়ালখালী, চট্টগ্রাম)। */
  location: { lat: 22.38, lon: 91.93, label: "আমুচিয়া, বোয়ালখালী" },
} as const;

export type OwnerAccount = {
  id: string;
  name: string;
  phone: string;
};

/** মালিকের লগইন অ্যাকাউন্ট — দোকানের মোবাইল নম্বরগুলোই লগইন আইডি। */
export const OWNER_ACCOUNTS: OwnerAccount[] = [
  { id: "u-owner-1", name: "মো. জসিম উদ্দিন", phone: "01821989717" },
  { id: "u-owner-2", name: "মো. ফরিদুল ইসলাম", phone: "01811808294" },
];

/** প্রাথমিক (ফ্যাক্টরি) পাসওয়ার্ড — প্রথম লগইনে পরিবর্তন বাধ্যতামূলক। */
export const DEFAULT_OWNER_PASSWORD = "123456";

/** ক্রেতার প্রাথমিক (ফ্যাক্টরি) পাসওয়ার্ড — মালিক অনুমোদনের পর, প্রথম লগইনে পরিবর্তন বাধ্যতামূলক। */
export const DEFAULT_CUSTOMER_PASSWORD = "123456";
