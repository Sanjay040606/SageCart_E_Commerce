'use client'
import { assets } from "@/assets/assets";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useState } from "react";
import { useAppContext } from "@/context/AppContext";
import axios from "axios";
import toast from "react-hot-toast";

const AddressMap = dynamic(() => import("@/components/AddressMap"), { ssr: false });

const AddAddress = () => {

    const { getToken, router } = useAppContext()

    const [address, setAddress] = useState({
        fullName: '',
        phoneNumber: '',
        pincode: '',
        area: '',
        city: '',
        state: '',
    })

    const handleAddressFetch = (details) => {
        setAddress(prev => ({
            ...prev,
            ...details
        }))
        toast.success("Location details fetched!")
    }

    const onSubmitHandler = async (e) => {
        e.preventDefault();
        
        // Frontend Validation
        if (!address.fullName.trim() || !address.phoneNumber.trim() || !address.pincode || !address.area.trim() || !address.city.trim() || !address.state.trim()) {
            return toast.error("Please fill in all address details.");
        }

        try {
            
            const token = await getToken()

            const { data } = await axios.post('/api/user/add-address', {address},{headers:{Authorization: `Bearer ${token}`}})

            if (data.success) {
                toast.success(data.message)
                router.push('/cart')
            } else {
                toast.error(data.message)
            }

        } catch (error) {
            toast.error(error.response?.data?.message || error.message)
        }
    }

    return (
        <>
            <Navbar />
            <div className="px-6 md:px-16 lg:px-32 py-12">
                <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-12">
                    <form onSubmit={onSubmitHandler} className="flex-1">
                        <p className="text-2xl md:text-3xl text-gray-500 mb-8">
                            Add Shipping <span className="font-semibold text-[var(--accent-strong)]">Address</span>
                        </p>
                        <div className="space-y-4">
                            <input
                                className="px-4 py-3 focus:border-[var(--accent)] transition border border-gray-500/30 rounded-xl outline-none w-full text-gray-700 bg-white"
                                type="text"
                                placeholder="Full name"
                                onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
                                value={address.fullName}
                            />
                            <input
                                className="px-4 py-3 focus:border-[var(--accent)] transition border border-gray-500/30 rounded-xl outline-none w-full text-gray-700 bg-white"
                                type="text"
                                placeholder="Phone number"
                                onChange={(e) => setAddress({ ...address, phoneNumber: e.target.value })}
                                value={address.phoneNumber}
                            />
                            <div className="flex gap-4">
                                <input
                                    className="px-4 py-3 focus:border-[var(--accent)] transition border border-gray-500/30 rounded-xl outline-none w-[40%] text-gray-700 bg-white"
                                    type="text"
                                    placeholder="Pin code"
                                    onChange={(e) => setAddress({ ...address, pincode: e.target.value })}
                                    value={address.pincode}
                                />
                                <input
                                    className="px-4 py-3 focus:border-[var(--accent)] transition border border-gray-500/30 rounded-xl outline-none w-[60%] text-gray-700 bg-white"
                                    type="text"
                                    placeholder="City/Town"
                                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                                    value={address.city}
                                />
                            </div>
                            <input
                                className="px-4 py-3 focus:border-[var(--accent)] transition border border-gray-500/30 rounded-xl outline-none w-full text-gray-700 bg-white"
                                type="text"
                                placeholder="State"
                                onChange={(e) => setAddress({ ...address, state: e.target.value })}
                                value={address.state}
                            />
                            <textarea
                                className="px-4 py-3 focus:border-[var(--accent)] transition border border-gray-500/30 rounded-xl outline-none w-full text-gray-700 bg-white resize-none"
                                rows={3}
                                placeholder="Area, Street, Landmark"
                                onChange={(e) => setAddress({ ...address, area: e.target.value })}
                                value={address.area}
                            />
                        </div>
                        <button type="submit" className="w-full mt-8 brand-button py-4 uppercase text-sm font-bold tracking-widest">
                            Save address & Continue
                        </button>
                    </form>

                    <div className="flex-1 space-y-4">
                        <p className="text-xl font-medium text-[var(--ink-900)]">Mark Location on Map</p>
                        <AddressMap onAddressFetch={handleAddressFetch} />
                        <div className="brand-surface p-4 rounded-2xl border border-[var(--line-soft)] text-sm text-[var(--ink-500)] flex items-start gap-3">
                            <span className="text-lg">📍</span>
                            <p>Pinning your location helps us ensure faster and more accurate delivery to your doorstep.</p>
                        </div>
                    </div>
                </div>
            </div>
            <Footer />
        </>
    );
};

export default AddAddress;