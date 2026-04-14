import React, { useState } from "react";
import toast from 'react-hot-toast';
import { GAME_PROMO_CODES } from "@/lib/promoCodes";
import { useAppContext } from "@/context/AppContext";
import axios from "axios";

const NewsLetter = () => {
  const { user, getToken, fetchUserData } = useAppContext();
  const [isPlaying, setIsPlaying] = useState(false);
  const [result, setResult] = useState(null);

  const coupons = [
    { code: 'SAVE10', discount: GAME_PROMO_CODES.SAVE10.label, chance: 5 },
    { code: 'SAVE2', discount: GAME_PROMO_CODES.SAVE2.label, chance: 25 },
    { code: 'SAVE1', discount: GAME_PROMO_CODES.SAVE1.label, chance: 30 },
    { code: 'FREESHIP', discount: GAME_PROMO_CODES.FREESHIP.label, chance: 40 }
  ];

  const playGame = async () => {
    if (!user) {
      toast.error('Please log in to play and claim a coupon.');
      return;
    }

    setIsPlaying(true);
    setResult(null);

    // Simulate spinning animation
    setTimeout(async () => {
      const random = Math.random() * 100;
      let cumulativeChance = 0;
      let wonCoupon = null;

      for (const coupon of coupons) {
        cumulativeChance += coupon.chance;
        if (random <= cumulativeChance) {
          wonCoupon = coupon;
          break;
        }
      }

      try {
        const token = await getToken();
        // API now handles weighted selection, just request without a specific code
        const { data } = await axios.post('/api/game-coupon/claim', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!data.success) {
          throw new Error(data.message);
        }

        const issuedCoupon = {
          ...wonCoupon,
          code: data.coupon.code,
          discount: data.coupon.rewardLabel
        };

        setResult(issuedCoupon);
        await fetchUserData();
        toast.success(`Congratulations! You won: ${issuedCoupon.discount} (${issuedCoupon.code})`);
      } catch (error) {
        setResult(null);
        toast.error(error?.response?.data?.message || error.message);
      } finally {
        setIsPlaying(false);
      }
    }, 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center text-center space-y-4 pt-8 pb-14 border">
      <h1 className="md:text-4xl text-2xl font-medium">
        🎰 Coupon Game 🎰
      </h1>
      <p className="md:text-lg text-gray-500 pb-4">
        Spin the wheel and win amazing coupons!
      </p>

      {!isPlaying && !result && (
        <button
          onClick={playGame}
          className="brand-button px-8 py-3 rounded-lg font-medium"
        >
          🎯 Play Now
        </button>
      )}

      {isPlaying && (
        <div className="space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-[var(--accent)] border-gray-200 mx-auto"></div>
          <p className="text-[var(--accent-strong)] font-medium">Spinning the wheel...</p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className={`p-6 rounded-lg border-2 ${result.code !== 'TRYAGAIN' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
            <h3 className="text-xl font-bold mb-2">
              {result.code !== 'TRYAGAIN' ? '🎉 Congratulations!' : '😞 Better Luck Next Time'}
            </h3>
            <p className="text-lg">
              You won: <span className="font-bold text-[var(--accent-strong)]">{result.discount}</span>
            </p>
            {result.code !== 'TRYAGAIN' && (
              <p className="text-sm text-gray-600 mt-2">
                Coupon Code: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{result.code}</span>
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setResult(null);
              playGame();
            }}
            className="brand-button px-6 py-2 rounded-lg font-medium"
          >
            🎲 Play Again
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Spin the wheel and win amazing coupons!
      </p>
    </div>
  );
};

export default NewsLetter;
