import { shiftKey, todayKey } from "./format";
import type {
  Collection,
  Customer,
  Expense,
  Order,
  Product,
  Purchase,
  Sale,
} from "./types";

export function createSeed() {
  const today = todayKey();
  const d1 = shiftKey(-1);
  const d2 = shiftKey(-2);
  const d5 = shiftKey(-5);
  const d8 = shiftKey(-8);
  const d12 = shiftKey(-12);

  const products: Product[] = [
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

  const customers: Customer[] = [
    {
      id: "c-1",
      name: "করিম মিয়া",
      phone: "01900000000",
      address: "পদুয়া, বোয়ালখালী",
      createdAt: d12,
    },
    {
      id: "c-2",
      name: "আবদুল মালেক",
      phone: "01815551234",
      address: "আমুচিয়া, বোয়ালখালী",
      createdAt: d12,
    },
    {
      id: "c-3",
      name: "নুরুল ইসলাম",
      phone: "01816667890",
      address: "কাঞ্চনা, বোয়ালখালী",
      createdAt: d8,
    },
    {
      id: "c-4",
      name: "ফাতেমা বেগম",
      phone: "01817774321",
      address: "শাকপুরা",
      createdAt: d8,
    },
    {
      id: "c-5",
      name: "রফিক উদ্দিন",
      phone: "01818889012",
      address: "বুড়া মসজিদ রোড",
      createdAt: d5,
    },
  ];

  const item = (
    p: Product,
    qty: number,
  ): Sale["items"][number] => ({
    productId: p.id,
    productName: p.name,
    unit: p.unit,
    quantity: qty,
    salePrice: p.salePrice,
    purchasePrice: p.purchasePrice,
    total: p.salePrice * qty,
  });

  function sale(
    id: string,
    bill: string,
    date: string,
    customer: Customer | null,
    lines: { p: Product; q: number }[],
    paidRatio: number,
    by = "মো. জসিম উদ্দিন",
  ): Sale {
    const items = lines.map((l) => item(l.p, l.q));
    const subtotal = items.reduce((a, i) => a + i.total, 0);
    const total = subtotal;
    const paid = Math.round(total * paidRatio);
    return {
      id,
      billNo: bill,
      date,
      items,
      subtotal,
      discount: 0,
      total,
      paid,
      customerId: customer?.id,
      customerName: customer?.name ?? "নগদ ক্রেতা",
      createdBy: by,
      createdAt: `${date}T10:30:00`,
    };
  }

  const [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10] = products;
  const [c1, c2, c3, c4, c5] = customers;

  const sales: Sale[] = [
    sale("s-1", "বিল-১০৪২", d12, c1, [{ p: p1, q: 4 }, { p: p6, q: 2 }], 0.4),
    sale("s-2", "বিল-১০৪৩", d8, c2, [{ p: p2, q: 3 }, { p: p7, q: 5 }], 0.5),
    sale("s-3", "বিল-১০৪৪", d5, c3, [{ p: p3, q: 2 }, { p: p9, q: 10 }], 1),
    sale("s-4", "বিল-১০৪৫", d2, c4, [{ p: p5, q: 4 }, { p: p8, q: 2 }], 0),
    sale("s-5", "বিল-১০৪৬", d1, c1, [{ p: p1, q: 2 }, { p: p10, q: 2 }], 0.3),
    sale("s-6", "বিল-১০৪৭", today, c2, [{ p: p2, q: 2 }, { p: p6, q: 3 }], 0.6),
    sale("s-7", "বিল-১০৪৮", today, null, [{ p: p7, q: 4 }, { p: p9, q: 6 }], 1),
    sale("s-8", "বিল-১০৪৯", today, c5, [{ p: p4, q: 1 }, { p: p1, q: 1 }], 0),
  ];

  const purchases: Purchase[] = [
    {
      id: "pu-1",
      date: d8,
      productId: p1.id,
      productName: p1.name,
      quantity: 20,
      unit: p1.unit,
      purchasePrice: p1.purchasePrice,
      total: 20 * p1.purchasePrice,
      supplier: "নন্দন ফিড মিলস",
      paid: 20 * p1.purchasePrice,
      createdAt: d8,
    },
    {
      id: "pu-2",
      date: d5,
      productId: p3.id,
      productName: p3.name,
      quantity: 12,
      unit: p3.unit,
      purchasePrice: p3.purchasePrice,
      total: 12 * p3.purchasePrice,
      supplier: "Quality Feeds Ltd",
      paid: 0,
      createdAt: d5,
    },
    {
      id: "pu-3",
      date: d1,
      productId: p6.id,
      productName: p6.name,
      quantity: 15,
      unit: p6.unit,
      purchasePrice: p6.purchasePrice,
      total: 15 * p6.purchasePrice,
      supplier: "স্থানীয় খৈল মিল",
      paid: Math.round(15 * p6.purchasePrice * 0.5),
      createdAt: d1,
    },
  ];

  const expenses: Expense[] = [
    {
      id: "e-1",
      date: d5,
      category: "ভাড়া",
      amount: 8000,
      kind: "shop",
      note: "দোকান ভাড়া",
      createdAt: d5,
    },
    {
      id: "e-2",
      date: d2,
      category: "বিদ্যুৎ",
      amount: 1450,
      kind: "shop",
      createdAt: d2,
    },
    {
      id: "e-3",
      date: today,
      category: "যাতায়াত",
      amount: 420,
      kind: "shop",
      note: "মাল আনা",
      createdAt: today,
    },
    {
      id: "e-4",
      date: d1,
      category: "মালিকের উত্তোলন",
      amount: 5000,
      kind: "owner",
      createdAt: d1,
    },
  ];

  const collections: Collection[] = [
    {
      id: "col-1",
      date: d5,
      partyId: "c-1",
      partyName: "করিম মিয়া",
      kind: "customer",
      amount: 4000,
      method: "নগদ",
      createdAt: d5,
    },
    {
      id: "col-2",
      date: d1,
      partyId: "c-2",
      partyName: "আবদুল মালেক",
      kind: "customer",
      amount: 3000,
      method: "বিকাশ",
      createdAt: d1,
    },
    {
      id: "col-3",
      date: today,
      partyId: "c-1",
      partyName: "করিম মিয়া",
      kind: "customer",
      amount: 2500,
      method: "নগদ",
      createdAt: today,
    },
  ];

  const orders: Order[] = [
    {
      id: "o-1",
      customerId: "c-1",
      customerName: "করিম মিয়া",
      items: [
        {
          productId: p1.id,
          productName: p1.name,
          unit: p1.unit,
          quantity: 3,
          salePrice: p1.salePrice,
          total: 3 * p1.salePrice,
        },
        {
          productId: p7.id,
          productName: p7.name,
          unit: p7.unit,
          quantity: 2,
          salePrice: p7.salePrice,
          total: 2 * p7.salePrice,
        },
      ],
      total: 3 * p1.salePrice + 2 * p7.salePrice,
      status: "pending",
      note: "কাল সকালে লাগবে",
      createdAt: `${today}T08:12:00`,
      updatedAt: `${today}T08:12:00`,
    },
    {
      id: "o-2",
      customerId: "c-3",
      customerName: "নুরুল ইসলাম",
      items: [
        {
          productId: p2.id,
          productName: p2.name,
          unit: p2.unit,
          quantity: 2,
          salePrice: p2.salePrice,
          total: 2 * p2.salePrice,
        },
      ],
      total: 2 * p2.salePrice,
      status: "accepted",
      createdAt: `${d1}T16:40:00`,
      updatedAt: `${d1}T17:05:00`,
    },
  ];

  return {
    products,
    customers,
    sales,
    purchases,
    expenses,
    collections,
    orders,
    adjustments: [] as { id: string; date: string; productId: string; productName: string; quantity: number; reason: string; createdAt: string }[],
    billSeq: 1050,
  };
}
