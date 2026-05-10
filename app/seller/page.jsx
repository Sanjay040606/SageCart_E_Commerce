'use client'
import React, { useMemo, useState } from "react";
import { assets } from "@/assets/assets";
import Image from "next/image";
import { useAppContext } from "@/context/AppContext";
import axios from "axios";
import toast from "react-hot-toast";
import { convertINRToUSD } from "@/lib/currencyUtils";
import { getCategoryVariantConfig, inferCategoryVariantMode, parseDelimitedValues } from "@/lib/productVariantRules";

const AddProduct = () => {
  const { getToken, fetchProductData } = useAppContext()

  const [files, setFiles] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Earphone');
  const [price, setPrice] = useState('');
  const [offerPrice, setOfferPrice] = useState('');
  const [stock, setStock] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [colorValues, setColorValues] = useState('');
  const [variantValues, setVariantValues] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const categoryOptions = useMemo(() => ([
    "Clothing",
    "Topwear",
    "Bottomwear",
    "Winter Wear",
    "Earphone",
    "Apparel",
    "Fashion",
    "Headphone",
    "Watch",
    "Smartphone",
    "Mobile",
    "Phone",
    "Laptop",
    "Tablet",
    "Computer",
    "Desktop",
    "PC",
    "Camera",
    "Accessories",
    "Phone & Tablet Accessories",
    "Dress",
    "Shirt",
    "T-Shirt",
    "Pant",
    "Jeans",
    "Shoes",
    "Footwear",
    "Skirt",
    "Kurti",
    "Saree",
    "Bags",
    "Kurta Sets",
    "Ethnic Wear",
    "Dupatta",
    "Bodysuit",
    "Dungarees",
    "Innerwear",
    "Flats",
    "Beauty",
    "Skincare",
    "Makeup"
  ]), []);

  const variantConfig = useMemo(() => getCategoryVariantConfig(category), [category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsUploading(true);

    const parsedVariantValues = parseDelimitedValues(variantValues);
    const parsedColorValues = parseDelimitedValues(colorValues);
    const variantMode = inferCategoryVariantMode(category);

    const formData = new FormData()

    formData.append('name', name)
    formData.append('description', description)
    formData.append('category', category)
    formData.append('price', convertINRToUSD(price))
    formData.append('offerPrice', convertINRToUSD(offerPrice))
    formData.append('stock', stock || '0')
    formData.append('promoCode', promoCode)
    formData.append('variantMode', variantMode)
    formData.append('colorValues', parsedColorValues.join(', '))
    formData.append('variantValues', parsedVariantValues.join(', '))

    for (let index = 0; index < files.length; index++) {
      formData.append('images', files[index])
    }

    try {
      const token = await getToken()

      const { data } = await axios.post('/api/product/add', formData, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (data.success) {
        toast.success(data.message)
        await fetchProductData({ bustCache: true, silent: true });
        setFiles([]);
        setName('');
        setDescription('');
        setCategory('Earphone');
        setPrice('');
        setOfferPrice('');
        setPromoCode('');
        setColorValues('');
        setVariantValues('');
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex-1 min-h-screen w-full min-w-0 overflow-x-hidden flex flex-col justify-between">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-4xl space-y-5 p-4 md:rounded-2xl md:border md:border-gray-500/20 md:bg-white md:p-10 md:shadow-sm"
      >
        <div>
          <p className="text-base font-medium">Product Image</p>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <label key={index} htmlFor={`image${index}`} className="block">
                <input
                  onChange={(e) => {
                    const updatedFiles = [...files];
                    updatedFiles[index] = e.target.files[0];
                    setFiles(updatedFiles);
                  }}
                  type="file"
                  id={`image${index}`}
                  hidden
                />
                <Image
                  className="h-28 w-full cursor-pointer rounded-xl border border-dashed border-gray-300 bg-white p-2 object-contain sm:h-32"
                  src={files[index] ? URL.createObjectURL(files[index]) : assets.upload_area}
                  alt=""
                  width={100}
                  height={100}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full max-w-none">
          <label className="text-base font-medium" htmlFor="product-name">
            Product Name
          </label>
          <input
            id="product-name"
            type="text"
            placeholder="Type here"
            className="w-full rounded border border-gray-500/40 bg-white px-3 py-2 outline-none md:py-2.5"
            onChange={(e) => setName(e.target.value)}
            value={name}
            required
          />
        </div>

        <div className="flex flex-col gap-1 w-full max-w-none">
          <label className="text-base font-medium" htmlFor="product-description">
            Product Description
          </label>
          <textarea
            id="product-description"
            rows={4}
            className="w-full resize-none rounded border border-gray-500/40 bg-white px-3 py-2 outline-none md:py-2.5"
            placeholder="Type here"
            onChange={(e) => setDescription(e.target.value)}
            value={description}
            required
          ></textarea>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1 w-full min-w-0">
            <label className="text-base font-medium" htmlFor="category">
              Category
            </label>
            <input
              id="category"
              list="product-category-options"
              className="w-full rounded border border-gray-500/40 bg-white px-3 py-2 outline-none md:py-2.5"
              onChange={(e) => setCategory(e.target.value)}
              value={category}
              placeholder="Type or choose a category"
            />
            <datalist id="product-category-options">
              {categoryOptions.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1 w-full min-w-0">
            <label className="text-base font-medium" htmlFor="product-price">
              Product Price (â‚¹)
            </label>
            <input
              id="product-price"
              type="number"
              placeholder="0"
              className="w-full rounded border border-gray-500/40 bg-white px-3 py-2 outline-none md:py-2.5"
              onChange={(e) => setPrice(e.target.value)}
              value={price}
              required
            />
          </div>

          <div className="flex flex-col gap-1 w-full min-w-0">
            <label className="text-base font-medium" htmlFor="offer-price">
              Offer Price (â‚¹)
            </label>
            <input
              id="offer-price"
              type="number"
              placeholder="0"
              className="w-full rounded border border-gray-500/40 bg-white px-3 py-2 outline-none md:py-2.5"
              onChange={(e) => setOfferPrice(e.target.value)}
              value={offerPrice}
              required
            />
          </div>

          <div className="flex flex-col gap-1 w-full min-w-0">
            <label className="text-base font-medium" htmlFor="stock-count">
              Stock Quantity
            </label>
            <input
              id="stock-count"
              type="number"
              min="0"
              placeholder="0"
              className="w-full rounded border border-gray-500/40 bg-white px-3 py-2 outline-none md:py-2.5"
              onChange={(e) => setStock(e.target.value)}
              value={stock}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full max-w-none">
          <label className="text-base font-medium" htmlFor="product-promo-code">
            Product Promo Code <span className="text-gray-500 text-sm">(Optional)</span>
          </label>
          <input
            id="product-promo-code"
            type="text"
            placeholder="e.g. SPECIAL10 (leave empty if no coupon)"
            className="w-full rounded border border-gray-500/40 bg-white px-3 py-2 outline-none md:py-2.5"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1 w-full max-w-none">
          {variantConfig.mode === "storage" && (
            <div className="mb-4 flex flex-col gap-1">
              <label className="text-base font-medium" htmlFor="product-colors">
                Available Colors <span className="text-gray-500 text-sm">(Optional)</span>
              </label>
              <input
                id="product-colors"
                type="text"
                placeholder="Black, Blue, White"
                className="w-full rounded border border-gray-500/40 bg-white px-3 py-2 outline-none md:py-2.5"
                value={colorValues}
                onChange={(e) => setColorValues(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Enter each color separated by commas or new lines. Match the uploaded images to the same order.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-base font-medium" htmlFor="product-variants">
              {variantConfig.label} <span className="text-gray-500 text-sm">(Optional)</span>
            </label>
            <input
              id="product-variants"
              type="text"
              placeholder={variantConfig.placeholder}
              className="w-full rounded border border-gray-500/40 bg-white px-3 py-2 outline-none md:py-2.5"
              value={variantValues}
              onChange={(e) => setVariantValues(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              {variantConfig.helperText} Upload the main image first, then the option images in the same order.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isUploading}
          className="brand-button w-full rounded px-8 py-3 font-medium disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isUploading ? 'Uploading Product...' : 'ADD'}
        </button>
      </form>
    </div>
  );
};

export default AddProduct;
