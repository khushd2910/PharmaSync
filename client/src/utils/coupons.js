// Client-side coupon catalog for the demo storefront — there's no coupon
// model on the backend, so this is display/discount math only, shared by
// the Cart page (where a coupon is applied) and the Checkout payment +
// confirmation steps (where that same discount needs to keep showing up).
export const COUPONS = [
  {
    code: 'PYMED25',
    description: 'Get 20% instant discount, up to ₹150',
    type: 'percent',
    value: 20,
    maxDiscount: 150,
    minOrder: 150,
  },
  {
    code: 'WELCOME50',
    description: 'Flat ₹50 off, exclusively for your very first order',
    type: 'flat',
    value: 50,
    minOrder: 0,
    firstOrderOnly: true,
  },
];

// `amount` is the cart's current discounted value (cart.totalAmount).
export const computeCouponDiscount = (coupon, amount) => {
  if (!coupon) return 0;
  if (coupon.type === 'percent') {
    return Math.min(amount * (coupon.value / 100), coupon.maxDiscount ?? Infinity);
  }
  return Math.min(coupon.value, amount);
};
