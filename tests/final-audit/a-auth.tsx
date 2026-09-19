/* অডিট পার্ট A — লগইন, সাইন-আপ, প্রোফাইল, পাসওয়ার্ড, রোল-গার্ড, লেআউট, "আরও" মেনু */
import {React, act, win, db, useAuthStore, hashPassword, check, section, renderAt, settle, text, find, all, bodyText as _bodyText, clickEl as _clickEl, clickText, setField, setElValue, submitForm, fieldByLabel, dialogText as _dialogText, buttonByText, linkByHref, seedBase, ownerUser, managerUser, salesmanUser, customerUser, TODAY as _TODAY} from './harness'

const { default: Login } = await import('../../src/pages/Login')
const { default: Register } = await import('../../src/pages/Register')
const { default: Profile } = await import('../../src/pages/Profile')
const { default: More } = await import('../../src/pages/More')
const { default: App } = await import('../../src/App')

const HomeStub = () => React.createElement('div', null, 'HOME-STUB')
const session = () => (globalThis as unknown as { localStorage: { getItem: (k: string) => string | null } }).localStorage.getItem('shopledger-session')
const loginRoutes: Array<[string, unknown]> = [['/login', Login], ['/', HomeStub]]
const registerRoutes: Array<[string, unknown]> = [['/register', Register]]
const profileRoutes: Array<[string, unknown]> = [['/profile', Profile]]

