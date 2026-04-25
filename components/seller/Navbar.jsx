import React from 'react'
import { assets } from '../../assets/assets'
import Image from 'next/image'
import { useAppContext } from '@/context/AppContext'

const Navbar = () => {

  const { router } = useAppContext()

  return (
    <div className='sticky top-0 z-40 flex items-center justify-between border-b bg-white px-4 py-3 md:px-8'>
      <Image onClick={()=>router.push('/')} className='w-24 cursor-pointer object-contain sm:w-28 lg:w-32' src={assets.logo} alt="" />
      <button className='rounded-full bg-gray-600 px-4 py-2 text-xs text-white sm:px-7 sm:text-sm'>Logout</button>
    </div>
  )
}

export default Navbar
