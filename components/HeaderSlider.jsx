import React, { useState, useEffect } from "react";
import Link from 'next/link'
import { assets } from "@/assets/assets";
import Image from "next/image";

const HeaderSlider = () => {
  const sliderData = [
    {
      id: "686a6f84fd68cfeeddf40fc5",
      title: "Experience Pure Sound - Your Perfect Headphones Awaits!",
      offer: "Limited Time Offer 30% Off",
      buttonText1: "Buy now",
      buttonText2: "Find more",
      imgSrc: assets.header_headphone_image,
    },
    {
      id: "686a7073fd68cfeeddf40fcf",
      title: "Next-Level Gaming Starts Here - Discover PlayStation 5 Today!",
      offer: "Hurry up only few lefts!",
      buttonText1: "Shop Now",
      buttonText2: "Explore Deals",
      imgSrc: assets.header_playstation_image,
    },
    {
      id: "686a711efd68cfeeddf40fd4",
      title: "Power Meets Elegance - Apple MacBook Pro is Here for you!",
      offer: "Exclusive Deal 40% Off",
      buttonText1: "Order Now",
      buttonText2: "Learn More",
      imgSrc: assets.header_macbook_image,
    },
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % sliderData.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [sliderData.length]);

  const handleSlideChange = (index) => {
    setCurrentSlide(index);
  };

  return (
    <div className="overflow-hidden relative w-full">
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{
          transform: `translateX(-${currentSlide * 100}%)`,
        }}
      >
        {sliderData.map((slide, index) => (
          <div
            key={slide.id}
            className="flex flex-col-reverse md:flex-row items-center justify-between bg-[linear-gradient(135deg,#f7f4ec_0%,#e8eee3_100%)] border border-[var(--line-soft)] py-8 md:px-14 px-5 mt-6 rounded-[2rem] min-w-full shadow-[0_18px_40px_rgba(77,87,74,0.08)]"
          >
            <div className="md:pl-8 mt-10 md:mt-0">
              <p className="md:text-base text-[var(--accent-strong)] pb-1 uppercase tracking-[0.2em] text-xs md:text-sm">{slide.offer}</p>
              <h1 className="max-w-lg md:text-[40px] md:leading-[48px] text-2xl font-semibold text-[var(--ink-900)]">
                {slide.title}
              </h1>
              <div className="flex items-center mt-4 md:mt-6 ">
                <Link href={"product/" + slide.id} className="brand-button md:px-10 px-7 md:py-2.5 py-2 rounded-full font-medium">
                  {slide.buttonText1}
                </Link>
                <Link href="/all-products" className="group flex items-center gap-2 px-6 py-2.5 font-medium text-[var(--ink-700)]">
                  {slide.buttonText2}
                  <Image className="group-hover:translate-x-1 transition" src={assets.arrow_icon} alt="arrow_icon" />
                </Link>
              </div>
            </div>
            <div className="flex items-center flex-1 justify-center">
              <Image
                className="md:w-72 w-48"
                src={slide.imgSrc}
                alt={`Slide ${index + 1}`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-2 mt-8">
        {sliderData.map((_, index) => (
          <div
            key={index}
            onClick={() => handleSlideChange(index)}
            className={`h-2 w-2 rounded-full cursor-pointer ${
              currentSlide === index ? "bg-[var(--accent)]" : "bg-[var(--line-soft)]"
            }`}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default HeaderSlider;
