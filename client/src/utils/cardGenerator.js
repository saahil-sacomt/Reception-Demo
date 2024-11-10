// client/src/utils/cardGenerator.js
import JsBarcode from 'jsbarcode';
import { createCanvas, loadImage } from 'canvas';
import cardTemplate from '../assets/Sreenetra Final Proposal-2_page-0001.jpg';
import logo from '../assets/SreenethraLogoWhite.png';

// Generate barcode as a high-resolution image
async function generateBarcode(pcNumber) {
    const barcodeCanvas = createCanvas(300, 100); // Larger canvas for higher resolution
    JsBarcode(barcodeCanvas, pcNumber, { format: 'CODE128', width: 2, height: 50 });
    return barcodeCanvas.toDataURL(); // Return Data URL for embedding in the main canvas
}

export async function generateCardWithBarcode(pcNumber, name) { // Added `name` as a parameter
    // Load card template and logo images
    const cardImage = await loadImage(cardTemplate);
    const logoImage = await loadImage(logo);

    // Create main canvas with card template dimensions
    const canvas = createCanvas(cardImage.width, cardImage.height);
    const ctx = canvas.getContext('2d');

    // Draw card template
    ctx.drawImage(cardImage, 0, 0);

    // Draw logo on top-left corner (position and size can be adjusted as needed)
    const logoWidth = 2000;
    const logoHeight = 500;
    ctx.drawImage(logoImage, 450, 450, logoWidth, logoHeight);
    
    // Draw customer name in the center of the card
    ctx.font = 'bold 350px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(name, canvas.width / 2, canvas.height / 2); // Centered text

    // Generate and load the barcode image, then draw it on bottom-right
    const barcodeDataUrl = await generateBarcode(pcNumber);
    const barcodeImage = await loadImage(barcodeDataUrl);
    const barcodeWidth = 2500;
    const barcodeHeight = 1000;
    ctx.drawImage(barcodeImage, canvas.width - barcodeWidth - 20, canvas.height - barcodeHeight - 20, barcodeWidth, barcodeHeight);

    // Resize if necessary (compressing the image to reduce file size)
    const finalCanvas = createCanvas(canvas.width / 2, canvas.height / 2);
    const finalCtx = finalCanvas.getContext('2d');
    finalCtx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);

    // Return as Data URL (adjusts for browser compatibility)
    return finalCanvas.toDataURL('image/png');
}
