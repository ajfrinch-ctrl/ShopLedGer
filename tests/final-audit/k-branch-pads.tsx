/* অডিট পার্ট K — শাখা ও ব্যবস্থাপক ব্যবস্থাপনা (BranchPads, শুধু মালিক) */
import {React as _React, db, check, section, renderAt, settle, text, find, all, clickEl, setElValue, submitForm, seedBase, ownerUser, managerUser, customerUser} from './harness'

const { default: BranchPads } = await import('../../src/pages/BranchPads')
const { hashPassword } = await import('../../src/stores/authStore')

const routes: Array<[string, unknown]> = [['/branch-pads', BranchPads]]
const nfc = (s: string) => s.normalize('NFC')
const hasText = (needle: string) => nfc(text()).includes(nfc(needle))
const btnExact = (label: string) =>
  all<HTMLButtonElement>('button').find((b) => nfc((b.textContent || '').trim()) === nfc(label))
const btnStarts = (label: string) =>
  all<HTMLButtonElement>('button').find((b) => nfc((b.textContent || '').trim()).startsWith(nfc(label)))
const btnTitle = (title: string) =>
  all<HTMLButtonElement>('button').find((b) => nfc(b.getAttribute('title') || '') === nfc(title))
const inputByPlaceholder = (p: string) => all<HTMLInputElement>(`input[placeholder="${p}"]`)[0]
const chip = (name: string) =>
  all<HTMLButtonElement>('button').find((b) => nfc((b.textContent || '').trim()).startsWith(nfc(name)) && nfc(b.textContent || '').includes('কর্মী'))

/** আইডি তালিকার একটি সারি (ইউজারনেম দিয়ে) */
const rowFor = (token: string) =>
  all<HTMLElement>('div')
    .filter((d) => nfc(d.textContent || '').includes('আইডি: ' + token) && !!d.querySelector('button[title="আইডি স্থায়ীভাবে মুছে ফেলুন"]'))
    .pop()

/** সেই সারির ভিতরের বোতাম (title বা ঠিক লেখা দিয়ে) */
const rowBtn = (token: string, match: { title?: string; label?: string }) => {
  const row = rowFor(token)
  if (!row) return undefined
  const btns = [...row.querySelectorAll<HTMLButtonElement>('button')]
  return match.title
    ? btns.find((b) => nfc(b.getAttribute('title') || '') === nfc(match.title!))
    : btns.find((b) => nfc((b.textContent || '').trim()) === nfc(match.label!))
}

/** নির্বাচিত শাখায় গিয়ে আইডি-ব্যবস্থাপনা ট্যাব খোলা (আগে চিপ, পরে ট্যাব) */
async function openStaffTab(branch = 'প্রধান শাখা') {
  const c = chip(branch)
  if (c) await clickEl(c)
  await settle(240)
  await clickEl(btnStarts('শাখা ব্যবস্থাপক ও পাসওয়ার্ড')!)
  await settle(260)
}

