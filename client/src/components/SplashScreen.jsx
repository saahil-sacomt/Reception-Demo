// client/src/components/SplashScreen.jsx
import { useEffect } from 'react';
import topLogo from '../assets/sreenethraenglishisolated.png';
import bottomLogo from '../assets/Retrato Black PNG.png';

const SplashScreen = ({ onAnimationEnd }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onAnimationEnd();
        }, 4000);

        return () => clearTimeout(timer);
    }, [onAnimationEnd]);

    return (
        <div className="flex items-center justify-center h-screen w-screen fixed top-0 left-0 z-50 bg-transparent">
            <div className="flex flex-col items-center space-y-8 animate-disintegrate">
            <div className="flex items-center space-x-10">
                <img src={topLogo} alt="Top Logo" className="h-24 w-auto" />
                <div className="text-6xl font-bold text-gray-500">X</div>
                <img src={bottomLogo} alt="Bottom Logo" className="h-24 w-auto" />
            </div>
            </div>
        </div>
    );
};

export default SplashScreen;
