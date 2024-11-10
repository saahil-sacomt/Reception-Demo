// utils.js
const calculateAmounts = (productEntries, advanceDetails, redeemPoints, loyaltyPoints) => {
    const totalAmount = productEntries.reduce((acc, product) => {
        const price = parseFloat(product.price) || 0;
        const quantity = parseInt(product.quantity) || 0;
        return acc + price * quantity;
    }, 0);

    const remainingBalance = totalAmount - (parseFloat(advanceDetails) || 0);
    const discount = redeemPoints ? Math.min(loyaltyPoints, remainingBalance) : 0;
    const finalAmount = Math.max(remainingBalance - discount, 0);

    return { totalAmount, remainingBalance, discount, finalAmount };
};

const calculateLoyaltyPoints = (totalAmount, loyaltyPoints, redeemPoints, remainingBalance) => {
    let pointsToRedeem = 0;
    if (redeemPoints) {
        pointsToRedeem = Math.min(loyaltyPoints, remainingBalance);
    }
    let updatedPoints = loyaltyPoints - pointsToRedeem;
    const pointsToAdd = Math.min(Math.floor(totalAmount * 0.1), 500);
    updatedPoints += pointsToAdd;
    return { updatedPoints, pointsToRedeem };
};
