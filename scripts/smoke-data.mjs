import { shiftKey, todayKey } from "../src/lib/format.ts";

/**
 * নির্ধারিত ডেটাসেট — ব্রাউজার স্মোক টেস্টের জন্য।
 *
 * অ্যাপ এখন খালি খাতা দিয়ে শুরু হয় (কোনো ডেমো ডাটা নেই)। যে স্মোক টেস্ট
 * পণ্য/ক্রেতা/বিক্রির ওপর নির্ভর করে (pages-smoke, customer-receipts-smoke),
 * সেগুলো লগইনের পর এই ডেটাসেট localStorage-এ নিজেই লেখে — ঠিক যেভাবে
 * আসল ব্যবহারকারীর হিসাব থাকে। এই ডেটা শুধু টেস্টে ব্যবহৃত, অ্যাপে নয়।
 */
export function smokeDataset() {
  const today = todayKey();
  const d1 = shiftKey(-1);
  const d2 = shiftKey(-2);
  const d5 = shiftKey(-5);
  const d8 = shiftKey(-8);
  const d12 = shiftKey(-12);

  const products = [
    {
      id: "p-1",
      code: "NDN-001",
      name: "নন্দন ফ্যাটনিং পেলেট ৫০ কেজি",
      company: "নন্দন",
      unit: "বস্তা",
      purchasePrice: 2450,
      salePrice: 2750,
      openingStock: 48,
      minStock: 8,
      createdAt: d12,
    },
    {
      id: "p-2",
      code: "NDN-002",
      name: "নন্দন ডেইরি ফিড ৫০ কেজি",
      company: "নন্দন",
      unit: "বস্তা",
      purchasePrice: 2280,
      salePrice: 2580,
      openingStock: 36,
      minStock: 6,
      createdAt: d12,
    },
    {
      id: "p-3",
      code: "QTY-101",
      name: "কোয়ালিটি ব্রয়লার স্টার্টার ৫০ কেজি",
      company: "Quality",
      unit: "বস্তা",
      purchasePrice: 2520,
      salePrice: 2850,
      openingStock: 22,
      minStock: 5,
      createdAt: d12,
    },
    {
      id: "p-4",
      code: "QTY-102",
      name: "কোয়ালিটি লেয়ার ৫০ কেজি",
      company: "Quality",
      unit: "বস্তা",
      purchasePrice: 2380,
      salePrice: 2680,
      openingStock: 18,
      minStock: 5,
      createdAt: d12,
    },
    {
      id: "p-5",
      code: "GT-201",
      name: "ছাগল মোটাতাজা ২৫ কেজি",
      company: "লোকাল",
      unit: "বস্তা",
      purchasePrice: 1180,
      salePrice: 1380,
      openingStock: 30,
      minStock: 6,
      createdAt: d12,
    },
    {
      id: "p-6",
      code: "KH-301",
      name: "সরিষার খৈল ৪০ কেজি",
      company: "লোকাল",
      unit: "বস্তা",
      purchasePrice: 1520,
      salePrice: 1750,
      openingStock: 40,
      minStock: 10,
      createdAt: d12,
    },
    {
      id: "p-7",
      code: "VH-302",
      name: "গমের ভুসি ৪০ কেজি",
      company: "লোকাল",
      unit: "বস্তা",
      purchasePrice: 980,
      salePrice: 1180,
      openingStock: 55,
      minStock: 12,
      createdAt: d12,
    },
    {
      id: "p-8",
      code: "VH-303",
      name: "আটা ভুসি ৪০ কেজি",
      company: "লোকাল",
      unit: "বস্তা",
      purchasePrice: 920,
      salePrice: 1100,
      openingStock: 28,
      minStock: 8,
      createdAt: d12,
    },
    {
      id: "p-9",
      code: "SL-401",
      name: "চাট লবণ ১ কেজি",
      company: "ACI",
      unit: "কেজি",
      purchasePrice: 42,
      salePrice: 65,
      openingStock: 80,
      minStock: 15,
      createdAt: d12,
    },
    {
      id: "p-10",
      code: "VT-501",
      name: "ভিটামিন প্রিমিক্স ১ কেজি",
      company: "ACI",
      unit: "কেজি",
      purchasePrice: 320,
      salePrice: 450,
      openingStock: 12,
      minStock: 4,
      createdAt: d12,
    },
  ];

  const customers = [
    { id: "c-1", name: "করিম মিয়া", username: "korim01", phone: "01900000000", address: "পদুয়া, বোয়ালখালী", createdAt: d12 },
    { id: "c-2", name: "আবদুল মালেক", username: "malek01", phone: "01815551234", address: "আমুচিয়া, বোয়ালখালী", createdAt: d12 },
    { id: "c-3", name: "নুরুল ইসলাম", username: "nurul01", phone: "01816667890", address: "কাঞ্চনা, বোয়ালখালী", createdAt: d8 },
    { id: "c-4", name: "ফাতেমা বেগম", username: "fatema01", phone: "01817774321", address: "শাকপুরা", createdAt: d8 },
    { id: "c-5", name: "রফিক উদ্দিন", username: "rafik01", phone: "01818889012", address: "বুড়া মসজিদ রোড", createdAt: d5 },
  ];

  const item = (p, qty) => ({
    productId: p.id,
    productName: p.name,
    unit: p.unit,
    quantity: qty,
    salePrice: p.salePrice,
    purchasePrice: p.purchasePrice,
    total: p.salePrice * qty,
  });

  const sale = (id, bill, date, customer, lines, paidRatio) => {
    const items = lines.map((l) => item(l.p, l.q));
    const subtotal = items.reduce((a, i) => a + i.total, 0);
    return {
      id,
      billNo: bill,
      date,
      items,
      subtotal,
      discount: 0,
      total: subtotal,
      paid: Math.round(subtotal * paidRatio),
      customerId: customer?.id,
      customerName: customer?.name ?? "নগদ ক্রেতা",
      createdBy: "মো. জসিম উদ্দিন",
      createdAt: `${date}T10:30:00`,
    };
  };

  const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10] = products;
  const [c1, c2, c3, c4, c5] = customers;

  const sales = [
    sale("s-1", "বিল-১০৪২", d12, c1, [{ p: p1, q: 4 }, { p: p6, q: 2 }], 0.4),
    sale("s-2", "বিল-১০৪৩", d8, c2, [{ p: p2, q: 3 }, { p: p7, q: 5 }], 0.5),
    sale("s-3", "বিল-১০৪৪", d5, c3, [{ p: p3, q: 2 }, { p: p9, q: 10 }], 1),
    sale("s-4", "বিল-১০৪৫", d2, c4, [{ p: p5, q: 4 }, { p: p8, q: 2 }], 0),
    sale("s-5", "বিল-১০৪৬", d1, c1, [{ p: p1, q: 2 }, { p: p10, q: 2 }], 0.3),
    sale("s-6", "বিল-১০৪৭", today, c2, [{ p: p2, q: 2 }, { p: p6, q: 3 }], 0.6),
    sale("s-7", "বিল-১০৪৮", today, null, [{ p: p7, q: 4 }, { p: p9, q: 6 }], 1),
    sale("s-8", "বিল-১০৪৯", today, c5, [{ p: p4, q: 1 }, { p: p1, q: 1 }], 0),
  ];

  // c-1-এর একটা জমা থাকা আবশ্যক: ক্রেতার খাতায় জমা-সারি «রসিদ দেখুন» বাটন
  // disabled-এ রেন্ডার হয় — customer-receipts-smoke সেটা যাচাই করে
  // (আদায় রসিদ না)।
  const collections = [
    {
      id: "cl-1",
      date: d5,
      partyId: c1.id,
      partyName: c1.name,
      kind: "customer",
      amount: 3000,
      method: "নগদ",
      createdAt: `${d5}T15:00:00`,
    },
  ];

  // পণ্য/ক্রেতা/বিক্রি + c-1-এর জমা — স্মোক টেস্ট যা যা যাচাই করে (বিক্রয়/স্টক
  // রিপোর্ট, রসিদ, ক্রেতার খাতা), তা এই তিনটির উপরই। বাকি খাতা খালি থাকতে পারে।
  return {
    products,
    customers,
    sales,
    purchases: [],
    expenses: [],
    collections,
    orders: [],
    adjustments: [],
  };
}
