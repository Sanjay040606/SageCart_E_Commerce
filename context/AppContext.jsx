'use client'
import { convertUSDToINR } from "@/lib/currencyUtils";
import { useAuth, useUser } from "@clerk/nextjs";
import axios from "axios";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    buildCartKey,
    getCartItemUnitPriceInr,
    getCartProductQuantity,
    parseCartKey
} from "@/lib/cartUtils";

const PRODUCT_CACHE_KEY = "sagecart:products-cache:v1";

const readCachedProducts = () => {
    if (typeof window === "undefined") return [];

    try {
        const cached = window.localStorage.getItem(PRODUCT_CACHE_KEY);
        if (!cached) return [];

        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

const writeCachedProducts = (products = []) => {
    if (typeof window === "undefined") return;

    try {
        window.localStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify(products));
    } catch {
        // Ignore storage quota or privacy mode errors.
    }
};

export const AppContext = createContext();

export const useAppContext = () => {
    return useContext(AppContext)
}

export const AppContextProvider = (props) => {

    const currency = process.env.NEXT_PUBLIC_CURRENCY
    const router = useRouter()
    const pathname = usePathname()
    const currentPathname = pathname || ""

    const { user } = useUser()
    const { getToken } = useAuth()

    const [products, setProducts] = useState([])
    const [productsLoading, setProductsLoading] = useState(true)
    const [userData, setUserData] = useState(false)
    const [isSeller, setIsSeller] = useState(false)
    const [cartItems, setCartItems] = useState({})
    const [wishlistItems, setWishlistItems] = useState([])

    const [chatMessages, setChatMessages] = useState(null)
    const [isChatOpen, setIsChatOpen] = useState(false)

    useEffect(() => {
        const cachedProducts = readCachedProducts();
        if (cachedProducts.length > 0) {
            setProducts(cachedProducts);
            setProductsLoading(false);
        }
    }, []);

    const shouldLoadProductCatalog =
      currentPathname === "/" ||
      currentPathname.startsWith("/all-products") ||
      currentPathname.startsWith("/product") ||
      currentPathname.startsWith("/cart") ||
      currentPathname.startsWith("/wishlist");

    const fetchProductData = useCallback(async ({ signal, bustCache = false, silent = false } = {}) => {
        try {
            const requestUrl = bustCache
                ? `/api/product/list?ts=${Date.now()}`
                : '/api/product/list';
            const { data } = await axios.get(requestUrl, { signal })

            if (data.success) {
                setProducts(data.products)
                writeCachedProducts(data.products)
            } else {
                if (!silent) {
                    toast.error(data.message)
                }
            }
        } catch (error) {
            if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
                return;
            }

            if (!silent) {
                toast.error(error.message)
            }
        } finally {
            setProductsLoading(false)
        }
    }, [])

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
                setWishlistItems(data.user.wishlistItems || [])
            } else{
                toast.error(data.message)
            }

        } catch (error) {
            toast.error(error.message)
        }
    }

    const addToCart = async (itemId, variantLabel = '', variantMeta = {}) => {
        const cartKey = buildCartKey(itemId, variantLabel, variantMeta);
        let cartData = structuredClone(cartItems);
        const product = products.find((item) => item._id === itemId);
        const currentQty = cartData[cartKey] ?? 0;
        const productQtyInCart = getCartProductQuantity(cartData, itemId);
        const remainingStock = product ? Math.max(0, product.stock - productQtyInCart) : Infinity;

        if (product && remainingStock <= 0) {
            toast.error(`Only ${product.stock} items are available in stock.`)
            return;
        }

        if (product && currentQty >= remainingStock) {
            toast.error(`Only ${product.stock} items are available in stock.`)
            return;
        }

        if (cartData[cartKey]) {
            cartData[cartKey] += 1;
        }
        else {
            cartData[cartKey] = 1;
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

    const updateCartQuantity = async (cartKey, quantity) => {

        let cartData = structuredClone(cartItems);
        const { productId } = parseCartKey(cartKey);
        const product = products.find((item) => item._id === productId);
        const safeQuantity = Number.isNaN(Number(quantity)) ? 0 : Number(quantity);
        const otherQuantities = getCartProductQuantity(cartData, productId, cartKey);
        const maxQuantity = product ? Math.max(0, product.stock - otherQuantities) : Infinity;

        if (safeQuantity > maxQuantity) {
            toast.error(`Only ${maxQuantity} items are available in stock.`)
        }

        const finalQuantity = Math.min(Math.max(safeQuantity, 0), maxQuantity);

        if (finalQuantity === 0) {
            delete cartData[cartKey];
        } else {
            cartData[cartKey] = finalQuantity;
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
        for (const cartKey in cartItems) {
            const { productId, variantPriceInr } = parseCartKey(cartKey);
            let itemInfo = products.find((product) => product._id === productId);
            if (itemInfo && cartItems[cartKey] > 0) {
                totalAmount += getCartItemUnitPriceInr(itemInfo, { variantPriceInr }) * cartItems[cartKey];
            }
        }

        return Math.floor(totalAmount * 100) / 100;
    }

    const toggleWishlist = async (productId) => {
        if (!user) {
            toast.error("Please login to use wishlist");
            return;
        }

        let currentWishlist = [...wishlistItems];
        if (currentWishlist.includes(productId)) {
            currentWishlist = currentWishlist.filter(id => id !== productId);
            toast.success("Removed from wishlist");
        } else {
            currentWishlist.push(productId);
            toast.success("Added to wishlist");
        }
        setWishlistItems(currentWishlist);

        try {
            const token = await getToken()
            await axios.post('/api/user/wishlist/update', { productId }, { headers: { Authorization: `Bearer ${token}` } })
        } catch (error) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        if (!shouldLoadProductCatalog) {
            setProductsLoading(false)
            return undefined
        }

        if (products.length > 0) {
            setProductsLoading(false)
            return undefined
        }

        const controller = new AbortController()
        setProductsLoading(true)
        fetchProductData({ signal: controller.signal })

        return () => {
            controller.abort()
        }
    }, [fetchProductData, products.length, shouldLoadProductCatalog])

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
        isChatOpen, setIsChatOpen,
        wishlistItems, setWishlistItems, toggleWishlist
    }

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    )
}
