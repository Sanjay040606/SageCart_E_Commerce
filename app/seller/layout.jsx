'use client'
import Navbar from '@/components/seller/Navbar'
import Sidebar from '@/components/seller/Sidebar'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const sellerNavItems = [
  { name: 'Add Product', path: '/seller' },
  { name: 'Product List', path: '/seller/product-list' },
  { name: 'Orders', path: '/seller/orders' }
]

const Layout = ({ children }) => {
  const pathname = usePathname()

  return (
    <div className="min-h-screen w-full">
      <Navbar />
      <div className="border-b border-gray-200 bg-white/80 px-3 py-3 md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sellerNavItems.map((item) => {
            const isActive = pathname === item.path

            return (
              <Link
                href={item.path}
                key={item.name}
                className={`shrink-0 rounded-full border px-4 py-2 text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--ink-900)]'
                    : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {item.name}
              </Link>
            )
          })}
        </div>
      </div>
      <div className='flex w-full flex-col md:flex-row'>
        <div className="hidden md:block md:shrink-0">
          <Sidebar />
        </div>
        <main className="flex-1 min-w-0 w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
