import React from 'react'
import { assets } from '../../assets/assets'
import Image from 'next/image'
import { useAppContext } from '@/context/AppContext'

const Navbar = () => {

  const { router } = useAppContext()

  return (
    <div className='sticky top-0 z-40 flex items-center justify-between border-b bg-white px-4 py-3 md:px-8'>
      <button type="button" onClick={() => router.push('/')} className="flex items-center">
        <Image
          className="w-[128px] cursor-pointer object-contain sm:w-[152px] md:w-[172px] lg:w-[184px]"
          src={assets.logo}
          alt="SageCart"
          width={184}
          height={44}
        />
      </button>
      <button className='rounded-full bg-gray-600 px-4 py-2 text-xs text-white sm:px-7 sm:text-sm'>Logout</button>
    </div>
  )
}

export default Navbar
