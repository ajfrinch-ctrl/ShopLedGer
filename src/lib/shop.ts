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

export type DemoAccount = {
  id: string;
  name: string;
  phone: string;
  password: string;
  role: "owner" | "salesman" | "customer";
  customerId?: string;
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: "u-owner-1",
    name: "মো. জসিম উদ্দিন",
    phone: "01821989717",
    password: "123456",
    role: "owner",
  },
  {
    id: "u-owner-2",
    name: "মো. ফরিদুল ইসলাম",
    phone: "01811808294",
    password: "123456",
    role: "owner",
  },
  {
    id: "u-sales-1",
    name: "রহিম উদ্দিন",
    phone: "01800000000",
    password: "123456",
    role: "salesman",
  },
  {
    id: "u-cust-1",
    name: "করিম মিয়া",
    phone: "01900000000",
    password: "123456",
    role: "customer",
    customerId: "c-1",
  },
];
