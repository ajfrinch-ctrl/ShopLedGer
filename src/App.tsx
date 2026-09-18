import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={
            <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
              <h1 className="text-3xl font-bold text-primary-700 mb-2">ShopLedGer</h1>
              <p className="text-gray-600 mb-6">অফলাইন-ফার্স্ট দোকান হিসাব ব্যবস্থা</p>
              <div className="card max-w-md w-full space-y-3">
                <p className="text-sm text-gray-500">প্রজেক্ট সফলভাবে সেটআপ হয়েছে।</p>
                <p className="text-sm text-gray-500">পরবর্তী ধাপে লগইন, ড্যাশবোর্ড ও এন্ট্রি স্ক্রিন যোগ করা হবে।</p>
              </div>
            </div>
          } />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
