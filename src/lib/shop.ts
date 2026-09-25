const defaults = {
  name: "কর্ণফুলী সেলস সেন্টার",
  tagline: "গবাদি পশুর খাদ্য সরবরাহ",
  address: "পল্লি বিদ্যুৎ অফিসের পাশে, বুড়া মসজিদ রোড, আমুচিয়া, বোয়ালখালী, চট্টগ্রাম",
  phones: ["01821989717", "01811808294"],
  logo: `${import.meta.env.BASE_URL}brand/karnaphuli-mark.jpg`,
};
const STORAGE_KEY = "shopledger-branch-info-v1";
type BranchInfo = { name: string; tagline: string; address: string; phones: string[]; logo: string };
export function getBranchInfo(): BranchInfo {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  } catch {
    return defaults;
  }
}
export function saveBranchInfo(info: BranchInfo) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  window.dispatchEvent(new Event("shopledger-branch-info"));
}

export const SHOP = {
  get name() { return getBranchInfo().name; },
  get tagline() { return getBranchInfo().tagline; },
  get address() { return getBranchInfo().address; },
  get phones() { return getBranchInfo().phones; },
  get logo() { return getBranchInfo().logo; },
  branch: "প্রধান শাখা",
  printLogo: `${import.meta.env.BASE_URL}brand/karnaphuli-mark-mono.png`,
  location: { lat: 22.38, lon: 91.93, label: "আমুচিয়া, বোয়ালখালী" },
} as const;
