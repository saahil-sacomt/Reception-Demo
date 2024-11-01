// client/src/utils/watiApi.js
import axios from 'axios';

export async function sendCardViaWhatsApp(phoneNumber, cardDataUrl) {
    const apiKey = import.meta.env.VITE_WATI_API_KEY;
    const watiApiUrl = `https://app-server.wati.io/api/v1/sendSessionFile/91${phoneNumber}`; // Removed "+" and used "91"

    // Convert Data URL to Blob for sending
    const response = await fetch(cardDataUrl);
    const cardImageBlob = await response.blob();

    const formData = new FormData();
    formData.append('file', cardImageBlob, 'privilege_card.png');

    try {
        const response = await axios.post(watiApiUrl, formData, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'multipart/form-data',
            },
        });
        console.log('Card sent successfully:', response.data);
    } catch (error) {
        console.error('Error sending card:', error.response?.data || error.message);
    }
}