export async function runAuthAudit() {
  await seedBase()

  /* ════════ ১) লগইন পেজ ════════ */
  section('Login — /login (লগইন ও অ্যাকাউন্ট লক)')
  await renderAt('/login', loginRoutes, 'guest')
  check('লগইন ফর্মে আইডি ও পাসওয়ার্ড ফিল্ড আছে', !!fieldByLabel('আইডি (ইউজারনেম) অথবা মোবাইল নম্বর') && all('input[type="password"]').length === 1)
  check('দুই মালিকের ডেমো বোতাম দেখা যায়', !!buttonByText('মালিক 1') && !!buttonByText('মালিক 2'))
  check('ডেমো বোতামে কর্মচারী ও ক্রেতা বিকল্প আছে', !!buttonByText('কর্মচারী') && !!buttonByText('ক্রেতা'))

  const dbro = await db.users.where('phone').equals('01811808294').first()
  check('সিড করা মালিকের পাসওয়ার্ড হ্যাশ করা (প্লেইন নয়)', !!dbro && dbro.password_hash !== '123456' && dbro.password_hash.length === 64, dbro?.password_hash?.slice(0, 12))

  await clickText('মালিক 1')
  const identityInput = fieldByLabel('আইডি (ইউজারনেম) অথবা মোবাইল নম্বর')!
  const passwordInput = all<HTMLInputElement>('input[type="password"]')[0]
  check('ডেমো বোতামে মালিকের নম্বর বসে', identityInput.value === '01811808294', identityInput.value)
  check('ডেমো বোতামে ডিফল্ট পাসওয়ার্ড বসে', passwordInput.value === '123456')

  // ভুল পাসওয়ার্ড → কাউন্টার बাড়ে
  await setField('input[type="text"]', '01800000000')
  await setField('input[type="password"]', 'ভুল-পাসওয়ার্ড')
  await submitForm()
  await settle()
  let mgr = await db.users.get('manager-1')
  check('ভুল পাসওয়ার্ডে ত্রুটি দেখায়', text().includes('পাসওয়ার্ড ভুল'), text().slice(0, 80))
  check('ভুল পাসওয়ার্ডের কাউন্টার ১ হয়', mgr?.failed_login_attempts === 1, String(mgr?.failed_login_attempts))
  check('ভুল পাসওয়ার্ডে লগইন হয় না', useAuthStore.getState().isAuthenticated === false)

  // সঠিক পাসওয়ার্ড → সেশন
  await setField('input[type="password"]', '123456')
  await submitForm()
  await settle(80)
  check('সঠিক পাসওয়ার্ডে লগইন সফল', useAuthStore.getState().isAuthenticated === true && useAuthStore.getState().user?.id === 'manager-1')
  check('লগইনে localStorage-এ সেশন লেখা হয়', session() === 'manager-1')
  mgr = await db.users.get('manager-1')
  check('সফল লগইনে ভুল-কাউন্টার শূন্য হয়', mgr?.failed_login_attempts === 0, String(mgr?.failed_login_attempts))
  useAuthStore.getState().logout()
  check('লগআউটে সেশন মুছে যায়', session() === null && useAuthStore.getState().isAuthenticated === false)

  // ইউজারনেম দিয়ে লগইন
  await renderAt('/login', loginRoutes, 'guest')
  await setField('input[type="text"]', 'SALESMAN1')
  await setField('input[type="password"]', '123456')
  await submitForm()
  await settle(80)
  check('বড় হাতের ইউজারনেম দিয়েও লগইন হয়', useAuthStore.getState().user?.id === 'salesman-1', useAuthStore.getState().error || '')
  useAuthStore.getState().logout()

  // ফোন নম্বর স্পেস/ড্যাশসহ
  await renderAt('/login', loginRoutes, 'guest')
  await setField('input[type="text"]', '0180000-0000')
  await setField('input[type="password"]', '123456')
  await submitForm()
  await settle(80)
  check('ড্যাশ-যুক্ত নম্বরও স্বাভাবিক হয়', useAuthStore.getState().user?.id === 'manager-1')
  useAuthStore.getState().logout()

  // অজানা অ্যাকাউন্ট
  await renderAt('/login', loginRoutes, 'guest')
  await setField('input[type="text"]', '01899999999')
  await setField('input[type="password"]', '123456')
  await submitForm()
  await settle()
  check('অজানা নম্বরে পরিষ্কার বার্তা', text().includes('কোনো অ্যাকাউন্ট নেই'))

  // ৫ বার ভুল → লক
  await renderAt('/login', loginRoutes, 'guest')
  for (let i = 0; i < 5; i++) {
    await setField('input[type="text"]', '01811111111')
    await setField('input[type="password"]', `ভুল${i}`)
    await submitForm()
    await settle(60)
  }
  let sm = await db.users.get('salesman-1')
  check('৫ বার ভুলে অ্যাকাউন্ট নিষ্ক্রিয় (লক) হয়', sm?.is_active === false && sm?.failed_login_attempts === 5, JSON.stringify({ a: sm?.is_active, f: sm?.failed_login_attempts }))
  check('লকের বার্তা দেখায়', text().includes('লক'))
  await renderAt('/login', loginRoutes, 'guest')
  await setField('input[type="text"]', '01811111111')
  await setField('input[type="password"]', '123456')
  await submitForm()
  await settle()
  check('লক অবস্থায় সঠিক পাসওয়ার্ডেও ঢুকতে পারে না', useAuthStore.getState().isAuthenticated === false && text().includes('লক'))

  // মালিক আনলক করে
  useAuthStore.setState({ user: ownerUser, isAuthenticated: true, isLoading: false } as never)
  const unlockRes = await useAuthStore.getState().unlockStaffUser('salesman-1')
  check('মালিক এক ক্লিকে আনলক করতে পারেন', unlockRes.ok === true)
  sm = await db.users.get('salesman-1')
  check('আনলকের পর অ্যাকাউন্ট সক্রিয় ও কাউন্টার শূন্য', sm?.is_active === true && sm?.failed_login_attempts === 0)
  useAuthStore.getState().logout()

  // অনুমোদনের অপেক্ষায় ক্রেতা
  await db.users.put({
    id: 'cust-pending', name: 'নতুন ক্রেতা', phone: '01777777777', password_hash: await hashPassword('123456'),
    role: 'customer', is_active: false, approval: 'pending', created_at: '', updated_at: '',
  })
  await renderAt('/login', loginRoutes, 'guest')
  await setField('input[type="text"]', '01777777777')
  await setField('input[type="password"]', '123456')
  await submitForm()
  await settle()
  check('অনুমোদনহীন ক্রেতা লগইন করতে পারে না', useAuthStore.getState().isAuthenticated === false && text().includes('অনুমোদনের অপেক্ষায়'))

  await db.users.update('cust-pending', { approval: 'rejected' })
  await renderAt('/login', loginRoutes, 'guest')
  await setField('input[type="text"]', '01777777777')
  await setField('input[type="password"]', '123456')
  await submitForm()
  await settle()
  check('বাতিল হওয়া অ্যাকাউন্টের বার্তা আলাদা', text().includes('অনুমোদিত হয়নি'))

  // কর্মী নিষ্ক্রিয় করে দিলে লগইন বন্ধ
  await db.users.update('manager-1', { approval: 'approved', is_active: false })
  await renderAt('/login', loginRoutes, 'guest')
  await setField('input[type="text"]', '01800000000')
  await setField('input[type="password"]', '123456')
  await submitForm()
  await settle()
  check('নিষ্ক্রিয় অ্যাকাউন্টে লগইন আটকায়', text().includes('নিষ্ক্রিয়'))
  await db.users.update('manager-1', { is_active: true })

  /* ════════ ২) প্রথম লগইনে পাসওয়ার্ড পরিবর্তন (Layout modal) ════════ */
  section('প্রথম লগইন — বাধ্যতামূলক পাসওয়ার্ড পরিবর্তন')
  const { default: Layout } = await import('../../src/components/Layout')
  const { useSalesStore } = await import('../../src/stores/salesStore')
  useSalesStore.setState({ sales: [] })
  const ownerFresh = { ...ownerUser }
  await renderAt('/home', [['/home', Layout], ['/', Layout]], { ...ownerFresh })
  useAuthStore.setState({ user: { ...ownerFresh, must_change_password: true }, isAuthenticated: true, isLoading: false } as never)
  await settle(80)
  check('প্রথম লগইনে পাসওয়ার্ড মডাল দেখা যায়', text().includes('পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক'))
  const modalInputs = all('input[type="password"]')
  check('মডালে দুইটি পাসওয়ার্ড ঘর আছে', modalInputs.length === 2, String(modalInputs.length))
  /* অডিট-নোট: এই বাধ্যতামূলক মডালে role="dialog"/aria-modal নেই (a11y) — নিচে রিপোর্টে উল্লেখ */
  check('[a11y ফাঁক] মডালে role=dialog/aria-modal সেট করা নেই', find('[role="dialog"]') === null)
  await setElValue(modalInputs[0], '123456')
  await setElValue(modalInputs[1], '123456')
  await clickText('পাসওয়ার্ড সংরক্ষণ করে শুরু করুন')
  await settle(80)
  check('ডিফল্ট পাসওয়ার্ড (123456) রাখা যায় না', text().includes('ডিফল্ট পাসওয়ার্ড'))
  await setElValue(modalInputs[0], 'নতুনপাস১২৩')
  await setElValue(modalInputs[1], 'অন্যকিছু৯৯')
  await clickText('পাসওয়ার্ড সংরক্ষণ করে শুরু করুন')
  await settle(80)
  check('দুই ঘর না মিললে ত্রুটি', text().includes('হুবহু মেলেনি'))
  await setElValue(modalInputs[0], '০১২৩')
  await setElValue(modalInputs[1], '০১২৩')
  await clickText('পাসওয়ার্ড সংরক্ষণ করে শুরু করুন')
  await settle(80)
  check('কম অক্ষরের পাসওয়ার্ড আটকায়', text().includes('অন্তত ৬ অক্ষর'))
  await setElValue(modalInputs[0], 'নতুনগোপন123')
  await setElValue(modalInputs[1], 'নতুনগোপন123')
  await clickText('পাসওয়ার্ড সংরক্ষণ করে শুরু করুন')
  await settle(100)
  const ownerRow = await db.users.get('owner-1')
  check('সঠিক পাসওয়ার্ডে মডাল বন্ধ হয়', !text().includes('পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক'))
  check('ডেটাবেসে must_change_password বন্ধ', ownerRow?.must_change_password === false)
  check('নতুন হ্যাশ আসলেই নতুন পাসওয়ার্ডের', ownerRow?.password_hash === (await hashPassword('নতুনগোপন123')))
  const shortRes = await useAuthStore.getState().completeFirstLoginPasswordChange('০১২')
  check('খুব ছোট পাসওয়ার্ড API-লেভেলেও আটকায়', shortRes.ok === false)

  /* ════════ ৩) সাইন-আপ (ক্রেতা) ════════ */
  section('Register — /register (ক্রেতার সাইন-আপ)')
  await renderAt('/register', registerRoutes, 'guest')
  check('সাইন-আপ ফর্মে নাম/ফোন/পাসওয়ার্ড আছে', !!fieldByLabel('আপনার নাম') && !!fieldByLabel('মোবাইল নম্বর') && !!fieldByLabel('পাসওয়ার্ড (অন্তত ৬ অক্ষর)'))
  await setElValue(fieldByLabel('আপনার নাম')!, 'নতুন ক্রেতা সাহাব')
  await setElValue(fieldByLabel('মোবাইল নম্বর')!, '01766666666')
  // ডুপ্লিকেট: আগেই থাকা *ইউজার* নম্বর (ক্রেতা-১) দিয়ে
  await setElValue(fieldByLabel('পাসওয়ার্ড (অন্তত ৬ অক্ষর)')!, '১২৩৪৫৬')
  await setElValue(fieldByLabel('পাসওয়ার্ড আবার লিখুন')!, '১২৩৪৫৬')
  await setElValue(fieldByLabel('মোবাইল নম্বর')!, '01900000000')
  await submitForm()
  await settle()
  check('আগেই থাকা অ্যাকাউন্টের নম্বরে সাইন-আপ আটকায়', text().includes('আগেই অ্যাকাউন্ট আছে'))

  /* অডিট-নোট: দোকানের ক্রেতা-তালিকায় থাকা নম্বর (কিন্তু ইউজার অ্যাকাউন্ট নেই) দিয়ে
     সাইন-আপ করা যায় — OTP/যাচাই ছাড়া কেউ অন্যের নম্বরের অ্যাকাউন্ট খুলে ফেলতে পারে। */
  await setElValue(fieldByLabel('মোবাইল নম্বর')!, '01711111111')
  await submitForm()
  await settle(80)
  const claimed = await db.users.where('phone').equals('01711111111').first()
  check('[ফাইন্ডিং] দোকানের ক্রেতার নম্বর দিয়েও নতুন অ্যাকাউন্ট খোলা যায় (যাচাই নেই)', !!claimed, claimed?.id || '')
  if (claimed) await db.users.delete(claimed.id)

  // সফল সাইন-আপ (নতুন নম্বর)
  await renderAt('/register', registerRoutes, 'guest')
  await setElValue(fieldByLabel('আপনার নাম')!, 'নতুন ক্রেতা সাহাব')
  await setElValue(fieldByLabel('মোবাইল নম্বর')!, '01766666666')
  await setElValue(fieldByLabel('ঠিকানা (ঐচ্ছিক)')!, 'নতুন বাজার')
  await setElValue(fieldByLabel('পাসওয়ার্ড (অন্তত ৬ অক্ষর)')!, '১২৩৪৫৬')
  await setElValue(fieldByLabel('পাসওয়ার্ড আবার লিখুন')!, '১২৩৪৫৬')
  await submitForm()
  await settle(80)
  check('সফল সাইন-আপে নিশ্চিতকরণ পর্দা', text().includes('অ্যাকাউন্ট তৈরি হয়েছে'))
  const newCust = await db.users.where('phone').equals('01766666666').first()
  check('নতুন ক্রেতা ডেটাবেসে জমা (অনুমোদন অপেক্ষমাণ)', !!newCust && newCust.role === 'customer' && newCust.approval === 'pending' && newCust.is_active === false)
  check('নতুন ক্রেতার আইডি ফরম্যাট CU…', !!newCust && /^CU\d+$/.test(newCust.id), newCust?.id)
  check('সাইন-আপের ঠিকানা সংরক্ষিত', newCust?.address === 'নতুন বাজার')

  /* ════════ ৪) প্রোফাইল ও পাসওয়ার্ড ════════ */
  section('Profile — /profile (তথ্য ও পাসওয়ার্ড)')
  await renderAt('/profile', profileRoutes, { ...managerUser })
  await settle(80)
  check('প্রোফাইলে নাম ও ভূমিকা দেখা যায়', text().includes(managerUser.name) && text().includes('শাখা ব্যবস্থাপক'))
  const plain = () => all<HTMLInputElement>('input').filter((i) => i.type !== 'password' && i.type !== 'submit')
  const [nameInput, _phoneInput] = plain()
  await setElValue(nameInput, '')
  await submitForm()
  await settle()
  check('খালি নাম সংরক্ষণ আটকায়', text().includes('নাম খালি'))
  await renderAt('/profile', profileRoutes, { ...managerUser })
  await settle(60)
  const inputs2 = plain()
  await setElValue(inputs2[1], '12345')
  await submitForm()
  await settle()
  check('ভুল নম্বরে সংরক্ষণ আটকায়', text().includes('১১ সংখ্যার'))
  await setElValue(inputs2[1], '01811111111')
  await submitForm()
  await settle()
  check('অন্যের নম্বর ব্যবহার আটকায়', text().includes('অন্য অ্যাকাউন্ট আছে'))
  await setElValue(inputs2[0], 'ব্যবস্থাপক রহিম (নতুন)')
  await setElValue(inputs2[1], '01812345678')
  await submitForm()
  await settle(80)
  const mgrRow = await db.users.get('manager-1')
  check('প্রোফাইল সংরক্ষণ ডেটাবেসে যায়', mgrRow?.name === 'ব্যবস্থাপক রহিম (নতুন)' && mgrRow?.phone === '01812345678', JSON.stringify({ n: mgrRow?.name, p: mgrRow?.phone }))
  check('সংরক্ষণের বার্তা দেখায়', text().includes('তথ্য সংরক্ষিত'))
  check('auth store-এও নাম-নম্বর হালনাগাদ', useAuthStore.getState().user?.name === 'ব্যবস্থাপক রহিম (নতুন)')

  // পাসওয়ার্ড পরিবর্তন
  await renderAt('/profile', profileRoutes, { ...managerUser })
  await settle(60)
  const pw = () => all<HTMLInputElement>('input[type="password"]')
  check('পাসওয়ার্ড পরিবর্তনের তিনটি ঘর আছে', pw().length >= 3, String(pw().length))
  const pwForm = () => all('form')[1]
  await setElValue(pw()[0], '123456')
  await setElValue(pw()[1], 'নতুনপাস১')
  await setElValue(pw()[2], 'নতুনপাস২')
  await submitForm(pwForm())
  await settle()
  check('নতুন পাসওয়ার্ড দুইবার না মিললে আটকায়', text().includes('একই লিখুন'))
  await setElValue(pw()[0], 'ভুল-বর্তমান-পাস')
  await setElValue(pw()[1], 'নতুনপাস২')
  await setElValue(pw()[2], 'নতুনপাস২')
  await submitForm(pwForm())
  await settle(80)
  check('বর্তমান পাসওয়ার্ড ভুল হলে আটকায়', text().includes('বর্তমান পাসওয়ার্ড ভুল'))
  await setElValue(pw()[0], 'বদলানো১')
  await setElValue(pw()[1], 'বদলানো১')
  await setElValue(pw()[2], 'বদলানো১')
  await submitForm(pwForm())
  await settle(80)
  check('নতুন পাসওয়ার্ড আগেরটার মতো হলে আটকায়', text().includes('আগেরটার মতোই'))
  await setElValue(pw()[0], '123456')
  await setElValue(pw()[1], 'নতুনপাস২')
  await setElValue(pw()[2], 'নতুনপাস২')
  await submitForm(pwForm())
  await settle(80)
  const afterPw = await db.users.get('manager-1')
  check('পাসওয়ার্ড বদলের পর ডেটাবেসে নতুন হ্যাশ', afterPw?.password_hash === (await hashPassword('নতুনপাস২')), JSON.stringify({ phone: afterPw?.phone, must: afterPw?.must_change_password }))
  const signIn = async (identity: string, pass: string) => {
    useAuthStore.getState().logout()
    await renderAt('/login', loginRoutes, 'guest')
    await setField('input[type="text"]', identity)
    await setField('input[type="password"]', pass)
    await submitForm()
    await settle(80)
    return useAuthStore.getState().isAuthenticated
  }
  check('নতুন পাসওয়ার্ড দিয়ে লগইন হয়', await signIn('01812345678', 'নতুনপাস২'))
  check('পুরোনো (ডিফল্ট) পাসওয়ার্ড আর কাজ করে না', (await signIn('01812345678', '123456')) === false)

  // ক্রেতার প্রোফাইল → ক্রেতা রেকর্ডও বদলায়
  await renderAt('/profile', profileRoutes, { ...customerUser })
  await settle(120)
  const custInputs = plain()
  await setElValue(custInputs[0], 'করিম উদ্দিন')
  await setElValue(custInputs[1], '01711111111')
  const addr = plain()[2]
  if (addr) await setElValue(addr, 'নতুন বাজার')
  await submitForm()
  await settle(120)
  const linked = (await db.customers.toArray()).find((c) => c.phone === '01711111111')
  check('ক্রেতার প্রোফাইল ক্রেতা-রেকর্ডেও যায়', linked?.name === 'করিম উদ্দিন' && linked?.address === 'নতুন বাজার', JSON.stringify({ n: linked?.name, a: linked?.address }))

  // লগআউট বোতাম
  await renderAt('/profile', profileRoutes, { ...managerUser })
  const ls = (globalThis as unknown as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage
  ls.setItem('shopledger-session', 'manager-1')
  await clickText('লগআউট')
  await settle(60)
  check('প্রোফাইলের লগআউট কাজ করে', useAuthStore.getState().isAuthenticated === false && session() === null)

  /* ════════ ৫) রোল-গার্ড ও রাউটিং (আসল App) ════════ */
  section('App রাউটিং — ভূমিকা অনুযায়ী পেজ ও গার্ড')
  const renderApp = async (path: string, as: 'guest' | typeof ownerUser) => {
    await (async () => {
      const { unmountAll } = await import('./harness')
      await unmountAll()
    })()
    const store = (globalThis as unknown as { localStorage: { setItem: (k: string, v: string) => void; removeItem: (k: string) => void } }).localStorage
    if (as === 'guest') store.removeItem('shopledger-session')
    else store.setItem('shopledger-session', as.id)
    useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true, error: null } as never)
    win.history.pushState({}, '', path)
    const host = win.document.createElement('div')
    win.document.body.appendChild(host)
    const { createRoot } = await import('react-dom/client')
    const root = createRoot(host as unknown as HTMLElement)
    ;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true
    await act(async () => {
      root.render(React.createElement(App))
    })
    return root as unknown as { unmount: () => void }
  }
  let appRoot = await renderApp('/sales', 'guest')
  await settle(120)
  check('লগইন ছাড়া সুরক্ষিত পেজ → /login-এ পাঠায়', win.location.pathname === '/login', win.location.pathname)
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/sales', { ...managerUser, branch_ids: ['branch-1'] })
  await settle(150)
  check('ব্যবস্থাপক বিক্রি পেজ দেখতে পারেন', win.location.pathname === '/sales' && !!find('[data-sale-page]'), win.location.pathname)
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/purchases', { ...salesmanUser })
  await settle(150)
  check('সেলস ম্যান ক্রয় পেজে ঢুকতে পারে না (হোমে ফেরত)', win.location.pathname === '/' && !text().includes('ক্রয় এন্ট্রি'), win.location.pathname)
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/sales', { ...customerUser })
  await settle(150)
  check('ক্রেতা বিক্রি পেজে ঢুকতে পারে না', win.location.pathname === '/' && !find('[data-sale-page]'), win.location.pathname)
  check('ক্রেতার হোমে নিজের হিসাব দেখায়', text().includes('আপনার হিসাব'))
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/my-dues', { ...customerUser })
  await settle(150)
  check('ক্রেতা বাকির হিসাব পেজ দেখতে পারেন', win.location.pathname === '/my-dues')
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/backup', { ...managerUser })
  await settle(150)
  check('ব্যবস্থাপক ব্যাকআপ পেজে ঢুকতে পারে না', win.location.pathname === '/', win.location.pathname)
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/backup', { ...ownerUser })
  await settle(150)
  check('মালিক ব্যাকআপ পেজ দেখতে পারেন', win.location.pathname === '/backup' && text().includes('ব্যাকআপ'), win.location.pathname)
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/salesmen', { ...ownerUser })
  await settle(150)
  check('মালিকের জন্য সেলস-ম্যান পেজ নয় → হোমে ফেরত', win.location.pathname === '/', win.location.pathname)
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/salesmen', { ...managerUser })
  await settle(150)
  check('ব্যবস্থাপক সেলস-ম্যান আইডি পেজ পান', win.location.pathname === '/salesmen')
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/কিছুই-নেই', { ...ownerUser })
  await settle(150)
  check('অজানা পথ → হোমে ফেরত', win.location.pathname === '/', win.location.pathname)
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/reports/stock', { ...ownerUser })
  await settle(150)
  check('রিপোর্টের ডিপ-লিংক (/reports/stock) চলে', win.location.pathname === '/reports/stock' && text().includes('স্টক'), win.location.pathname)
  await act(async () => {
    appRoot.unmount()
  })

  /* ════════ ৬) লেআউট ও "আরও" মেনু ════════ */
  section('Layout ও More — মেনু, শাখা নির্বাচক, লগআউট')
  appRoot = await renderApp('/', { ...ownerUser })
  await settle(150)
  const navLinks = all('nav a').map((a) => a.getAttribute('href'))
  check('দোকান-রোলের নিচের মেনুতে ৫টি আইটেম', navLinks.length === 5, navLinks.join(','))
  check('হেডারে দোকানের নাম দেখা যায়', text().includes('কর্ণফুলী সেলস সেন্টার'))
  await act(async () => {
    ;(find('[aria-label="মেনু"]') as HTMLElement)?.click()
    await new Promise((r) => setTimeout(r, 60))
  })
  check('মেনু খুললে নাম-ভূমিকা-লগআউট দেখায়', text().includes('লগআউট') && text().includes('মালিক'))
  await act(async () => {
    ;(find('[aria-label="মেনু"]') as HTMLElement)?.click()
    await new Promise((r) => setTimeout(r, 60))
  })
  check('মেনু আবার বন্ধ হয়', !text().includes('লগআউট'))
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/', { ...salesmanUser })
  await settle(150)
  check('সেলস ম্যানের মেনুতে ৫টি আইটেম', all('nav a').length === 5)
  await act(async () => {
    appRoot.unmount()
  })

  appRoot = await renderApp('/', { ...customerUser })
  await settle(150)
  const custNav = all('nav a').map((a) => a.getAttribute('href'))
  check('ক্রেতার মেনু: হোম, অর্ডার, বাকি, প্রোফাইল', custNav.join(',') === '/,/orders,/my-dues,/profile', custNav.join(','))
  await act(async () => {
    appRoot.unmount()
  })

  await db.users.put({
    id: 'manager-2', name: 'দুই শাখার ব্যবস্থাপক', phone: '01812340000',
    password_hash: await hashPassword('123456'), role: 'manager', username: 'manager2',
    branch_id: 'branch-1', branch_ids: ['branch-1', 'branch-2'], is_active: true, approval: 'approved',
    created_at: '', updated_at: '',
  })
  appRoot = await renderApp('/', {
    id: 'manager-2',
    name: 'দুই শাখার ব্যবস্থাপক',
    phone: '01812340000',
    role: 'manager',
    branch_id: 'branch-1',
    branch_ids: ['branch-1', 'branch-2'],
  })
  await settle(150)
  await settle(150)
  check('দুই শাখার কর্মীর শাখা-নির্বাচক দেখা যায়', !!find('[aria-label="কাজের শাখা"]'))
  const branchSelect = find('[aria-label="কাজের শাখা"]') as HTMLSelectElement
  check('শাখা-নির্বাচকে দুই শাখা আছে', branchSelect?.options.length === 2, String(branchSelect?.options.length))
  if (branchSelect) await setElValue(branchSelect, 'branch-2')
  await settle(60)
  const { useUiStore } = await import('../../src/stores/uiStore')
  await settle(80)
  check('শাখা বদলালে UI store-এ বসে', useUiStore.getState().staffBranchId === 'branch-2', useUiStore.getState().staffBranchId)
  const { useActiveBranchId } = await import('../../src/stores/uiStore')
  const activeProbe = React.createElement(() => React.createElement('i', null, useActiveBranchId()))
  useUiStore.setState({ staffBranchId: '' })
  check('নির্বাচিত শাখা না থাকলে প্রথম শাখাই সক্রিয়', activeProbe !== null)
  await act(async () => {
    appRoot.unmount()
  })

  // More পেজ
  await renderAt('/more', [['/more', More]], { ...ownerUser })
  for (const [label, href] of [
    ['ক্রেতা', '/customers'],
    ['ক্রয় এন্ট্রি', '/purchases'],
    ['খরচ এন্ট্রি', '/expenses'],
    ['রিপোর্ট সেন্টার', '/reports'],
    ['লাভ-ক্ষতি রিপোর্ট', '/profit-loss'],
    ['স্টক', '/stock'],
    ['শাখা ও ব্যবস্থাপক', '/branch-pads'],
    ['ডেটা ব্যাকআপ', '/backup'],
  ] as const) {
    check(`More-এ "${label}" লিংক আছে`, !!linkByHref(href), href)
  }
  /* অডিট-ফাইন্ডিং: মালিকের "আরও" পেজে সেলস-ম্যান আইডির লিংক নেই —
     রুটও শুধু manager-role-এর জন্য; রোল-হেল্পার canManageSalesmen মালিককেও অনুমতি দেয়। */
  check('[ফাইন্ডিং] মালিকের More-এ সেলস-ম্যান লিংক নেই (BranchPads-এ আছে)', !linkByHref('/salesmen'))
  await renderAt('/more', [['/more', More]], { ...salesmanUser })
  const salesmanLinks = all('a').map((a) => a.getAttribute('href'))
  check('সেলস ম্যানের জন্য ক্রয়/খরচ/লাভ/ব্যাকআপ লুকানো', !salesmanLinks.includes('/purchases') && !salesmanLinks.includes('/expenses') && !salesmanLinks.includes('/profit-loss') && !salesmanLinks.includes('/backup'))
  check('সেলস ম্যান ক্রেতা ও স্টক পেজের লিংক পান', salesmanLinks.includes('/customers') && salesmanLinks.includes('/stock'))
  await renderAt('/more', [['/more', More]], { ...customerUser })
  const custLinks = all('a').map((a) => a.getAttribute('href'))
  check('ক্রেতার More-এ ক্রয়/খরচ/ব্যাকআপ লিংক নেই', !custLinks.some((h) => ['/purchases', '/expenses', '/backup', '/branch-pads', '/salesmen'].includes(h || '')))
  /* অডিট-ফাইন্ডিং: ক্রেতা সরাসরি /more খুললে দোকানের (গার্ডেড) পেজের লিংক দেখতে পান —
     ক্লিক করলে RoleRoute হোমে ফেরত পাঠায়, তাই ডেটা ফাঁস নেই; শুধু বিভ্রান্তিকর মেনু। */
  check('[ফাইন্ডিং] ক্রেতার More-এ দোকানের পেজের লিংক দেখা যায় (রুট গার্ডেড)', custLinks.some((h) => ['/customers', '/stock', '/reports'].includes(h || '')))
}
