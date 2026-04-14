'use client'
import { productsDummyData, userDummyData } from "@/assets/assets";
import { convertUSDToINR } from "@/lib/currencyUtils";
import { useAuth, useUser } from "@clerk/nextjs";
import axios from "axios";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";

export const AppContext = createContext();

export const useAppContext = () => {
    return useContext(AppContext)
}

export const AppContextProvider = (props) => {

    const currency = process.env.NEXT_PUBLIC_CURRENCY
    const router = useRouter()

    const { user } = useUser()
    const { getToken } = useAuth()

    const [products, setProducts] = useState([])
    const [productsLoading, setProductsLoading] = useState(true)
    const [userData, setUserData] = useState(false)
    const [isSeller, setIsSeller] = useState(false)
    const [cartItems, setCartItems] = useState({})

    const [chatMessages, setChatMessages] = useState(null)
    const [isChatOpen, setIsChatOpen] = useState(false)

    const fetchProductData = async () => {
        
        try {
            
            const {data} = await axios.get('/api/product/list')

            if(data.success){
                setProducts(data.products)
                setProductsLoading(false)
            } else {
                toast.error(data.message)
                setProductsLoading(false)
            }

        } catch (error) {
            toast.error(error.message)
            setProductsLoading(false)
        }

    }

    const fetchUserData = async () => {
        try {
            
            if (user.publicMetadata.role === 'seller') {
                setIsSeller(true)
            }

            const token = await getToken()

            const {data} = await axios.get('/api/user/data' , { headers: { Authorization: `Bearer ${token}`} })

            if (data.success) {
                setUserData(data.user)
                setCartItems(data.user.cartItems)
            } else{
                toast.error(data.message)
            }

        } catch (error) {
            toast.error(error.message)
        }
    }

    const addToCart = async (itemId) => {

        let cartData = structuredClone(cartItems);
        const currentQty = cartData[itemId] ?? 0;
        const product = products.find((item) => item._id === itemId);

        if (product && currentQty >= product.stock) {
            toast.error(`Only ${product.stock} items are available in stock.`)
            return;
        }

        if (cartData[itemId]) {
            cartData[itemId] += 1;
        }
        else {
            cartData[itemId] = 1;
        }
        setCartItems(cartData);

        if (user) {
            try {
                const token = await getToken()
                await axios.post('/api/cart/update', {cartData}, {headers: {Authorization: `Bearer ${token}`}})
                toast.success('Item added to cart')
            } catch (error) {
                toast.error(error.message)
            }
        } else {
            toast.error("Not logged in")
        }

    }

    const updateCartQuantity = async (itemId, quantity) => {

        let cartData = structuredClone(cartItems);
        const product = products.find((item) => item._id === itemId);
        const safeQuantity = Number.isNaN(Number(quantity)) ? 0 : Number(quantity);
        const maxQuantity = product ? product.stock : Infinity;

        if (safeQuantity > maxQuantity) {
            toast.error(`Only ${maxQuantity} items are available in stock.`)
        }

        const finalQuantity = Math.min(Math.max(safeQuantity, 0), maxQuantity);

        if (finalQuantity === 0) {
            delete cartData[itemId];
        } else {
            cartData[itemId] = finalQuantity;
        }
        setCartItems(cartData)
        if (user) {
            try {
                const token = await getToken()
                await axios.post('/api/cart/update', {cartData}, {headers: {Authorization: `Bearer ${token}`}})
                toast.success('Cart Updated')
            } catch (error) {
                toast.error(error.message)
            }
        }
    }

    const getCartCount = () => {
        let totalCount = 0;
        for (const items in cartItems) {
            if (cartItems[items] > 0) {
                totalCount += cartItems[items];
            }
        }
        return totalCount;
    }

    const getCartAmount = () => {
        let totalAmount = 0;
        for (const items in cartItems) {
            let itemInfo = products.find((product) => product._id === items);
            if (cartItems[items] > 0) {
                totalAmount += itemInfo.offerPrice * cartItems[items];
            }
        }

        // Convert total USD amount into INR before returning
        const inrAmount = convertUSDToINR(Math.floor(totalAmount * 100) / 100);
        return Math.floor(inrAmount * 100) / 100;
    }

    useEffect(() => {
        fetchProductData()
    }, [])

    useEffect(() => {
        if (user) {
            fetchUserData()
        }
    }, [user])

    const value = {
        user, getToken,
        currency, router,
        isSeller, setIsSeller,
        userData, fetchUserData,
        products, productsLoading, fetchProductData,
        cartItems, setCartItems,
        addToCart, updateCartQuantity,
        getCartCount, getCartAmount,
        chatMessages, setChatMessages,
        isChatOpen, setIsChatOpen
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )
}