export async function runBranchPadsAudit() {
  await seedBase()

  /* ════════ ১) পেজ, শাখা-চিপ ও ফর্ম ════════ */
  section('BranchPads — শিরোনাম, শাখা নির্বাচন ও প্যাড ফর্ম')
  await renderAt('/branch-pads', routes, { ...ownerUser })
  await settle(300)
  check('পেজের শিরোনাম ও ব্যাখ্যা দেখা যায়', hasText('শাখা ও ব্যবস্থাপক ব্যবস্থাপনা (মালিক অংশ)') && hasText('নতুন শাখা খোলা'), text().slice(0, 200))
  check('শাখা নির্বাচনের চিপে নাম ও কর্মী সংখ্যা দেখায়', hasText('শাখা নির্বাচন করুন') && hasText('প্রধান শাখা') && hasText('কর্মী'), text().slice(0, 260))
  check('"নতুন শাখা" বোতাম আছে', !!btnExact('নতুন শাখা'))
  check('তিনটি ট্যাব আছে (তথ্য/আইডি/ব্যাখ্যা)', !!btnStarts('শাখার তথ্য ও প্যাড') && !!btnStarts('শাখা ব্যবস্থাপক ও পাসওয়ার্ড') && !!btnStarts('নতুন শাখা খুললে কী হবে?'))
  check('[ফাইন্ডিং] পেজ খুলতেই কোনো শাখা নির্বাচিত থাকে না — ফর্ম খালি, আইডি সংখ্যা (0)', hasText('নতুন শাখা তৈরি') && hasText('(0)'), text().slice(0, 200))
  await clickEl(chip('প্রধান শাখা')!)
  await settle(240)
  check('চিপ চাপলে সেই শাখার নাম ফর্মে বসে', inputByPlaceholder('যেমন: আগ্রাবাদ শাখা, চকবাজার শাখা')?.value === 'প্রধান শাখা', inputByPlaceholder('যেমন: আগ্রাবাদ শাখা, চকবাজার শাখা')?.value || '—')
  check('ঠিকানা ও ফোনও চিপ অনুযায়ী বসে', inputByPlaceholder('যেমন: দোকান নং ১২, রোড ৩, চকবাজার')?.value === 'বুড়া মসজিদ রোড, আমুচিয়া, বোয়ালখালী, চট্টগ্রাম' && !!inputByPlaceholder('যেমন: 01821989717, 01811808294')?.value)
  check('লোগো আপলোড ঘর আছে (ছবি ফাইল)', !!find('input[type="file"]'))
  check('সক্রিয়/নিষ্ক্রিয় চেকবক্স আছে', !!find('input[type="checkbox"]'))
  check('চিপে কর্মীর সংখ্যা সঠিক (প্রধান শাখা 2 কর্মী)', !!chip('প্রধান শাখা') && nfc(chip('প্রধান শাখা')!.textContent || '').includes('2 কর্মী'))

  /* ════════ ২) নতুন শাখা যোগ ও সংরক্ষণ ════════ */
  section('BranchPads — নতুন শাখা যোগ, নাম বাধ্যতামূলক ও সংরক্ষণ')
  await clickEl(btnExact('নতুন শাখা')!)
  await settle(220)
  check('খালি ফর্মে গেলে "নতুন শাখা তৈরি" লেখা আসে', hasText('নতুন শাখা তৈরি') && (inputByPlaceholder('যেমন: আগ্রাবাদ শাখা, চকবাজার শাখা')?.value || '') === '', text().slice(0, 200))
  const branchesBefore = (await db.branches.toArray()).length
  await submitForm([...all('form')].at(-1) as HTMLFormElement)
  await settle(260)
  check('নাম ছাড়া শাখা সংরক্ষণ হয় না', (await db.branches.toArray()).length === branchesBefore && hasText('শাখার নাম অবশ্যই দিতে হবে'), text().slice(0, 200))
  await setElValue(inputByPlaceholder('যেমন: আগ্রাবাদ শাখা, চকবাজার শাখা'), 'আগ্রাবাদ শাখা')
  await setElValue(inputByPlaceholder('যেমন: দোকান নং ১২, রোড ৩, চকবাজার'), 'দোকান নং ১২, আগ্রাবাদ')
  await setElValue(inputByPlaceholder('যেমন: 01821989717, 01811808294'), '01855555555')
  await submitForm([...all('form')].at(-1) as HTMLFormElement)
  await settle(320)
  const created = (await db.branches.toArray()).find((b) => b.name === 'আগ্রাবাদ শাখা')
  check('নতুন শাখা সংরক্ষিত হয় (স্বয়ংক্রিয় শাখা আইডি B…)', !!created && /^B\d{6,}$/.test(created.id), created?.id || '—')
  check('ঠিকানা ও ফোনও সংরক্ষিত হয়', created?.address === 'দোকান নং ১২, আগ্রাবাদ' && created?.phone === '01855555555')
  check('নতুন শাখায় প্রতিষ্ঠানের নাম আগে থেকেই বসে', created?.organization === 'কর্ণফুলী সেলস সেন্টার', created?.organization || '—')
  check('সংরক্ষণের সফল বার্তা দেখায়', hasText('শাখার তথ্য ও প্যাড সফলভাবে সংরক্ষিত হয়েছে!'), text().slice(0, 240))
  await renderAt('/branch-pads', routes, { ...ownerUser })
  await settle(300)
  check('নতুন শাখা চিপ হিসেবে তালিকায় আসে (0 কর্মী)', !!chip('আগ্রাবাদ শাখা') && nfc(chip('আগ্রাবাদ শাখা')!.textContent || '').includes('0 কর্মী'), text().slice(0, 260))
  await clickEl(chip('আগ্রাবাদ শাখা')!)
  await settle(240)
  check('নতুন শাখার তথ্য ফর্মে ফিরে আসে (সংরক্ষিত)', inputByPlaceholder('যেমন: দোকান নং ১২, রোড ৩, চকবাজার')?.value === 'দোকান নং ১২, আগ্রাবাদ')

  /* ════════ ৩) আইডি ব্যবস্থাপনা ট্যাব ════════ */
  section('BranchPads — আইডি তালিকা, ফিল্টার ও খালি শাখা')
  await clickEl(btnStarts('শাখা ব্যবস্থাপক ও পাসওয়ার্ড')!)
  await settle(260)
  check('নতুন শাখায় কোনো আইডি নেই বলে দেখায়', hasText('এই শাখার জন্য এখনো কোনো আইডি খোলা হয়নি'), text().slice(0, 300))
  await clickEl(chip('প্রধান শাখা')!)
  await settle(260)
  check('প্রধান শাখা বেছে নিলে তার আইডি তালিকা আসে', hasText('"প্রধান শাখা"-এর আইডি তালিকা') && hasText('ব্যবস্থাপক রহিম') && hasText('ব্যবস্থাপক'), text().slice(0, 300))
  check('আইডি ও মোবাইল নম্বর দেখায়', hasText('manager1') && hasText('01800000000') && hasText('salesman1'))
  check('ফিল্টারে ভূমিকা অনুযায়ী ছাঁকা যায় (সব/ব্যবস্থাপক/সেলস ম্যান)', !!btnExact('সব') && !!btnExact('শাখা ব্যবস্থাপক') && !!btnExact('সেলস ম্যান'))
  await clickEl(btnExact('সেলস ম্যান')!)
  await settle(240)
  check('"সেলস ম্যান" ফিল্টারে শুধু সেলস ম্যান থাকে (ব্যবস্থাপক বাদ)', hasText('আইডি তালিকা (1টি)') && !hasText('ব্যবস্থাপক রহিম'), text().slice(0, 260))
  await clickEl(btnExact('শাখা ব্যবস্থাপক')!)
  await settle(240)
  check('"শাখা ব্যবস্থাপক" ফিল্টারে শুধু ব্যবস্থাপক থাকে', hasText('আইডি তালিকা (1টি)') && hasText('ব্যবস্থাপক রহিম') && !hasText('সেলস ম্যান কামাল'), text().slice(0, 260))
  await clickEl(btnExact('সব')!)
  await settle(240)
  check('"সব" চাপলে আবার সব আইডি ফেরে (2টি)', hasText('আইডি তালিকা (2টি)') && hasText('ব্যবস্থাপক রহিম') && hasText('সেলস ম্যান কামাল'), text().slice(0, 260))

  /* ════════ ৪) নতুন আইডি খোলা ════════ */
  section('BranchPads — নতুন ব্যবস্থাপক/সেলস ম্যান আইডি')
  const sparkle = btnTitle('স্বয়ংক্রিয় ইউজারনেম')
  check('নতুন আইডির ফর্মে ইউজারনেম প্রস্তাবের (Sparkles) বোতাম আছে', !!sparkle, text().slice(0, 160))
  await clickEl(sparkle!)
  await settle(240)
  const usernameInput = inputByPlaceholder('যেমন: aghrabad_manager')
  check('শাখার নাম থেকে স্বয়ংক্রিয় ইউজারনেম বসে', /^[a-z0-9_]+$/.test(usernameInput?.value || ''), usernameInput?.value || '—')
  await setElValue(inputByPlaceholder('যেমন: মামুন হাসান'), 'নতুন ব্যবস্থাপক দুলাল')
  await setElValue(inputByPlaceholder('যেমন: aghrabad_manager'), 'dulal_manager')
  await setElValue(inputByPlaceholder('দিলে ফোন দিয়েও লগইন ও WhatsApp যোগাযোগ হবে'), '01877777777')
  await setElValue(inputByPlaceholder('ডিফল্ট: 123456'), '123456')
  await submitForm([...all('form')].at(-1) as HTMLFormElement)
  await settle(340)
  const newStaff = (await db.users.toArray()).find((u) => u.username === 'dulal_manager')
  check('নতুন ব্যবস্থাপক আইডি তৈরি হয় (নির্বাচিত শাখায়)', !!newStaff && newStaff.role === 'manager' && (newStaff.branch_ids || []).includes('branch-1'), JSON.stringify({ id: newStaff?.id, b: newStaff?.branch_ids }))
  check('প্রাথমিক পাসওয়ার্ড হ্যাশ হয়ে জমা হয় ও ১ম লগইনে বদলাতে হয়', newStaff?.password_hash === await hashPassword('123456') && newStaff?.must_change_password === true)
  check('সফল বার্তায় আইডি ও পাসওয়ার্ড দেখায়', hasText('আইডি খোলা হয়েছে') && hasText('dulal_manager'), text().slice(0, 400))
  check('WhatsApp পাঠানোর লিংক তৈরি হয়', !!all<HTMLAnchorElement>('a[href^="https://wa.me/"]').length)
  check('তালিকায় নতুন আইডি যোগ হয় (3টি)', hasText('আইডি তালিকা (3টি)') && hasText('নতুন ব্যবস্থাপক দুলাল'), text().slice(0, 300))
  /* একই ইউজারনেম আবার */
  await setElValue(inputByPlaceholder('যেমন: মামুন হাসান'), 'ডুপ্লিকেট দুলাল')
  await setElValue(inputByPlaceholder('যেমন: aghrabad_manager'), 'dulal_manager')
  await submitForm([...all('form')].at(-1) as HTMLFormElement)
  await settle(300)
  check('একই ইউজারনেমে দ্বিতীয় আইডি খোলা যায় না', (await db.users.toArray()).filter((u) => u.username === 'dulal_manager').length === 1, text().slice(0, 300))

  /* ════════ ৫) সম্পাদনা, আনলক, নিষ্ক্রিয়, রিসেট ════════ */
  section('BranchPads — আইডি সম্পাদনা, আনলক, নিষ্ক্রিয় ও পাসওয়ার্ড রিসেট')
  await renderAt('/branch-pads', routes, { ...ownerUser })
  await settle(300)
  await openStaffTab()
  check('প্রতিটি আইডি সারিতে সম্পাদনা ও মুছে ফেলার বোতাম আছে',
    !!rowBtn('manager1', { title: 'নাম/ইউজারনেম/মোবাইল/শাখা সম্পাদনা' }) && !!rowBtn('manager1', { title: 'আইডি স্থায়ীভাবে মুছে ফেলুন' }) && !!rowBtn('salesman1', { title: 'আইডি স্থায়ীভাবে মুছে ফেলুন' }))
  await clickEl(rowBtn('manager1', { title: 'নাম/ইউজারনেম/মোবাইল/শাখা সম্পাদনা' })!)
  await settle(240)
  check('সম্পাদনা প্যানেল খোলে', hasText('আইডি সম্পাদনা') && hasText('শাখা (একাধিক বেছে নিতে পারেন)'), text().slice(0, 260))
  const editGrid = inputByPlaceholder('017XXXXXXXX')?.closest('.grid') as HTMLElement | null
  const editInputs = editGrid ? [...editGrid.querySelectorAll<HTMLInputElement>('input')] : []
  check('সম্পাদনা প্যানেলে বর্তমান নাম/ইউজারনেম/মোবাইল বসানো আছে',
    editInputs[0]?.value === 'ব্যবস্থাপক রহিম' && editInputs[1]?.value === 'manager1' && editInputs[2]?.value === '01800000000',
    editInputs.map((i) => i.value).join(' | ') || '—')
  await setElValue(editInputs[0], 'ব্যবস্থাপক রহিম (হালনাগাদ)')
  await clickEl(btnExact('সংরক্ষণ করুন')!)
  await settle(360)
  check('সম্পাদনা সংরক্ষিত হয়, বার্তা দেখায় ও তালিকা সাথে সাথে হালনাগাদ হয়',
    hasText('আইডির তথ্য হালনাগাদ হয়েছে') && (await db.users.get('manager-1'))?.name === 'ব্যবস্থাপক রহিম (হালনাগাদ)' && hasText('ব্যবস্থাপক রহিম (হালনাগাদ)'),
    String((await db.users.get('manager-1'))?.name))
  await db.users.update('manager-1', { name: 'ব্যবস্থাপক রহিম' } as never)
  /* ভুল ইউজারনেম ধরা পড়ে */
  await clickEl(rowBtn('manager1', { title: 'নাম/ইউজারনেম/মোবাইল/শাখা সম্পাদনা' })!)
  await settle(240)
  const grid2 = inputByPlaceholder('017XXXXXXXX')?.closest('.grid') as HTMLElement | null
  const inputs2 = grid2 ? [...grid2.querySelectorAll<HTMLInputElement>('input')] : []
  await setElValue(inputs2[1], 'salesman1')
  await clickEl(btnExact('সংরক্ষণ করুন')!)
  await settle(320)
  check('অন্য আইডির ইউজারনেম বসাতে গেলে আটকায়', hasText('ইউজারনেম') && (await db.users.get('manager-1'))?.username === 'manager1', text().slice(0, 260))
  await clickEl(btnExact('বাতিল')!)
  await settle(200)
  /* আনলক */
  await db.users.update('manager-1', { failed_login_attempts: 5 } as never)
  await renderAt('/branch-pads', routes, { ...ownerUser })
  await settle(300)
  await openStaffTab()
  check('৫ বার ভুলে লক হওয়া আইডি সারিতে "লক করা" ও "আনলক" দেখায়', !!rowBtn('manager1', { label: 'আনলক' }) && nfc(rowFor('manager1')?.textContent || '').includes('লক করা'), text().slice(0, 300))
  await clickEl(rowBtn('manager1', { label: 'আনলক' })!)
  await settle(320)
  check('এক চাপে লক খোলে (ভুলের গণনা শূন্য) ও বার্তা আসে', ((await db.users.get('manager-1'))?.failed_login_attempts || 0) === 0 && hasText('সফলভাবে আনলক করা হয়েছে'), text().slice(0, 240))
  /* নিষ্ক্রিয় করা */
  await clickEl(rowBtn('manager1', { title: 'নিষ্ক্রিয় করুন' })!)
  await settle(340)
  check('আইডি সাময়িক নিষ্ক্রিয় করা যায় (তালিকায় লক দেখায়)',
    (await db.users.get('manager-1'))?.is_active === false && hasText('সাময়িক নিষ্ক্রিয় (লক) করা হয়েছে') && nfc(rowFor('manager1')?.textContent || '').includes('লক করা'),
    text().slice(-240))
  /* আবার সক্রিয় */
  await clickEl(rowBtn('manager1', { title: 'সক্রিয় করুন' })!)
  await settle(340)
  check('আবার সক্রিয় করা যায়', (await db.users.get('manager-1'))?.is_active === true && hasText('সক্রিয় করা হয়েছে'), text().slice(-200))
  /* রিসেট */
  await clickEl(rowBtn('manager1', { label: 'রিসেট' })!)
  await settle(260)
  check('রিসেট প্যানেল খোলে ও স্বয়ংক্রিয় আনলকের কথা লেখা', hasText('এর পাসওয়ার্ড রিসেট') && hasText('স্বয়ংক্রিয়ভাবে আনলক হবে'), text().slice(0, 280))
  await setElValue(inputByPlaceholder('কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড'), 'manager999')
  await clickEl(btnExact('পাসওয়ার্ড সেট করুন')!)
  await settle(340)
  check('নিজের পছন্দের পাসওয়ার্ড সেট করা যায়', (await db.users.get('manager-1'))?.password_hash === await hashPassword('manager999'))
  await clickEl(btnExact('ডিফল্ট "123456" পাসওয়ার্ড দিন')!)
  await settle(340)
  const afterDefault = await db.users.get('manager-1')
  check('ডিফল্ট 123456 পাসওয়ার্ড রিসেট হয় (আইডি স্বয়ংক্রিয় আনলক)', afterDefault?.password_hash === await hashPassword('123456') && afterDefault?.must_change_password === true && afterDefault?.is_active === true)
  check('রিসেটের সফল বার্তা + WhatsApp পাঠানোর লিংক আসে', hasText('পাসওয়ার্ড সফলভাবে রিসেট হয়েছে!') && !!all<HTMLAnchorElement>('a[href^="https://wa.me/88"]').length, text().slice(0, 320))

  /* ════════ ৬) আইডি মুছে ফেলা ও ব্যাখ্যা ট্যাব ════════ */
  section('BranchPads — আইডি স্থায়ীভাবে মুছে ফেলা ও ব্যাখ্যা ট্যাব')
  await clickEl(rowBtn('dulal_manager', { title: 'আইডি স্থায়ীভাবে মুছে ফেলুন' })!)
  await settle(260)
  check('মুছে ফেলার আগে নিশ্চিতকরণ ও সতর্কবার্তা দেখায়', hasText('আইডি মুছে ফেলবেন?') && hasText('স্থায়ীভাবে মুছে যাবে'), text().slice(0, 300))
  const doomed = (await db.users.toArray()).find((u) => u.username === 'dulal_manager')!
  await clickEl(btnExact('হ্যাঁ, মুছে ফেলুন')!)
  await settle(360)
  check('আইডি সত্যিই মুছে যায় ও বার্তা দেখায়', !(await db.users.get(doomed.id)) && hasText('স্থায়ীভাবে মুছে ফেলা হয়েছে'), text().slice(0, 260))
  check('তালিকা থেকে সারিও সরে যায় (2টি)', hasText('আইডি তালিকা (2টি)'), text().slice(0, 200))
  /* আইডি ট্যাবের নীতিমালা-প্যানেল */
  await clickEl(btnStarts('শাখা ব্যবস্থাপক ও পাসওয়ার্ড')!)
  await settle(260)
  check('আইডি ট্যাবে ইউজারনেম/একাধিক শাখা/লক-আনলক নীতিমালা লেখা',
    hasText('আইডি (ইউজারনেম) ও পাসওয়ার্ড নীতি') && hasText('ইউজারনেম দিয়ে লগইন') && hasText('একাধিক শাখা') && hasText('এক ক্লিকে আনলক'),
    text().slice(0, 420))
  /* ব্যাখ্যা ট্যাব */
  await clickEl(btnStarts('নতুন শাখা খুললে কী হবে?')!)
  await settle(260)
  check('ব্যাখ্যা ট্যাবে চারটি প্রভাব ও নিরাপত্তা নীতি লেখা',
    hasText('নতুন শাখা খুললে সিস্টেমে কী কী ঘটবে?') && hasText('১. শাখাভিত্তিক সম্পূর্ণ আলাদা গণনা') && hasText('২. শুধু নিজের শাখার দেখতে পারবে') && hasText('৩. ক্রয়-বিক্রয়ের শাখার প্যাড ও রসিদ') && hasText('৪. পৃথক ও সমন্বিত কেন্দ্রীয় রিপোর্ট') && hasText('নিরাপত্তা নীতি ও পার্স/পাসওয়ার্ড রিকভারি'),
    text().slice(0, 460))
  check('[ফাইন্ডিং] গাইডে "ডিফল্ট পাসওয়ার্ড (১২৩৪৫৬)" বাংলা অঙ্কে লেখা, প্রকৃত ডিফল্ট 123456',
    hasText('সহজ ডিফল্ট পাসওয়ার্ড (১২৩৪৫৬)') && !hasText('সহজ ডিফল্ট পাসওয়ার্ড (123456)'))

  /* ════════ ৭) অনুমতির সীমানা ════════ */
  section('BranchPads — শুধু মালিকের পেজ')
  await renderAt('/branch-pads', routes, { ...managerUser })
  await settle(260)
  check('ব্যবস্থাপক ঢুকতে পারে না', hasText('শাখা ও ব্যবস্থাপক প্যানেল কেবল দোকানের মালিক ব্যবহার করতে পারবেন।') && !hasText('শাখা নির্বাচন করুন'), text().slice(0, 160))
  await renderAt('/branch-pads', routes, { ...customerUser })
  await settle(260)
  check('ক্রেতা ঢুকতে পারে না', hasText('কেবল দোকানের মালিক ব্যবহার করতে পারবেন।'))
}
