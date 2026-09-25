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


